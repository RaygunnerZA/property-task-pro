-- Phase 0–1: ensure billing tables, usage metrics, tier seeds,
-- entitlement helpers, refresh_org_usage, property-limit gate on create_property_v2.
-- @Docs/20_Billing.md · @Docs/28_Billing_Implementation_Plan.md Appendix A
-- Remote Filla-v2 may lack legacy billing tables / properties.is_archived / is_platform_admin.

-- ---------------------------------------------------------------------------
-- 0) Active-property column (archived properties do not count)
-- ---------------------------------------------------------------------------
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 1) Billing tables (create if missing — remote may never have received v2 init)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  price_id TEXT,
  entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.org_subscriptions (
  org_id UUID PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  plan_id TEXT REFERENCES public.subscription_tiers(id),
  seat_count INTEGER,
  usage_limits JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.org_usage (
  org_id UUID PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
  storage_used_bytes BIGINT NOT NULL DEFAULT 0,
  property_count INTEGER NOT NULL DEFAULT 0,
  staff_count INTEGER NOT NULL DEFAULT 0,
  compliance_docs_count INTEGER NOT NULL DEFAULT 0,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.org_usage ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.org_usage
  ADD COLUMN IF NOT EXISTS metrics JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscription_tiers'
      AND policyname = 'subscription_tiers_select'
  ) THEN
    CREATE POLICY subscription_tiers_select ON public.subscription_tiers
      FOR SELECT USING (is_active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'org_subscriptions'
      AND policyname = 'org_subscriptions_select'
  ) THEN
    CREATE POLICY org_subscriptions_select ON public.org_subscriptions
      FOR SELECT USING (org_id = public.current_org_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'org_usage'
      AND policyname = 'org_usage_select'
  ) THEN
    CREATE POLICY org_usage_select ON public.org_usage
      FOR SELECT USING (org_id = public.current_org_id());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Seed subscription tiers (idempotent upsert)
-- ---------------------------------------------------------------------------
INSERT INTO public.subscription_tiers (id, name, type, price_id, entitlements, is_active)
VALUES
  (
    'home',
    'Home',
    'personal',
    NULL,
    '{
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
      "ai_ops_allowance": 25
    }'::jsonb,
    true
  ),
  (
    'home_plus',
    'Home Plus',
    'personal',
    NULL,
    '{
      "active_properties_limit": 1,
      "coordinating_seats_limit": 5,
      "staff_active_monthly_allowance": 10,
      "can_add_staff": true,
      "multi_property_enabled": false,
      "external_submissions_enabled": true,
      "compliance_enabled": false,
      "advanced_reports_enabled": false,
      "api_enabled": false,
      "evidence_bytes_allowance": 2147483648,
      "ai_ops_allowance": 100
    }'::jsonb,
    true
  ),
  (
    'portfolio_2_5',
    'Portfolio (2–5)',
    'business',
    NULL,
    '{
      "active_properties_limit": 5,
      "coordinating_seats_limit": 5,
      "staff_active_monthly_allowance": 25,
      "can_add_staff": true,
      "multi_property_enabled": true,
      "external_submissions_enabled": true,
      "compliance_enabled": true,
      "advanced_reports_enabled": false,
      "api_enabled": false,
      "evidence_bytes_allowance": 10737418240,
      "ai_ops_allowance": 500
    }'::jsonb,
    true
  ),
  (
    'portfolio_6_15',
    'Portfolio (6–15)',
    'business',
    NULL,
    '{
      "active_properties_limit": 15,
      "coordinating_seats_limit": 10,
      "staff_active_monthly_allowance": 50,
      "can_add_staff": true,
      "multi_property_enabled": true,
      "external_submissions_enabled": true,
      "compliance_enabled": true,
      "advanced_reports_enabled": true,
      "api_enabled": false,
      "evidence_bytes_allowance": 32212254720,
      "ai_ops_allowance": 1500
    }'::jsonb,
    true
  ),
  (
    'portfolio_16_40',
    'Portfolio (16–40)',
    'business',
    NULL,
    '{
      "active_properties_limit": 40,
      "coordinating_seats_limit": 20,
      "staff_active_monthly_allowance": 100,
      "can_add_staff": true,
      "multi_property_enabled": true,
      "external_submissions_enabled": true,
      "compliance_enabled": true,
      "advanced_reports_enabled": true,
      "api_enabled": false,
      "evidence_bytes_allowance": 107374182400,
      "ai_ops_allowance": 4000
    }'::jsonb,
    true
  ),
  (
    'business',
    'Business',
    'business',
    NULL,
    '{
      "active_properties_limit": 100,
      "coordinating_seats_limit": 50,
      "staff_active_monthly_allowance": 250,
      "can_add_staff": true,
      "multi_property_enabled": true,
      "external_submissions_enabled": true,
      "compliance_enabled": true,
      "advanced_reports_enabled": true,
      "api_enabled": true,
      "evidence_bytes_allowance": 549755813888,
      "ai_ops_allowance": 20000
    }'::jsonb,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  entitlements = EXCLUDED.entitlements,
  is_active = EXCLUDED.is_active;

-- ---------------------------------------------------------------------------
-- 3) Home entitlement defaults + get_org_entitlements
-- ---------------------------------------------------------------------------
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
    "ai_ops_allowance": 25
  }'::jsonb;
$$;

