-- Persist rich checklist requirements on task subtasks (not only yes/no + signature).
-- Assigners set these at create time; assignees need them visible on Task Detail.

ALTER TABLE public.subtasks
  ADD COLUMN IF NOT EXISTS step_type text NOT NULL DEFAULT 'check';

ALTER TABLE public.subtasks
  ADD COLUMN IF NOT EXISTS is_sub_step boolean NOT NULL DEFAULT false;

ALTER TABLE public.subtasks
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT false;

-- Backfill from legacy flags
UPDATE public.subtasks
SET step_type = CASE
  WHEN requires_signature IS TRUE THEN 'signature'
  WHEN is_yes_no IS TRUE THEN 'yes_no'
  ELSE COALESCE(NULLIF(step_type, ''), 'check')
END
WHERE step_type = 'check'
   OR step_type IS NULL
   OR step_type = '';

ALTER TABLE public.subtasks
  DROP CONSTRAINT IF EXISTS subtasks_step_type_valid;

ALTER TABLE public.subtasks
  ADD CONSTRAINT subtasks_step_type_valid CHECK (
    step_type = ANY (ARRAY[
      'check',
      'yes_no',
      'text',
      'number',
      'photo',
      'file',
      'signature',
      'scan',
      'pass_fail',
      'title',
      'note',
      'divider'
    ])
  );

COMMENT ON COLUMN public.subtasks.step_type IS
  'Checklist response/structure requirement set by the assigner (photo, yes_no, signature, …).';
