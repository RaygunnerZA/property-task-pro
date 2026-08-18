-- Phase 10: Full Compliance Automation Engine
-- Auto-task creation, contractor assignment, intelligent schedule maintenance

-- ============================================================================
-- 1. compliance_auto_tasks (dedupe + lifecycle tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_auto_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  compliance_document_id UUID NOT NULL REFERENCES compliance_documents(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  auto_task_type TEXT NOT NULL CHECK (auto_task_type IN ('critical', 'high', 'expiring_soon', 'upcoming')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'created', 'completed', 'skipped')),
  UNIQUE(compliance_document_id, auto_task_type)
);

COMMENT ON TABLE compliance_auto_tasks IS 'Tracks auto-generated tasks for compliance items. Prevents duplicates and tracks lifecycle.';

CREATE INDEX IF NOT EXISTS idx_compliance_auto_tasks_org ON compliance_auto_tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_compliance_auto_tasks_compliance ON compliance_auto_tasks(compliance_document_id);
CREATE INDEX IF NOT EXISTS idx_compliance_auto_tasks_status ON compliance_auto_tasks(status);

ALTER TABLE compliance_auto_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_auto_tasks_select" ON compliance_auto_tasks FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "compliance_auto_tasks_insert" ON compliance_auto_tasks FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "compliance_auto_tasks_update" ON compliance_auto_tasks FOR UPDATE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

-- ============================================================================
-- 2. Extend compliance_documents (scheduling intelligence)
-- ============================================================================
-- frequency, next_due_date, last_completed_date already exist from Phase 6
ALTER TABLE compliance_documents
  ADD COLUMN IF NOT EXISTS auto_assign_contractor BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_contractor_id UUID REFERENCES organisations(id) ON DELETE SET NULL;

COMMENT ON COLUMN compliance_documents.auto_assign_contractor IS 'If true, automation engine may assign contractor when creating tasks';
COMMENT ON COLUMN compliance_documents.default_contractor_id IS 'Default contractor for this compliance item (used when auto-assigning)';

-- ============================================================================
-- 3. Extend org_settings (automation toggles)
-- ============================================================================
ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS auto_task_creation BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_assignment BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS automation_aggressiveness TEXT DEFAULT 'recommended'
    CHECK (automation_aggressiveness IN ('conservative', 'recommended', 'aggressive'));

COMMENT ON COLUMN org_settings.auto_task_creation IS 'Enable auto-creation of tasks for compliance items';
COMMENT ON COLUMN org_settings.auto_assignment IS 'Enable auto-assignment of contractors to tasks';
COMMENT ON COLUMN org_settings.automation_aggressiveness IS 'Controls which risk levels trigger auto-tasks: conservative=critical only, recommended=critical+high, aggressive=all';

-- ============================================================================
-- 4. Add source_auto_task_id to tasks for badge (optional - use metadata)
-- ============================================================================
-- Tasks can store metadata. We'll use task_compliance + compliance_auto_tasks to detect auto-generated.
-- No schema change needed - we join task_compliance → compliance_auto_tasks to find auto-generated tasks.
