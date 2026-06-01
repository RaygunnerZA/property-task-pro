-- Add thumbnail_url column to attachments table for optimized image display
ALTER TABLE attachments 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Add comment
COMMENT ON COLUMN attachments.thumbnail_url IS 'URL to optimized thumbnail version of the image (WebP, 800px width)';

