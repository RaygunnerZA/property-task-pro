-- Task followers: watchers who are not the responsible party.
-- @Docs/02_Identity.md §11 · @Docs/05_Task_Engine.md §5.2
--
-- Followers may comment. They do not gain UPDATE on task status/details unless
-- they are Owner/Manager or the assigned user. Staff "complete assigned work"
-- is the assigned user, not a follower.

-- ---------------------------------------------------------------------------
-- 1) Who may change task status / details
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.member_can_mutate_task(
  p_org_id uuid,
  p_assigned_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organisation_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND COALESCE(om.membership_status, 'active') = 'active'
      AND (
        om.is_primary_owner = true
        OR lower(om.role) IN ('owner', 'manager')
        OR (p_assigned_user_id IS NOT NULL AND p_assigned_user_id = auth.uid())
      )
  );
$$;

REVOKE ALL ON FUNCTION public.member_can_mutate_task(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.member_can_mutate_task(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.member_can_mutate_task(uuid, uuid) IS
  'Owner/Manager or the assigned user may change task status and details. Followers and other Staff cannot.';

DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (public.member_can_mutate_task(org_id, assigned_user_id))
  WITH CHECK (public.member_can_mutate_task(org_id, assigned_user_id));

-- ---------------------------------------------------------------------------
-- 2) Junction
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_followers (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_followers_org ON public.task_followers (org_id);
CREATE INDEX IF NOT EXISTS idx_task_followers_user ON public.task_followers (user_id);

COMMENT ON TABLE public.task_followers IS
  'Users watching a task. Not the responsible assignee. Comment-only unless Owner/Manager.';

ALTER TABLE public.task_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_followers_select" ON public.task_followers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_followers.task_id
        AND t.org_id = task_followers.org_id
    )
  );

CREATE POLICY "task_followers_insert" ON public.task_followers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by IS NOT DISTINCT FROM auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_followers.task_id
        AND t.org_id = task_followers.org_id
        AND public.member_can_mutate_task(t.org_id, t.assigned_user_id)
        AND t.assigned_user_id IS DISTINCT FROM task_followers.user_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.organisation_members om
      WHERE om.org_id = task_followers.org_id
        AND om.user_id = task_followers.user_id
        AND COALESCE(om.membership_status, 'active') = 'active'
    )
  );

CREATE POLICY "task_followers_delete" ON public.task_followers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_followers.task_id
        AND t.org_id = task_followers.org_id
        AND public.member_can_mutate_task(t.org_id, t.assigned_user_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Expose follower ids on tasks_view (same shape as latest view + followers)
-- ---------------------------------------------------------------------------
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
    SELECT array_agg(tf.user_id ORDER BY tf.created_at)
    FROM public.task_followers tf
    WHERE tf.task_id = t.id
  ), ARRAY[]::uuid[]) AS follower_user_ids,
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
  COALESCE((
    SELECT json_agg(
      jsonb_build_object(
        'id', att.id,
        'file_url', att.file_url,
        'thumbnail_url', att.thumbnail_url,
        'file_name', att.file_name,
        'file_type', att.file_type
      )
      ORDER BY att.created_at DESC
    )
    FROM attachments att
    WHERE att.parent_id = t.id
      AND att.parent_type = 'task'
      AND att.org_id = t.org_id
      AND COALESCE(lower(att.file_name), '') NOT LIKE 'signature.%'
      AND COALESCE(att.metadata->>'evidence_kind', '') IS DISTINCT FROM 'signature'
  ), CASE
    WHEN t.image_url IS NOT NULL THEN
      json_build_array(jsonb_build_object('file_url', t.image_url, 'file_type', 'image/*'))
    ELSE '[]'::json
  END) AS images
FROM tasks t
LEFT JOIN properties p ON p.id = t.property_id AND p.org_id = t.org_id
LEFT JOIN task_themes tt ON tt.task_id = t.id
LEFT JOIN themes th ON th.id = tt.theme_id AND th.org_id = t.org_id
GROUP BY
  t.id, t.org_id, t.title, t.description, t.status, t.priority, t.due_at,
  t.assigned_user_id, t.owner_user_id, t.property_id, t.created_at, t.updated_at,
  t.space_ids, t.assigned_team_ids, t.image_url, t.milestones,
  p.nickname, p.address, p.thumbnail_url;

GRANT SELECT ON public.tasks_view TO anon, authenticated;

COMMENT ON VIEW public.tasks_view IS
  'Tasks with relationships. follower_user_ids are watchers, not the assignee. images exclude checklist signatures.';

GRANT SELECT, INSERT, DELETE ON public.task_followers TO authenticated;
REVOKE UPDATE ON public.task_followers FROM authenticated, anon;

NOTIFY pgrst, 'reload schema';
