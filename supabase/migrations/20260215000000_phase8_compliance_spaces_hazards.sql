-- Phase 8: Space Intelligence, Hazard System & Compliance Knowledge Graph

-- ============================================================================
-- 1. compliance_spaces junction
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  compliance_document_id UUID NOT NULL REFERENCES compliance_documents(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(compliance_document_id, space_id)
);
ALTER TABLE compliance_spaces ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_compliance_spaces_compliance ON compliance_spaces(compliance_document_id);
CREATE INDEX IF NOT EXISTS idx_compliance_spaces_space ON compliance_spaces(space_id);

CREATE POLICY "compliance_spaces_select" ON compliance_spaces FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "compliance_spaces_insert" ON compliance_spaces FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "compliance_spaces_update" ON compliance_spaces FOR UPDATE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "compliance_spaces_delete" ON compliance_spaces FOR DELETE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

-- ============================================================================
-- 2. Add hazards to compliance_documents
-- ============================================================================
ALTER TABLE compliance_documents
  ADD COLUMN IF NOT EXISTS hazards TEXT[] DEFAULT '{}';

COMMENT ON COLUMN compliance_documents.hazards IS 'Hazard categories: fire, electrical, slip, water, structural, obstruction, hygiene, ventilation, unknown';

-- ============================================================================
-- 3. Recreate compliance_portfolio_view with hazards
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
  cd.hazards,
  CASE
    WHEN COALESCE(cd.next_due_date, cd.expiry_date) IS NULL THEN 'none'
    WHEN COALESCE(cd.next_due_date, cd.expiry_date) < CURRENT_DATE THEN 'expired'
    WHEN COALESCE(cd.next_due_date, cd.expiry_date) <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring'
    ELSE 'valid'
  END AS expiry_state
FROM compliance_documents cd
LEFT JOIN properties p ON cd.property_id = p.id;
