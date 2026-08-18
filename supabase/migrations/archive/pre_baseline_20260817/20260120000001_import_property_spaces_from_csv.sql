-- Import Property Spaces from CSV
-- Idempotent function to import property spaces data from CSV format
-- Handles: property creation/matching, space type upsert, space instance creation

-- ============================================================================
-- HELPER FUNCTION: Map CSV Space Group to functional_class enum
-- ============================================================================
CREATE OR REPLACE FUNCTION map_space_group_to_functional_class(
  p_space_group TEXT
)
RETURNS functional_class
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE
    WHEN LOWER(TRIM(p_space_group)) = 'circulation' THEN 'circulation'::functional_class
    WHEN LOWER(TRIM(p_space_group)) = 'habitable / working' THEN 'habitable'::functional_class
    WHEN LOWER(TRIM(p_space_group)) = 'service areas' THEN 'service'::functional_class
    WHEN LOWER(TRIM(p_space_group)) = 'sanitary spaces' THEN 'sanitary'::functional_class
    WHEN LOWER(TRIM(p_space_group)) = 'storage' THEN 'storage'::functional_class
    WHEN LOWER(TRIM(p_space_group)) = 'technical / plant' THEN 'mechanical_plant'::functional_class
    WHEN LOWER(TRIM(p_space_group)) = 'external areas' THEN 'external_area'::functional_class
    ELSE NULL
  END;
END;
$$;

-- ============================================================================
-- HELPER FUNCTION: Map CSV Internal/External to enum
-- ============================================================================
CREATE OR REPLACE FUNCTION map_internal_external(
  p_value TEXT
)
RETURNS internal_external
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE
    WHEN LOWER(TRIM(p_value)) = 'internal' THEN 'internal'::internal_external
    WHEN LOWER(TRIM(p_value)) = 'external' THEN 'external'::internal_external
    ELSE NULL
  END;
END;
$$;

-- ============================================================================
-- MAIN IMPORT FUNCTION
-- ============================================================================
-- This function processes CSV data and creates:
--   1. Space types (idempotent upsert by name)
--   2. Properties (match or create by address within org)
--   3. Space instances (one per row with property data)
--
-- Parameters:
--   p_org_id: Organisation ID (required)
--   p_csv_data: JSON array of CSV rows, each with:
--     - property_name (TEXT, optional)
--     - property_address (TEXT, optional)
--     - space_group (TEXT, required)
--     - space_type (TEXT, required)
--     - space_name (TEXT, optional - defaults to space_type if empty)
--     - floor_level (TEXT, optional)
--     - internal_external (TEXT, required: 'Internal' or 'External')
--     - area_sqm (NUMERIC, optional)
--     - notes (TEXT, optional)
--
-- Returns: JSON with import statistics

