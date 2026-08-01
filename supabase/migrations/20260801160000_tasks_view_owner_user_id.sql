-- Expose existing tasks.owner_user_id on tasks_view for card “From” (assigner).
-- Does not invent a column — owner_user_id already exists on tasks.
-- Recreates tasks_view with the standardised shape + owner_user_id.

DO $$
DECLARE
  v_has_owner boolean;
  v_has_due_at boolean;
  v_has_due_date boolean;
  v_due_select text;
  v_due_group text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'owner_user_id'
  ) INTO v_has_owner;

  IF NOT v_has_owner THEN
    ALTER TABLE public.tasks
      ADD COLUMN owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_at'
  ) INTO v_has_due_at;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_date'
  ) INTO v_has_due_date;

  IF v_has_due_at THEN
    v_due_select := 't.due_at AS due_date';
    v_due_group := 't.due_at';
  ELSIF v_has_due_date THEN
    v_due_select := 't.due_date';
    v_due_group := 't.due_date';
  ELSE
    v_due_select := 'NULL::timestamptz AS due_date';
    v_due_group := 'NULL::timestamptz';
  END IF;

  EXECUTE format(
    $sql$
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
      %s,
      t.assigned_user_id,
      t.owner_user_id,
      t.property_id,
      t.created_at,
      t.updated_at,
      p.nickname AS property_name,
      p.address AS property_address,
      p.thumbnail_url AS property_thumbnail_url,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object(
          'id', sp.id,
          'name', sp.name
        )) FILTER (WHERE sp.id IS NOT NULL),
        '[]'::json
      ) AS spaces,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object(
          'id', th.id,
          'name', th.name,
          'color', th.color,
          'icon', th.icon
        )) FILTER (WHERE th.id IS NOT NULL),
        '[]'::json
      ) AS themes,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object(
          'id', tm.id,
          'name', tm.name,
          'color', tm.color,
          'icon', tm.icon
        )) FILTER (WHERE tm.id IS NOT NULL),
        '[]'::json
      ) AS teams,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object(
          'id', att.id,
          'file_url', att.file_url,
          'thumbnail_url', att.thumbnail_url,
          'file_name', att.file_name,
          'file_type', att.file_type
        )) FILTER (WHERE att.id IS NOT NULL),
        '[]'::json
      ) AS images,
      COALESCE(t.milestones, '[]'::jsonb) AS milestones
    FROM public.tasks t
    LEFT JOIN public.properties p ON p.id = t.property_id AND p.org_id = t.org_id
    LEFT JOIN public.task_spaces ts ON ts.task_id = t.id
    LEFT JOIN public.spaces sp ON sp.id = ts.space_id AND sp.org_id = t.org_id
    LEFT JOIN public.task_themes tt ON tt.task_id = t.id
    LEFT JOIN public.themes th ON th.id = tt.theme_id AND th.org_id = t.org_id
    LEFT JOIN public.task_teams ttm ON ttm.task_id = t.id
    LEFT JOIN public.teams tm ON tm.id = ttm.team_id AND tm.org_id = t.org_id
    LEFT JOIN public.attachments att
      ON att.parent_id = t.id AND att.parent_type = 'task' AND att.org_id = t.org_id
    GROUP BY
      t.id, t.org_id, t.title, t.description, t.status, t.priority,
      %s, t.assigned_user_id, t.owner_user_id, t.property_id, t.created_at, t.updated_at,
      t.milestones,
      p.nickname, p.address, p.thumbnail_url
    $sql$,
    v_due_select,
    v_due_group
  );

  GRANT SELECT ON public.tasks_view TO anon, authenticated;
  COMMENT ON VIEW public.tasks_view IS
    'Tasks with relationships. owner_user_id is the assigner (From) when set; assigned_user_id is the assignee (For).';
END $$;

NOTIFY pgrst, 'reload schema';
