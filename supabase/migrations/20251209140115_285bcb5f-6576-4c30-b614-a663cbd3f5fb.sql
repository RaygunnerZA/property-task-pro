-- Migration Step 2: Add space_ids UUID[] column to tasks table
-- Purpose: Associates a task with one or more spaces (parallel to property_id)

DO $$
BEGIN
  -- Check if column already exists (idempotent)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tasks' 
    AND column_name = 'space_ids'
  ) THEN
    -- Add the column (nullable with empty array default)
    ALTER TABLE public.tasks 
    ADD COLUMN space_ids UUID[] DEFAULT '{}'::uuid[];
    
    -- Add descriptive comment
    COMMENT ON COLUMN public.tasks.space_ids IS 
      'Associates a task with one or more spaces. Parallel to property_id. Optional.';
      
    RAISE NOTICE 'Column tasks.space_ids added successfully';
  ELSE
    RAISE NOTICE 'Column tasks.space_ids already exists, skipping';
  END IF;
END $$;