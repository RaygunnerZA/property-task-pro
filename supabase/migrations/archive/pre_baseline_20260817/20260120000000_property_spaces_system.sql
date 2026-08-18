-- Property Spaces System Migration (Authoritative, Production-Ready)
-- Adapted to Filla schema with org_id for RLS
--
-- Creates a clean, future-proof data model for property spaces that separates:
--   • Space types (canonical, system-owned)
--   • Space instances (property-specific, user-owned)
--   • UI grouping (presentation only)
--   • Listed building metadata (separate, optional, space-level or property-level)
--
-- Model rules:
--   • Space Types define what a space is
--   • Space Instances represent real, inspectable spaces
--   • Functional class drives compliance logic
--   • UI grouping must not drive logic
--   • Listed building data must not be embedded in spaces

-- ============================================================================
-- ENUMS (Minimal, Stable)
-- ============================================================================

CREATE TYPE functional_class AS ENUM (
  'circulation',
  'habitable',
  'service',
  'sanitary',
  'storage',
  'mechanical_plant',
  'it_infrastructure',
  'electrical',
  'power_backup',
  'building_services',
  'vertical_transport',
  'external_area',
  'external_logistics'
);

CREATE TYPE internal_external AS ENUM (
  'internal',
  'external'
);

-- ============================================================================
-- SPACE TYPES (System Reference)
-- ============================================================================
-- Canonical definitions of space types. System-owned and stable.
-- No org_id - these are global, system-provided definitions.

CREATE TABLE IF NOT EXISTS space_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  functional_class functional_class NOT NULL,
  default_ui_group TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Ensure unique names globally
  CONSTRAINT space_types_name_unique UNIQUE (name)
);

COMMENT ON TABLE space_types IS 'Canonical definitions of space types. System-owned and stable.';
COMMENT ON COLUMN space_types.functional_class IS 'Drives compliance and asset logic.';
COMMENT ON COLUMN space_types.default_ui_group IS 'Default presentation grouping only.';

ALTER TABLE space_types ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SPACE INSTANCES (Property-Specific)
-- ============================================================================
-- Real, inspectable spaces within a property.
-- Adapted to Filla: keeps org_id for RLS compatibility.

-- Add new columns to existing spaces table
-- Note: space_type_id and internal_external are nullable initially for migration safety
-- They should be made NOT NULL after data migration is complete
ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS space_type_id UUID REFERENCES space_types(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS floor_level TEXT,
  ADD COLUMN IF NOT EXISTS area_sqm NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS internal_external internal_external,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Drop old space_type TEXT column if it exists (replaced by FK)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'spaces' 
    AND column_name = 'space_type'
    AND data_type = 'text'
  ) THEN
    ALTER TABLE spaces DROP COLUMN space_type;
    RAISE NOTICE 'Dropped old spaces.space_type TEXT column (replaced by space_type_id FK)';
  END IF;
END $$;

-- Add comments to clarify the table's purpose
COMMENT ON TABLE spaces IS 'Real, inspectable spaces within a property.';
COMMENT ON COLUMN spaces.name IS 'Human-readable label (e.g. WC – Ground Floor).';
COMMENT ON COLUMN spaces.space_type_id IS 'Reference to canonical space type definition.';
COMMENT ON COLUMN spaces.floor_level IS 'Floor level identifier (e.g. "Ground", "1st Floor", "Basement").';
COMMENT ON COLUMN spaces.area_sqm IS 'Optional but recommended area in square meters.';
COMMENT ON COLUMN spaces.internal_external IS 'Whether the space is internal or external.';
COMMENT ON COLUMN spaces.notes IS 'Optional notes about the space.';

-- ============================================================================
-- UI GROUP OVERRIDES (Optional, UI-Only)
-- ============================================================================
-- Optional overrides for UI grouping only. One-to-one with space instances.
-- Presentation only - must not drive business logic.

