-- Phase 14: assistant_logs table for Assistant action audit
CREATE TABLE IF NOT EXISTS assistant_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_logs_org ON assistant_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_assistant_logs_created ON assistant_logs(created_at);

ALTER TABLE assistant_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assistant_logs_select" ON assistant_logs FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "assistant_logs_insert" ON assistant_logs FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

COMMENT ON TABLE assistant_logs IS 'Phase 14: Audit log for Assistant-approved actions (create_task, link_compliance).';
