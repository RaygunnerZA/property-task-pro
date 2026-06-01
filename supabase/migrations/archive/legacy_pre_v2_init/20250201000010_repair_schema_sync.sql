-- Repair Schema Sync: Fix database schema to match code expectations
-- This migration repairs the mismatch between live database and code

-- ============================================================================
-- STEP 1: Drop View (Unlock the table)
-- ============================================================================
DROP VIEW IF EXISTS tasks_view CASCADE;

-- ============================================================================
-- STEP 2: Add Missing Columns to tasks table
-- ============================================================================
-- Ensure all columns that code expects exist in the tasks table

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

-- Set default values for existing rows with NULL title
UPDATE tasks
SET title = 'Untitled Task'
WHERE title IS NULL;

-- Make title NOT NULL after setting defaults
DO $$
BEGIN
  -- Check if title column is nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' 
    AND column_name = 'title' 
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE tasks ALTER COLUMN title SET NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Recreate tasks_view with full definition
-- ============================================================================
-- This includes all columns and the json_agg for images/teams/spaces/themes

CREATE VIEW tasks_view
WITH (security_invoker = true)
AS
SELECT 
  t.id,
  t.org_id,
  t.title,
  t.description,
  t.status,
  t.priority,
  t.due_date,
  t.assigned_user_id,
  t.property_id,
  t.created_at,
  t.updated_at,
  -- Property data
  p.nickname AS property_name,
  p.address AS property_address,
  p.thumbnail_url AS property_thumbnail_url,
  -- Spaces (aggregated as JSON array)
  COALESCE(
    json_agg(DISTINCT jsonb_build_object(
      'id', sp.id,
      'name', sp.name
    )) FILTER (WHERE sp.id IS NOT NULL),
    '[]'::json
  ) AS spaces,
  -- Themes (aggregated as JSON array)
  COALESCE(
    json_agg(DISTINCT jsonb_build_object(
      'id', th.id,
      'name', th.name,
      'color', th.color,
      'icon', th.icon
    )) FILTER (WHERE th.id IS NOT NULL),
    '[]'::json
  ) AS themes,
  -- Teams (aggregated as JSON array)
  COALESCE(
    json_agg(DISTINCT jsonb_build_object(
      'id', tm.id,
      'name', tm.name,
      'color', tm.color,
      'icon', tm.icon
    )) FILTER (WHERE tm.id IS NOT NULL),
    '[]'::json
  ) AS teams,
  -- Images (aggregated as JSON array from attachments)
  COALESCE(
    json_agg(DISTINCT jsonb_build_object(
      'id', att.id,
      'file_url', att.file_url,
      'thumbnail_url', att.thumbnail_url
    )) FILTER (WHERE att.id IS NOT NULL),
    '[]'::json
  ) AS images,
  -- Assignee: Only user_id (user profile data in auth.users, fetch separately via get_users_info RPC)
  t.assigned_user_id AS assignee_user_id
FROM tasks t
LEFT JOIN properties p ON p.id = t.property_id AND p.org_id = t.org_id
LEFT JOIN task_spaces ts ON ts.task_id = t.id
LEFT JOIN spaces sp ON sp.id = ts.space_id AND sp.org_id = t.org_id
LEFT JOIN task_themes tt ON tt.task_id = t.id
LEFT JOIN themes th ON th.id = tt.theme_id AND th.org_id = t.org_id
LEFT JOIN task_teams ttm ON ttm.task_id = t.id
LEFT JOIN teams tm ON tm.id = ttm.team_id AND tm.org_id = t.org_id
LEFT JOIN attachments att ON att.parent_id = t.id AND att.parent_type = 'task' AND att.org_id = t.org_id
GROUP BY 
  t.id, t.org_id, t.title, t.description, t.status, t.priority, 
  t.due_date, t.assigned_user_id, t.property_id, t.created_at, 
  t.updated_at,
  p.nickname, p.address, p.thumbnail_url;

-- ============================================================================
-- STEP 4: Fix Missing RLS Policies
-- ============================================================================
-- Apply missing SELECT policies for tables that might not have them

-- Schedule Items: Add SELECT policy if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'schedule_items' 
    AND policyname = 'schedule_items_select'
  ) THEN
    CREATE POLICY "schedule_items_select" ON schedule_items
      FOR SELECT
      TO authenticated
      USING (org_id IN (
        SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

-- Task Instances: Add SELECT policy if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'task_instances' 
    AND policyname = 'task_instances_select'
  ) THEN
    CREATE POLICY "task_instances_select" ON task_instances
      FOR SELECT
      TO authenticated
      USING (org_id IN (
        SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

-- Issues: Add SELECT policy if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'issues' 
    AND policyname = 'issues_select'
  ) THEN
    CREATE POLICY "issues_select" ON issues
      FOR SELECT
      TO authenticated
      USING (org_id IN (
        SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

-- Compliance Sources: Add SELECT policy if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'compliance_sources' 
    AND policyname = 'compliance_sources_select'
  ) THEN
    CREATE POLICY "compliance_sources_select" ON compliance_sources
      FOR SELECT
      TO authenticated
      USING (org_id IN (
        SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

-- Compliance Documents: Add SELECT policy if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'compliance_documents' 
    AND policyname = 'compliance_documents_select'
  ) THEN
    CREATE POLICY "compliance_documents_select" ON compliance_documents
      FOR SELECT
      TO authenticated
      USING (org_id IN (
        SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

-- Compliance Rules: Add SELECT policy if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'compliance_rules' 
    AND policyname = 'compliance_rules_select'
  ) THEN
    CREATE POLICY "compliance_rules_select" ON compliance_rules
      FOR SELECT
      TO authenticated
      USING (org_id IN (
        SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

-- Contractor Tokens: Add SELECT policy if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'contractor_tokens' 
    AND policyname = 'contractor_tokens_select'
  ) THEN
    CREATE POLICY "contractor_tokens_select" ON contractor_tokens
      FOR SELECT
      TO authenticated
      USING (
        -- Contractor token access: JWT contractor_token claim matches token column
        (auth.jwt() ->> 'contractor_token') = token
      );
  END IF;
END $$;

-- Subscription Tiers: Add SELECT policy if missing (public read for pricing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'subscription_tiers' 
    AND policyname = 'subscription_tiers_select'
  ) THEN
    CREATE POLICY "subscription_tiers_select" ON subscription_tiers
      FOR SELECT
      TO authenticated
      USING (is_active = true);
  END IF;
END $$;

-- Org Subscriptions: Add SELECT policy if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'org_subscriptions' 
    AND policyname = 'org_subscriptions_select'
  ) THEN
    CREATE POLICY "org_subscriptions_select" ON org_subscriptions
      FOR SELECT
      TO authenticated
      USING (org_id IN (
        SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

-- Org Usage: Add SELECT policy if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'org_usage' 
    AND policyname = 'org_usage_select'
  ) THEN
    CREATE POLICY "org_usage_select" ON org_usage
      FOR SELECT
      TO authenticated
      USING (org_id IN (
        SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

-- Groups/Categories: Add SELECT policy if missing (from task_relationships_v2.sql)
-- Note: groups table was renamed to categories, but check both
DO $$
BEGIN
  -- Check if groups table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'groups') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'groups' 
      AND policyname = 'groups_select'
    ) THEN
      CREATE POLICY "groups_select" ON groups
        FOR SELECT
        TO authenticated
        USING (org_id IN (
          SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
        ));
    END IF;
  END IF;
  
  -- Check if categories table exists (renamed from groups)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'categories' 
      AND policyname = 'categories_select'
    ) THEN
      CREATE POLICY "categories_select" ON categories
        FOR SELECT
        TO authenticated
        USING (org_id IN (
          SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
        ));
    END IF;
  END IF;
END $$;

-- Task Groups/Categories: Add SELECT policy if missing (from task_relationships_v2.sql)
-- Note: task_groups was renamed to task_categories, but check both
DO $$
BEGIN
  -- Check if task_groups table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_groups') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'task_groups' 
      AND policyname = 'task_groups_select'
    ) THEN
      CREATE POLICY "task_groups_select" ON task_groups
        FOR SELECT
        TO authenticated
        USING (
          task_id IN (
            SELECT id FROM tasks WHERE org_id IN (
              SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
            )
          )
        );
    END IF;
  END IF;
  
  -- Check if task_categories table exists (renamed from task_groups)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_categories') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'task_categories' 
      AND policyname = 'task_categories_select'
    ) THEN
      CREATE POLICY "task_categories_select" ON task_categories
        FOR SELECT
        TO authenticated
        USING (
          task_id IN (
            SELECT id FROM tasks WHERE org_id IN (
              SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
            )
          )
        );
    END IF;
  END IF;
END $$;

-- Task Spaces: Add SELECT policy if missing (from task_relationships_v2.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'task_spaces' 
    AND policyname = 'task_spaces_select'
  ) THEN
    CREATE POLICY "task_spaces_select" ON task_spaces
      FOR SELECT
      TO authenticated
      USING (
        task_id IN (
          SELECT id FROM tasks WHERE org_id IN (
            SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- Task Teams: Add SELECT policy if missing (from task_relationships_v2.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'task_teams' 
    AND policyname = 'task_teams_select'
  ) THEN
    CREATE POLICY "task_teams_select" ON task_teams
      FOR SELECT
      TO authenticated
      USING (
        task_id IN (
          SELECT id FROM tasks WHERE org_id IN (
            SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- Task Themes: Add SELECT policy if missing (from implement_typed_themes.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'task_themes' 
    AND policyname = 'task_themes_select'
  ) THEN
    CREATE POLICY "task_themes_select" ON task_themes
      FOR SELECT
      TO authenticated
      USING (
        task_id IN (
          SELECT id FROM tasks WHERE org_id IN (
            SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- Asset Themes: Add SELECT policy if missing (from implement_typed_themes.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'asset_themes' 
    AND policyname = 'asset_themes_select'
  ) THEN
    CREATE POLICY "asset_themes_select" ON asset_themes
      FOR SELECT
      TO authenticated
      USING (
        asset_id IN (
          SELECT id FROM assets WHERE org_id IN (
            SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- Property Themes: Add SELECT policy if missing (from implement_typed_themes.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'property_themes' 
    AND policyname = 'property_themes_select'
  ) THEN
    CREATE POLICY "property_themes_select" ON property_themes
      FOR SELECT
      TO authenticated
      USING (
        property_id IN (
          SELECT id FROM properties WHERE org_id IN (
            SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- Property Image Versions: Add SELECT policy if missing (from property_image_versioning.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'property_image_versions' 
    AND policyname = 'property_image_versions_select'
  ) THEN
    CREATE POLICY "property_image_versions_select" ON property_image_versions
      FOR SELECT
      TO authenticated
      USING (
        property_id IN (
          SELECT id FROM properties WHERE org_id IN (
            SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- Property Image Actions: Add SELECT policy if missing (from property_image_versioning.sql)
DO $$
BEGIN
  -- Check if table exists first
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'property_image_actions') THEN
    -- Check what the foreign key column is called
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'property_image_actions' 
      AND column_name = 'version_id'
    ) THEN
      -- Use version_id if it exists
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'property_image_actions' 
        AND policyname = 'property_image_actions_select'
      ) THEN
        CREATE POLICY "property_image_actions_select" ON property_image_actions
          FOR SELECT
          TO authenticated
          USING (
            version_id IN (
              SELECT id FROM property_image_versions WHERE property_id IN (
                SELECT id FROM properties WHERE org_id IN (
                  SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
                )
              )
            )
          );
      END IF;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'property_image_actions' 
      AND column_name = 'image_version_id'
    ) THEN
      -- Use image_version_id if that's the column name
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'property_image_actions' 
        AND policyname = 'property_image_actions_select'
      ) THEN
        CREATE POLICY "property_image_actions_select" ON property_image_actions
          FOR SELECT
          TO authenticated
          USING (
            image_version_id IN (
              SELECT id FROM property_image_versions WHERE property_id IN (
                SELECT id FROM properties WHERE org_id IN (
                  SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
                )
              )
            )
          );
      END IF;
    END IF;
  END IF;
END $$;

