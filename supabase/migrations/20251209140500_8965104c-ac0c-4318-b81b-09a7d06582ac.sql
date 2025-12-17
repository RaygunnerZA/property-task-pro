-- Migration Step 3: Add compliance columns to tasks table
-- Purpose: Support compliance-related task features

DO $$
BEGIN
  -- Add is_compliance column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tasks' 
    AND column_name = 'is_compliance'
  ) THEN
    ALTER TABLE public.tasks 
    ADD COLUMN is_compliance BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Column tasks.is_compliance added successfully';
  ELSE
    RAISE NOTICE 'Column tasks.is_compliance already exists, skipping';
  END IF;

  -- Add compliance_level column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tasks' 
    AND column_name = 'compliance_level'
  ) THEN
    ALTER TABLE public.tasks 
    ADD COLUMN compliance_level TEXT;
    RAISE NOTICE 'Column tasks.compliance_level added successfully';
  ELSE
    RAISE NOTICE 'Column tasks.compliance_level already exists, skipping';
  END IF;

  -- Add annotation_required column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tasks' 
    AND column_name = 'annotation_required'
  ) THEN
    ALTER TABLE public.tasks 
    ADD COLUMN annotation_required BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Column tasks.annotation_required added successfully';
  ELSE
    RAISE NOTICE 'Column tasks.annotation_required already exists, skipping';
  END IF;
END $$;

-- Add descriptive comments
COMMENT ON COLUMN public.tasks.is_compliance IS 'Marks the task as a compliance-related task.';
COMMENT ON COLUMN public.tasks.compliance_level IS 'Severity or category of compliance requirement.';
COMMENT ON COLUMN public.tasks.annotation_required IS 'Indicates if image annotation is required for task completion.';