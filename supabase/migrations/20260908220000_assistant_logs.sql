-- Phase 14 assistant action audit (baseline omitted this table).
CREATE TABLE IF NOT EXISTS public.assistant_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_logs_org ON public.assistant_logs (org_id);
CREATE INDEX IF NOT EXISTS idx_assistant_logs_created ON public.assistant_logs (created_at);

ALTER TABLE public.assistant_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assistant_logs_select ON public.assistant_logs;
CREATE POLICY assistant_logs_select ON public.assistant_logs
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT om.org_id FROM public.organisation_members om WHERE om.user_id = auth.uid())
  );

DROP POLICY IF EXISTS assistant_logs_insert ON public.assistant_logs;
CREATE POLICY assistant_logs_insert ON public.assistant_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT om.org_id FROM public.organisation_members om WHERE om.user_id = auth.uid())
  );

GRANT SELECT, INSERT ON public.assistant_logs TO authenticated;
GRANT ALL ON public.assistant_logs TO service_role;