CREATE TABLE IF NOT EXISTS space_ui_groups (
  space_id UUID PRIMARY KEY REFERENCES spaces(id) ON DELETE CASCADE,
  ui_group TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE space_ui_groups IS 'Optional overrides for UI grouping only.';
COMMENT ON COLUMN space_ui_groups.ui_group IS 'UI group name override (e.g. "Ground Floor", "Interior", "Exterior").';
COMMENT ON COLUMN space_ui_groups.reason IS 'Optional reason for the override.';

ALTER TABLE space_ui_groups ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- LISTED BUILDING METADATA
-- ============================================================================
-- Heritage and listing metadata. Can apply to whole property or specific spaces.
-- Adapted to Filla: adds org_id for RLS compatibility.
--
-- Rule:
--   • space_id IS NULL → applies to whole property
--   • space_id IS NOT NULL → applies to that space only

CREATE TABLE IF NOT EXISTS listed_buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  is_listed BOOLEAN NOT NULL,
  listing_grade TEXT,
  -- Listing grade (e.g., "Grade I", "Grade II*", "Grade II", "Grade B", etc.)
  applies_to TEXT NOT NULL,
  -- Description of what the listing applies to (e.g., "Whole property", "Main building", "Specific space")
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE listed_buildings IS 'Heritage and listing metadata. Can apply to whole property or specific spaces.';
COMMENT ON COLUMN listed_buildings.space_id IS 'NULL means applies to whole property, NOT NULL means applies to that space only.';
COMMENT ON COLUMN listed_buildings.is_listed IS 'Whether the property/space is listed.';
COMMENT ON COLUMN listed_buildings.listing_grade IS 'Listing grade (e.g., "Grade I", "Grade II*", "Grade II", "Grade B").';
COMMENT ON COLUMN listed_buildings.applies_to IS 'Description of what the listing applies to.';

ALTER TABLE listed_buildings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Space types indexes
CREATE INDEX IF NOT EXISTS idx_space_types_functional_class ON space_types(functional_class);
CREATE INDEX IF NOT EXISTS idx_space_types_default_ui_group ON space_types(default_ui_group);

-- Space instances indexes
CREATE INDEX IF NOT EXISTS idx_spaces_space_type_id ON spaces(space_type_id);
CREATE INDEX IF NOT EXISTS idx_spaces_property_id ON spaces(property_id);
CREATE INDEX IF NOT EXISTS idx_spaces_org_id ON spaces(org_id);
CREATE INDEX IF NOT EXISTS idx_spaces_internal_external ON spaces(internal_external);
CREATE INDEX IF NOT EXISTS idx_spaces_property_floor ON spaces(property_id, floor_level);

-- Space UI groups indexes
CREATE INDEX IF NOT EXISTS idx_space_ui_groups_ui_group ON space_ui_groups(ui_group);

-- Listed buildings indexes
CREATE INDEX IF NOT EXISTS idx_listed_buildings_property_id ON listed_buildings(property_id);
CREATE INDEX IF NOT EXISTS idx_listed_buildings_space_id ON listed_buildings(space_id);
CREATE INDEX IF NOT EXISTS idx_listed_buildings_org_id ON listed_buildings(org_id);
CREATE INDEX IF NOT EXISTS idx_listed_buildings_is_listed ON listed_buildings(is_listed);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================
-- RLS policies are stubbed - do not invent auth logic per requirements
-- Policies intentionally not fully defined here.
-- To be implemented based on organisation / property ownership model.

-- Space Types: System-owned, readable by all authenticated users
DROP POLICY IF EXISTS "space_types_select" ON space_types;
CREATE POLICY "space_types_select" ON space_types
  FOR SELECT
  TO authenticated
  USING (true);
  -- System types are readable by all authenticated users

-- Space Instances: Use existing spaces policies (already exist)
-- No changes needed - existing RLS policies on spaces table remain

-- Space UI Groups: Org members can read/write their org's groups
DROP POLICY IF EXISTS "space_ui_groups_select" ON space_ui_groups;
CREATE POLICY "space_ui_groups_select" ON space_ui_groups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM spaces
      WHERE spaces.id = space_ui_groups.space_id
        AND spaces.org_id = current_org_id()
    )
  );

DROP POLICY IF EXISTS "space_ui_groups_insert" ON space_ui_groups;
CREATE POLICY "space_ui_groups_insert" ON space_ui_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM spaces
      WHERE spaces.id = space_ui_groups.space_id
        AND spaces.org_id = current_org_id()
    )
  );

DROP POLICY IF EXISTS "space_ui_groups_update" ON space_ui_groups;
CREATE POLICY "space_ui_groups_update" ON space_ui_groups
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM spaces
      WHERE spaces.id = space_ui_groups.space_id
        AND spaces.org_id = current_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM spaces
      WHERE spaces.id = space_ui_groups.space_id
        AND spaces.org_id = current_org_id()
    )
  );

DROP POLICY IF EXISTS "space_ui_groups_delete" ON space_ui_groups;
CREATE POLICY "space_ui_groups_delete" ON space_ui_groups
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM spaces
      WHERE spaces.id = space_ui_groups.space_id
        AND spaces.org_id = current_org_id()
    )
  );

-- Listed Buildings: Org members can read/write their org's metadata
DROP POLICY IF EXISTS "listed_buildings_select" ON listed_buildings;
CREATE POLICY "listed_buildings_select" ON listed_buildings
  FOR SELECT
  TO authenticated
  USING (org_id = current_org_id());

DROP POLICY IF EXISTS "listed_buildings_insert" ON listed_buildings;
CREATE POLICY "listed_buildings_insert" ON listed_buildings
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id = current_org_id());

DROP POLICY IF EXISTS "listed_buildings_update" ON listed_buildings;
CREATE POLICY "listed_buildings_update" ON listed_buildings
  FOR UPDATE
  TO authenticated
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

DROP POLICY IF EXISTS "listed_buildings_delete" ON listed_buildings;
CREATE POLICY "listed_buildings_delete" ON listed_buildings
  FOR DELETE
  TO authenticated
  USING (org_id = current_org_id());

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
-- After migrating existing space data:
--   1. Populate space_type_id for existing spaces (map from old space_type TEXT)
--   2. Populate internal_external for existing spaces
--   3. Once all spaces have space_type_id and internal_external:
--      ALTER TABLE spaces ALTER COLUMN space_type_id SET NOT NULL;
--      ALTER TABLE spaces ALTER COLUMN internal_external SET NOT NULL;
--
-- This migration makes these columns nullable initially for migration safety.
-- The authoritative schema requires them to be NOT NULL.
