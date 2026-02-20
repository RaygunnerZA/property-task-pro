-- Ensure optimized_url, annotation_json and upload_status columns exist on attachments.
-- The original migration (20260115000001) may have been registered in migration history
-- without the DDL actually executing on the remote database.

ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS optimized_url TEXT,
  ADD COLUMN IF NOT EXISTS annotation_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS upload_status TEXT DEFAULT 'complete';
