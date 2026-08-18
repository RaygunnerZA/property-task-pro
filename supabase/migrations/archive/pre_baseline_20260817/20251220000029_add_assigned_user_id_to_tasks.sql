-- Add assigned_user_id column to tasks table
-- This allows tasks to be assigned to individual users

ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user_id ON tasks(assigned_user_id);

-- Add comment
COMMENT ON COLUMN tasks.assigned_user_id IS 'User ID of the person assigned to this task';

