-- Sprint 1 Migration 2: Create compliance_occurrences table
-- Tracks each individual due-date cycle for a compliance rule.
-- One row per occurrence (annual LOLER → one row per year per asset).
-- status: 'pending' | 'complete' | 'missed'

CREATE TABLE IF NOT EXISTS compliance_occurrences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  rule_id         uuid NOT NULL REFERENCES compliance_rules(id) ON DELETE CASCADE,
  asset_id        uuid REFERENCES assets(id) ON DELETE SET NULL,
  due_date        date NOT NULL,
  completed_at    timestamptz,
  task_id         uuid REFERENCES tasks(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'complete', 'missed')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Primary query pattern: pending occurrences for a rule, ordered by due date
CREATE INDEX IF NOT EXISTS compliance_occurrences_rule_status_due_idx
  ON compliance_occurrences (rule_id, status, due_date);

-- Support querying overdue occurrences across an org
CREATE INDEX IF NOT EXISTS compliance_occurrences_org_status_idx
  ON compliance_occurrences (org_id, status, due_date);

ALTER TABLE compliance_occurrences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compliance_occurrences_org_access" ON compliance_occurrences;
CREATE POLICY "compliance_occurrences_org_access" ON compliance_occurrences
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );
