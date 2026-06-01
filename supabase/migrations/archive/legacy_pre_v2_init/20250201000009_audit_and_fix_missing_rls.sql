-- Synchronization Audit: Check and fix missing RLS policies
-- This migration ensures all tables with RLS enabled have appropriate policies

-- ============================================================================
-- HELPER: Check which tables have RLS enabled but no policies
-- ============================================================================
-- This query will be run manually to identify gaps, then we create policies

-- ============================================================================
-- TABLES TO CHECK (from filla_v2_init.sql):
-- ============================================================================
-- organisations - RLS enabled
-- organisation_members - RLS enabled
-- properties - RLS enabled
-- spaces - RLS enabled
-- assets - RLS enabled
-- tasks - RLS enabled
-- schedule_items - RLS enabled
-- task_instances - RLS enabled
-- issues - RLS enabled
-- compliance_sources - RLS enabled
-- compliance_documents - RLS enabled
-- compliance_rules - RLS enabled
-- attachments - RLS enabled
-- evidence - RLS enabled
-- contractor_tokens - RLS enabled
-- subscription_tiers - RLS enabled
-- org_subscriptions - RLS enabled
-- org_usage - RLS enabled

-- ============================================================================
-- ADDITIONAL TABLES FROM OTHER MIGRATIONS:
-- ============================================================================
-- conversations - RLS enabled (from messaging_tables.sql)
-- messages - RLS enabled (from messaging_tables.sql)
-- teams - RLS enabled (from task_relationships_v2.sql)
-- groups - RLS enabled (from task_relationships_v2.sql)
-- task_spaces - RLS enabled (from task_relationships_v2.sql)
-- task_teams - RLS enabled (from task_relationships_v2.sql)
-- task_groups - RLS enabled (from task_relationships_v2.sql)
-- themes - RLS enabled (from implement_typed_themes.sql)
-- task_themes - RLS enabled (from implement_typed_themes.sql)
-- asset_themes - RLS enabled (from implement_typed_themes.sql)
-- property_themes - RLS enabled (from implement_typed_themes.sql)
-- property_image_versions - RLS enabled (from property_image_versioning.sql)
-- property_image_actions - RLS enabled (from property_image_versioning.sql)

-- ============================================================================
-- FIX: Ensure all tables have at least SELECT policies for authenticated users
-- ============================================================================

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
      USING (org_id IN (
        SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
      ));
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
    -- Check what the foreign key column is called (it's image_version_id, not version_id)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'property_image_actions' 
      AND column_name = 'image_version_id'
    ) THEN
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