CREATE OR REPLACE FUNCTION import_property_spaces_from_csv(
  p_org_id UUID,
  p_csv_data JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row JSONB;
  v_space_type_id UUID;
  v_property_id UUID;
  v_space_id UUID;
  v_space_group TEXT;
  v_space_type_name TEXT;
  v_functional_class functional_class;
  v_internal_external internal_external;
  v_space_name TEXT;
  v_floor_level TEXT;
  v_area_sqm NUMERIC(8,2);
  v_notes TEXT;
  v_property_name TEXT;
  v_property_address TEXT;
  v_stats JSON;
  v_space_types_created INTEGER := 0;
  v_space_types_existing INTEGER := 0;
  v_properties_created INTEGER := 0;
  v_properties_matched INTEGER := 0;
  v_spaces_created INTEGER := 0;
  v_spaces_skipped INTEGER := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Validate org_id
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'org_id is required';
  END IF;

  -- Validate CSV data
  IF p_csv_data IS NULL OR jsonb_array_length(p_csv_data) = 0 THEN
    RAISE EXCEPTION 'csv_data must be a non-empty JSON array';
  END IF;

  -- Process each row
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_csv_data)
  LOOP
    BEGIN
      -- Extract CSV fields
      v_space_group := v_row->>'space_group';
      v_space_type_name := v_row->>'space_type';
      v_property_name := v_row->>'property_name';
      v_property_address := v_row->>'property_address';
      v_space_name := NULLIF(TRIM(v_row->>'space_name'), '');
      v_floor_level := NULLIF(TRIM(v_row->>'floor_level'), '');
      v_area_sqm := NULLIF((v_row->>'area_sqm')::NUMERIC, NULL);
      v_notes := NULLIF(TRIM(v_row->>'notes'), '');

      -- Validate required fields for space type creation
      IF v_space_group IS NULL OR TRIM(v_space_group) = '' THEN
        RAISE WARNING 'Skipping row: space_group is required';
        v_spaces_skipped := v_spaces_skipped + 1;
        CONTINUE;
      END IF;

      IF v_space_type_name IS NULL OR TRIM(v_space_type_name) = '' THEN
        RAISE WARNING 'Skipping row: space_type is required';
        v_spaces_skipped := v_spaces_skipped + 1;
        CONTINUE;
      END IF;

      -- Map space group to functional class
      v_functional_class := map_space_group_to_functional_class(v_space_group);
      IF v_functional_class IS NULL THEN
        RAISE EXCEPTION 'Unknown space_group: %', v_space_group;
      END IF;

      -- Upsert space type (idempotent by name)
      -- Check if exists first for statistics
      SELECT id INTO v_space_type_id
      FROM space_types
      WHERE name = TRIM(v_space_type_name);

      IF v_space_type_id IS NULL THEN
        -- Insert new space type
        INSERT INTO space_types (name, functional_class, default_ui_group)
        VALUES (TRIM(v_space_type_name), v_functional_class, TRIM(v_space_group))
        RETURNING id INTO v_space_type_id;
        v_space_types_created := v_space_types_created + 1;
      ELSE
        -- Update existing space type
        UPDATE space_types
        SET
          functional_class = v_functional_class,
          default_ui_group = TRIM(v_space_group)
        WHERE id = v_space_type_id;
        v_space_types_existing := v_space_types_existing + 1;
      END IF;

      -- Only create space instances if property data is provided
      IF v_property_address IS NOT NULL AND TRIM(v_property_address) != '' THEN
        -- Match or create property (by address within org)
        SELECT id INTO v_property_id
        FROM properties
        WHERE org_id = p_org_id
          AND LOWER(TRIM(address)) = LOWER(TRIM(v_property_address));

        IF v_property_id IS NULL THEN
          -- Create new property
          INSERT INTO properties (org_id, address, nickname)
          VALUES (
            p_org_id,
            TRIM(v_property_address),
            NULLIF(TRIM(v_property_name), '')
          )
          RETURNING id INTO v_property_id;
          v_properties_created := v_properties_created + 1;
        ELSE
          v_properties_matched := v_properties_matched + 1;
        END IF;

        -- Map internal/external
        v_internal_external := map_internal_external(v_row->>'internal_external');
        IF v_internal_external IS NULL AND (v_row->>'internal_external') IS NOT NULL THEN
          RAISE WARNING 'Invalid internal_external value: %, defaulting to internal', v_row->>'internal_external';
          v_internal_external := 'internal'::internal_external;
        END IF;

        -- Default space name to space type name if not provided
        IF v_space_name IS NULL OR v_space_name = '' THEN
          v_space_name := TRIM(v_space_type_name);
        END IF;

        -- Create space instance
        INSERT INTO spaces (
          org_id,
          property_id,
          space_type_id,
          name,
          floor_level,
          area_sqm,
          internal_external,
          notes
        )
        VALUES (
          p_org_id,
          v_property_id,
          v_space_type_id,
          v_space_name,
          v_floor_level,
          v_area_sqm,
          v_internal_external,
          v_notes
        )
        RETURNING id INTO v_space_id;

        v_spaces_created := v_spaces_created + 1;
      ELSE
        -- Row has no property data - this is a template row showing available space types
        -- Space type was already created above, skip space instance creation
        v_spaces_skipped := v_spaces_skipped + 1;
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        -- Collect error but continue processing
        v_errors := array_append(v_errors, format('Row error: %s - %s', v_row->>'space_type', SQLERRM));
        v_spaces_skipped := v_spaces_skipped + 1;
    END;
  END LOOP;

  -- Return statistics
  v_stats := json_build_object(
    'space_types_created', v_space_types_created,
    'space_types_existing', v_space_types_existing,
    'properties_created', v_properties_created,
    'properties_matched', v_properties_matched,
    'spaces_created', v_spaces_created,
    'spaces_skipped', v_spaces_skipped,
    'errors', v_errors
  );

  RETURN v_stats;
END;
$$;

GRANT EXECUTE ON FUNCTION import_property_spaces_from_csv(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION map_space_group_to_functional_class(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION map_internal_external(TEXT) TO authenticated;

COMMENT ON FUNCTION import_property_spaces_from_csv IS 'Idempotent import function for property spaces from CSV data. Creates space types, properties, and space instances.';
COMMENT ON FUNCTION map_space_group_to_functional_class IS 'Maps CSV space group names to functional_class enum values.';
COMMENT ON FUNCTION map_internal_external IS 'Maps CSV internal/external text to internal_external enum values.';
