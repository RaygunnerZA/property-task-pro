-- Example: Import Property Spaces from CSV
-- This shows how to use the import_property_spaces_from_csv function
-- with data from filla_property_spaces_import_template.csv

-- Step 1: Convert CSV to JSONB format
-- The CSV columns map as follows:
--   Property Name → property_name
--   Property Address → property_address
--   Space Group → space_group
--   Space Type → space_type
--   Space Name → space_name
--   Floor / Level → floor_level
--   Internal or External → internal_external
--   Area (m²) → area_sqm
--   Notes → notes

-- Example: Import a single property with spaces
-- Replace 'YOUR_ORG_ID' with actual org_id UUID
-- Replace property data with actual values from CSV

SELECT import_property_spaces_from_csv(
  'YOUR_ORG_ID'::UUID,
  '[
    {
      "property_name": "Example Property",
      "property_address": "123 Main Street, London, UK",
      "space_group": "Circulation",
      "space_type": "Corridor",
      "space_name": "Main Corridor - Ground Floor",
      "floor_level": "Ground",
      "internal_external": "Internal",
      "area_sqm": 25.5,
      "notes": "Main access corridor"
    },
    {
      "property_name": "Example Property",
      "property_address": "123 Main Street, London, UK",
      "space_group": "Habitable / Working",
      "space_type": "Office",
      "space_name": "Office 101",
      "floor_level": "1st Floor",
      "internal_external": "Internal",
      "area_sqm": 15.0,
      "notes": null
    },
    {
      "property_name": "Example Property",
      "property_address": "123 Main Street, London, UK",
      "space_group": "External Areas",
      "space_type": "Car Park",
      "space_name": "Main Car Park",
      "floor_level": null,
      "internal_external": "External",
      "area_sqm": 200.0,
      "notes": null
    }
  ]'::JSONB
);

-- Example: Import space types only (template rows without property data)
-- This will create space types but skip space instance creation
SELECT import_property_spaces_from_csv(
  'YOUR_ORG_ID'::UUID,
  '[
    {
      "property_name": null,
      "property_address": null,
      "space_group": "Circulation",
      "space_type": "Corridor",
      "space_name": null,
      "floor_level": null,
      "internal_external": "Internal",
      "area_sqm": null,
      "notes": null
    },
    {
      "property_name": null,
      "property_address": null,
      "space_group": "Habitable / Working",
      "space_type": "Bedroom",
      "space_name": null,
      "floor_level": null,
      "internal_external": "Internal",
      "area_sqm": null,
      "notes": null
    }
  ]'::JSONB
);

-- The function returns statistics:
-- {
--   "space_types_created": 2,
--   "space_types_existing": 0,
--   "properties_created": 1,
--   "properties_matched": 0,
--   "spaces_created": 3,
--   "spaces_skipped": 0,
--   "errors": []
-- }
