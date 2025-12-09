-- Migration: task_groups RLS, group enhancements, indexes, and triggers

-- Drop existing policies
DROP POLICY IF EXISTS task_groups_select ON public.task_groups;
DROP POLICY IF EXISTS task_groups_insert ON public.task_groups;
DROP POLICY IF EXISTS task_groups_update ON public.task_groups;
DROP POLICY IF EXISTS task_groups_delete ON public.task_groups;

-- SELECT
CREATE POLICY task_groups_select ON public.task_groups
FOR SELECT USING (
  task_id IN (
    SELECT id FROM public.tasks
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE org_id = current_org_id()
    )
  )
);

-- INSERT
CREATE POLICY task_groups_insert ON public.task_groups
FOR INSERT WITH CHECK (
  task_id IN (
    SELECT id FROM public.tasks
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE org_id = current_org_id()
    )
  )
);

-- UPDATE
CREATE POLICY task_groups_update ON public.task_groups
FOR UPDATE USING (
  task_id IN (
    SELECT id FROM public.tasks
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE org_id = current_org_id()
    )
  )
)
WITH CHECK (
  task_id IN (
    SELECT id FROM public.tasks
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE org_id = current_org_id()
    )
  )
);

-- DELETE
CREATE POLICY task_groups_delete ON public.task_groups
FOR DELETE USING (
  task_id IN (
    SELECT id FROM public.tasks
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE org_id = current_org_id()
    )
  )
);

-- Indexes for groups, group_members, task_groups
CREATE INDEX IF NOT EXISTS groups_org_id_idx ON public.groups (org_id);
CREATE INDEX IF NOT EXISTS group_members_group_id_idx ON public.group_members (group_id);
CREATE INDEX IF NOT EXISTS group_members_org_id_idx ON public.group_members (org_id);
CREATE INDEX IF NOT EXISTS task_groups_task_id_idx ON public.task_groups (task_id);
CREATE INDEX IF NOT EXISTS task_groups_group_id_idx ON public.task_groups (group_id);

-- Step 31: Add created_by/updated_by to groups
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS updated_by UUID,
ADD COLUMN IF NOT EXISTS color TEXT,
ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS groups_is_archived_idx ON public.groups (is_archived);
CREATE INDEX IF NOT EXISTS groups_created_by_idx ON public.groups (created_by);
CREATE INDEX IF NOT EXISTS groups_updated_by_idx ON public.groups (updated_by);
CREATE INDEX IF NOT EXISTS groups_display_order_idx ON public.groups (display_order);

-- Step 32: Add audit timestamps to group_members
ALTER TABLE public.group_members
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS group_members_created_at_idx ON public.group_members (created_at);
CREATE INDEX IF NOT EXISTS group_members_is_deleted_idx ON public.group_members (is_deleted);

-- Soft delete for task_groups
ALTER TABLE public.task_groups
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS task_groups_is_deleted_idx ON public.task_groups (is_deleted);

-- Step 34: updated_at trigger for group_members
DROP TRIGGER IF EXISTS group_members_set_updated_at ON public.group_members;
CREATE TRIGGER group_members_set_updated_at
BEFORE UPDATE ON public.group_members
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();