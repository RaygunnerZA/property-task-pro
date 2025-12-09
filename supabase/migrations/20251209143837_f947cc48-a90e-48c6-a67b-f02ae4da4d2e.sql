-- Migration Steps 66-80: group_members and task_groups enhancements

-- Steps 66-69: group_members audit columns
ALTER TABLE public.group_members
ADD COLUMN IF NOT EXISTS created_by UUID,
ADD COLUMN IF NOT EXISTS updated_by UUID,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by UUID;

-- Step 70: Update trigger for group_members
DROP TRIGGER IF EXISTS group_members_update_timestamp ON public.group_members;

CREATE TRIGGER group_members_update_timestamp
BEFORE UPDATE ON public.group_members
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();

-- Step 75: Index on user_id (partial)
CREATE INDEX IF NOT EXISTS group_members_user_id_idx
ON public.group_members (user_id)
WHERE user_id IS NOT NULL;

-- Step 76: Index on space_id (partial)
CREATE INDEX IF NOT EXISTS group_members_space_id_idx
ON public.group_members (space_id)
WHERE space_id IS NOT NULL;

-- Step 77: Partial index for active group members
CREATE INDEX IF NOT EXISTS group_members_active_idx
ON public.group_members (group_id, user_id, space_id)
WHERE is_deleted = FALSE;

-- Steps 78-80: task_groups already has created_by, created_at, is_deleted from previous migrations
-- Add is_archived as alias if needed
ALTER TABLE public.task_groups
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;