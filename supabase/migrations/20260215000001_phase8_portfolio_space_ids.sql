-- Phase 8: Add space_ids to compliance_portfolio_view for space link counts

DROP VIEW IF EXISTS compliance_portfolio_view CASCADE;

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
  (SELECT COALESCE(array_agg(cs.space_id), ARRAY[]::uuid[]) FROM compliance_spaces cs WHERE cs.compliance_document_id = cd.id) AS space_ids,
  CASE
    WHEN COALESCE(cd.next_due_date, cd.expiry_date) IS NULL THEN 'none'
    WHEN COALESCE(cd.next_due_date, cd.expiry_date) < CURRENT_DATE THEN 'expired'
    WHEN COALESCE(cd.next_due_date, cd.expiry_date) <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring'
    ELSE 'valid'
  END AS expiry_state
FROM compliance_documents cd
LEFT JOIN properties p ON cd.property_id = p.id;
