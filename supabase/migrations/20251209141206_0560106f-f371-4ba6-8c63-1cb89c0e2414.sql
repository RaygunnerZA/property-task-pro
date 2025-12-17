-- Migration Step 6: Create groups, group_members, task_groups tables
-- Purpose: Grouping system for chips, drag-and-drop, and hierarchical collections

-- 1. Create groups table
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT, -- e.g. "team", "space", "mixed"
  icon TEXT,
  image_url TEXT,
  parent_group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create group_members table (polymorphic membership)
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID,
  space_id UUID,
  property_id UUID,
  team_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Ensure at least one membership target is set
  CHECK (
    user_id IS NOT NULL
    OR space_id IS NOT NULL
    OR property_id IS NOT NULL
    OR team_id IS NOT NULL
  )
);

-- 3. Create task_groups junction table
CREATE TABLE IF NOT EXISTS public.task_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_groups_parent_group ON public.groups(parent_group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_task_groups_task_id ON public.task_groups(task_id);

-- 5. Enable RLS on all three tables
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_groups ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for groups (org-scoped)
CREATE POLICY groups_select ON public.groups
  FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY groups_insert ON public.groups
  FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY groups_update ON public.groups
  FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY groups_delete ON public.groups
  FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- 7. RLS policies for group_members (org-scoped)
CREATE POLICY group_members_select ON public.group_members
  FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY group_members_insert ON public.group_members
  FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY group_members_update ON public.group_members
  FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY group_members_delete ON public.group_members
  FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- 8. RLS policies for task_groups (org-scoped)
CREATE POLICY task_groups_select ON public.task_groups
  FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY task_groups_insert ON public.task_groups
  FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY task_groups_update ON public.task_groups
  FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY task_groups_delete ON public.task_groups
  FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- 9. Add descriptive comments
COMMENT ON TABLE public.groups IS 'Hierarchical grouping system for chips, collections, and organization.';
COMMENT ON TABLE public.group_members IS 'Polymorphic membership linking users, spaces, properties, or teams to groups.';
COMMENT ON TABLE public.task_groups IS 'Junction table linking tasks to groups.';
COMMENT ON COLUMN public.groups.category IS 'Group type: team, space, mixed, etc.';
COMMENT ON COLUMN public.groups.parent_group_id IS 'Self-referencing for nested group hierarchies.';