-- Activity tab failures:
-- 1) audit_logs was in migration history but missing on Filla-v2 (timeline query 404s)
-- 2) conversations.channel CHECK omitted 'task' while clients insert channel = 'task'
-- 3) messages.source CHECK omitted 'web' while clients insert source = 'web'

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_channel_check;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_channel_check
  CHECK (
    channel = ANY (
      ARRAY[
        'app'::text,
        'task'::text,
        'property'::text,
        'compliance'::text,
        'contractor'::text,
        'email'::text,
        'whatsapp'::text,
        'sms'::text,
        'other'::text
      ]
    )
  );

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON public.audit_logs (org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id
  ON public.audit_logs (actor_id)
  WHERE actor_id IS NOT NULL;

DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT
  USING (org_id = current_org_id());

-- Allow inserts from authenticated org members (for future write paths / triggers).
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id = current_org_id());

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_source_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_source_check
  CHECK (
    source = ANY (
      ARRAY[
        'app'::text,
        'web'::text,
        'email'::text,
        'whatsapp'::text,
        'ai'::text,
        'system'::text,
        'other'::text,
        'sms'::text
      ]
    )
  );

NOTIFY pgrst, 'reload schema';
