-- Phase 4 — Evidence controls
-- @Docs/20_Billing.md §20.2 · @Docs/28_Billing_Implementation_Plan.md Phase 4
-- Fix storage meter, evidence allowance + storage packs, upload assert, video MIME on task-images.

-- ---------------------------------------------------------------------------
-- 1) Storage pack add-on bytes on subscription
-- ---------------------------------------------------------------------------
ALTER TABLE public.org_subscriptions
  ADD COLUMN IF NOT EXISTS storage_addon_bytes BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.org_subscriptions.storage_addon_bytes IS
  'Purchased evidence storage pack bytes beyond plan evidence_bytes_allowance.';

-- ---------------------------------------------------------------------------
-- 2) Entitlements: include storage packs in evidence allowance
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
  v_base_seats integer;
  v_base_storage bigint;
BEGIN
  SELECT t.entitlements, COALESCE(s.seat_count, 0), COALESCE(s.storage_addon_bytes, 0)
  INTO v_entitlements, v_seat_addon, v_storage_addon
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

  v_base_storage := COALESCE((v_entitlements ->> 'evidence_bytes_allowance')::bigint, 0);
  IF v_storage_addon > 0 THEN
    v_entitlements := jsonb_set(
      v_entitlements,
      '{evidence_bytes_allowance}',
      to_jsonb(v_base_storage + v_storage_addon)
    );
  END IF;

  RETURN v_entitlements;
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_entitlements(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_entitlements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_entitlements(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3) refresh_org_usage — real file_size sums + per-property breakdown
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

  -- Stored evidence bytes: attachments.file_size + intake_items.file_size
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

  -- Top properties by attachment bytes (via task → property)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'property_id', x.property_id,
        'bytes', x.bytes
      )
      ORDER BY x.bytes DESC
    ),
    '[]'::jsonb
  )
  INTO v_by_property
  FROM (
    SELECT t.property_id, SUM(COALESCE(a.file_size, 0))::bigint AS bytes
    FROM public.attachments a
    JOIN public.tasks t
      ON t.id = a.parent_id
     AND a.parent_type = 'task'
    WHERE a.org_id = p_org_id
      AND t.property_id IS NOT NULL
    GROUP BY t.property_id
    ORDER BY bytes DESC
    LIMIT 10
  ) x;

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
    -- Delivered-bytes observe stub (CDN/webhook later)
    'evidence_delivered_bytes', 0
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
-- 4) Server-side upload gate (new uploads only — never revokes existing reads)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_evidence_upload_allowed(
  p_org_id uuid,
  p_file_size bigint,
  p_mime_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_ents jsonb;
  v_allowance bigint;
  v_used bigint;
  v_mime text := lower(COALESCE(p_mime_type, ''));
  v_max bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'auth', 'message', 'Authentication required');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE org_id = p_org_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'auth', 'message', 'Not a member of this organisation');
  END IF;

  IF p_file_size IS NULL OR p_file_size < 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'size', 'message', 'Invalid file size');
  END IF;

  -- Block obvious executables / archives often used for malware
  IF v_mime IN (
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-executable',
    'application/x-dosexec',
    'application/java-archive',
    'application/x-sh',
    'application/x-csh'
  ) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'type',
      'message', 'This file type is not allowed for evidence uploads.'
    );
  END IF;

  -- Per-type caps (aligned with client uploadLimits)
  IF v_mime LIKE 'image/%' THEN
    v_max := 10 * 1024 * 1024;
  ELSIF v_mime = 'application/pdf' THEN
    v_max := 25 * 1024 * 1024;
  ELSIF v_mime LIKE 'video/%' THEN
    v_max := 50 * 1024 * 1024;
  ELSIF v_mime LIKE 'audio/%' THEN
    v_max := 25 * 1024 * 1024;
  ELSE
    v_max := 20 * 1024 * 1024;
  END IF;

  IF p_file_size > v_max THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'size',
      'message', format('File exceeds the %s MB limit for this type.', (v_max / (1024 * 1024))::text),
      'max_bytes', v_max
    );
  END IF;

  v_ents := public.get_org_entitlements(p_org_id);
  v_allowance := COALESCE((v_ents ->> 'evidence_bytes_allowance')::bigint, 0);

  SELECT COALESCE(storage_used_bytes, 0)
  INTO v_used
  FROM public.org_usage
  WHERE org_id = p_org_id;

  IF v_used IS NULL THEN
    v_used := 0;
  END IF;

  IF v_allowance > 0 AND (v_used + p_file_size) > v_allowance THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'quota',
      'message', 'Evidence storage allowance reached. Existing files remain available — add a storage pack to upload more.',
      'storage_used_bytes', v_used,
      'evidence_bytes_allowance', v_allowance
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'storage_used_bytes', v_used,
    'evidence_bytes_allowance', v_allowance,
    'max_bytes', v_max
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assert_evidence_upload_allowed(uuid, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_evidence_upload_allowed(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_evidence_upload_allowed(uuid, bigint, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Billing upsert: persist storage_addon_bytes
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.upsert_org_subscription_from_billing(
  uuid, text, text, text, text, text, integer, boolean, timestamptz, timestamptz, timestamptz, timestamptz
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
  p_storage_addon_bytes bigint DEFAULT NULL
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
    storage_addon_bytes,
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
    COALESCE(p_storage_addon_bytes, 0),
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
    storage_addon_bytes = COALESCE(EXCLUDED.storage_addon_bytes, org_subscriptions.storage_addon_bytes),
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
  uuid, text, text, text, text, text, integer, boolean, timestamptz, timestamptz, timestamptz, timestamptz, bigint
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_org_subscription_from_billing(
  uuid, text, text, text, text, text, integer, boolean, timestamptz, timestamptz, timestamptz, timestamptz, bigint
) TO service_role;

-- ---------------------------------------------------------------------------
-- 6) Allow short video on task-images (50MB cap at Storage layer)
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
SET file_size_limit = 52428800, -- 50 MiB
    allowed_mime_types = ARRAY[
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'video/mp4', 'video/quicktime', 'video/webm'
    ]
WHERE id = 'task-images';

-- Include storage packs in billing status payload
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
      'storage_addon_bytes', 0,
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
    'storage_addon_bytes', COALESCE(v_sub.storage_addon_bytes, 0),
    'cancel_at_period_end', COALESCE(v_sub.cancel_at_period_end, false),
    'current_period_end', v_sub.current_period_end,
    'stripe_customer_id', v_sub.stripe_customer_id,
    'stripe_subscription_id', v_sub.stripe_subscription_id
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
