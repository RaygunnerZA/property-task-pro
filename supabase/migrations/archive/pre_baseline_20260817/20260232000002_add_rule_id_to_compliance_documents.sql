-- Sprint 1 Migration 3: Add rule_id backlink to compliance_documents
-- Allows seed hook to create a stub compliance_document linked to a compliance_rule.
-- Preserves existing FK graph (compliance_recommendations → compliance_documents).
-- Nullable: existing document records are not linked to a rule.

ALTER TABLE compliance_documents
  ADD COLUMN IF NOT EXISTS rule_id uuid REFERENCES compliance_rules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS compliance_documents_rule_id_idx
  ON compliance_documents (rule_id)
  WHERE rule_id IS NOT NULL;
