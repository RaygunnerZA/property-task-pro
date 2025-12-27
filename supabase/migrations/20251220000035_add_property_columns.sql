-- Add missing columns to properties table: nickname, thumbnail_url, icon_name, icon_color_hex, and is_archived

-- Add nickname column
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Add thumbnail_url column
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Add icon_name column
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS icon_name TEXT;

-- Add icon_color_hex column
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS icon_color_hex TEXT;

-- Add is_archived column (defaults to false)
-- First add as nullable, then set default for existing rows, then make NOT NULL
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN;

-- Set default value for existing rows
UPDATE properties 
SET is_archived = FALSE 
WHERE is_archived IS NULL;

-- Now make it NOT NULL with default
ALTER TABLE properties 
ALTER COLUMN is_archived SET DEFAULT FALSE,
ALTER COLUMN is_archived SET NOT NULL;

-- Add index for filtering archived properties
CREATE INDEX IF NOT EXISTS idx_properties_is_archived ON properties(is_archived);

