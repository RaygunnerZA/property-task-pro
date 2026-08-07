-- Phase 6 — Business governance foundation
-- @Docs/20_Billing.md §20.1 Business · @Docs/28 Phase 6
-- Ship: governance entitlement keys, time-bounded overrides, retention settings,
-- API key stub, audit export gate. Not in this migration: full SSO IdP, approval engine.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Governance entitlement keys on tiers (Business differentiators)
-- ---------------------------------------------------------------------------
UPDATE public.subscription_tiers
SET entitlements = entitlements || jsonb_build_object(
  'approval_workflows_enabled', (id = 'business'),
  'advanced_audit_export_enabled', (id = 'business'),
  'configurable_retention_enabled', (id = 'business'),
  'teams_regions_enabled', (id = 'business'),
  'sso_enabled', (id = 'business')
);

-- Ensure Home defaults function includes governance keys (all false)
CREATE OR REPLACE FUNCTION public.home_entitlement_defaults()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '{
    "active_properties_limit": 1,
    "coordinating_seats_limit": 1,
    "staff_active_monthly_allowance": 0,
    "can_add_staff": false,
    "multi_property_enabled": false,
    "external_submissions_enabled": false,
    "compliance_enabled": false,
    "advanced_reports_enabled": false,
    "api_enabled": false,
    "evidence_bytes_allowance": 536870912,
    "ai_ops_allowance": 25,
    "premium_messaging_allowance": 0,
    "approval_workflows_enabled": false,
    "advanced_audit_export_enabled": false,
    "configurable_retention_enabled": false,
    "teams_regions_enabled": false,
    "sso_enabled": false
  }'::jsonb;
$$;

-- ---------------------------------------------------------------------------
-- 2) Time-bounded entitlement overrides (Enterprise path — no plan-name branches)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_entitlement_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  entitlement_key TEXT NOT NULL,
  value JSONB NOT NULL,
  reason TEXT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_until TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_entitlement_overrides_until_after_from CHECK (
    effective_until IS NULL OR effective_until > effective_from
  )
);

CREATE INDEX IF NOT EXISTS org_entitlement_overrides_org_active_idx
  ON public.org_entitlement_overrides (org_id, entitlement_key)
  WHERE revoked_at IS NULL;

ALTER TABLE public.org_entitlement_overrides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'org_entitlement_overrides'
      AND policyname = 'org_entitlement_overrides_select_members'
  ) THEN
    CREATE POLICY org_entitlement_overrides_select_members
      ON public.org_entitlement_overrides
      FOR SELECT
      USING (org_id = public.current_org_id());
  END IF;
END $$;

COMMENT ON TABLE public.org_entitlement_overrides IS
  'Time-bounded entitlement overrides (enterprise / support). Merged in get_org_entitlements; audited on write.';

-- ---------------------------------------------------------------------------
-- 3) Retention settings (store + document; no hard-delete jobs yet)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_retention_settings (
  org_id UUID PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
  policy TEXT NOT NULL DEFAULT 'standard'
    CHECK (policy IN ('standard', 'extended', 'custom')),
  retention_days INTEGER NOT NULL DEFAULT 365
    CHECK (retention_days >= 30 AND retention_days <= 3650),
  legal_hold BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.org_retention_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'org_retention_settings'
      AND policyname = 'org_retention_settings_select_members'
  ) THEN
    CREATE POLICY org_retention_settings_select_members
      ON public.org_retention_settings
      FOR SELECT
      USING (org_id = public.current_org_id());
  END IF;
END $$;

COMMENT ON TABLE public.org_retention_settings IS
  'Org retention policy (Business). Aligns with @Docs/21 — no automatic hard-delete in Phase 6.';

-- ---------------------------------------------------------------------------
-- 4) Org API keys stub (mint/list/revoke; no public API surface yet)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_api_keys_org_idx ON public.org_api_keys (org_id);

