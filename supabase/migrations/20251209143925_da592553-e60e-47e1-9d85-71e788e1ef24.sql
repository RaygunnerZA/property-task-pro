-- Migration Steps 81-95: task_groups and checklist_templates enhancements

-- Steps 81-84: task_groups audit columns
ALTER TABLE public.task_groups
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by UUID;

-- Step 87: Index for active task_groups
CREATE INDEX IF NOT EXISTS task_groups_active_idx
ON public.task_groups (task_id, group_id)
WHERE is_archived = FALSE;

-- Steps 88-94: checklist_templates audit columns
ALTER TABLE public.checklist_templates
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_by UUID,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by UUID;

-- Create update trigger for checklist_templates
DROP TRIGGER IF EXISTS checklist_templates_update_timestamp ON public.checklist_templates;

CREATE TRIGGER checklist_templates_update_timestamp
BEFORE UPDATE ON public.checklist_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();

-- Create update trigger for task_groups
DROP TRIGGER IF EXISTS task_groups_update_timestamp ON public.task_groups;

CREATE TRIGGER task_groups_update_timestamp
BEFORE UPDATE ON public.task_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();