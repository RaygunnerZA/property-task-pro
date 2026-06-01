-- Property Seeding Engine
-- Auto-generates default themes, spaces, and property_details when a property is created
-- Source: @Docs/03_Data_Model.md

-- ============================================================================
-- FUNCTION: Seed Property Defaults
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_property_defaults(
  p_property_id UUID,
  p_org_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_theme_id UUID;
BEGIN
  -- ============================================================================
  -- STEP 1: Create empty property_details row
  -- ============================================================================
  INSERT INTO property_details (property_id, org_id)
  VALUES (p_property_id, p_org_id)
  ON CONFLICT (property_id) DO NOTHING;

  -- ============================================================================
  -- STEP 2: Create/Link Default Themes (Org-wide)
  -- ============================================================================
  -- Themes are org-wide, so we check if they exist, create if not, then link to property
  
  -- Compliance Theme
  SELECT id INTO v_theme_id
  FROM themes
  WHERE org_id = p_org_id
    AND name = 'Compliance'
    AND type = 'group'
  LIMIT 1;
  
  IF v_theme_id IS NULL THEN
    INSERT INTO themes (org_id, name, type, color, icon)
    VALUES (p_org_id, 'Compliance', 'group', '#EB6834', 'shield-check')
    RETURNING id INTO v_theme_id;
  END IF;
  
  -- Link to property
  INSERT INTO property_themes (property_id, theme_id)
  VALUES (p_property_id, v_theme_id)
  ON CONFLICT (property_id, theme_id) DO NOTHING;

  -- Utilities Theme
  SELECT id INTO v_theme_id
  FROM themes
  WHERE org_id = p_org_id
    AND name = 'Utilities'
    AND type = 'group'
  LIMIT 1;
  
  IF v_theme_id IS NULL THEN
    INSERT INTO themes (org_id, name, type, color, icon)
    VALUES (p_org_id, 'Utilities', 'group', '#8EC9CE', 'zap')
    RETURNING id INTO v_theme_id;
  END IF;
  
  INSERT INTO property_themes (property_id, theme_id)
  VALUES (p_property_id, v_theme_id)
  ON CONFLICT (property_id, theme_id) DO NOTHING;

  -- Maintenance Theme
  SELECT id INTO v_theme_id
  FROM themes
  WHERE org_id = p_org_id
    AND name = 'Maintenance'
    AND type = 'group'
  LIMIT 1;
  
  IF v_theme_id IS NULL THEN
    INSERT INTO themes (org_id, name, type, color, icon)
    VALUES (p_org_id, 'Maintenance', 'group', '#4ECDC4', 'wrench')
    RETURNING id INTO v_theme_id;
  END IF;
  
  INSERT INTO property_themes (property_id, theme_id)
  VALUES (p_property_id, v_theme_id)
  ON CONFLICT (property_id, theme_id) DO NOTHING;

  -- Safety Theme
  SELECT id INTO v_theme_id
  FROM themes
  WHERE org_id = p_org_id
    AND name = 'Safety'
    AND type = 'group'
  LIMIT 1;
  
  IF v_theme_id IS NULL THEN
    INSERT INTO themes (org_id, name, type, color, icon)
    VALUES (p_org_id, 'Safety', 'group', '#FF6B6B', 'alert-triangle')
    RETURNING id INTO v_theme_id;
  END IF;
  
  INSERT INTO property_themes (property_id, theme_id)
  VALUES (p_property_id, v_theme_id)
  ON CONFLICT (property_id, theme_id) DO NOTHING;

  -- Assets Theme
  SELECT id INTO v_theme_id
  FROM themes
  WHERE org_id = p_org_id
    AND name = 'Assets'
    AND type = 'group'
  LIMIT 1;
  
  IF v_theme_id IS NULL THEN
    INSERT INTO themes (org_id, name, type, color, icon)
    VALUES (p_org_id, 'Assets', 'group', '#96CEB4', 'package')
    RETURNING id INTO v_theme_id;
  END IF;
  
  INSERT INTO property_themes (property_id, theme_id)
  VALUES (p_property_id, v_theme_id)
  ON CONFLICT (property_id, theme_id) DO NOTHING;

  -- ============================================================================
  -- STEP 3: Create Default Spaces (Property-specific)
  -- ============================================================================
  -- Spaces are property-specific, so we create them for each new property
  -- Check if spaces already exist to prevent duplicates
  
  IF NOT EXISTS (SELECT 1 FROM spaces WHERE property_id = p_property_id LIMIT 1) THEN
    INSERT INTO spaces (org_id, property_id, name, space_type)
    VALUES
      (p_org_id, p_property_id, 'Kitchen', 'interior'),
      (p_org_id, p_property_id, 'Living Room', 'interior'),
      (p_org_id, p_property_id, 'Bedroom', 'interior'),
      (p_org_id, p_property_id, 'Bathroom', 'interior'),
      (p_org_id, p_property_id, 'Exterior', 'exterior'),
      (p_org_id, p_property_id, 'Basement', 'interior'),
      (p_org_id, p_property_id, 'Attic', 'interior');
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail property creation
    RAISE WARNING 'Error seeding property defaults for property %: %', p_property_id, SQLERRM;
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION seed_property_defaults(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION seed_property_defaults(UUID, UUID) TO service_role;

-- ============================================================================
-- TRIGGER: Auto-seed on Property Creation
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_seed_property_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call seeding function after property is inserted
  PERFORM seed_property_defaults(NEW.id, NEW.org_id);
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS seed_property_defaults_trigger ON properties;
CREATE TRIGGER seed_property_defaults_trigger
  AFTER INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_property_defaults();

