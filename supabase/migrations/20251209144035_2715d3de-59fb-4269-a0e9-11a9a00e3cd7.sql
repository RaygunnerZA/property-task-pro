-- Migration Steps 96-125: checklist_template_items, subtasks, spaces enhancements

-- Step 96: Index for active checklist templates
CREATE INDEX IF NOT EXISTS checklist_templates_active_idx
ON public.checklist_templates (org_id)
WHERE is_archived = FALSE;

-- Steps 97-104: checklist_template_items audit columns
ALTER TABLE public.checklist_template_items
ADD COLUMN IF NOT EXISTS created_by UUID,
ADD COLUMN IF NOT EXISTS updated_by UUID,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by UUID;

CREATE INDEX IF NOT EXISTS checklist_template_items_template_idx
ON public.checklist_template_items (template_id);

-- Step 105: updated_at trigger for checklist_template_items
CREATE OR REPLACE FUNCTION public.update_checklist_template_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_checklist_template_items_updated_at ON public.checklist_template_items;

CREATE TRIGGER trg_update_checklist_template_items_updated_at
BEFORE UPDATE ON public.checklist_template_items
FOR EACH ROW
EXECUTE FUNCTION public.update_checklist_template_items_updated_at();

-- Steps 106-111: subtasks audit columns
ALTER TABLE public.subtasks
ADD COLUMN IF NOT EXISTS updated_by UUID,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by UUID,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Step 112: FK from subtasks.template_id to checklist_templates
ALTER TABLE public.subtasks
DROP CONSTRAINT IF EXISTS subtasks_template_id_fkey;

ALTER TABLE public.subtasks
ADD CONSTRAINT subtasks_template_id_fkey
FOREIGN KEY (template_id)
REFERENCES public.checklist_templates(id)
ON DELETE SET NULL;

-- Step 113: Index for active subtasks
CREATE INDEX IF NOT EXISTS subtasks_task_active_idx
ON public.subtasks (task_id)
WHERE is_archived = FALSE;

-- Step 114: updated_at trigger for subtasks
CREATE OR REPLACE FUNCTION public.update_subtasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_subtasks_updated_at ON public.subtasks;

CREATE TRIGGER trg_update_subtasks_updated_at
BEFORE UPDATE ON public.subtasks
FOR EACH ROW
EXECUTE FUNCTION public.update_subtasks_updated_at();

-- Steps 115-122: spaces audit columns
ALTER TABLE public.spaces
ADD COLUMN IF NOT EXISTS created_by UUID,
ADD COLUMN IF NOT EXISTS updated_by UUID,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by UUID;

-- Step 123: Index on parent_space_id
CREATE INDEX IF NOT EXISTS spaces_parent_space_id_idx
ON public.spaces (parent_space_id);

-- Step 124: updated_at trigger for spaces
CREATE OR REPLACE FUNCTION public.update_spaces_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_spaces_updated_at ON public.spaces;

CREATE TRIGGER trg_update_spaces_updated_at
BEFORE UPDATE ON public.spaces
FOR EACH ROW
EXECUTE FUNCTION public.update_spaces_updated_at();

-- Step 125: Index for active spaces
CREATE INDEX IF NOT EXISTS spaces_active_idx
ON public.spaces (org_id)
WHERE is_archived = FALSE;