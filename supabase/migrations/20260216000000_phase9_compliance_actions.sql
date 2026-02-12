-- Phase 9: Compliance Interpretation & Actions Layer
-- Stores recommended actions for compliance documents. No auto-task creation.

-- ============================================================================
-- 1. compliance_recommendations
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  compliance_document_id UUID NOT NULL REFERENCES compliance_documents(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  asset_ids UUID[] DEFAULT '{}',
  space_ids UUID[] DEFAULT '{}',
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  recommended_action TEXT NOT NULL,
  recommended_tasks JSONB DEFAULT '[]',
  hazards TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  UNIQUE(compliance_document_id)
);

COMMENT ON TABLE compliance_recommendations IS 'AI-generated recommended actions for compliance documents. Phase 9: interpretation only, no auto-task creation.';

CREATE INDEX IF NOT EXISTS idx_compliance_recommendations_org ON compliance_recommendations(org_id);
CREATE INDEX IF NOT EXISTS idx_compliance_recommendations_compliance ON compliance_recommendations(compliance_document_id);
CREATE INDEX IF NOT EXISTS idx_compliance_recommendations_property ON compliance_recommendations(property_id);
CREATE INDEX IF NOT EXISTS idx_compliance_recommendations_status ON compliance_recommendations(status);

ALTER TABLE compliance_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_recommendations_select" ON compliance_recommendations FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "compliance_recommendations_insert" ON compliance_recommendations FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "compliance_recommendations_update" ON compliance_recommendations FOR UPDATE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "compliance_recommendations_delete" ON compliance_recommendations FOR DELETE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

-- ============================================================================
-- 2. compliance_actions_view
-- ============================================================================
DROP VIEW IF EXISTS compliance_actions_view CASCADE;

CREATE VIEW compliance_actions_view
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
  cd.next_due_date,
  cd.hazards AS doc_hazards,
  cd.linked_asset_ids,
  cr.id AS recommendation_id,
  cr.risk_level,
  cr.recommended_action,
  cr.recommended_tasks,
  cr.hazards AS rec_hazards,
  cr.status AS recommendation_status,
  cr.created_at AS recommendation_created_at,
  CASE
    WHEN COALESCE(cd.next_due_date, cd.expiry_date) IS NULL THEN NULL::integer
    ELSE (COALESCE(cd.next_due_date, cd.expiry_date) - CURRENT_DATE)::integer
  END AS days_until_expiry,
  CASE
    WHEN COALESCE(cd.next_due_date, cd.expiry_date) IS NULL THEN 'none'
    WHEN COALESCE(cd.next_due_date, cd.expiry_date) < CURRENT_DATE THEN 'expired'
    WHEN COALESCE(cd.next_due_date, cd.expiry_date) <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring'
    ELSE 'valid'
  END AS expiry_state,
  (SELECT COUNT(*)::int FROM compliance_spaces cs WHERE cs.compliance_document_id = cd.id) AS space_links_count,
  COALESCE(array_length(cd.linked_asset_ids, 1), 0) AS asset_links_count
FROM compliance_documents cd
LEFT JOIN properties p ON cd.property_id = p.id
LEFT JOIN compliance_recommendations cr ON cr.compliance_document_id = cd.id;
