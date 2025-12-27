-- Add missing 'name' column to organisations table
-- The schema cache error indicates this column is missing from the database

DO $$
BEGIN
  -- Check if name column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'organisations' 
    AND column_name = 'name'
  ) THEN
    ALTER TABLE organisations ADD COLUMN name TEXT NOT NULL DEFAULT 'Unnamed Organisation';
    -- Update existing rows to have a proper name
    UPDATE organisations SET name = 'My Personal Org' WHERE name = 'Unnamed Organisation' OR name IS NULL;
    RAISE NOTICE 'Added name column to organisations table';
  ELSE
    RAISE NOTICE 'name column already exists on organisations table';
  END IF;
END $$;

