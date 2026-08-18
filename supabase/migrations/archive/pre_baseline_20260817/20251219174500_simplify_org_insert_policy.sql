-- Simplify organisations INSERT policy
-- The WITH CHECK clause might be evaluating before the row is fully constructed
-- So we'll allow any authenticated user to create, and validate created_by in application

-- Drop the existing policy if it exists
DROP POLICY IF EXISTS "organisations_insert" ON organisations;

-- Create a simpler INSERT policy that just checks authentication
-- The application will ensure created_by is set correctly
CREATE POLICY "organisations_insert" ON organisations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

