-- Phase 6: Compliance Scheduler & Automation Core
-- Extends compliance_documents with property awareness, scheduling, task linking

-- ============================================================================
-- 1. Extend compliance_documents
-- ============================================================================
ALTER TABLE compliance_documents
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS frequency TEXT,
  ADD COLUMN IF NOT EXISTS last_completed_date DATE,
  ADD COLUMN IF NOT EXISTS next_due_date DATE,
  ADD COLUMN IF NOT EXISTS auto_schedule BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS assigned_contractor_org_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN compliance_documents.property_id IS 'Property this compliance item applies to (null = org-wide)';
COMMENT ON COLUMN compliance_documents.frequency IS 'annual | 5-year | quarterly | null';
COMMENT ON COLUMN compliance_documents.next_due_date IS 'Next due date; used for scheduling';
COMMENT ON COLUMN compliance_documents.auto_schedule IS 'If true, scheduler may auto-create tasks when due';

-- Backfill next_due_date from expiry_date
UPDATE compliance_documents
SET next_due_date = expiry_date
WHERE expiry_date IS NOT NULL AND (next_due_date IS NULL OR next_due_date < expiry_date);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_compliance_documents_property ON compliance_documents(property_id);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_next_due ON compliance_documents(next_due_date) WHERE next_due_date IS NOT NULL;

-- ============================================================================
-- 2. task_compliance junction
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_compliance (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  compliance_document_id UUID NOT NULL REFERENCES compliance_documents(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, compliance_document_id)
);
ALTER TABLE task_compliance ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_task_compliance_task ON task_compliance(task_id);
CREATE INDEX IF NOT EXISTS idx_task_compliance_compliance ON task_compliance(compliance_document_id);

CREATE POLICY "task_compliance_select" ON task_compliance FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "task_compliance_insert" ON task_compliance FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "task_compliance_delete" ON task_compliance FOR DELETE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

-- ============================================================================
-- 3. compliance_history
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_document_id UUID NOT NULL REFERENCES compliance_documents(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE
);
ALTER TABLE compliance_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_compliance_history_doc ON compliance_history(compliance_document_id);

CREATE POLICY "compliance_history_select" ON compliance_history FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "compliance_history_insert" ON compliance_history FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

-- ============================================================================
-- 4. org_settings for auto_schedule_enabled
-- ============================================================================
CREATE TABLE IF NOT EXISTS org_settings (
  org_id UUID PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  auto_schedule_compliance BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_settings_select" ON org_settings FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "org_settings_insert" ON org_settings FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "org_settings_update" ON org_settings FOR UPDATE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

-- ============================================================================
-- 5. Recreate compliance_view with new columns
-- ============================================================================
DROP VIEW IF EXISTS compliance_view CASCADE;

CREATE OR REPLACE VIEW compliance_view
WITH (security_invoker = true)
AS
SELECT 
  cd.id,
  cd.org_id,
  cd.property_id,
  cd.title,
  cd.expiry_date,
  cd.status,
  cd.frequency,
  cd.last_completed_date,
  cd.next_due_date,
  cd.auto_schedule,
  cd.notes,
  cd.file_url,
  cd.created_at,
  cd.updated_at,
  -- Use next_due_date for calculations when set, else expiry_date
  CASE 
    WHEN COALESCE(cd.next_due_date, cd.expiry_date) IS NULL THEN NULL::integer
    ELSE (COALESCE(cd.next_due_date, cd.expiry_date) - CURRENT_DATE)::integer
  END AS days_until_expiry,
  CASE
    WHEN COALESCE(cd.next_due_date, cd.expiry_date) IS NULL THEN 'none'
    WHEN COALESCE(cd.next_due_date, cd.expiry_date) < CURRENT_DATE THEN 'expired'
    WHEN COALESCE(cd.next_due_date, cd.expiry_date) <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring'
    ELSE 'valid'
  END AS expiry_status
FROM compliance_documents cd;
