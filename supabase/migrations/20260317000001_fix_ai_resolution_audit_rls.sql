-- Fix ai_resolution_audit RLS: policies referenced `org_members` which does not exist.
-- The correct table is `organisation_members`. This caused every INSERT from
-- src/services/ai/resolutionAudit.ts to silently fail in production.
--
-- No-op if the table is missing (e.g. remote never applied 20260107000001).

DO $body$
BEGIN
  IF to_regclass('public.ai_resolution_audit') IS NULL THEN
    RAISE NOTICE 'Skipping ai_resolution_audit RLS fix: table does not exist';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "Users can read audit logs for their org" ON ai_resolution_audit';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert audit logs for their org" ON ai_resolution_audit';
  EXECUTE 'DROP POLICY IF EXISTS "ai_resolution_audit_select" ON ai_resolution_audit';
  EXECUTE 'DROP POLICY IF EXISTS "ai_resolution_audit_insert" ON ai_resolution_audit';

  EXECUTE $pol$
    CREATE POLICY "ai_resolution_audit_select" ON ai_resolution_audit
      FOR SELECT USING (
        org_id IN (
          SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
        )
      )
  $pol$;

  EXECUTE $pol$
    CREATE POLICY "ai_resolution_audit_insert" ON ai_resolution_audit
      FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND org_id IN (
          SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
        )
      )
  $pol$;
END
$body$;
