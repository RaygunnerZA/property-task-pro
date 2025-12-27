-- Add title column to tasks table if it doesn't exist
-- This migration ensures the title column exists for task creation

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS title TEXT;

-- Make it NOT NULL if it doesn't have a default, but first set a default for existing rows
-- Update any existing NULL titles to a default value
UPDATE tasks
SET title = 'Untitled Task'
WHERE title IS NULL;

-- Now make it NOT NULL
ALTER TABLE tasks
ALTER COLUMN title SET NOT NULL;

