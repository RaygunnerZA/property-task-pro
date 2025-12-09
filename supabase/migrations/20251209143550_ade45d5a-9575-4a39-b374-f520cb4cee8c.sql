-- Migration: Groups metadata/icon and task_groups audit fields

-- Add icon to groups
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS groups_icon_idx ON public.groups (icon);
CREATE INDEX IF NOT EXISTS groups_metadata_idx ON public.groups USING GIN (metadata);

-- Add created_by/updated_by to task_groups
ALTER TABLE public.task_groups
ADD COLUMN IF NOT EXISTS created_by UUID,
ADD COLUMN IF NOT EXISTS updated_by UUID,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS task_groups_created_by_idx ON public.task_groups (created_by);
CREATE INDEX IF NOT EXISTS task_groups_updated_by_idx ON public.task_groups (updated_by);

-- Auto-updating updated_at trigger
DROP TRIGGER IF EXISTS task_groups_set_updated_at ON public.task_groups;
CREATE TRIGGER task_groups_set_updated_at
BEFORE UPDATE ON public.task_groups
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Unique constraint for task-group pairs
ALTER TABLE public.task_groups
DROP CONSTRAINT IF EXISTS task_groups_unique_pair;

ALTER TABLE public.task_groups
ADD CONSTRAINT task_groups_unique_pair UNIQUE (task_id, group_id);