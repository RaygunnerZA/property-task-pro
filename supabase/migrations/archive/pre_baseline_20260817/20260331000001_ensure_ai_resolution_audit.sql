-- Ensure ai_resolution_audit exists on every environment and RLS uses organisation_members.
-- Older migration 20260107000001 referenced non-existent org_members; this replaces policies safely.

CREATE TABLE IF NOT EXISTS public.ai_resolution_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_temp_id TEXT,
  suggestion_payload JSONB NOT NULL,
  chosen_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_resolution_audit_org_user
  ON public.ai_resolution_audit (org_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_resolution_audit_task
  ON public.ai_resolution_audit (task_temp_id)
  WHERE task_temp_id IS NOT NULL;

ALTER TABLE public.ai_resolution_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read audit logs for their org" ON public.ai_resolution_audit;
DROP POLICY IF EXISTS "Users can insert audit logs for their org" ON public.ai_resolution_audit;
DROP POLICY IF EXISTS "ai_resolution_audit_select" ON public.ai_resolution_audit;
DROP POLICY IF EXISTS "ai_resolution_audit_insert" ON public.ai_resolution_audit;

CREATE POLICY "ai_resolution_audit_select" ON public.ai_resolution_audit
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM public.organisation_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "ai_resolution_audit_insert" ON public.ai_resolution_audit
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND org_id IN (
      SELECT org_id FROM public.organisation_members WHERE user_id = auth.uid()
    )
  );
