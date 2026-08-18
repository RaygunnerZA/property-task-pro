-- Rename Groups to Categories Migration
-- Renames groups table to categories, task_groups to task_categories, and updates all related references

-- ============================================================================
-- STEP 1: Rename task_groups table to task_categories
-- ============================================================================
ALTER TABLE IF EXISTS task_groups RENAME TO task_categories;

-- ============================================================================
-- STEP 2: Rename group_id column to category_id in task_categories
-- ============================================================================
ALTER TABLE task_categories RENAME COLUMN group_id TO category_id;

-- ============================================================================
-- STEP 3: Drop old foreign key constraint and recreate with new column name
-- ============================================================================
-- Drop the old foreign key constraint
ALTER TABLE task_categories 
  DROP CONSTRAINT IF EXISTS task_groups_group_id_fkey;

-- Recreate foreign key with new column name (will reference groups for now, we'll update after renaming)
ALTER TABLE task_categories
  ADD CONSTRAINT task_categories_category_id_fkey 
  FOREIGN KEY (category_id) REFERENCES groups(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 4: Rename groups table to categories
-- ============================================================================
ALTER TABLE IF EXISTS groups RENAME TO categories;

-- ============================================================================
-- STEP 5: Update foreign key constraint to reference categories table
-- ============================================================================
ALTER TABLE task_categories 
  DROP CONSTRAINT IF EXISTS task_categories_category_id_fkey;

ALTER TABLE task_categories
  ADD CONSTRAINT task_categories_category_id_fkey 
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 6: Drop old RLS policies and create new ones for categories
-- ============================================================================

-- Drop old groups policies
DROP POLICY IF EXISTS "groups_select" ON categories;
DROP POLICY IF EXISTS "groups_insert" ON categories;
DROP POLICY IF EXISTS "groups_update" ON categories;
DROP POLICY IF EXISTS "groups_delete" ON categories;

-- Create new categories policies
CREATE POLICY "categories_select" ON categories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = categories.org_id
        AND organisation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "categories_insert" ON categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = categories.org_id
        AND organisation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "categories_update" ON categories
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = categories.org_id
        AND organisation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "categories_delete" ON categories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = categories.org_id
        AND organisation_members.user_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 7: Drop old task_groups policies and create new ones for task_categories
-- ============================================================================

-- Drop old task_groups policies
DROP POLICY IF EXISTS "task_groups_select" ON task_categories;
DROP POLICY IF EXISTS "task_groups_insert" ON task_categories;
DROP POLICY IF EXISTS "task_groups_delete" ON task_categories;

-- Create new task_categories policies
CREATE POLICY "task_categories_select" ON task_categories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM tasks
      JOIN organisation_members ON organisation_members.org_id = tasks.org_id
      WHERE tasks.id = task_categories.task_id
        AND organisation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "task_categories_insert" ON task_categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tasks
      JOIN organisation_members ON organisation_members.org_id = tasks.org_id
      WHERE tasks.id = task_categories.task_id
        AND organisation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "task_categories_delete" ON task_categories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM tasks
      JOIN organisation_members ON organisation_members.org_id = tasks.org_id
      WHERE tasks.id = task_categories.task_id
        AND organisation_members.user_id = auth.uid()
    )
  );

