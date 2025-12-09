-- Migration Step 17: Task–Space–Property linking cleanup + strengthening relations

-- Ensure spaces always belong to a valid property (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'spaces_property_id_fkey'
    AND table_name = 'spaces'
  ) THEN
    ALTER TABLE public.spaces
    ADD CONSTRAINT spaces_property_id_fkey
    FOREIGN KEY (property_id)
    REFERENCES public.properties(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Strengthen tasks.property_id to ensure relational integrity (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tasks_property_id_fkey'
    AND table_name = 'tasks'
  ) THEN
    ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_property_id_fkey
    FOREIGN KEY (property_id)
    REFERENCES public.properties(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Strengthen tasks.space_ids[] integrity using an FK validator function
CREATE OR REPLACE FUNCTION public.validate_space_ids()
RETURNS trigger AS $$
BEGIN
  IF NEW.space_ids IS NOT NULL AND array_length(NEW.space_ids, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(NEW.space_ids) AS sid
      WHERE NOT EXISTS (
        SELECT 1 FROM public.spaces WHERE spaces.id = sid
      )
    ) THEN
      RAISE EXCEPTION 'Invalid space_ids: some spaces do not exist';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS trg_validate_space_ids ON public.tasks;

CREATE TRIGGER trg_validate_space_ids
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.validate_space_ids();

-- Add comments
COMMENT ON FUNCTION public.validate_space_ids IS 'Validates that all space_ids in tasks array reference existing spaces.';