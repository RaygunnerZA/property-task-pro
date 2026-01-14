-- Add optimized_url, annotation_json, and upload_status to attachments table
-- Supports pre-task image creation with annotations

ALTER TABLE attachments 
ADD COLUMN IF NOT EXISTS optimized_url TEXT,
ADD COLUMN IF NOT EXISTS annotation_json JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS upload_status TEXT DEFAULT 'complete';

-- Add comments
COMMENT ON COLUMN attachments.optimized_url IS 'URL to optimized version (1200px max, WebP)';
COMMENT ON COLUMN attachments.annotation_json IS 'JSON array of annotations attached to this image';
COMMENT ON COLUMN attachments.upload_status IS 'Upload status: pending, uploading, complete, failed';

-- Add index for upload_status queries
CREATE INDEX IF NOT EXISTS idx_attachments_upload_status ON attachments(upload_status) WHERE upload_status != 'complete';
