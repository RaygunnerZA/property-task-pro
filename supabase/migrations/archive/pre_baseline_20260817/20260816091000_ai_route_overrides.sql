-- AI route overrides (Phase 3 of the AI call boundary).
-- Canonical definitions: @Docs/03_Data_Model.md, @Docs/07_AI_Intelligence.md
--
-- Code stays authoritative. The compiled capability map in
-- supabase/functions/_shared/aiRouting.ts is the source of truth, so normal model
-- changes stay in git history where they are reviewable and revertible.
--
-- This table exists for one job: pinning a capability to a different approved
-- strategy without a deploy, when a provider deprecates or breaks a model.
--
-- Design rules enforced below:
--   * Platform-admin write only. Never org-readable, never org-writable — unlike
--     ai_requests, which org members may SELECT for their own usage.
--   * A missing, empty or unreadable table means "use the compiled default".
--     A broken override table must never take down every AI feature.
--   * Overrides expire. An emergency pin that is quietly permanent is a fork.
--   * Every write emits an audit_logs row.

CREATE TABLE IF NOT EXISTS public.ai_route_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  /** Capability key from CAPABILITIES in aiRouting.ts. */
  capability TEXT NOT NULL UNIQUE,
  /** Strategy id from STRATEGIES in aiRouting.ts, e.g. "model:gpt-4o-mini". */
  strategy TEXT NOT NULL,
  /** Why this pin exists. Required: an unexplained pin cannot be safely removed. */
  reason TEXT NOT NULL,
  set_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_route_overrides_reason_not_blank CHECK (length(trim(reason)) > 0)
);

-- No further index: `capability` is UNIQUE, so its implicit index already covers
-- every read, and this table holds at most one row per capability. (A partial
-- index on `expires_at > now()` is not possible — index predicates must be
-- IMMUTABLE and now() is STABLE.)

ALTER TABLE public.ai_route_overrides ENABLE ROW LEVEL SECURITY;

-- Platform scope only. No org policy of any kind is defined here on purpose:
-- a route override affects every org, so no org may read or change it.
DROP POLICY IF EXISTS ai_route_overrides_select_admin ON public.ai_route_overrides;
CREATE POLICY ai_route_overrides_select_admin ON public.ai_route_overrides
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

REVOKE ALL ON public.ai_route_overrides FROM authenticated;
GRANT SELECT ON public.ai_route_overrides TO authenticated;
GRANT ALL ON public.ai_route_overrides TO service_role;

-- ---------------------------------------------------------------------------
-- Read path used by the edge boundary (service role). Returns at most one row
-- per capability and never returns an expired pin.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.active_ai_route_overrides()
RETURNS TABLE (capability TEXT, strategy TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.capability, o.strategy
  FROM ai_route_overrides o
  WHERE o.expires_at IS NULL OR o.expires_at > now();
$$;

REVOKE ALL ON FUNCTION public.active_ai_route_overrides() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.active_ai_route_overrides() TO service_role;

-- ---------------------------------------------------------------------------
-- Set or replace a pin. Platform admin only, audited.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_ai_route_override(
  p_capability TEXT,
  p_strategy TEXT,
  p_reason TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  IF p_capability IS NULL OR length(trim(p_capability)) = 0 THEN
    RAISE EXCEPTION 'capability_required';
  END IF;
  IF p_strategy IS NULL OR length(trim(p_strategy)) = 0 THEN
    RAISE EXCEPTION 'strategy_required';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  INSERT INTO ai_route_overrides (capability, strategy, reason, set_by, expires_at)
  VALUES (trim(p_capability), trim(p_strategy), trim(p_reason), auth.uid(), p_expires_at)
  ON CONFLICT (capability) DO UPDATE
    SET strategy = EXCLUDED.strategy,
        reason = EXCLUDED.reason,
        set_by = EXCLUDED.set_by,
        expires_at = EXCLUDED.expires_at,
        updated_at = now()
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'ai_route_override',
    v_id,
    'ai.route.override.set',
    jsonb_build_object(
      'capability', trim(p_capability),
      'strategy', trim(p_strategy),
      'reason', trim(p_reason),
      'expires_at', p_expires_at
    )
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_ai_route_override(TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_ai_route_override(TEXT, TEXT, TEXT, TIMESTAMPTZ)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Remove a pin and fall back to the compiled default. Platform admin only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_ai_route_override(p_capability TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row ai_route_overrides;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  DELETE FROM ai_route_overrides
  WHERE capability = trim(p_capability)
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'ai_route_override',
    v_row.id,
    'ai.route.override.cleared',
    jsonb_build_object(
      'capability', v_row.capability,
      'strategy', v_row.strategy,
      'reason', v_row.reason
    )
  );

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_ai_route_override(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_ai_route_override(TEXT) TO authenticated, service_role;
