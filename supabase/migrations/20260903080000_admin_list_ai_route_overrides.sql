-- Admin list of AI route pins. Platform-admin RPC so the UI does not depend on
-- PostgREST exposing ai_route_overrides (Ch 25: named RPCs, not direct table access).
-- Canonical: @Docs/03_Data_Model.md, @Docs/25_Phase2_Admin_Panel_Spec.md

CREATE OR REPLACE FUNCTION public.admin_list_ai_route_overrides()
RETURNS TABLE (
  id UUID,
  capability TEXT,
  strategy TEXT,
  reason TEXT,
  set_by UUID,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN;
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'platform',
    auth.uid(),
    'admin.ai.route_overrides_viewed',
    jsonb_build_object('timestamp', now())
  );

  RETURN QUERY
  SELECT
    o.id,
    o.capability,
    o.strategy,
    o.reason,
    o.set_by,
    o.expires_at,
    o.created_at,
    o.updated_at
  FROM ai_route_overrides o
  ORDER BY o.capability;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_ai_route_overrides() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_ai_route_overrides() TO authenticated, service_role;
