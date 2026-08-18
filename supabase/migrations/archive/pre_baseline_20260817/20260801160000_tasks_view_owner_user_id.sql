-- Expose tasks.owner_user_id on tasks_view for card “From” (assigner).
-- Auto-set owner_user_id = auth.uid() on insert when omitted (all create paths).
-- View shape matches live Filla-v2 (space_ids / assigned_team_ids / image_url).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'owner_user_id'
  ) THEN
    ALTER TABLE public.tasks
      ADD COLUMN owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tasks_set_owner_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_user_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.owner_user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_set_owner_user_id ON public.tasks;
CREATE TRIGGER trg_tasks_set_owner_user_id
  BEFORE INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tasks_set_owner_user_id();

COMMENT ON FUNCTION public.tasks_set_owner_user_id() IS
  'Defaults tasks.owner_user_id to auth.uid() so card From/assigner meta works for every create path.';

DROP VIEW IF EXISTS public.tasks_view CASCADE;

CREATE VIEW public.tasks_view
WITH (security_invoker = true)
AS
SELECT
  t.id,
  t.org_id,
  t.title,
  t.description,
  t.status,
  t.priority,
  t.due_at AS due_date,
  COALESCE(t.milestones, '[]'::jsonb) AS milestones,
  t.assigned_user_id,
  t.owner_user_id,
  t.property_id,
  t.created_at,
  t.updated_at,
  p.nickname AS property_name,
  p.address AS property_address,
  p.thumbnail_url AS property_thumbnail_url,
  COALESCE((
    SELECT json_agg(DISTINCT jsonb_build_object('id', sp_1.id, 'name', sp_1.name))
    FROM unnest(COALESCE(t.space_ids, ARRAY[]::uuid[])) sid(space_id)
    JOIN spaces sp_1 ON sp_1.id = sid.space_id AND sp_1.org_id = t.org_id
  ), '[]'::json) AS spaces,
  COALESCE(
    json_agg(DISTINCT jsonb_build_object('id', th.id, 'name', th.name, 'color', th.color, 'icon', th.icon))
      FILTER (WHERE th.id IS NOT NULL),
    '[]'::json
  ) AS themes,
  COALESCE((
    SELECT json_agg(DISTINCT jsonb_build_object('id', tm.id, 'name', tm.name, 'color', tm.color, 'icon', tm.icon))
    FROM unnest(COALESCE(t.assigned_team_ids, ARRAY[]::uuid[])) tid(team_id)
    JOIN teams tm ON tm.id = tid.team_id
  ), '[]'::json) AS teams,
  CASE
    WHEN t.image_url IS NOT NULL THEN json_build_array(jsonb_build_object('file_url', t.image_url))
    ELSE '[]'::json
  END AS images
FROM tasks t
LEFT JOIN properties p ON p.id = t.property_id AND p.org_id = t.org_id
LEFT JOIN task_spaces ts ON ts.task_id = t.id
LEFT JOIN spaces sp ON sp.id = ts.space_id AND sp.org_id = t.org_id
LEFT JOIN task_themes tt ON tt.task_id = t.id
LEFT JOIN themes th ON th.id = tt.theme_id AND th.org_id = t.org_id
GROUP BY
  t.id, t.org_id, t.title, t.description, t.status, t.priority, t.due_at,
  t.assigned_user_id, t.owner_user_id, t.property_id, t.created_at, t.updated_at,
  t.space_ids, t.assigned_team_ids, t.image_url, t.milestones,
  p.nickname, p.address, p.thumbnail_url;

GRANT SELECT ON public.tasks_view TO anon, authenticated;

COMMENT ON VIEW public.tasks_view IS
  'Tasks with relationships. owner_user_id is the assigner (From); assigned_user_id is the assignee (For).';

NOTIFY pgrst, 'reload schema';
