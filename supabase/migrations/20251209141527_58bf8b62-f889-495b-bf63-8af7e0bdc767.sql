-- Migration: Alter group_members to enforce exactly one membership type
-- Purpose: Stricter polymorphic constraint and remove team_id

-- 1. Add missing columns if they do not exist
ALTER TABLE public.group_members
ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE public.group_members
ADD COLUMN IF NOT EXISTS space_id UUID;

ALTER TABLE public.group_members
ADD COLUMN IF NOT EXISTS property_id UUID;

-- 2. Drop unsupported column from step 6 if it exists
ALTER TABLE public.group_members
DROP COLUMN IF EXISTS team_id;

-- 3. Drop old constraint and add new stricter constraint
ALTER TABLE public.group_members
DROP CONSTRAINT IF EXISTS group_members_check;

ALTER TABLE public.group_members
DROP CONSTRAINT IF EXISTS one_member_type;

ALTER TABLE public.group_members
ADD CONSTRAINT one_member_type CHECK (
  (user_id IS NOT NULL)::int +
  (space_id IS NOT NULL)::int +
  (property_id IS NOT NULL)::int = 1
);

-- 4. Ensure indexes exist for member columns
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_space ON public.group_members(space_id);
CREATE INDEX IF NOT EXISTS idx_group_members_property ON public.group_members(property_id);

-- 5. Add descriptive comment
COMMENT ON CONSTRAINT one_member_type ON public.group_members IS 'Ensures exactly one of user_id, space_id, or property_id is set per row.';