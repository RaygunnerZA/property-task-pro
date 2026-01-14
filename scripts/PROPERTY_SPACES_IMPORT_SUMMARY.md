# Property Spaces CSV Import - Summary

## Mapping Logic

### 1. Space Types (Canonical, System-Owned)

**Source**: CSV column "Space Type"  
**Target**: `space_types.name`  
**Deduplication**: By name (global unique constraint)  
**Process**: 
- Extract unique space types from CSV
- Map "Space Group" → `functional_class` enum
- Map "Space Group" → `default_ui_group` (direct, UI-only)
- Upsert: Insert if new, update if exists

**Example**:
- CSV: `Space Type = "Corridor"`, `Space Group = "Circulation"`
- Creates: `space_types(name='Corridor', functional_class='circulation', default_ui_group='Circulation')`

### 2. Properties (Org-Scoped)

**Source**: CSV columns "Property Name" + "Property Address"  
**Target**: `properties` table  
**Matching**: By address (case-insensitive, trimmed) within org  
**Process**:
- If property with same address exists in org → use existing
- If not → create new property with address and optional nickname

**Example**:
- CSV: `Property Name = "Office Building"`, `Property Address = "123 Main St"`
- Creates/Matches: `properties(org_id=..., address='123 Main St', nickname='Office Building')`

### 3. Space Instances (Property-Specific)

**Source**: Each CSV row with property data  
**Target**: `spaces` table  
**Process**:
- One space instance per CSV row (if property data present)
- Links to space type via `space_type_id` FK
- Links to property via `property_id` FK
- Maps optional fields: floor_level, area_sqm, notes
- Maps required: internal_external enum

**Example**:
- CSV row with property data → creates one `spaces` record
- CSV row without property data → skips space instance (template row)

## Space Group → Functional Class Mapping

| CSV Space Group | functional_class Enum | default_ui_group |
|----------------|----------------------|------------------|
| "Circulation" | `circulation` | "Circulation" |
| "Habitable / Working" | `habitable` | "Habitable / Working" |
| "Service Areas" | `service` | "Service Areas" |
| "Sanitary Spaces" | `sanitary` | "Sanitary Spaces" |
| "Storage" | `storage` | "Storage" |
| "Technical / Plant" | `mechanical_plant` | "Technical / Plant" |
| "External Areas" | `external_area` | "External Areas" |

## Assumptions (Minimal)

1. **Property Matching**: Properties matched by address only (not name) within org scope
2. **Space Type Global**: Space types are globally unique by name (system-owned, no org_id)
3. **Template Rows**: Rows without `property_address` are template rows that only seed space types
4. **Space Name Default**: If `space_name` is empty, defaults to `space_type` name
5. **Internal/External**: Must be exactly "Internal" or "External" (case-insensitive, mapped to enum)
6. **Functional Class**: The 7 space groups in CSV map directly to 7 enum values (no guessing)
7. **Idempotency**: Re-running import updates existing space types but does not duplicate
8. **Optional Fields**: Missing floor_level, area_sqm, notes do not block import

## CSV Columns Not Used

- **Site Type**: Column exists in CSV but not in schema → ignored
- **Listed Building (Y/N)**: Not space-specific in CSV → ignored (would be property-level)
- **Listing Grade**: Not space-specific in CSV → ignored (would be property-level)

## Error Handling

- **Structural Errors**: Function fails loudly (e.g., unknown space_group, invalid org_id)
- **Data Issues**: Warnings logged, row skipped, processing continues
- **Transaction Safety**: Function should be wrapped in transaction for rollback

## Idempotency

- **Space Types**: Upsert by name (insert if new, update if exists)
- **Properties**: Match by address (create if missing, use existing if found)
- **Spaces**: Always insert (no deduplication - each row creates one space)

## Deliverables

1. ✅ **SQL Migration**: `supabase/migrations/20260120000001_import_property_spaces_from_csv.sql`
   - Main import function
   - Helper mapping functions
   - Idempotent upsert logic

2. ✅ **Mapping Logic Explanation**: This document

3. ✅ **Assumptions List**: Minimal assumptions documented above
