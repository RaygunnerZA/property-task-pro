-- Add attachment support to messages
-- Messages can have attachments linked via the attachments table (parent_type = 'message')

-- Add file_name and file_type to attachments table for better metadata
ALTER TABLE attachments 
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_attachments_parent ON attachments(parent_type, parent_id);

-- Add comment
COMMENT ON COLUMN attachments.parent_type IS 'Type of parent entity: message, task, property, etc.';
COMMENT ON COLUMN attachments.parent_id IS 'ID of the parent entity';

