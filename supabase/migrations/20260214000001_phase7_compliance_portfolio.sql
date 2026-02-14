-- Phase 7: Portfolio-Level Compliance Intelligence & Multi-Entity Linking

-- ============================================================================
-- 1. Extend compliance_documents
-- ============================================================================
ALTER TABLE compliance_documents
  ADD COLUMN IF NOT EXISTS linked_asset_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS document_type TEXT,
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC;

COMMENT ON COLUMN compliance_documents.linked_asset_ids IS 'Asset IDs this compliance item relates to';
COMMENT ON COLUMN compliance_documents.document_type IS 'EICR | Gas Safety | Fire Risk Assessment | etc';
COMMENT ON COLUMN compliance_documents.ai_confidence IS 'AI analysis confidence 0-1';

-- property_id already exists from Phase 6

-- ============================================================================
-- 2. compliance_portfolio_view
-- ============================================================================
CREATE OR REPLACE VIEW compliance_portfolio_view
WITH (security_invoker = true)
AS
SELECT
  cd.id,
  cd.org_id,
  cd.property_id,
  p.nickname AS property_name,
  cd.title,
  cd.document_type,
  cd.expiry_date,
  cd.status,
  cd.next_due_date,
  cd.ai_confidence,
  cd.linked_asset_ids,
  CASE
    WHEN COALESCE(cd.next_due_date, cd.expiry_date) IS NULL THEN 'none'
    WHEN COALESCE(cd.next_due_date, cd.expiry_date) < CURRENT_DATE THEN 'expired'
    WHEN COALESCE(cd.next_due_date, cd.expiry_date) <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring'
    ELSE 'valid'
  END AS expiry_state
FROM compliance_documents cd
LEFT JOIN properties p ON cd.property_id = p.id;

-- ============================================================================
-- 3. compliance_contractors junction (contractors = organisations with org_type=contractor)
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  compliance_document_id UUID NOT NULL REFERENCES compliance_documents(id) ON DELETE CASCADE,
  contractor_org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(compliance_document_id, contractor_org_id)
);
ALTER TABLE compliance_contractors ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_compliance_contractors_compliance ON compliance_contractors(compliance_document_id);
CREATE INDEX IF NOT EXISTS idx_compliance_contractors_contractor ON compliance_contractors(contractor_org_id);

CREATE POLICY "compliance_contractors_select" ON compliance_contractors FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "compliance_contractors_insert" ON compliance_contractors FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "compliance_contractors_update" ON compliance_contractors FOR UPDATE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "compliance_contractors_delete" ON compliance_contractors FOR DELETE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

-- ============================================================================
-- 4. compliance_documents UPDATE policy (for linked_asset_ids)
-- ============================================================================
DROP POLICY IF EXISTS "compliance_documents_update" ON compliance_documents;
CREATE POLICY "compliance_documents_update" ON compliance_documents FOR UPDATE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
