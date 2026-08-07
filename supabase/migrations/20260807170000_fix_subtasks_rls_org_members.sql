-- Fix subtasks RLS so checklist authoring works in Task Detail edit mode.
--
-- Root cause: subtasks_insert / update / delete only allowed
--   owner_user_id = auth.uid() OR owner_team membership via current_org_id().
-- current_org_id() is often NULL (JWT), so even owners on the team path fail,
-- and any org member who can edit a task but is not the owner cannot add steps.
--
-- Align with checklist_templates + tasks_update: organisation_members membership.
-- Keep SELECT broad enough for assignees / property scope / contractor tokens.

DROP POLICY IF EXISTS "subtasks_select" ON public.subtasks;
DROP POLICY IF EXISTS "subtasks_insert" ON public.subtasks;
DROP POLICY IF EXISTS "subtasks_update" ON public.subtasks;
DROP POLICY IF EXISTS "subtasks_delete" ON public.subtasks;

CREATE POLICY "subtasks_select" ON public.subtasks
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      org_id IN (
        SELECT om.org_id
        FROM public.organisation_members om
        WHERE om.user_id = auth.uid()
      )
      OR task_id IN (
        SELECT cta.task_id
        FROM public.contractor_task_access cta
        WHERE cta.contractor_token = public.current_contractor_token()
      )
    )
  );

CREATE POLICY "subtasks_insert" ON public.subtasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT om.org_id
      FROM public.organisation_members om
      WHERE om.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_id
        AND t.org_id = org_id
    )
  );

CREATE POLICY "subtasks_update" ON public.subtasks
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      org_id IN (
        SELECT om.org_id
        FROM public.organisation_members om
        WHERE om.user_id = auth.uid()
      )
      OR task_id IN (
        SELECT cta.task_id
        FROM public.contractor_task_access cta
        WHERE cta.contractor_token = public.current_contractor_token()
      )
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      org_id IN (
        SELECT om.org_id
        FROM public.organisation_members om
        WHERE om.user_id = auth.uid()
      )
      OR task_id IN (
        SELECT cta.task_id
        FROM public.contractor_task_access cta
        WHERE cta.contractor_token = public.current_contractor_token()
      )
    )
  );

CREATE POLICY "subtasks_delete" ON public.subtasks
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT om.org_id
      FROM public.organisation_members om
      WHERE om.user_id = auth.uid()
    )
  );
