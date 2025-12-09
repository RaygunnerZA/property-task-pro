-- Migration: Groups polymorphic structure and RLS

-- Add team_id to group_members if not exists
ALTER TABLE public.group_members
ADD COLUMN IF NOT EXISTS team_id UUID;

-- Add FK for team_id
ALTER TABLE public.group_members
DROP CONSTRAINT IF EXISTS group_members_team_id_fkey;

ALTER TABLE public.group_members
ADD CONSTRAINT group_members_team_id_fkey
FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

-- Add property FK if not exists
ALTER TABLE public.group_members
DROP CONSTRAINT IF EXISTS group_members_property_id_fkey;

ALTER TABLE public.group_members
ADD CONSTRAINT group_members_property_id_fkey
FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;

-- Add space FK if not exists
ALTER TABLE public.group_members
DROP CONSTRAINT IF EXISTS group_members_space_id_fkey;

ALTER TABLE public.group_members
ADD CONSTRAINT group_members_space_id_fkey
FOREIGN KEY (space_id) REFERENCES public.spaces(id) ON DELETE SET NULL;

-- Add polymorphic constraint (exactly one member type)
ALTER TABLE public.group_members
DROP CONSTRAINT IF EXISTS group_members_one_member;

ALTER TABLE public.group_members
ADD CONSTRAINT group_members_one_member CHECK (
    (user_id IS NOT NULL)::int +
    (team_id IS NOT NULL)::int +
    (space_id IS NOT NULL)::int +
    (property_id IS NOT NULL)::int = 1
) NOT VALID;

-- Update group_members RLS to use group chain
DROP POLICY IF EXISTS group_members_select ON public.group_members;
DROP POLICY IF EXISTS group_members_insert ON public.group_members;
DROP POLICY IF EXISTS group_members_update ON public.group_members;
DROP POLICY IF EXISTS group_members_delete ON public.group_members;

CREATE POLICY group_members_select ON public.group_members
FOR SELECT USING (
    group_id IN (SELECT id FROM public.groups WHERE org_id = current_org_id())
);

CREATE POLICY group_members_insert ON public.group_members
FOR INSERT WITH CHECK (
    group_id IN (SELECT id FROM public.groups WHERE org_id = current_org_id())
);

CREATE POLICY group_members_update ON public.group_members
FOR UPDATE USING (
    group_id IN (SELECT id FROM public.groups WHERE org_id = current_org_id())
);

CREATE POLICY group_members_delete ON public.group_members
FOR DELETE USING (
    group_id IN (SELECT id FROM public.groups WHERE org_id = current_org_id())
);

-- Additional indexes
CREATE INDEX IF NOT EXISTS idx_groups_org_id ON public.groups(org_id);
CREATE INDEX IF NOT EXISTS idx_groups_parent ON public.groups(parent_group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_team_id ON public.group_members(team_id);
CREATE INDEX IF NOT EXISTS idx_task_groups_task_id ON public.task_groups(task_id);
CREATE INDEX IF NOT EXISTS idx_task_groups_group_id ON public.task_groups(group_id);