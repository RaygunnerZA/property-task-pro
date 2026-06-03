-- Repair part 8: space_types.default_icon for PostgREST embed on spaces queries.

ALTER TABLE space_types ADD COLUMN IF NOT EXISTS default_icon TEXT;
ALTER TABLE space_types ADD COLUMN IF NOT EXISTS icon_alternates JSONB DEFAULT '[]';

COMMENT ON COLUMN space_types.default_icon IS 'Lucide icon name (kebab-case) for space display.';
COMMENT ON COLUMN space_types.icon_alternates IS 'JSON array of alternate Lucide icon names for this space type.';

UPDATE space_types SET default_icon = 'chef-hat' WHERE name = 'Kitchen' AND default_icon IS NULL;
UPDATE space_types SET default_icon = 'sofa' WHERE name = 'Living Room' AND default_icon IS NULL;
UPDATE space_types SET default_icon = 'bed-double' WHERE name = 'Bedroom' AND default_icon IS NULL;
UPDATE space_types SET default_icon = 'bath' WHERE name = 'Bathroom' AND default_icon IS NULL;
UPDATE space_types SET default_icon = 'home' WHERE name = 'Exterior' AND default_icon IS NULL;
UPDATE space_types SET default_icon = 'layers' WHERE name = 'Basement' AND default_icon IS NULL;
UPDATE space_types SET default_icon = 'home' WHERE name = 'Attic' AND default_icon IS NULL;

NOTIFY pgrst, 'reload schema';
