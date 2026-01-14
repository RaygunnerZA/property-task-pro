# Property Spaces CSV Import

## Overview

This import system processes CSV data to create:
1. **Space Types** (canonical, system-owned) - idempotent upsert by name
2. **Properties** (match or create by address within org)
3. **Space Instances** (one per row with property data)

## CSV Column Mapping

| CSV Column | Database Target | Notes |
|------------|----------------|-------|
| Property Name | `properties.nickname` | Optional, used if property is created |
| Property Address | `properties.address` | Required for space instance creation |
| Space Group | `space_types.default_ui_group` | UI-only, also maps to `functional_class` |
| Space Type | `space_types.name` | Required, deduplicated by name |
| Space Name | `spaces.name` | Optional, defaults to Space Type if empty |
| Floor / Level | `spaces.floor_level` | Optional |
| Internal or External | `spaces.internal_external` | Required enum: 'Internal' or 'External' |
| Area (m²) | `spaces.area_sqm` | Optional numeric |
| Notes | `spaces.notes` | Optional |

## Space Group → Functional Class Mapping

The CSV "Space Group" column maps to both:
- `space_types.default_ui_group` (direct mapping, UI-only)
- `space_types.functional_class` (enum mapping, drives compliance logic)

Mapping rules:
- `"Circulation"` → `functional_class = 'circulation'`
- `"Habitable / Working"` → `functional_class = 'habitable'`
- `"Service Areas"` → `functional_class = 'service'`
- `"Sanitary Spaces"` → `functional_class = 'sanitary'`
- `"Storage"` → `functional_class = 'storage'`
- `"Technical / Plant"` → `functional_class = 'mechanical_plant'`
- `"External Areas"` → `functional_class = 'external_area'`

## Import Logic

### Space Types
- **Upsert by name**: If space type exists, update `functional_class` and `default_ui_group`
- **Idempotent**: Re-running import will not duplicate space types
- **Global**: Space types are system-owned (no `org_id`)

### Properties
- **Match by address**: Within the same org, properties are matched by address (case-insensitive, trimmed)
- **Create if missing**: If no match found, property is created with provided name/address
- **Org-scoped**: Properties require `org_id`

### Space Instances
- **One per row**: Each CSV row with property data creates one space instance
- **Requires property**: Rows without `property_address` skip space instance creation (template rows)
- **Defaults**: If `space_name` is empty, defaults to `space_type` name
- **Optional fields**: Missing optional fields (floor_level, area_sqm, notes) do not block import

## Assumptions

1. **Property matching**: Properties are matched by address only (not name) within an org
2. **Space type deduplication**: Space types are globally unique by name (not org-scoped)
3. **Template rows**: Rows without property data are template rows that only create space types
4. **Functional class mapping**: The 7 space groups in the CSV map to the 7 corresponding enum values
5. **Internal/External**: Must be exactly "Internal" or "External" (case-insensitive)
6. **Area**: Must be valid numeric if provided, stored as NUMERIC(8,2)

## Usage

### SQL Function Call

```sql
SELECT import_property_spaces_from_csv(
  'org-uuid-here'::UUID,
  '[
    {
      "property_name": "My Property",
      "property_address": "123 Main St",
      "space_group": "Circulation",
      "space_type": "Corridor",
      "space_name": "Main Corridor",
      "floor_level": "Ground",
      "internal_external": "Internal",
      "area_sqm": 25.5,
      "notes": "Main access"
    }
  ]'::JSONB
);
```

### Return Value

Returns JSON statistics:
```json
{
  "space_types_created": 1,
  "space_types_existing": 0,
  "properties_created": 1,
  "properties_matched": 0,
  "spaces_created": 1,
  "spaces_skipped": 0,
  "errors": []
}
```

## Error Handling

- **Structural errors**: Function fails loudly (e.g., unknown space_group)
- **Data issues**: Warnings logged, row skipped, processing continues
- **Transaction safety**: Function should be called within a transaction for rollback capability

## Notes

- **Listed Building data**: Not handled in this import (per requirements, CSV has no space-specific listing data)
- **Site Type**: CSV column exists but is not used (not in schema)
- **Listing Grade**: CSV column exists but is not used (property-level only, not in CSV data)
