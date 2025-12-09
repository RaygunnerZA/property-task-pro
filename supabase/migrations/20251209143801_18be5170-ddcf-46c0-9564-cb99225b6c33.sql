-- Migration Steps 56-65: Groups audit and archive enhancements

-- Step 62: Add archived_by
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS archived_by UUID;

-- Step 59: Create trigger function with secure search_path
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS groups_update_timestamp ON public.groups;

CREATE TRIGGER groups_update_timestamp
BEFORE UPDATE ON public.groups
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();

-- Step 64: Index on parent_group_id
CREATE INDEX IF NOT EXISTS groups_parent_group_idx
ON public.groups (parent_group_id);

-- Step 65: Partial index for active groups
CREATE INDEX IF NOT EXISTS groups_active_idx
ON public.groups (org_id, name)
WHERE is_archived = FALSE;