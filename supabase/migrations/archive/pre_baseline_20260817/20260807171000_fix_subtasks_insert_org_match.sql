-- Clarify subtasks_insert WITH CHECK: qualify subtasks columns so the parent-task
-- org match is real (unqualified org_id was resolving to tasks.org_id).

DROP POLICY IF EXISTS "subtasks_insert" ON public.subtasks;

CREATE POLICY "subtasks_insert" ON public.subtasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND subtasks.org_id IN (
      SELECT om.org_id
      FROM public.organisation_members om
      WHERE om.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = subtasks.task_id
        AND t.org_id = subtasks.org_id
    )
  );
