-- Phase 7 — Packaging optimization foundation
-- @Docs/28 Phase 7 · instrumentation export + soft-warn/enforce documentation hooks
-- Full contribution-margin dashboards remain out of scope; this ships finance-ready snapshots.

-- Ensure pgcrypto for API key hashing (also used by Phase 6)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Admin utilization snapshot (platform admin) — plan × usage ratios
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_billing_utilization_snapshot()
RETURNS TABLE (
  org_id uuid,
  org_name text,
  plan_id text,
  plan_name text,
  billing_state text,
  property_count integer,
  active_properties_limit integer,
  property_utilization numeric,
  coordinating_count integer,
  coordinating_seats_limit integer,
  seat_utilization numeric,
  staff_headcount integer,
  staff_active_monthly_allowance integer,
  storage_used_bytes bigint,
  evidence_bytes_allowance bigint,
  evidence_utilization numeric,
  ai_ops_used integer,
  ai_ops_allowance integer,
  ai_utilization numeric,
  messaging_units_used integer,
  premium_messaging_allowance integer,
  seat_addon integer,
  storage_addon_bytes bigint,
  ai_addon_ops integer,
  messaging_addon_units integer,
  ai_cost_usd_period numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH ents AS (
    SELECT
      o.id AS org_id,
      o.name AS org_name,
      s.plan_id,
      t.name AS plan_name,
      COALESCE(s.billing_state, 'ok') AS billing_state,
      COALESCE(u.property_count, 0) AS property_count,
      COALESCE(u.staff_count, 0) AS staff_headcount,
      COALESCE(u.storage_used_bytes, 0)::bigint AS storage_used_bytes,
      COALESCE((u.metrics ->> 'coordinating_count')::integer, 0) AS coordinating_count,
      COALESCE((u.metrics ->> 'ai_ops_used')::integer, 0) AS ai_ops_used,
      COALESCE((u.metrics ->> 'messaging_units_used')::integer, 0) AS messaging_units_used,
      COALESCE(s.seat_count, 0) AS seat_addon,
      COALESCE(s.storage_addon_bytes, 0)::bigint AS storage_addon_bytes,
      COALESCE(s.ai_addon_ops, 0) AS ai_addon_ops,
      COALESCE(s.messaging_addon_units, 0) AS messaging_addon_units,
      public.get_org_entitlements(o.id) AS entitlements,
      public.org_billing_period_start(o.id) AS period_start
    FROM public.organisations o
    LEFT JOIN public.org_subscriptions s ON s.org_id = o.id
    LEFT JOIN public.subscription_tiers t ON t.id = s.plan_id
    LEFT JOIN public.org_usage u ON u.org_id = o.id
  ),
  ai_costs AS (
    SELECT
      ar.org_id,
      COALESCE(SUM(ar.cost_usd), 0)::numeric AS ai_cost_usd_period
    FROM public.ai_requests ar
    GROUP BY ar.org_id
  )
  SELECT
    e.org_id,
    e.org_name,
    e.plan_id,
    COALESCE(e.plan_name, 'Home') AS plan_name,
    e.billing_state,
    e.property_count,
    COALESCE((e.entitlements ->> 'active_properties_limit')::integer, 1) AS active_properties_limit,
    CASE
      WHEN COALESCE((e.entitlements ->> 'active_properties_limit')::integer, 1) > 0
      THEN round(
        e.property_count::numeric
        / (e.entitlements ->> 'active_properties_limit')::integer,
        4
      )
      ELSE NULL
    END AS property_utilization,
    e.coordinating_count,
    COALESCE((e.entitlements ->> 'coordinating_seats_limit')::integer, 1) AS coordinating_seats_limit,
    CASE
      WHEN COALESCE((e.entitlements ->> 'coordinating_seats_limit')::integer, 1) > 0
      THEN round(
        e.coordinating_count::numeric
        / (e.entitlements ->> 'coordinating_seats_limit')::integer,
        4
      )
      ELSE NULL
    END AS seat_utilization,
    e.staff_headcount,
    COALESCE((e.entitlements ->> 'staff_active_monthly_allowance')::integer, 0)
      AS staff_active_monthly_allowance,
    e.storage_used_bytes,
    COALESCE((e.entitlements ->> 'evidence_bytes_allowance')::bigint, 0) AS evidence_bytes_allowance,
    CASE
      WHEN COALESCE((e.entitlements ->> 'evidence_bytes_allowance')::bigint, 0) > 0
      THEN round(
        e.storage_used_bytes::numeric
        / (e.entitlements ->> 'evidence_bytes_allowance')::bigint,
        4
      )
      ELSE NULL
    END AS evidence_utilization,
    e.ai_ops_used,
    COALESCE((e.entitlements ->> 'ai_ops_allowance')::integer, 0) AS ai_ops_allowance,
    CASE
      WHEN COALESCE((e.entitlements ->> 'ai_ops_allowance')::integer, 0) > 0
      THEN round(
        e.ai_ops_used::numeric / (e.entitlements ->> 'ai_ops_allowance')::integer,
        4
      )
      ELSE NULL
    END AS ai_utilization,
    e.messaging_units_used,
    COALESCE((e.entitlements ->> 'premium_messaging_allowance')::integer, 0)
      AS premium_messaging_allowance,
    e.seat_addon,
    e.storage_addon_bytes,
    e.ai_addon_ops,
    e.messaging_addon_units,
    COALESCE(ac.ai_cost_usd_period, 0) AS ai_cost_usd_period
  FROM ents e
  LEFT JOIN ai_costs ac ON ac.org_id = e.org_id
  ORDER BY e.org_name;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_billing_utilization_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_billing_utilization_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_billing_utilization_snapshot() TO service_role;

COMMENT ON FUNCTION public.admin_billing_utilization_snapshot() IS
  'Phase 7: platform-admin utilization export for packaging / contribution-margin analysis.';
