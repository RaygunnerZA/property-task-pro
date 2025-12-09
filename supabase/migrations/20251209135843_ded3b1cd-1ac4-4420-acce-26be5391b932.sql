-- Migration Step 1: Add metadata JSONB column to tasks table
-- Purpose: Flexible storage for AI suggestions, repeat rules, chips, and future metadata

DO $$
BEGIN
  -- Check if column already exists (idempotent)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tasks' 
    AND column_name = 'metadata'
  ) THEN
    -- Add the column
    ALTER TABLE public.tasks 
    ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb NOT NULL;
    
    -- Add descriptive comment
    COMMENT ON COLUMN public.tasks.metadata IS 
      'Flexible storage for AI suggestions, repeat rules, chips, and future metadata.';
      
    RAISE NOTICE 'Column tasks.metadata added successfully';
  ELSE
    RAISE NOTICE 'Column tasks.metadata already exists, skipping';
  END IF;
END $$;