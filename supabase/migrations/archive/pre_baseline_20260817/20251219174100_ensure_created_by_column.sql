-- Ensure created_by column exists on organisations table
-- This fixes issues where the column might be missing

DO $$
BEGIN
  -- Check if created_by column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'organisations' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE organisations ADD COLUMN created_by UUID NOT NULL;
    RAISE NOTICE 'Added created_by column to organisations table';
  ELSE
    RAISE NOTICE 'created_by column already exists on organisations table';
  END IF;
END $$;

