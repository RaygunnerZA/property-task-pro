-- Ensure platform admin guard exists (was missing on remote after baseline squash).
-- Idempotent; safe if reconcile already applied elsewhere.
-- Skip sentinel org insert here: org INSERT triggers membership for auth.uid(),
-- which is null under migration/service connections.

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes     TEXT
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_admins_self_select" ON public.platform_admins;
CREATE POLICY "platform_admins_self_select" ON public.platform_admins
  FOR SELECT USING (user_id = auth.uid());

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

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT SELECT ON TABLE public.platform_admins TO authenticated;

NOTIFY pgrst, 'reload schema';
