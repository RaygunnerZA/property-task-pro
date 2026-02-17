-- Add default_icon and icon_alternates to space_types
-- Single source of truth for space type → Lucide icon mapping (kebab-case)

ALTER TABLE space_types ADD COLUMN IF NOT EXISTS default_icon TEXT;
ALTER TABLE space_types ADD COLUMN IF NOT EXISTS icon_alternates JSONB DEFAULT '[]';

COMMENT ON COLUMN space_types.default_icon IS 'Lucide icon name (kebab-case) for space display.';
COMMENT ON COLUMN space_types.icon_alternates IS 'JSON array of alternate Lucide icon names for this space type.';

-- Seed common space types with icon mappings (from user specification)
-- Only updates existing rows; new types added via CSV import get icons later or via ai_icon_search fallback

-- Residential & Domestic
UPDATE space_types SET default_icon = 'sofa', icon_alternates = '["armchair", "lamp-floor"]'::jsonb WHERE name = 'Living Room';
UPDATE space_types SET default_icon = 'sofa', icon_alternates = '["armchair", "lamp-floor"]'::jsonb WHERE name = 'Sitting Room';
UPDATE space_types SET default_icon = 'sofa', icon_alternates = '["armchair", "lamp-floor"]'::jsonb WHERE name = 'Lounge';
UPDATE space_types SET default_icon = 'bed-double', icon_alternates = '["bed", "lamp"]'::jsonb WHERE name = 'Bedroom';
UPDATE space_types SET default_icon = 'bed-double', icon_alternates = '["bed", "lamp"]'::jsonb WHERE name = 'Master Bedroom';
UPDATE space_types SET default_icon = 'bed-double', icon_alternates = '["bed", "lamp"]'::jsonb WHERE name = 'Guest Room';
UPDATE space_types SET default_icon = 'bath', icon_alternates = '["toilet", "shower-head"]'::jsonb WHERE name = 'Bathroom';
UPDATE space_types SET default_icon = 'bath', icon_alternates = '["toilet", "shower-head"]'::jsonb WHERE name = 'Family Bathroom';
UPDATE space_types SET default_icon = 'toilet' WHERE name = 'WC';
UPDATE space_types SET default_icon = 'toilet' WHERE name = 'Toilet';
UPDATE space_types SET default_icon = 'toilet' WHERE name = 'Powder Room';
UPDATE space_types SET default_icon = 'shower-head', icon_alternates = '["droplets"]'::jsonb WHERE name = 'Shower Room';
UPDATE space_types SET default_icon = 'chef-hat', icon_alternates = '["cooking-pot", "utensils-crossed"]'::jsonb WHERE name = 'Kitchen';
UPDATE space_types SET default_icon = 'utensils-crossed', icon_alternates = '["wine", "utensils"]'::jsonb WHERE name = 'Dining Room';
UPDATE space_types SET default_icon = 'archive', icon_alternates = '["boxes"]'::jsonb WHERE name = 'Pantry';
UPDATE space_types SET default_icon = 'shirt', icon_alternates = '["settings"]'::jsonb WHERE name = 'Utility';
UPDATE space_types SET default_icon = 'shirt', icon_alternates = '["settings"]'::jsonb WHERE name = 'Laundry Room';
UPDATE space_types SET default_icon = 'desk', icon_alternates = '["briefcase", "monitor"]'::jsonb WHERE name = 'Home Office';
UPDATE space_types SET default_icon = 'desk', icon_alternates = '["briefcase", "monitor"]'::jsonb WHERE name = 'Study';
UPDATE space_types SET default_icon = 'puzzle', icon_alternates = '["toy-brick"]'::jsonb WHERE name = 'Playroom';
UPDATE space_types SET default_icon = 'sun' WHERE name = 'Conservatory';
UPDATE space_types SET default_icon = 'sun' WHERE name = 'Sunroom';
UPDATE space_types SET default_icon = 'car', icon_alternates = '["wrench"]'::jsonb WHERE name = 'Garage';
UPDATE space_types SET default_icon = 'home', icon_alternates = '["triangle"]'::jsonb WHERE name = 'Loft';
UPDATE space_types SET default_icon = 'home', icon_alternates = '["triangle"]'::jsonb WHERE name = 'Attic';
UPDATE space_types SET default_icon = 'layers', icon_alternates = '["archive"]'::jsonb WHERE name = 'Basement';
UPDATE space_types SET default_icon = 'layers', icon_alternates = '["archive"]'::jsonb WHERE name = 'Cellar';

-- Office / Workspace
UPDATE space_types SET default_icon = 'briefcase', icon_alternates = '["desk", "monitor"]'::jsonb WHERE name = 'Office';
UPDATE space_types SET default_icon = 'users', icon_alternates = '["layout-grid"]'::jsonb WHERE name = 'Open Plan Office';
UPDATE space_types SET default_icon = 'users', icon_alternates = '["presentation", "video"]'::jsonb WHERE name = 'Meeting Room';
UPDATE space_types SET default_icon = 'users', icon_alternates = '["presentation", "video"]'::jsonb WHERE name = 'Conference Room';
UPDATE space_types SET default_icon = 'building-2', icon_alternates = '["users"]'::jsonb WHERE name = 'Boardroom';
UPDATE space_types SET default_icon = 'building-2', icon_alternates = '["bell"]'::jsonb WHERE name = 'Reception';
UPDATE space_types SET default_icon = 'building-2', icon_alternates = '["bell"]'::jsonb WHERE name = 'Lobby';
UPDATE space_types SET default_icon = 'coffee', icon_alternates = '["sofa"]'::jsonb WHERE name = 'Breakout Area';
UPDATE space_types SET default_icon = 'coffee', icon_alternates = '["chef-hat"]'::jsonb WHERE name = 'Canteen';
UPDATE space_types SET default_icon = 'coffee', icon_alternates = '["chef-hat"]'::jsonb WHERE name = 'Staff Kitchen';
UPDATE space_types SET default_icon = 'printer' WHERE name = 'Print Room';
UPDATE space_types SET default_icon = 'printer', icon_alternates = '["files"]'::jsonb WHERE name = 'Copy Room';
UPDATE space_types SET default_icon = 'phone' WHERE name = 'Phone Booth';
UPDATE space_types SET default_icon = 'phone' WHERE name = 'Call Room';
UPDATE space_types SET default_icon = 'server', icon_alternates = '["cpu"]'::jsonb WHERE name = 'IT Room';
UPDATE space_types SET default_icon = 'server' WHERE name = 'Server Room';
UPDATE space_types SET default_icon = 'server' WHERE name = 'Data Room';
UPDATE space_types SET default_icon = 'users', icon_alternates = '["id-card"]'::jsonb WHERE name = 'HR Office';
UPDATE space_types SET default_icon = 'graduation-cap' WHERE name = 'Training Room';
UPDATE space_types SET default_icon = 'graduation-cap', icon_alternates = '["book-open"]'::jsonb WHERE name = 'Classroom';
UPDATE space_types SET default_icon = 'book-open' WHERE name = 'Library';
UPDATE space_types SET default_icon = 'folder-archive', icon_alternates = '["archive"]'::jsonb WHERE name = 'Archive Room';
UPDATE space_types SET default_icon = 'boxes' WHERE name = 'Stock Room';
UPDATE space_types SET default_icon = 'shopping-cart', icon_alternates = '["store"]'::jsonb WHERE name = 'Retail Floor';
UPDATE space_types SET default_icon = 'shopping-cart', icon_alternates = '["store"]'::jsonb WHERE name = 'Sales Floor';
UPDATE space_types SET default_icon = 'wrench', icon_alternates = '["hammer"]'::jsonb WHERE name = 'Workshop';
UPDATE space_types SET default_icon = 'palette', icon_alternates = '["pen-tool"]'::jsonb WHERE name = 'Creative Studio';
UPDATE space_types SET default_icon = 'heart-pulse', icon_alternates = '["cross"]'::jsonb WHERE name = 'Medical Room';
UPDATE space_types SET default_icon = 'heart-pulse', icon_alternates = '["cross"]'::jsonb WHERE name = 'First Aid';
UPDATE space_types SET default_icon = 'flask-conical', icon_alternates = '["microscope"]'::jsonb WHERE name = 'Laboratory';
UPDATE space_types SET default_icon = 'shield-check', icon_alternates = '["camera"]'::jsonb WHERE name = 'Security Room';

-- Sanitary & Changing
UPDATE space_types SET default_icon = 'accessibility' WHERE name = 'Accessible WC';
UPDATE space_types SET default_icon = 'accessibility' WHERE name = 'Disabled WC';
UPDATE space_types SET default_icon = 'shirt' WHERE name = 'Changing Room';
UPDATE space_types SET default_icon = 'lock', icon_alternates = '["shield"]'::jsonb WHERE name = 'Locker Room';
UPDATE space_types SET default_icon = 'shower-head' WHERE name = 'Shower Block';

