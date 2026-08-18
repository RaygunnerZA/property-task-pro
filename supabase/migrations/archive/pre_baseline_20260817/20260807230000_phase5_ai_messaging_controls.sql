-- Phase 5 — AI ops + premium messaging controls
-- @Docs/20_Billing.md §20.2–§20.4 · @Docs/28 Phase 5
-- AI exhaustion never blocks core manual work — only paid AI / premium channels.

-- ---------------------------------------------------------------------------
-- 1) Add-on columns + messaging allowance keys on tiers
-- ---------------------------------------------------------------------------
ALTER TABLE public.org_subscriptions
  ADD COLUMN IF NOT EXISTS ai_addon_ops INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS messaging_addon_units INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.org_subscriptions.ai_addon_ops IS
  'Purchased AI operation pack units beyond plan ai_ops_allowance.';
COMMENT ON COLUMN public.org_subscriptions.messaging_addon_units IS
  'Purchased premium messaging units (SMS/WhatsApp) beyond plan allowance.';

-- ai_requests may be absent on some remotes (legacy migration not applied)
CREATE TABLE IF NOT EXISTS public.ai_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  function_name   TEXT NOT NULL,
  model_used      TEXT NOT NULL,
  provider        TEXT NOT NULL,
  prompt_version  TEXT,
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  cost_usd        NUMERIC(10, 6),
  cost_units      INTEGER NOT NULL DEFAULT 1,
  latency_ms      INTEGER,
  status          TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout', 'fallback')),
  error_message   TEXT,
  entity_type     TEXT,
  entity_id       UUID,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_requests
  ADD COLUMN IF NOT EXISTS cost_units INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS ai_requests_org_id_idx ON public.ai_requests (org_id);
CREATE INDEX IF NOT EXISTS ai_requests_created_at_idx ON public.ai_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_requests_function_name_idx ON public.ai_requests (function_name);

ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_requests'
      AND policyname = 'ai_requests_select_org_members'
  ) THEN
    CREATE POLICY ai_requests_select_org_members ON public.ai_requests
      FOR SELECT USING (org_id = public.current_org_id());
  END IF;
END $$;

COMMENT ON COLUMN public.ai_requests.cost_units IS
  'Product-level AI cost units for this call (not USD).';

-- Premium messaging usage log (greenfield — no Twilio send yet)
CREATE TABLE IF NOT EXISTS public.messaging_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'voice', 'transactional_email')),
  units INTEGER NOT NULL DEFAULT 1 CHECK (units > 0),
  status TEXT NOT NULL DEFAULT 'recorded'
    CHECK (status IN ('recorded', 'sent', 'failed', 'blocked')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messaging_usage_events_org_created_idx
  ON public.messaging_usage_events (org_id, created_at DESC);

ALTER TABLE public.messaging_usage_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messaging_usage_events'
      AND policyname = 'messaging_usage_select_members'
  ) THEN
    CREATE POLICY messaging_usage_select_members ON public.messaging_usage_events
      FOR SELECT USING (org_id = public.current_org_id());
  END IF;
END $$;

-- Seed premium_messaging_allowance into tiers (idempotent merge)
UPDATE public.subscription_tiers
SET entitlements = entitlements || jsonb_build_object(
  'premium_messaging_allowance',
  CASE id
    WHEN 'home' THEN 0
    WHEN 'home_plus' THEN 25
    WHEN 'portfolio_2_5' THEN 100
    WHEN 'portfolio_6_15' THEN 250
    WHEN 'portfolio_16_40' THEN 500
    WHEN 'business' THEN 2000
    ELSE 0
  END
);

-- ---------------------------------------------------------------------------
-- 2) Cost-unit catalogue
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_ops_cost_units(p_function_name text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(COALESCE(p_function_name, ''))
    WHEN 'ai-extract' THEN 1
    WHEN 'ai-image-analyse' THEN 2
    WHEN 'ai-doc-analyse' THEN 3
    WHEN 'ai-doc-reanalyse' THEN 3
    WHEN 'compliance-clause-rewrite' THEN 2
    WHEN 'building-plan-process' THEN 5
    ELSE 1
  END;
$$;

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
    "premium_messaging_allowance": 0
  }'::jsonb;
$$;

