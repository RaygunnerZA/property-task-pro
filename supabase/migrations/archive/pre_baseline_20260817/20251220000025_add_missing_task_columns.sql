-- Add missing columns to tasks table if they don't exist
-- This ensures all required columns exist for task creation

-- Add description column
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add property_id column (should exist from earlier migration, but ensure it)
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE CASCADE;

-- Ensure priority column exists
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

-- Ensure due_date column exists
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

-- Ensure status column exists with correct type
-- Check if task_status enum exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM ('open', 'in_progress', 'completed', 'archived');
  END IF;
END$$;

-- Ensure status column exists and has correct type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'status'
  ) THEN
    ALTER TABLE tasks ADD COLUMN status task_status NOT NULL DEFAULT 'open';
  END IF;
END$$;

