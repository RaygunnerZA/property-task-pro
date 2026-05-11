-- Phase 2: Admin Panel — platform_admins table and helper function.
--
-- The sentinel organisation row (00000000-...) is required so that admin RPCs
-- can write to audit_logs (which has org_id NOT NULL REFERENCES organisations(id)).
-- platform_admins can only be inserted directly in the DB — no API path exists.

-- Sentinel organisation for platform-level audit log entries.
-- ON CONFLICT DO NOTHING makes this migration idempotent.
INSERT INTO organisations (id, name, org_type, created_by)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  '_platform',
  'business',
  '00000000-0000-0000-0000-000000000000'::uuid
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes     TEXT
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may check whether they are a platform admin.
-- This is required by the frontend guard and by the SECURITY DEFINER RPCs.
CREATE POLICY "platform_admins_self_select" ON public.platform_admins
  FOR SELECT USING (user_id = auth.uid());

-- No INSERT or DELETE policy: manage via service role / direct DB only.

-- Helper used by all admin RPCs.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  );
$$;
