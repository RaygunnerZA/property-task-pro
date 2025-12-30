-- Fix attachments INSERT RLS policy
-- Allow all authenticated users to insert (backend validates org membership)

-- ============================================================================
-- ATTACHMENTS: Drop existing INSERT policies
-- ============================================================================
DROP POLICY IF EXISTS "attachments_insert" ON attachments;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON attachments;

-- ============================================================================
-- ATTACHMENTS: Create new INSERT policy
-- ============================================================================
CREATE POLICY "Enable insert for authenticated users" ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- EVIDENCE: Ensure INSERT policy exists
-- ============================================================================
DROP POLICY IF EXISTS "evidence_insert" ON evidence;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON evidence;

CREATE POLICY "Enable insert for authenticated users" ON evidence
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

