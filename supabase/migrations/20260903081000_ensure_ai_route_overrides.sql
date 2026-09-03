-- Ensure ai_route_overrides exists on live.
-- 20260817120001 is marked applied, but the table is missing (admin_list_ai_route_overrides
-- failed with undefined_table). Recreate idempotently; do not drop data if present.
-- Canonical: @Docs/03_Data_Model.md, @Docs/25_Phase2_Admin_Panel_Spec.md

CREATE TABLE IF NOT EXISTS public.ai_route_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability TEXT NOT NULL UNIQUE,
  strategy TEXT NOT NULL,
  reason TEXT NOT NULL,
  set_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_route_overrides_reason_not_blank CHECK (length(trim(reason)) > 0)
);

ALTER TABLE public.ai_route_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_route_overrides_select_admin ON public.ai_route_overrides;
CREATE POLICY ai_route_overrides_select_admin ON public.ai_route_overrides
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

REVOKE ALL ON public.ai_route_overrides FROM PUBLIC, anon;
REVOKE ALL ON public.ai_route_overrides FROM authenticated;
GRANT SELECT ON public.ai_route_overrides TO authenticated;
GRANT ALL ON public.ai_route_overrides TO service_role;
