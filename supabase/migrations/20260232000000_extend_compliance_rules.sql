-- Sprint 1 Migration 1: Build out compliance_rules table
-- The compliance_rules stub previously had only id, org_id, created_at, updated_at.
-- This adds all columns required for the compliance schedule definition system.

ALTER TABLE compliance_rules
  ADD COLUMN IF NOT EXISTS property_id        uuid REFERENCES properties(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name               text,
  ADD COLUMN IF NOT EXISTS description        text,
  ADD COLUMN IF NOT EXISTS frequency          text,
  ADD COLUMN IF NOT EXISTS scope_type         text NOT NULL DEFAULT 'property',
  ADD COLUMN IF NOT EXISTS scope_asset_type   text,
  ADD COLUMN IF NOT EXISTS scope_ids          jsonb,
  ADD COLUMN IF NOT EXISTS auto_create        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_config    jsonb,
  ADD COLUMN IF NOT EXISTS notify_days_before integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS is_archived        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_completed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS next_due_date      date;

-- Index for property-scoped rule queries (the primary read pattern)
CREATE INDEX IF NOT EXISTS compliance_rules_property_id_idx
  ON compliance_rules (property_id)
  WHERE is_archived = false;

-- RLS: org-scoped via properties join
ALTER TABLE compliance_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compliance_rules_org_access" ON compliance_rules;
CREATE POLICY "compliance_rules_org_access" ON compliance_rules
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );
