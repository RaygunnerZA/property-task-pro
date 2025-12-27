-- Implement Typed Themes Architecture
-- Replaces groups/categories with a unified themes system supporting multiple types

-- ============================================================================
-- STEP 1: Data Migration - Migrate existing groups/categories data to themes
-- ============================================================================

-- Create temporary themes table to migrate data
CREATE TABLE IF NOT EXISTS themes_temp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  parent_id UUID,
  type TEXT NOT NULL DEFAULT 'group',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migrate from groups table (if it exists and has data)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'groups') THEN
    INSERT INTO themes_temp (id, org_id, name, color, icon, type, created_at, updated_at)
    SELECT 
      id,
      org_id,
      name,
      color,
      icon,
      'group'::TEXT,
      COALESCE(created_at, now()),
      COALESCE(updated_at, now())
    FROM groups
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Migrated % rows from groups table', (SELECT COUNT(*) FROM groups);
  END IF;
END $$;

-- Migrate from categories table (if it exists and has data)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
    INSERT INTO themes_temp (id, org_id, name, color, icon, type, created_at, updated_at)
    SELECT 
      id,
      org_id,
      name,
      color,
      icon,
      'group'::TEXT,
      COALESCE(created_at, now()),
      COALESCE(updated_at, now())
    FROM categories
    WHERE id NOT IN (SELECT id FROM themes_temp)
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Migrated % rows from categories table', (SELECT COUNT(*) FROM categories);
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Clean the Slate - Drop old tables and junction tables
-- ============================================================================

-- Drop junction tables first (they have foreign keys)
DROP TABLE IF EXISTS task_categories CASCADE;
DROP TABLE IF EXISTS task_groups CASCADE;
DROP TABLE IF EXISTS asset_groups CASCADE;
DROP TABLE IF EXISTS property_groups CASCADE;

-- Drop old main tables
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS category_members CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;

-- ============================================================================
-- STEP 3: Create the Themes Table
-- ============================================================================

CREATE TABLE themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  parent_id UUID REFERENCES themes(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('category', 'project', 'tag', 'group')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for type filtering (common query pattern)
CREATE INDEX idx_themes_type ON themes(org_id, type);
CREATE INDEX idx_themes_parent ON themes(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_themes_org ON themes(org_id);

-- Add constraint to prevent circular references in parent_id
ALTER TABLE themes ADD CONSTRAINT themes_no_circular_parent 
  CHECK (id != parent_id);

-- ============================================================================
-- STEP 4: Migrate data from temp table to final themes table
-- ============================================================================

INSERT INTO themes (id, org_id, name, color, icon, type, created_at, updated_at)
SELECT id, org_id, name, color, icon, type, created_at, updated_at
FROM themes_temp
ON CONFLICT (id) DO NOTHING;

-- Drop temp table
DROP TABLE IF EXISTS themes_temp;

-- ============================================================================
-- STEP 5: Create Junction Tables (Many-to-Many)
-- ============================================================================

-- Task Themes Junction
CREATE TABLE task_themes (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, theme_id)
);

CREATE INDEX idx_task_themes_task ON task_themes(task_id);
CREATE INDEX idx_task_themes_theme ON task_themes(theme_id);

-- Asset Themes Junction
CREATE TABLE asset_themes (
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, theme_id)
);

CREATE INDEX idx_asset_themes_asset ON asset_themes(asset_id);
CREATE INDEX idx_asset_themes_theme ON asset_themes(theme_id);

-- Property Themes Junction
CREATE TABLE property_themes (
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  PRIMARY KEY (property_id, theme_id)
);

CREATE INDEX idx_property_themes_property ON property_themes(property_id);
CREATE INDEX idx_property_themes_theme ON property_themes(theme_id);

-- ============================================================================
-- STEP 6: Migrate existing junction table data
-- ============================================================================

