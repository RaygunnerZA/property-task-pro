-- Fix organisations INSERT policy to be more explicit
-- The current policy might be failing due to session timing or auth.uid() checks

-- Drop the existing policy if it exists
DROP POLICY IF EXISTS "organisations_insert" ON organisations;

-- Create a more explicit INSERT policy
-- Allow authenticated users to create organisations where they are the creator
CREATE POLICY "organisations_insert" ON organisations
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
  );