-- ---------------------------------------------------------------------------
-- 3) Entitlements: AI + messaging add-ons
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

  RETURN v_entitlements;
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_entitlements(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_entitlements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_entitlements(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Period helper + usage counters
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_billing_period_start(p_org_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
BEGIN
  SELECT current_period_start INTO v_start
  FROM public.org_subscriptions
  WHERE org_id = p_org_id;

  IF v_start IS NOT NULL THEN
    RETURN v_start;
  END IF;

  -- Calendar month UTC when no Stripe period
  RETURN date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc';
END;
$$;

CREATE OR REPLACE FUNCTION public.org_ai_ops_used(p_org_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(COALESCE(cost_units, 1)), 0)::integer
  FROM public.ai_requests
  WHERE org_id = p_org_id
    AND status IN ('success', 'fallback')
    AND created_at >= public.org_billing_period_start(p_org_id);
$$;

CREATE OR REPLACE FUNCTION public.org_messaging_units_used(p_org_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(units), 0)::integer
  FROM public.messaging_usage_events
  WHERE org_id = p_org_id
    AND status IN ('recorded', 'sent')
    AND created_at >= public.org_billing_period_start(p_org_id);
$$;

-- ---------------------------------------------------------------------------
-- 5) Assert AI ops (blocks paid AI only — callers must fall back to manual)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_ai_ops_allowed(
  p_org_id uuid,
  p_function_name text,
  p_cost_units integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_units integer := COALESCE(p_cost_units, public.ai_ops_cost_units(p_function_name));
  v_ents jsonb;
  v_allowance integer;
  v_used integer;
BEGIN
  IF p_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'auth',
      'message', 'Organisation required',
      'cost_units', v_units
    );
  END IF;

  v_ents := public.get_org_entitlements(p_org_id);
  v_allowance := COALESCE((v_ents ->> 'ai_ops_allowance')::integer, 0);
  v_used := public.org_ai_ops_used(p_org_id);

  IF v_allowance > 0 AND (v_used + v_units) > v_allowance THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'quota',
      'message', 'AI allowance reached for this period. Manual workflows continue — add an AI pack to resume automated analysis.',
      'cost_units', v_units,
      'ai_ops_used', v_used,
      'ai_ops_allowance', v_allowance
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'cost_units', v_units,
    'ai_ops_used', v_used,
    'ai_ops_allowance', v_allowance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assert_ai_ops_allowed(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_ai_ops_allowed(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_ai_ops_allowed(uuid, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.assert_premium_messaging_allowed(
  p_org_id uuid,
  p_units integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_units integer := GREATEST(COALESCE(p_units, 1), 1);
  v_ents jsonb;
  v_allowance integer;
  v_used integer;
BEGIN
  v_ents := public.get_org_entitlements(p_org_id);
  v_allowance := COALESCE((v_ents ->> 'premium_messaging_allowance')::integer, 0);
  v_used := public.org_messaging_units_used(p_org_id);

  IF v_allowance <= 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'disabled',
      'message', 'Premium messaging (SMS / WhatsApp) is not included on this plan. In-app messaging remains available.',
      'units', v_units,
      'messaging_used', v_used,
      'premium_messaging_allowance', v_allowance
    );
  END IF;

  IF (v_used + v_units) > v_allowance THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'quota',
      'message', 'Premium messaging allowance reached. In-app messaging continues — add a messaging pack for more SMS/WhatsApp.',
      'units', v_units,
      'messaging_used', v_used,
      'premium_messaging_allowance', v_allowance
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'units', v_units,
    'messaging_used', v_used,
    'premium_messaging_allowance', v_allowance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assert_premium_messaging_allowed(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_premium_messaging_allowed(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_premium_messaging_allowed(uuid, integer) TO service_role;

-- Record messaging usage (for future send providers)
CREATE OR REPLACE FUNCTION public.record_messaging_usage(
  p_org_id uuid,
  p_channel text,
  p_units integer DEFAULT 1,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_gate jsonb;
BEGIN
  v_gate := public.assert_premium_messaging_allowed(p_org_id, COALESCE(p_units, 1));
  IF (v_gate ->> 'allowed')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION '%', COALESCE(v_gate ->> 'message', 'Premium messaging not allowed');
  END IF;

  INSERT INTO public.messaging_usage_events (org_id, channel, units, status, metadata)
  VALUES (
    p_org_id,
    p_channel,
    GREATEST(COALESCE(p_units, 1), 1),
    'recorded',
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_messaging_usage(uuid, text, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_messaging_usage(uuid, text, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_messaging_usage(uuid, text, integer, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- 6) refresh_org_usage — include AI + messaging meters
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
  v_attach_bytes bigint;
  v_intake_bytes bigint;
  v_compliance integer;
  v_by_property jsonb;
  v_ai_used integer;
  v_msg_used integer;
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

  SELECT COALESCE(SUM(COALESCE(file_size, 0)), 0)::bigint
  INTO v_attach_bytes
  FROM public.attachments
  WHERE org_id = p_org_id;

  SELECT COALESCE(SUM(COALESCE(file_size, 0)), 0)::bigint
  INTO v_intake_bytes
  FROM public.intake_items
  WHERE org_id = p_org_id;

  v_storage := v_attach_bytes + v_intake_bytes;

  SELECT COUNT(*)::integer
  INTO v_compliance
  FROM public.compliance_documents
  WHERE org_id = p_org_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('property_id', x.property_id, 'bytes', x.bytes)
      ORDER BY x.bytes DESC
    ),
    '[]'::jsonb
  )
  INTO v_by_property
  FROM (
    SELECT t.property_id, SUM(COALESCE(a.file_size, 0))::bigint AS bytes
    FROM public.attachments a
    JOIN public.tasks t ON t.id = a.parent_id AND a.parent_type = 'task'
    WHERE a.org_id = p_org_id AND t.property_id IS NOT NULL
    GROUP BY t.property_id
    ORDER BY bytes DESC
    LIMIT 10
  ) x;

  v_ai_used := public.org_ai_ops_used(p_org_id);
  v_msg_used := public.org_messaging_units_used(p_org_id);

  v_metrics := jsonb_build_object(
    'coordinating_count', v_coordinating,
    'staff_headcount', v_staff_headcount,
    'owner_count', v_owner_count,
    'manager_count', v_manager_count,
    'member_legacy_count', v_member_legacy,
    'archived_property_count', v_archived_count,
    'evidence_attachment_bytes', v_attach_bytes,
    'evidence_intake_bytes', v_intake_bytes,
    'evidence_by_property', v_by_property,
    'evidence_delivered_bytes', 0,
    'ai_ops_used', v_ai_used,
    'messaging_units_used', v_msg_used
  );

  INSERT INTO public.org_usage AS u (
    org_id, property_count, staff_count, storage_used_bytes,
    compliance_docs_count, metrics, last_updated
  )
  VALUES (
    p_org_id, v_property_count, v_staff_headcount, v_storage,
    v_compliance, v_metrics, now()
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
-- 7) Billing upsert — AI + messaging add-ons
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.upsert_org_subscription_from_billing(
  uuid, text, text, text, text, text, integer, boolean, timestamptz, timestamptz, timestamptz, timestamptz, bigint
);

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
  p_last_payment_failed_at timestamptz DEFAULT NULL,
  p_storage_addon_bytes bigint DEFAULT NULL,
  p_ai_addon_ops integer DEFAULT NULL,
  p_messaging_addon_units integer DEFAULT NULL
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
    org_id, plan_id, status, billing_state,
    stripe_customer_id, stripe_subscription_id,
    seat_count, storage_addon_bytes, ai_addon_ops, messaging_addon_units,
    cancel_at_period_end, current_period_start, current_period_end,
    grace_ends_at, last_payment_failed_at, updated_at
  )
  VALUES (
    p_org_id, p_plan_id, COALESCE(p_status, 'active'), COALESCE(p_billing_state, 'active'),
    p_stripe_customer_id, p_stripe_subscription_id,
    COALESCE(p_seat_count, 0), COALESCE(p_storage_addon_bytes, 0),
    COALESCE(p_ai_addon_ops, 0), COALESCE(p_messaging_addon_units, 0),
    COALESCE(p_cancel_at_period_end, false), p_current_period_start, p_current_period_end,
    p_grace_ends_at, p_last_payment_failed_at, now()
  )
  ON CONFLICT (org_id) DO UPDATE SET
    plan_id = COALESCE(EXCLUDED.plan_id, org_subscriptions.plan_id),
    status = COALESCE(EXCLUDED.status, org_subscriptions.status),
    billing_state = COALESCE(EXCLUDED.billing_state, org_subscriptions.billing_state),
    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, org_subscriptions.stripe_customer_id),
    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, org_subscriptions.stripe_subscription_id),
    seat_count = COALESCE(EXCLUDED.seat_count, org_subscriptions.seat_count),
    storage_addon_bytes = COALESCE(EXCLUDED.storage_addon_bytes, org_subscriptions.storage_addon_bytes),
    ai_addon_ops = COALESCE(EXCLUDED.ai_addon_ops, org_subscriptions.ai_addon_ops),
    messaging_addon_units = COALESCE(EXCLUDED.messaging_addon_units, org_subscriptions.messaging_addon_units),
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
  uuid, text, text, text, text, text, integer, boolean, timestamptz, timestamptz, timestamptz, timestamptz, bigint, integer, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_org_subscription_from_billing(
  uuid, text, text, text, text, text, integer, boolean, timestamptz, timestamptz, timestamptz, timestamptz, bigint, integer, integer
) TO service_role;

NOTIFY pgrst, 'reload schema';