-- Migrate from task_groups (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_groups') THEN
    INSERT INTO task_themes (task_id, theme_id)
    SELECT task_id, group_id
    FROM task_groups
    WHERE group_id IN (SELECT id FROM themes)
    ON CONFLICT (task_id, theme_id) DO NOTHING;
    
    RAISE NOTICE 'Migrated % rows from task_groups to task_themes', 
      (SELECT COUNT(*) FROM task_groups);
  END IF;
END $$;

-- Migrate from task_categories (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_categories') THEN
    INSERT INTO task_themes (task_id, theme_id)
    SELECT task_id, category_id
    FROM task_categories
    WHERE category_id IN (SELECT id FROM themes)
    ON CONFLICT (task_id, theme_id) DO NOTHING;
    
    RAISE NOTICE 'Migrated % rows from task_categories to task_themes', 
      (SELECT COUNT(*) FROM task_categories);
  END IF;
END $$;

-- ============================================================================
-- STEP 7: Enable RLS on all new tables
-- ============================================================================

ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_themes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 8: Create RLS Policies
-- ============================================================================

-- Themes: Users can only see/edit rows where org_id matches their membership
DROP POLICY IF EXISTS "themes_select" ON themes;
CREATE POLICY "themes_select" ON themes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = themes.org_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "themes_insert" ON themes;
CREATE POLICY "themes_insert" ON themes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = themes.org_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "themes_update" ON themes;
CREATE POLICY "themes_update" ON themes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = themes.org_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "themes_delete" ON themes;
CREATE POLICY "themes_delete" ON themes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = themes.org_id
        AND organisation_members.user_id = auth.uid()
    )
  );

-- Task Themes: Users can read/write relationships for their org's tasks
DROP POLICY IF EXISTS "task_themes_select" ON task_themes;
CREATE POLICY "task_themes_select" ON task_themes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM tasks
      JOIN organisation_members ON organisation_members.org_id = tasks.org_id
      WHERE tasks.id = task_themes.task_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "task_themes_insert" ON task_themes;
CREATE POLICY "task_themes_insert" ON task_themes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tasks
      JOIN organisation_members ON organisation_members.org_id = tasks.org_id
      WHERE tasks.id = task_themes.task_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "task_themes_delete" ON task_themes;
CREATE POLICY "task_themes_delete" ON task_themes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM tasks
      JOIN organisation_members ON organisation_members.org_id = tasks.org_id
      WHERE tasks.id = task_themes.task_id
        AND organisation_members.user_id = auth.uid()
    )
  );

-- Asset Themes: Users can read/write relationships for their org's assets
DROP POLICY IF EXISTS "asset_themes_select" ON asset_themes;
CREATE POLICY "asset_themes_select" ON asset_themes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM assets
      JOIN organisation_members ON organisation_members.org_id = assets.org_id
      WHERE assets.id = asset_themes.asset_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "asset_themes_insert" ON asset_themes;
CREATE POLICY "asset_themes_insert" ON asset_themes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM assets
      JOIN organisation_members ON organisation_members.org_id = assets.org_id
      WHERE assets.id = asset_themes.asset_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "asset_themes_delete" ON asset_themes;
CREATE POLICY "asset_themes_delete" ON asset_themes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM assets
      JOIN organisation_members ON organisation_members.org_id = assets.org_id
      WHERE assets.id = asset_themes.asset_id
        AND organisation_members.user_id = auth.uid()
    )
  );

-- Property Themes: Users can read/write relationships for their org's properties
DROP POLICY IF EXISTS "property_themes_select" ON property_themes;
CREATE POLICY "property_themes_select" ON property_themes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM properties
      JOIN organisation_members ON organisation_members.org_id = properties.org_id
      WHERE properties.id = property_themes.property_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "property_themes_insert" ON property_themes;
CREATE POLICY "property_themes_insert" ON property_themes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM properties
      JOIN organisation_members ON organisation_members.org_id = properties.org_id
      WHERE properties.id = property_themes.property_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "property_themes_delete" ON property_themes;
CREATE POLICY "property_themes_delete" ON property_themes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM properties
      JOIN organisation_members ON organisation_members.org_id = properties.org_id
      WHERE properties.id = property_themes.property_id
        AND organisation_members.user_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 9: Create updated_at trigger for themes
-- ============================================================================

CREATE OR REPLACE FUNCTION update_themes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS themes_updated_at ON themes;
CREATE TRIGGER themes_updated_at
  BEFORE UPDATE ON themes
  FOR EACH ROW
  EXECUTE FUNCTION update_themes_updated_at();

