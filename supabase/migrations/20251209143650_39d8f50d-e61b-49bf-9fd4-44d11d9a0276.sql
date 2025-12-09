-- Migration: Groups additional fields and updated_at trigger

-- Add archived_at timestamp
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Ensure created_at has default
ALTER TABLE public.groups
ALTER COLUMN created_at SET DEFAULT now();

-- Add updated_at with auto-update trigger
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

DROP TRIGGER IF EXISTS groups_set_updated_at ON public.groups;
CREATE TRIGGER groups_set_updated_at
BEFORE UPDATE ON public.groups
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();