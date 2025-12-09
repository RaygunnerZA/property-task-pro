-- Migration Step 11: Add missing FK on subtasks.template_id
-- Purpose: Link subtasks to checklist_templates

-- Add foreign key constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'subtasks_template_id_fkey'
    AND table_name = 'subtasks'
  ) THEN
    ALTER TABLE public.subtasks
    ADD CONSTRAINT subtasks_template_id_fkey 
    FOREIGN KEY (template_id) REFERENCES public.checklist_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.subtasks.template_id IS 'Reference to checklist template when subtask is generated from a template.';