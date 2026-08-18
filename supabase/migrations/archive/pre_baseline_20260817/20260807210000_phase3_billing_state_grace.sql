-- Phase 3 — billing state, grace, expansion lock, seat add-ons, downgrade archive
-- @Docs/20_Billing.md §20.4–§20.6 · @Docs/28_Billing_Implementation_Plan.md Phase 3

-- ---------------------------------------------------------------------------
-- 1) org_subscriptions billing state columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.org_subscriptions
  ADD COLUMN IF NOT EXISTS billing_state TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS grace_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;

COMMENT ON COLUMN public.org_subscriptions.billing_state IS
  'Canonical commercial state: active | past_due | grace | expansion_locked | canceled. Prefer get_org_billing_status() for effective state.';
COMMENT ON COLUMN public.org_subscriptions.grace_ends_at IS
  'When set after payment failure, existing ops continue until this timestamp; then expansion locks.';
COMMENT ON COLUMN public.org_subscriptions.seat_count IS
  'Add-on coordinating seats beyond the plan pack (0 = no add-ons).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'org_subscriptions_billing_state_check'
  ) THEN
    ALTER TABLE public.org_subscriptions
      ADD CONSTRAINT org_subscriptions_billing_state_check
      CHECK (billing_state IN (
        'active', 'past_due', 'grace', 'expansion_locked', 'canceled'
      ));
  END IF;
END $$;

UPDATE public.org_subscriptions
SET seat_count = 0
WHERE seat_count IS NULL;

