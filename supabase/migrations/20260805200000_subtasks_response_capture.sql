-- Checklist compliance responses: record answers + metadata per step.
-- Aligns with @Docs/05_Task_Engine.md (checklist items hold evidence, measurements, photos).

ALTER TABLE public.subtasks
  ADD COLUMN IF NOT EXISTS response_value text;

ALTER TABLE public.subtasks
  ADD COLUMN IF NOT EXISTS response_json jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.subtasks
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users(id);

ALTER TABLE public.subtasks
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE public.subtasks
  ADD COLUMN IF NOT EXISTS response_attachment_id uuid REFERENCES public.attachments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.subtasks.response_value IS
  'Recorded answer for the step (yes/no, pass/fail, text, number, scan code, etc.).';
COMMENT ON COLUMN public.subtasks.response_json IS
  'Structured metadata for the response (units, file name, geo, device, signature present, etc.).';
COMMENT ON COLUMN public.subtasks.completed_by IS
  'User who completed / submitted the step response.';
COMMENT ON COLUMN public.subtasks.completed_at IS
  'When the step response was recorded.';
COMMENT ON COLUMN public.subtasks.response_attachment_id IS
  'Primary evidence attachment for photo/file/signature steps (attachments.parent_type=subtask).';

CREATE INDEX IF NOT EXISTS idx_subtasks_completed_at
  ON public.subtasks (task_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attachments_subtask_parent
  ON public.attachments (parent_type, parent_id)
  WHERE parent_type = 'subtask';