-- Technical / Plant
UPDATE space_types SET default_icon = 'factory' WHERE name = 'Plant Room';
UPDATE space_types SET default_icon = 'flame' WHERE name = 'Boiler Room';
UPDATE space_types SET default_icon = 'zap' WHERE name = 'Electrical Room';
UPDATE space_types SET default_icon = 'zap', icon_alternates = '["cable"]'::jsonb WHERE name = 'Switch Room';
UPDATE space_types SET default_icon = 'battery-charging' WHERE name = 'UPS Room';
UPDATE space_types SET default_icon = 'battery', icon_alternates = '["fuel"]'::jsonb WHERE name = 'Generator Room';
UPDATE space_types SET default_icon = 'wind' WHERE name = 'HVAC Room';
UPDATE space_types SET default_icon = 'arrow-up-down' WHERE name = 'Riser';
UPDATE space_types SET default_icon = 'arrow-up-down' WHERE name = 'Service Riser';
UPDATE space_types SET default_icon = 'move-vertical' WHERE name = 'Lift';
UPDATE space_types SET default_icon = 'move-vertical' WHERE name = 'Elevator';
UPDATE space_types SET default_icon = 'move-vertical' WHERE name = 'Lift Motor Room';
UPDATE space_types SET default_icon = 'network' WHERE name = 'Comms Room';

-- Circulation
UPDATE space_types SET default_icon = 'move-horizontal' WHERE name = 'Corridor';
UPDATE space_types SET default_icon = 'move-horizontal' WHERE name = 'Hallway';
UPDATE space_types SET default_icon = 'arrow-up-down' WHERE name = 'Staircase';
UPDATE space_types SET default_icon = 'corner-down-right' WHERE name = 'Landing';
UPDATE space_types SET default_icon = 'door-open' WHERE name = 'Entrance';
UPDATE space_types SET default_icon = 'log-out' WHERE name = 'Exit';
UPDATE space_types SET default_icon = 'triangle-alert', icon_alternates = '["flame"]'::jsonb WHERE name = 'Fire Escape';

-- External & Site
UPDATE space_types SET default_icon = 'trees' WHERE name = 'Garden';
UPDATE space_types SET default_icon = 'sun' WHERE name = 'Terrace';
UPDATE space_types SET default_icon = 'sun', icon_alternates = '["home"]'::jsonb WHERE name = 'Balcony';
UPDATE space_types SET default_icon = 'warehouse' WHERE name = 'Yard';
UPDATE space_types SET default_icon = 'square', icon_alternates = '["tree-palm"]'::jsonb WHERE name = 'Courtyard';
UPDATE space_types SET default_icon = 'car' WHERE name = 'Car Park';
UPDATE space_types SET default_icon = 'car' WHERE name = 'Parking';
UPDATE space_types SET default_icon = 'bike' WHERE name = 'Bike Store';
UPDATE space_types SET default_icon = 'truck' WHERE name = 'Loading Bay';
UPDATE space_types SET default_icon = 'trash-2' WHERE name = 'Bin Store';
UPDATE space_types SET default_icon = 'home', icon_alternates = '["triangle"]'::jsonb WHERE name = 'Roof';
UPDATE space_types SET default_icon = 'wind', icon_alternates = '["factory"]'::jsonb WHERE name = 'Rooftop Plant';

-- Storage (from suggestedSpaces)
UPDATE space_types SET default_icon = 'archive', icon_alternates = '["boxes"]'::jsonb WHERE name = 'Storage Room';
UPDATE space_types SET default_icon = 'archive', icon_alternates = '["boxes"]'::jsonb WHERE name = 'Closet';
UPDATE space_types SET default_icon = 'archive', icon_alternates = '["boxes"]'::jsonb WHERE name = 'Cupboard';
UPDATE space_types SET default_icon = 'archive', icon_alternates = '["folder-archive"]'::jsonb WHERE name = 'Archive';
UPDATE space_types SET default_icon = 'boxes' WHERE name = 'Stock Room';
UPDATE space_types SET default_icon = 'shirt' WHERE name = 'Break Room';
UPDATE space_types SET default_icon = 'shirt' WHERE name = 'Utility Room';
UPDATE space_types SET default_icon = 'users' WHERE name = 'Staff Room';
