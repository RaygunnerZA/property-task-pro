-- Add name column to assets table for entity recognition matching.
-- The resolution pipeline and rule-based extractor expect assets to have a
-- human-readable name (e.g. "Boiler", "Kitchen Fridge") for fuzzy matching.
-- Previously only `serial` existed, which is a serial-number identifier and
-- not suitable for natural-language matching.

ALTER TABLE assets ADD COLUMN IF NOT EXISTS name TEXT;

-- Create an index for case-insensitive name lookups used during resolution
CREATE INDEX IF NOT EXISTS idx_assets_name_lower
  ON assets (lower(name))
  WHERE name IS NOT NULL;

-- Backfill: copy serial into name where available so existing assets
-- have a searchable label. Operators can update these to friendlier names.
UPDATE assets SET name = serial WHERE serial IS NOT NULL AND name IS NULL;
