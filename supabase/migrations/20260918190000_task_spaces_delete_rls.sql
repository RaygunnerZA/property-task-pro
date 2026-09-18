-- Restore task_spaces DELETE RLS omitted from baseline (archive had it; insert/select only remained).
-- Without DELETE, client replace-all syncs leave existing rows and INSERT hits task_spaces_pkey.

DROP POLICY IF EXISTS task_spaces_delete ON public.task_spaces;
CREATE POLICY task_spaces_delete ON public.task_spaces
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      JOIN public.organisation_members om
        ON om.org_id = t.org_id AND om.user_id = auth.uid()
      WHERE t.id = task_spaces.task_id
    )
  );
