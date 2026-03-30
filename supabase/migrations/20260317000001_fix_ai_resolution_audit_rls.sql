-- Fix ai_resolution_audit RLS: policies referenced `org_members` which does not exist.
-- The correct table is `organisation_members`. This caused every INSERT from
-- src/services/ai/resolutionAudit.ts to silently fail in production.

DROP POLICY IF EXISTS "Users can read audit logs for their org"   ON ai_resolution_audit;
DROP POLICY IF EXISTS "Users can insert audit logs for their org" ON ai_resolution_audit;

CREATE POLICY "ai_resolution_audit_select" ON ai_resolution_audit
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "ai_resolution_audit_insert" ON ai_resolution_audit
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );
