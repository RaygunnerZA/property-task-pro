-- Task Relationships V2 Migration
-- Creates many-to-many relationships for tasks with teams, groups, and spaces

-- ============================================================================
-- TEAMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- GROUPS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TASK_SPACES TABLE (Many-to-Many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_spaces (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, space_id)
);

ALTER TABLE task_spaces ENABLE ROW LEVEL SECURITY;

-- Migrate existing space_id data from tasks to task_spaces
-- Only if space_id column exists and has data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'space_id'
  ) THEN
    -- Insert existing space_id relationships into task_spaces
    INSERT INTO task_spaces (task_id, space_id)
    SELECT id, space_id
    FROM tasks
    WHERE space_id IS NOT NULL
    ON CONFLICT (task_id, space_id) DO NOTHING;
  END IF;
END $$;

-- Make space_id nullable in tasks (or keep it as 'Primary Space' reference)
-- We'll keep it for backward compatibility but new relationships go to task_spaces
-- If you want to remove it entirely, uncomment the following:
-- ALTER TABLE tasks ALTER COLUMN space_id DROP NOT NULL;

-- ============================================================================
-- TASK_TEAMS TABLE (Many-to-Many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_teams (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, team_id)
);

ALTER TABLE task_teams ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TASK_GROUPS TABLE (Many-to-Many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_groups (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, group_id)
);

ALTER TABLE task_groups ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Teams: Org members can read/write their org's teams
DROP POLICY IF EXISTS "teams_select" ON teams;
CREATE POLICY "teams_select" ON teams
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = teams.org_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "teams_insert" ON teams;
CREATE POLICY "teams_insert" ON teams
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = teams.org_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "teams_update" ON teams;
CREATE POLICY "teams_update" ON teams
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = teams.org_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "teams_delete" ON teams;
CREATE POLICY "teams_delete" ON teams
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = teams.org_id
        AND organisation_members.user_id = auth.uid()
    )
  );

-- Groups: Org members can read/write their org's groups
DROP POLICY IF EXISTS "groups_select" ON groups;
CREATE POLICY "groups_select" ON groups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = groups.org_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "groups_insert" ON groups;
CREATE POLICY "groups_insert" ON groups
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = groups.org_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "groups_update" ON groups;
CREATE POLICY "groups_update" ON groups
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = groups.org_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "groups_delete" ON groups;
CREATE POLICY "groups_delete" ON groups
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = groups.org_id
        AND organisation_members.user_id = auth.uid()
    )
  );

-- Task Spaces: Org members can read/write relationships for their org's tasks
DROP POLICY IF EXISTS "task_spaces_select" ON task_spaces;
CREATE POLICY "task_spaces_select" ON task_spaces
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM tasks
      JOIN organisation_members ON organisation_members.org_id = tasks.org_id
      WHERE tasks.id = task_spaces.task_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "task_spaces_insert" ON task_spaces;
CREATE POLICY "task_spaces_insert" ON task_spaces
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tasks
      JOIN organisation_members ON organisation_members.org_id = tasks.org_id
      WHERE tasks.id = task_spaces.task_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "task_spaces_delete" ON task_spaces;
CREATE POLICY "task_spaces_delete" ON task_spaces
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM tasks
      JOIN organisation_members ON organisation_members.org_id = tasks.org_id
      WHERE tasks.id = task_spaces.task_id
        AND organisation_members.user_id = auth.uid()
    )
  );

-- Task Teams: Org members can read/write relationships for their org's tasks
DROP POLICY IF EXISTS "task_teams_select" ON task_teams;
CREATE POLICY "task_teams_select" ON task_teams
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM tasks
      JOIN organisation_members ON organisation_members.org_id = tasks.org_id
      WHERE tasks.id = task_teams.task_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "task_teams_insert" ON task_teams;
CREATE POLICY "task_teams_insert" ON task_teams
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tasks
      JOIN organisation_members ON organisation_members.org_id = tasks.org_id
      WHERE tasks.id = task_teams.task_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "task_teams_delete" ON task_teams;
CREATE POLICY "task_teams_delete" ON task_teams
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM tasks
      JOIN organisation_members ON organisation_members.org_id = tasks.org_id
      WHERE tasks.id = task_teams.task_id
        AND organisation_members.user_id = auth.uid()
    )
  );

-- Task Groups: Org members can read/write relationships for their org's tasks
DROP POLICY IF EXISTS "task_groups_select" ON task_groups;
CREATE POLICY "task_groups_select" ON task_groups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM tasks
      JOIN organisation_members ON organisation_members.org_id = tasks.org_id
      WHERE tasks.id = task_groups.task_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "task_groups_insert" ON task_groups;
CREATE POLICY "task_groups_insert" ON task_groups
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tasks
      JOIN organisation_members ON organisation_members.org_id = tasks.org_id
      WHERE tasks.id = task_groups.task_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "task_groups_delete" ON task_groups;
CREATE POLICY "task_groups_delete" ON task_groups
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM tasks
      JOIN organisation_members ON organisation_members.org_id = tasks.org_id
      WHERE tasks.id = task_groups.task_id
        AND organisation_members.user_id = auth.uid()
    )
  );

