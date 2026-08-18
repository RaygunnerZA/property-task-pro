-- Ensure spaces table has 'name' column (not 'type')
-- The migration says it should be 'name', but types might be out of sync

-- Check if column is named 'type' and rename it to 'name'
DO $$
BEGIN
  -- Check if 'type' column exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'spaces' 
    AND column_name = 'type'
  ) THEN
    -- Rename 'type' to 'name'
    ALTER TABLE spaces RENAME COLUMN type TO name;
    RAISE NOTICE 'Renamed spaces.type to spaces.name';
  END IF;
  
  -- Ensure 'name' column exists and is NOT NULL
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'spaces' 
    AND column_name = 'name'
  ) THEN
    -- Add 'name' column if it doesn't exist
    ALTER TABLE spaces ADD COLUMN name TEXT NOT NULL DEFAULT '';
    RAISE NOTICE 'Added spaces.name column';
  END IF;
  
  -- Make sure name is NOT NULL
  ALTER TABLE spaces ALTER COLUMN name SET NOT NULL;
END $$;

