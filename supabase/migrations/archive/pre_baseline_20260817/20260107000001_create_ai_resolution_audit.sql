-- AI Resolution Audit Table
-- Append-only logging for AI resolutions
-- Enables trust, debugging, compliance later

CREATE TABLE IF NOT EXISTS ai_resolution_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_temp_id TEXT,  -- Temporary ID before task creation
  suggestion_payload JSONB NOT NULL,  -- What AI suggested
  chosen_payload JSONB NOT NULL,  -- What user chose
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by org and user
CREATE INDEX IF NOT EXISTS idx_ai_resolution_audit_org_user 
  ON ai_resolution_audit(org_id, user_id, created_at DESC);

-- Index for querying by task temp ID
CREATE INDEX IF NOT EXISTS idx_ai_resolution_audit_task 
  ON ai_resolution_audit(task_temp_id) WHERE task_temp_id IS NOT NULL;

-- RLS Policies
ALTER TABLE ai_resolution_audit ENABLE ROW LEVEL SECURITY;

-- Users can read audit logs for their org
CREATE POLICY "Users can read audit logs for their org"
  ON ai_resolution_audit
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = ai_resolution_audit.org_id
      AND org_members.user_id = auth.uid()
    )
  );

-- Users can insert audit logs for their org
CREATE POLICY "Users can insert audit logs for their org"
  ON ai_resolution_audit
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = ai_resolution_audit.org_id
      AND org_members.user_id = auth.uid()
    )
  );

-- Prevent updates and deletes (append-only)
-- No policies needed - default deny all for UPDATE and DELETE