-- ---------------------------------------------------------------------------
-- 2) Idempotent Stripe / billing event log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  org_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_events'
      AND policyname = 'billing_events_select_primary_owner'
  ) THEN
    CREATE POLICY billing_events_select_primary_owner ON public.billing_events
      FOR SELECT USING (
        org_id = public.current_org_id()
        AND EXISTS (
          SELECT 1 FROM public.organisation_members om
          WHERE om.org_id = billing_events.org_id
            AND om.user_id = auth.uid()
            AND om.is_primary_owner = true
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Effective billing status (grace evaluated at read time)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_org_billing_status(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.org_subscriptions%ROWTYPE;
  v_state text := 'active';
  v_expansion boolean := true;
  v_stripe_status text;
BEGIN
  SELECT * INTO v_sub
  FROM public.org_subscriptions
  WHERE org_id = p_org_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'state', 'active',
      'expansion_allowed', true,
      'status', 'home',
      'plan_id', NULL,
      'grace_ends_at', NULL,
      'seat_addon', 0,
      'cancel_at_period_end', false,
      'current_period_end', NULL,
      'stripe_customer_id', NULL,
      'stripe_subscription_id', NULL
    );
  END IF;

  v_stripe_status := lower(COALESCE(v_sub.status, 'active'));

  IF v_stripe_status IN ('canceled', 'cancelled', 'unpaid')
     OR v_sub.billing_state = 'canceled' THEN
    v_state := 'canceled';
    v_expansion := false;
  ELSIF v_stripe_status IN ('past_due', 'incomplete', 'incomplete_expired')
     OR v_sub.billing_state IN ('past_due', 'grace', 'expansion_locked') THEN
    IF v_sub.grace_ends_at IS NOT NULL AND v_sub.grace_ends_at > now() THEN
      v_state := 'grace';
      v_expansion := true;
    ELSE
      v_state := 'expansion_locked';
      v_expansion := false;
    END IF;
  ELSIF v_sub.billing_state = 'expansion_locked' THEN
    v_state := 'expansion_locked';
    v_expansion := false;
  ELSE
    v_state := 'active';
    v_expansion := true;
  END IF;

  RETURN jsonb_build_object(
    'state', v_state,
    'expansion_allowed', v_expansion,
    'status', v_sub.status,
    'plan_id', v_sub.plan_id,
    'grace_ends_at', v_sub.grace_ends_at,
    'seat_addon', COALESCE(v_sub.seat_count, 0),
    'cancel_at_period_end', COALESCE(v_sub.cancel_at_period_end, false),
    'current_period_end', v_sub.current_period_end,
    'stripe_customer_id', v_sub.stripe_customer_id,
    'stripe_subscription_id', v_sub.stripe_subscription_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_billing_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_billing_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_billing_status(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.org_expansion_allowed(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (public.get_org_billing_status(p_org_id) ->> 'expansion_allowed')::boolean,
    true
  );
$$;

REVOKE ALL ON FUNCTION public.org_expansion_allowed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_expansion_allowed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_expansion_allowed(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Entitlements: include seat add-ons in coordinating seat limit
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
  v_base_seats integer;
BEGIN
  SELECT t.entitlements, COALESCE(s.seat_count, 0)
  INTO v_entitlements, v_seat_addon
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
      v_entitlements,
      '{coordinating_seats_limit}',
      to_jsonb(v_base_seats + v_seat_addon)
    );
  END IF;

  RETURN v_entitlements;
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_entitlements(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_entitlements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_entitlements(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Gate create_property_v2 on expansion lock + property limit
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

  IF NOT public.org_expansion_allowed(p_org_id) THEN
    RAISE EXCEPTION
      'Billing restriction: adding properties is paused until payment is restored. Existing work continues.';
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

-- ---------------------------------------------------------------------------
-- 6) Downgrade: keep selected active properties, soft-archive the rest
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.select_active_properties_for_limit(
  p_org_id uuid,
  p_keep_property_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_primary boolean := false;
  v_ents jsonb;
  v_limit integer;
  v_keep_count integer;
  v_archived integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: User must be authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE org_id = p_org_id
      AND user_id = v_user_id
      AND is_primary_owner = true
  ) INTO v_is_primary;

  IF NOT v_is_primary THEN
    RAISE EXCEPTION 'Access Denied: Only the Primary Owner can select active properties';
  END IF;

  v_ents := public.get_org_entitlements(p_org_id);
  v_limit := COALESCE((v_ents ->> 'active_properties_limit')::integer, 1);
  v_keep_count := COALESCE(cardinality(p_keep_property_ids), 0);

  IF v_keep_count < 1 THEN
    RAISE EXCEPTION 'Keep at least one active property';
  END IF;

  IF v_keep_count > v_limit THEN
    RAISE EXCEPTION 'You can keep at most % active properties on this plan', v_limit;
  END IF;

  -- Validate keep IDs belong to org and are currently active
  IF (
    SELECT COUNT(*)::integer
    FROM public.properties
    WHERE org_id = p_org_id
      AND id = ANY(p_keep_property_ids)
      AND COALESCE(is_archived, false) = false
  ) <> v_keep_count THEN
    RAISE EXCEPTION 'One or more selected properties are invalid or already archived';
  END IF;

  UPDATE public.properties
  SET is_archived = true,
      updated_at = now()
  WHERE org_id = p_org_id
    AND COALESCE(is_archived, false) = false
    AND NOT (id = ANY(p_keep_property_ids));

  GET DIAGNOSTICS v_archived = ROW_COUNT;

  PERFORM public.refresh_org_usage(p_org_id);

  RETURN v_archived;
END;
$$;

REVOKE ALL ON FUNCTION public.select_active_properties_for_limit(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.select_active_properties_for_limit(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.select_active_properties_for_limit(uuid, uuid[]) TO service_role;

-- ---------------------------------------------------------------------------
-- 7) Service-role helper: upsert subscription from Stripe webhook
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_org_subscription_from_billing(
  p_org_id uuid,
  p_plan_id text,
  p_status text,
  p_billing_state text,
  p_stripe_customer_id text DEFAULT NULL,
  p_stripe_subscription_id text DEFAULT NULL,
  p_seat_count integer DEFAULT NULL,
  p_cancel_at_period_end boolean DEFAULT NULL,
  p_current_period_start timestamptz DEFAULT NULL,
  p_current_period_end timestamptz DEFAULT NULL,
  p_grace_ends_at timestamptz DEFAULT NULL,
  p_last_payment_failed_at timestamptz DEFAULT NULL
)
RETURNS public.org_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.org_subscriptions%ROWTYPE;
BEGIN
  INSERT INTO public.org_subscriptions (
    org_id,
    plan_id,
    status,
    billing_state,
    stripe_customer_id,
    stripe_subscription_id,
    seat_count,
    cancel_at_period_end,
    current_period_start,
    current_period_end,
    grace_ends_at,
    last_payment_failed_at,
    updated_at
  )
  VALUES (
    p_org_id,
    p_plan_id,
    COALESCE(p_status, 'active'),
    COALESCE(p_billing_state, 'active'),
    p_stripe_customer_id,
    p_stripe_subscription_id,
    COALESCE(p_seat_count, 0),
    COALESCE(p_cancel_at_period_end, false),
    p_current_period_start,
    p_current_period_end,
    p_grace_ends_at,
    p_last_payment_failed_at,
    now()
  )
  ON CONFLICT (org_id) DO UPDATE SET
    plan_id = COALESCE(EXCLUDED.plan_id, org_subscriptions.plan_id),
    status = COALESCE(EXCLUDED.status, org_subscriptions.status),
    billing_state = COALESCE(EXCLUDED.billing_state, org_subscriptions.billing_state),
    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, org_subscriptions.stripe_customer_id),
    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, org_subscriptions.stripe_subscription_id),
    seat_count = COALESCE(EXCLUDED.seat_count, org_subscriptions.seat_count),
    cancel_at_period_end = COALESCE(EXCLUDED.cancel_at_period_end, org_subscriptions.cancel_at_period_end),
    current_period_start = COALESCE(EXCLUDED.current_period_start, org_subscriptions.current_period_start),
    current_period_end = COALESCE(EXCLUDED.current_period_end, org_subscriptions.current_period_end),
    grace_ends_at = CASE
      WHEN EXCLUDED.billing_state = 'active' THEN NULL
      ELSE COALESCE(EXCLUDED.grace_ends_at, org_subscriptions.grace_ends_at)
    END,
    last_payment_failed_at = COALESCE(EXCLUDED.last_payment_failed_at, org_subscriptions.last_payment_failed_at),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_org_subscription_from_billing(
  uuid, text, text, text, text, text, integer, boolean, timestamptz, timestamptz, timestamptz, timestamptz
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_org_subscription_from_billing(
  uuid, text, text, text, text, text, integer, boolean, timestamptz, timestamptz, timestamptz, timestamptz
) TO service_role;

NOTIFY pgrst, 'reload schema';
