-- Add thumbnail_url to asset_files for fast, efficient card display
-- Same pattern as attachments: store small thumbnail for list views

ALTER TABLE asset_files
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

COMMENT ON COLUMN asset_files.thumbnail_url IS 'URL to optimized thumbnail (WebP, ~200px) for list/card display. Prefer over file_url for performance.';
