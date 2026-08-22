-- restore_task previously set status = 'pending', which violates tasks_status_check.
-- Align with enum / Docs: open | in_progress | waiting_review | completed | archived.

CREATE OR REPLACE FUNCTION public.restore_task(p_task_id uuid, p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.tasks
  SET status = 'open',
      updated_at = NOW()
  WHERE id = p_task_id
    AND org_id = p_org
    AND status = 'archived';
END;
$$;