CREATE OR REPLACE FUNCTION public.get_org_entitlements(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entitlements jsonb;
BEGIN
  SELECT t.entitlements
  INTO v_entitlements
  FROM public.org_subscriptions s
  JOIN public.subscription_tiers t ON t.id = s.plan_id
  WHERE s.org_id = p_org_id
  LIMIT 1;

  IF v_entitlements IS NULL THEN
    RETURN public.home_entitlement_defaults();
  END IF;

  RETURN public.home_entitlement_defaults() || v_entitlements;
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_entitlements(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_entitlements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_entitlements(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) refresh_org_usage — observe-mode counters
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_org_usage(p_org_id uuid)
RETURNS public.org_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_member boolean := false;
  v_property_count integer;
  v_archived_count integer;
  v_owner_count integer;
  v_manager_count integer;
  v_staff_count integer;
  v_member_legacy integer;
  v_coordinating integer;
  v_staff_headcount integer;
  v_storage bigint;
  v_compliance integer;
  v_metrics jsonb;
  v_row public.org_usage;
BEGIN
  IF v_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.organisation_members
      WHERE org_id = p_org_id AND user_id = v_user_id
    ) INTO v_is_member;

    IF NOT v_is_member THEN
      RAISE EXCEPTION 'Access Denied: not a member of this organisation';
    END IF;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE COALESCE(is_archived, false) = false),
    COUNT(*) FILTER (WHERE COALESCE(is_archived, false) = true)
  INTO v_property_count, v_archived_count
  FROM public.properties
  WHERE org_id = p_org_id;

  SELECT
    COUNT(*) FILTER (WHERE lower(role) = 'owner'),
    COUNT(*) FILTER (WHERE lower(role) = 'manager'),
    COUNT(*) FILTER (WHERE lower(role) = 'staff'),
    COUNT(*) FILTER (WHERE lower(role) = 'member')
  INTO v_owner_count, v_manager_count, v_staff_count, v_member_legacy
  FROM public.organisation_members
  WHERE org_id = p_org_id;

  v_coordinating := v_owner_count + v_manager_count;
  v_staff_headcount := v_staff_count + v_member_legacy;

  SELECT COALESCE(SUM(octet_length(COALESCE(file_url, ''))), 0)::bigint
  INTO v_storage
  FROM public.attachments
  WHERE org_id = p_org_id;

  SELECT COUNT(*)::integer
  INTO v_compliance
  FROM public.compliance_documents
  WHERE org_id = p_org_id;

  v_metrics := jsonb_build_object(
    'coordinating_count', v_coordinating,
    'staff_headcount', v_staff_headcount,
    'owner_count', v_owner_count,
    'manager_count', v_manager_count,
    'member_legacy_count', v_member_legacy,
    'archived_property_count', v_archived_count
  );

  INSERT INTO public.org_usage AS u (
    org_id,
    property_count,
    staff_count,
    storage_used_bytes,
    compliance_docs_count,
    metrics,
    last_updated
  )
  VALUES (
    p_org_id,
    v_property_count,
    v_staff_headcount,
    v_storage,
    v_compliance,
    v_metrics,
    now()
  )
  ON CONFLICT (org_id) DO UPDATE SET
    property_count = EXCLUDED.property_count,
    staff_count = EXCLUDED.staff_count,
    storage_used_bytes = EXCLUDED.storage_used_bytes,
    compliance_docs_count = EXCLUDED.compliance_docs_count,
    metrics = EXCLUDED.metrics,
    last_updated = EXCLUDED.last_updated
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_org_usage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_org_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_org_usage(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Gate create_property_v2 on active_properties_limit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_property_v2(
  p_org_id UUID,
  p_address TEXT,
  p_nickname TEXT DEFAULT NULL,
  p_icon_name TEXT DEFAULT NULL,
  p_icon_color_hex TEXT DEFAULT NULL,
  p_thumbnail_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_membership_count INTEGER;
  v_new_property JSON;
  v_property_id UUID;
  has_duplicate BOOLEAN;
  v_ents jsonb;
  v_limit integer;
  v_active_count integer;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: User must be authenticated';
  END IF;

  SELECT COUNT(*) INTO v_membership_count
  FROM organisation_members
  WHERE org_id = p_org_id AND user_id = v_user_id;

  IF v_membership_count = 0 THEN
    RAISE EXCEPTION 'Access Denied: User is not a member of this organisation';
  END IF;

  v_ents := public.get_org_entitlements(p_org_id);
  v_limit := COALESCE((v_ents ->> 'active_properties_limit')::integer, 1);

  SELECT COUNT(*)::integer
  INTO v_active_count
  FROM public.properties
  WHERE org_id = p_org_id
    AND COALESCE(is_archived, false) = false;

  IF v_active_count >= v_limit THEN
    RAISE EXCEPTION
      'Property limit reached (% of %). Upgrade to Portfolio to add more properties.',
      v_active_count,
      v_limit;
  END IF;

  has_duplicate := check_duplicate_property_address(p_org_id, p_address);

  IF has_duplicate THEN
    RAISE EXCEPTION 'A property with this address already exists in your organisation. Please use a different address.';
  END IF;

  INSERT INTO properties (
    org_id, address, nickname, icon_name, icon_color_hex, thumbnail_url
  )
  VALUES (
    p_org_id, p_address, p_nickname, p_icon_name, p_icon_color_hex, p_thumbnail_url
  )
  RETURNING json_build_object(
    'id', id,
    'org_id', org_id,
    'address', address,
    'nickname', nickname,
    'icon_name', icon_name,
    'icon_color_hex', icon_color_hex,
    'thumbnail_url', thumbnail_url,
    'created_at', created_at,
    'updated_at', updated_at
  ), id INTO v_new_property, v_property_id;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'seed_property_defaults'
  ) THEN
    PERFORM seed_property_defaults(v_property_id, p_org_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'seed_onboarding_demo_for_property'
  ) THEN
    PERFORM seed_onboarding_demo_for_property(v_property_id);
  END IF;

  PERFORM public.refresh_org_usage(p_org_id);

  RETURN v_new_property;
END;
$$;

NOTIFY pgrst, 'reload schema';