ALTER TABLE public.org_api_keys ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'org_api_keys'
      AND policyname = 'org_api_keys_select_owners'
  ) THEN
    CREATE POLICY org_api_keys_select_owners
      ON public.org_api_keys
      FOR SELECT
      USING (
        org_id = public.current_org_id()
        AND EXISTS (
          SELECT 1 FROM public.organisation_members om
          WHERE om.org_id = org_api_keys.org_id
            AND om.user_id = auth.uid()
            AND (
              om.is_primary_owner = true
              OR lower(om.role) = 'owner'
            )
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5) get_org_entitlements — merge active overrides after add-ons
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_org_entitlements(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entitlements jsonb;
  v_seat_addon integer := 0;
  v_storage_addon bigint := 0;
  v_ai_addon integer := 0;
  v_msg_addon integer := 0;
  v_base_seats integer;
  v_base_storage bigint;
  v_base_ai integer;
  v_base_msg integer;
  v_override record;
BEGIN
  SELECT
    t.entitlements,
    COALESCE(s.seat_count, 0),
    COALESCE(s.storage_addon_bytes, 0),
    COALESCE(s.ai_addon_ops, 0),
    COALESCE(s.messaging_addon_units, 0)
  INTO v_entitlements, v_seat_addon, v_storage_addon, v_ai_addon, v_msg_addon
  FROM public.org_subscriptions s
  JOIN public.subscription_tiers t ON t.id = s.plan_id
  WHERE s.org_id = p_org_id
  LIMIT 1;

  IF v_entitlements IS NULL THEN
    v_entitlements := public.home_entitlement_defaults();
  ELSE
    v_entitlements := public.home_entitlement_defaults() || v_entitlements;
  END IF;

  v_base_seats := COALESCE((v_entitlements ->> 'coordinating_seats_limit')::integer, 1);
  IF v_seat_addon > 0 THEN
    v_entitlements := jsonb_set(
      v_entitlements, '{coordinating_seats_limit}', to_jsonb(v_base_seats + v_seat_addon)
    );
  END IF;

  v_base_storage := COALESCE((v_entitlements ->> 'evidence_bytes_allowance')::bigint, 0);
  IF v_storage_addon > 0 THEN
    v_entitlements := jsonb_set(
      v_entitlements, '{evidence_bytes_allowance}', to_jsonb(v_base_storage + v_storage_addon)
    );
  END IF;

  v_base_ai := COALESCE((v_entitlements ->> 'ai_ops_allowance')::integer, 0);
  IF v_ai_addon > 0 THEN
    v_entitlements := jsonb_set(
      v_entitlements, '{ai_ops_allowance}', to_jsonb(v_base_ai + v_ai_addon)
    );
  END IF;

  v_base_msg := COALESCE((v_entitlements ->> 'premium_messaging_allowance')::integer, 0);
  IF v_msg_addon > 0 THEN
    v_entitlements := jsonb_set(
      v_entitlements, '{premium_messaging_allowance}', to_jsonb(v_base_msg + v_msg_addon)
    );
  END IF;

  -- Active, non-revoked, in-window overrides win last (enterprise contract path)
  FOR v_override IN
    SELECT entitlement_key, value
    FROM public.org_entitlement_overrides
    WHERE org_id = p_org_id
      AND revoked_at IS NULL
      AND effective_from <= now()
      AND (effective_until IS NULL OR effective_until > now())
    ORDER BY created_at ASC
  LOOP
    v_entitlements := jsonb_set(
      v_entitlements,
      ARRAY[v_override.entitlement_key],
      v_override.value,
      true
    );
  END LOOP;

  RETURN v_entitlements;
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_entitlements(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_entitlements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_entitlements(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 6) Override RPCs (platform admin only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_org_entitlement_override(
  p_org_id uuid,
  p_entitlement_key text,
  p_value jsonb,
  p_reason text,
  p_effective_until timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  IF p_entitlement_key IS NULL OR length(trim(p_entitlement_key)) = 0 THEN
    RAISE EXCEPTION 'entitlement_key_required';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  INSERT INTO public.org_entitlement_overrides (
    org_id, entitlement_key, value, reason, effective_until, created_by
  ) VALUES (
    p_org_id, trim(p_entitlement_key), p_value, trim(p_reason), p_effective_until, auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    p_org_id,
    auth.uid(),
    'entitlement_override',
    v_id,
    'entitlement.override.set',
    jsonb_build_object(
      'entitlement_key', p_entitlement_key,
      'value', p_value,
      'reason', p_reason,
      'effective_until', p_effective_until
    )
  );

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_org_entitlement_override(p_override_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.org_entitlement_overrides%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  SELECT * INTO v_row
  FROM public.org_entitlement_overrides
  WHERE id = p_override_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'override_not_found';
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RETURN;
  END IF;

  UPDATE public.org_entitlement_overrides
  SET revoked_at = now()
  WHERE id = p_override_id;

  INSERT INTO public.audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_row.org_id,
    auth.uid(),
    'entitlement_override',
    p_override_id,
    'entitlement.override.revoke',
    jsonb_build_object(
      'entitlement_key', v_row.entitlement_key,
      'reason', v_row.reason
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_org_entitlement_override(uuid, text, jsonb, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_org_entitlement_override(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_org_entitlement_override(uuid, text, jsonb, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_org_entitlement_override(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_org_entitlement_override(uuid, text, jsonb, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_org_entitlement_override(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 7) Retention upsert (Primary Owner / Owner when entitled)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_org_retention_settings(
  p_org_id uuid,
  p_policy text,
  p_retention_days integer,
  p_legal_hold boolean DEFAULT false
)
RETURNS public.org_retention_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ents jsonb;
  v_row public.org_retention_settings;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organisation_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND (om.is_primary_owner = true OR lower(om.role) = 'owner')
  ) THEN
    RAISE EXCEPTION 'not_org_owner';
  END IF;

  v_ents := public.get_org_entitlements(p_org_id);
  IF COALESCE((v_ents ->> 'configurable_retention_enabled')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'retention_not_entitled';
  END IF;

  IF p_policy NOT IN ('standard', 'extended', 'custom') THEN
    RAISE EXCEPTION 'invalid_policy';
  END IF;

  INSERT INTO public.org_retention_settings (
    org_id, policy, retention_days, legal_hold, updated_at, updated_by
  ) VALUES (
    p_org_id, p_policy, p_retention_days, COALESCE(p_legal_hold, false), now(), auth.uid()
  )
  ON CONFLICT (org_id) DO UPDATE SET
    policy = EXCLUDED.policy,
    retention_days = EXCLUDED.retention_days,
    legal_hold = EXCLUDED.legal_hold,
    updated_at = now(),
    updated_by = auth.uid()
  RETURNING * INTO v_row;

  INSERT INTO public.audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    p_org_id,
    auth.uid(),
    'retention_settings',
    p_org_id,
    'retention.settings.upsert',
    jsonb_build_object(
      'policy', p_policy,
      'retention_days', p_retention_days,
      'legal_hold', p_legal_hold
    )
  );

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_org_retention_settings(uuid, text, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_org_retention_settings(uuid, text, integer, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8) API key mint / revoke
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_org_api_key(
  p_org_id uuid,
  p_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ents jsonb;
  v_raw text;
  v_prefix text;
  v_hash text;
  v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organisation_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND (om.is_primary_owner = true OR lower(om.role) = 'owner')
  ) THEN
    RAISE EXCEPTION 'not_org_owner';
  END IF;

  v_ents := public.get_org_entitlements(p_org_id);
  IF COALESCE((v_ents ->> 'api_enabled')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'api_not_entitled';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'name_required';
  END IF;

  v_raw := 'filla_' || encode(gen_random_bytes(24), 'hex');
  v_prefix := left(v_raw, 12);
  v_hash := encode(digest(v_raw, 'sha256'), 'hex');

  INSERT INTO public.org_api_keys (org_id, name, key_prefix, key_hash, created_by)
  VALUES (p_org_id, trim(p_name), v_prefix, v_hash, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    p_org_id,
    auth.uid(),
    'api_key',
    v_id,
    'api_key.created',
    jsonb_build_object('name', trim(p_name), 'key_prefix', v_prefix)
  );

  -- Plaintext returned once; never stored
  RETURN jsonb_build_object(
    'id', v_id,
    'name', trim(p_name),
    'key_prefix', v_prefix,
    'api_key', v_raw
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_org_api_key(p_key_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.org_api_keys%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.org_api_keys WHERE id = p_key_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'api_key_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organisation_members om
    WHERE om.org_id = v_row.org_id
      AND om.user_id = auth.uid()
      AND (om.is_primary_owner = true OR lower(om.role) = 'owner')
  ) THEN
    RAISE EXCEPTION 'not_org_owner';
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RETURN;
  END IF;

  UPDATE public.org_api_keys SET revoked_at = now() WHERE id = p_key_id;

  INSERT INTO public.audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_row.org_id,
    auth.uid(),
    'api_key',
    p_key_id,
    'api_key.revoked',
    jsonb_build_object('name', v_row.name, 'key_prefix', v_row.key_prefix)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_org_api_key(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_org_api_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_org_api_key(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_org_api_key(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9) Org audit log export (gated by advanced_audit_export_enabled)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.export_org_audit_logs(
  p_org_id uuid,
  p_days integer DEFAULT 90
)
RETURNS SETOF public.audit_logs
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ents jsonb;
  v_days integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organisation_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND (
        om.is_primary_owner = true
        OR lower(om.role) IN ('owner', 'manager')
      )
  ) THEN
    RAISE EXCEPTION 'not_authorised';
  END IF;

  v_ents := public.get_org_entitlements(p_org_id);
  IF COALESCE((v_ents ->> 'advanced_audit_export_enabled')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'audit_export_not_entitled';
  END IF;

  v_days := GREATEST(1, LEAST(COALESCE(p_days, 90), 365));

  RETURN QUERY
  SELECT a.*
  FROM public.audit_logs a
  WHERE a.org_id = p_org_id
    AND a.created_at >= now() - (v_days || ' days')::interval
  ORDER BY a.created_at DESC
  LIMIT 5000;
END;
$$;

REVOKE ALL ON FUNCTION public.export_org_audit_logs(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.export_org_audit_logs(uuid, integer) TO authenticated;
