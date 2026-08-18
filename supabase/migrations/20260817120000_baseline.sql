-- Description: Squashed baseline of live public schema (project gbtexoyvfpnduykmxunc, 2026-08-17).
-- Source: pg_dump --schema-only of hosted Postgres. Do not edit by hand; add a new migration instead.
-- Legacy 216 files: supabase/migrations/archive/pre_baseline_20260817/
-- Canonical gaps (platform_admins, task_followers, etc.) are in the next migration.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: compliance_domain; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.compliance_domain AS ENUM (
    'safety',
    'occupancy',
    'landlord_duties',
    'data_protection',
    'building_maintenance',
    'other'
);


--
-- Name: compliance_obligation_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.compliance_obligation_type AS ENUM (
    'must_do',
    'must_not_do',
    'must_document',
    'must_report'
);


--
-- Name: compliance_review_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.compliance_review_type AS ENUM (
    'ai_critic',
    'ai_cross_model',
    'human'
);


--
-- Name: compliance_review_verdict; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.compliance_review_verdict AS ENUM (
    'ok',
    'uncertain',
    'incorrect'
);


--
-- Name: compliance_rule_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.compliance_rule_status AS ENUM (
    'extracted',
    'critiqued',
    'disagreed',
    'approved',
    'rejected'
);


--
-- Name: compliance_source_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.compliance_source_type AS ENUM (
    'pdf_upload',
    'url',
    'manual'
);


--
-- Name: connected_account_provider; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.connected_account_provider AS ENUM (
    'google',
    'microsoft',
    'apple'
);


--
-- Name: connected_account_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.connected_account_status AS ENUM (
    'active',
    'expired',
    'revoked'
);


--
-- Name: functional_class; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.functional_class AS ENUM (
    'circulation',
    'habitable',
    'service',
    'sanitary',
    'storage',
    'mechanical_plant',
    'it_infrastructure',
    'electrical',
    'power_backup',
    'building_services',
    'vertical_transport',
    'external_area',
    'external_logistics'
);


--
-- Name: intake_item_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.intake_item_status AS ENUM (
    'pending',
    'processing',
    'ready',
    'confirmed',
    'ignored',
    'failed'
);


--
-- Name: intake_source_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.intake_source_type AS ENUM (
    'upload',
    'forwarded_email',
    'calendar_event',
    'cloud_file'
);


--
-- Name: org_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.org_type AS ENUM (
    'personal',
    'business',
    'contractor'
);


--
-- Name: ownership_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ownership_type AS ENUM (
    'owned',
    'leased',
    'rented',
    'managed',
    'other'
);


--
-- Name: plan_file_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.plan_file_status AS ENUM (
    'uploaded',
    'converting',
    'extracting',
    'ready_for_review',
    'partially_reviewed',
    'imported',
    'failed'
);


--
-- Name: plan_page_processing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.plan_page_processing_status AS ENUM (
    'queued',
    'converted',
    'extracted',
    'failed'
);


--
-- Name: plan_run_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.plan_run_status AS ENUM (
    'queued',
    'running',
    'completed',
    'failed'
);


--
-- Name: signal_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.signal_severity AS ENUM (
    'info',
    'warning',
    'urgent',
    'critical'
);


--
-- Name: site_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.site_type AS ENUM (
    'residential',
    'commercial',
    'mixed_use',
    'industrial',
    'land',
    'other'
);


--
-- Name: _audit_day_label(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._audit_day_label(p_ts timestamp with time zone) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE
    WHEN p_ts IS NULL THEN 'none'
    ELSE trim(to_char(p_ts AT TIME ZONE 'UTC', 'FMDD Month'))
  END;
$$;


--
-- Name: accept_invitation(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_invitation(p_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_invitation invitations%ROWTYPE;
  v_user_id uuid;
  v_member_id uuid;
  v_property_id uuid;
  v_role text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT * INTO v_invitation
  FROM invitations
  WHERE token = p_token
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invitation_not_found');
  END IF;

  IF v_invitation.expires_at < now() THEN
    UPDATE invitations SET status = 'expired'
    WHERE id = v_invitation.id;
    RETURN jsonb_build_object('error', 'invitation_expired');
  END IF;

  IF lower((SELECT email FROM auth.users WHERE id = v_user_id)) != lower(v_invitation.email) THEN
    RETURN jsonb_build_object('error', 'email_mismatch');
  END IF;

  v_role := lower(COALESCE(v_invitation.role, 'staff'));
  IF v_role = 'member' THEN
    v_role := 'staff';
  END IF;

  IF EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = v_invitation.org_id
      AND user_id = v_user_id
  ) THEN
    UPDATE invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = v_invitation.id;

    UPDATE auth.users
    SET
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('org_id', v_invitation.org_id::text),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'invited', true,
          'onboarding_completed', true,
          'invitation_password_confirmed', true
        )
    WHERE id = v_user_id;

    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'seed_staff_training_tasks'
    ) THEN
      PERFORM seed_staff_training_tasks(
        v_invitation.org_id,
        v_user_id,
        CASE WHEN v_invitation.property_ids IS NOT NULL AND array_length(v_invitation.property_ids, 1) > 0
          THEN v_invitation.property_ids[1] ELSE NULL END
      );
    END IF;
    RETURN jsonb_build_object('org_id', v_invitation.org_id, 'already_member', true);
  END IF;

  INSERT INTO organisation_members (org_id, user_id, role, assigned_properties, is_primary_owner)
  VALUES (
    v_invitation.org_id,
    v_user_id,
    v_role,
    v_invitation.property_ids,
    false
  )
  RETURNING id INTO v_member_id;

  UPDATE invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invitation.id;

  UPDATE auth.users
  SET
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('org_id', v_invitation.org_id::text),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'invited', true,
        'onboarding_completed', true,
        'invitation_password_confirmed', true
      )
  WHERE id = v_user_id;

  v_property_id := CASE
    WHEN v_invitation.property_ids IS NOT NULL AND array_length(v_invitation.property_ids, 1) > 0
    THEN v_invitation.property_ids[1]
    ELSE NULL
  END;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'seed_staff_training_tasks'
  ) THEN
    PERFORM seed_staff_training_tasks(v_invitation.org_id, v_user_id, v_property_id);
  END IF;

  RETURN jsonb_build_object(
    'org_id', v_invitation.org_id,
    'member_id', v_member_id,
    'role', v_role,
    'property_ids', v_invitation.property_ids
  );
END;
$$;


--
-- Name: accept_starter_templates_disclaimer(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_starter_templates_disclaimer(p_org_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not an organisation member';
  END IF;

  UPDATE organisations
  SET starter_templates_disclaimer_accepted_at = now(),
      updated_at = now()
  WHERE id = p_org_id;
END;
$$;


--
-- Name: admin_billing_utilization_snapshot(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_billing_utilization_snapshot() RETURNS TABLE(org_id uuid, org_name text, plan_id text, plan_name text, billing_state text, property_count integer, active_properties_limit integer, property_utilization numeric, coordinating_count integer, coordinating_seats_limit integer, seat_utilization numeric, staff_headcount integer, staff_active_monthly_allowance integer, storage_used_bytes bigint, evidence_bytes_allowance bigint, evidence_utilization numeric, ai_ops_used integer, ai_ops_allowance integer, ai_utilization numeric, messaging_units_used integer, premium_messaging_allowance integer, seat_addon integer, storage_addon_bytes bigint, ai_addon_ops integer, messaging_addon_units integer, ai_cost_usd_period numeric)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION admin_billing_utilization_snapshot(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.admin_billing_utilization_snapshot() IS 'Phase 7: platform-admin utilization export for packaging / contribution-margin analysis.';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: knowledge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope text NOT NULL,
    status text DEFAULT 'candidate'::text NOT NULL,
    org_id uuid,
    title text NOT NULL,
    summary text,
    body text,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_kind text NOT NULL,
    trust_score numeric,
    provenance jsonb DEFAULT '{}'::jsonb NOT NULL,
    cohort_size integer,
    version integer DEFAULT 1 NOT NULL,
    supersedes_id uuid,
    created_by uuid,
    reviewed_by uuid,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_scope_check CHECK ((scope = ANY (ARRAY['platform'::text, 'organisation'::text]))),
    CONSTRAINT knowledge_scope_org_ck CHECK ((((scope = 'platform'::text) AND (org_id IS NULL)) OR ((scope = 'organisation'::text) AND (org_id IS NOT NULL)))),
    CONSTRAINT knowledge_source_kind_check CHECK ((source_kind = ANY (ARRAY['filla_curated'::text, 'org_upload'::text, 'operational_discovery'::text, 'community_brain'::text]))),
    CONSTRAINT knowledge_status_check CHECK ((status = ANY (ARRAY['candidate'::text, 'verified'::text, 'published'::text, 'stale'::text, 'archived'::text])))
);


--
-- Name: admin_get_knowledge(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_get_knowledge(p_knowledge_id uuid) RETURNS SETOF public.knowledge
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN;
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'knowledge',
    p_knowledge_id,
    'admin.knowledge.viewed',
    '{}'::jsonb
  );

  RETURN QUERY
  SELECT k.* FROM public.knowledge k WHERE k.id = p_knowledge_id;
END;
$$;


--
-- Name: admin_knowledge_metrics_snapshot(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_knowledge_metrics_snapshot() RETURNS TABLE(org_id uuid, org_name text, knowledge_created bigint, knowledge_verified bigint, knowledge_published bigint, knowledge_reused bigint, questions_answered bigint, automation_created bigint, time_saved_minutes numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
    'admin.knowledge.metrics_viewed',
    jsonb_build_object('timestamp', now())
  );

  RETURN QUERY
  WITH org_base AS (
    SELECT o.id, o.name
    FROM organisations o
    WHERE o.id <> '00000000-0000-0000-0000-000000000000'::uuid
  ),
  created AS (
    SELECT k.org_id, COUNT(*)::BIGINT AS n
    FROM knowledge k
    WHERE k.scope = 'organisation' AND k.org_id IS NOT NULL
    GROUP BY k.org_id
  ),
  verified AS (
    SELECT k.org_id, COUNT(*)::BIGINT AS n
    FROM knowledge k
    WHERE k.scope = 'organisation'
      AND k.org_id IS NOT NULL
      AND k.status IN ('verified', 'published')
    GROUP BY k.org_id
  ),
  published AS (
    SELECT k.org_id, COUNT(*)::BIGINT AS n
    FROM knowledge k
    WHERE k.scope = 'organisation'
      AND k.org_id IS NOT NULL
      AND k.status = 'published'
    GROUP BY k.org_id
  ),
  usage AS (
    SELECT
      u.org_id,
      COUNT(*) FILTER (WHERE u.event_type = 'reused')::BIGINT AS reused,
      COUNT(*) FILTER (WHERE u.event_type = 'question_answered')::BIGINT AS answered,
      COUNT(*) FILTER (WHERE u.event_type = 'automation_created')::BIGINT AS automation,
      COALESCE(SUM(u.estimated_minutes) FILTER (WHERE u.event_type = 'time_saved'), 0)::NUMERIC AS minutes
    FROM knowledge_usage_events u
    WHERE u.org_id IS NOT NULL
    GROUP BY u.org_id
  )
  SELECT
    ob.id AS org_id,
    ob.name AS org_name,
    COALESCE(c.n, 0) AS knowledge_created,
    COALESCE(v.n, 0) AS knowledge_verified,
    COALESCE(p.n, 0) AS knowledge_published,
    COALESCE(us.reused, 0) AS knowledge_reused,
    COALESCE(us.answered, 0) AS questions_answered,
    COALESCE(us.automation, 0) AS automation_created,
    COALESCE(us.minutes, 0) AS time_saved_minutes
  FROM org_base ob
  LEFT JOIN created c ON c.org_id = ob.id
  LEFT JOIN verified v ON v.org_id = ob.id
  LEFT JOIN published p ON p.org_id = ob.id
  LEFT JOIN usage us ON us.org_id = ob.id
  WHERE COALESCE(c.n, 0) > 0
     OR COALESCE(v.n, 0) > 0
     OR COALESCE(us.reused, 0) > 0
     OR COALESCE(us.answered, 0) > 0
     OR COALESCE(us.automation, 0) > 0
  ORDER BY COALESCE(us.minutes, 0) DESC, COALESCE(c.n, 0) DESC, ob.name;

  -- Platform-scope summary as a synthetic row (org_id = sentinel)
  RETURN QUERY
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS org_id,
    '_platform'::TEXT AS org_name,
    (SELECT COUNT(*)::BIGINT FROM knowledge k WHERE k.scope = 'platform') AS knowledge_created,
    (SELECT COUNT(*)::BIGINT FROM knowledge k WHERE k.scope = 'platform' AND k.status IN ('verified', 'published')) AS knowledge_verified,
    (SELECT COUNT(*)::BIGINT FROM knowledge k WHERE k.scope = 'platform' AND k.status = 'published') AS knowledge_published,
    (SELECT COUNT(*)::BIGINT FROM knowledge_usage_events u WHERE u.org_id IS NULL AND u.event_type = 'reused') AS knowledge_reused,
    (SELECT COUNT(*)::BIGINT FROM knowledge_usage_events u WHERE u.org_id IS NULL AND u.event_type = 'question_answered') AS questions_answered,
    (SELECT COUNT(*)::BIGINT FROM knowledge_usage_events u WHERE u.org_id IS NULL AND u.event_type = 'automation_created') AS automation_created,
    (SELECT COALESCE(SUM(u.estimated_minutes), 0)::NUMERIC FROM knowledge_usage_events u WHERE u.org_id IS NULL AND u.event_type = 'time_saved') AS time_saved_minutes;
END;
$$;


--
-- Name: admin_list_knowledge_review_queue(text[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_list_knowledge_review_queue(p_statuses text[] DEFAULT ARRAY['candidate'::text, 'verified'::text], p_scope text DEFAULT NULL::text) RETURNS SETOF public.knowledge
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
    'admin.knowledge.queue_listed',
    jsonb_build_object('statuses', to_jsonb(p_statuses), 'scope', p_scope)
  );

  RETURN QUERY
  SELECT k.*
  FROM public.knowledge k
  WHERE k.status = ANY (p_statuses)
    AND (p_scope IS NULL OR k.scope = p_scope)
  ORDER BY
    CASE k.scope WHEN 'platform' THEN 0 ELSE 1 END,
    k.updated_at DESC
  LIMIT 200;
END;
$$;


--
-- Name: admin_set_knowledge_status(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_knowledge_status(p_knowledge_id uuid, p_status text) RETURNS public.knowledge
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row public.knowledge;
  v_min INT := public.brain_min_cohort();
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  IF p_status NOT IN ('candidate', 'verified', 'published', 'stale', 'archived') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT * INTO v_row FROM public.knowledge WHERE id = p_knowledge_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'knowledge_not_found';
  END IF;

  IF p_status = 'published'
     AND v_row.source_kind = 'community_brain'
     AND (v_row.cohort_size IS NULL OR v_row.cohort_size < v_min) THEN
    RAISE EXCEPTION 'cohort_below_minimum';
  END IF;

  UPDATE public.knowledge
  SET
    status = p_status,
    reviewed_by = auth.uid(),
    published_at = CASE WHEN p_status = 'published' THEN COALESCE(published_at, now()) ELSE published_at END,
    updated_at = now()
  WHERE id = p_knowledge_id
  RETURNING * INTO v_row;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    COALESCE(v_row.org_id, '00000000-0000-0000-0000-000000000000'::uuid),
    auth.uid(),
    'knowledge',
    v_row.id,
    'admin.knowledge.status_set',
    jsonb_build_object('status', p_status)
  );

  INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
  VALUES (
    v_row.id,
    v_row.org_id,
    CASE
      WHEN p_status = 'published' THEN 'publish'
      WHEN p_status = 'archived' THEN 'archive'
      WHEN p_status = 'stale' THEN 'stale'
      WHEN p_status = 'verified' THEN 'human_approve'
      WHEN p_status = 'candidate' THEN 'human_edit'
      ELSE 'human_reject'
    END,
    auth.uid(),
    jsonb_build_object('status', p_status, 'via', 'admin')
  );

  RETURN v_row;
END;
$$;


--
-- Name: admin_upsert_platform_knowledge(text, text, text, text, jsonb, jsonb, integer, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_upsert_platform_knowledge(p_title text, p_summary text DEFAULT NULL::text, p_body text DEFAULT NULL::text, p_source_kind text DEFAULT 'filla_curated'::text, p_content jsonb DEFAULT '{}'::jsonb, p_provenance jsonb DEFAULT '{}'::jsonb, p_cohort_size integer DEFAULT NULL::integer, p_id uuid DEFAULT NULL::uuid, p_status text DEFAULT 'candidate'::text) RETURNS public.knowledge
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row public.knowledge;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  IF p_source_kind NOT IN ('filla_curated', 'community_brain') THEN
    RAISE EXCEPTION 'invalid_platform_source_kind';
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE public.knowledge
    SET
      title = p_title,
      summary = p_summary,
      body = p_body,
      content = COALESCE(p_content, content),
      provenance = COALESCE(p_provenance, provenance),
      cohort_size = COALESCE(p_cohort_size, cohort_size),
      source_kind = p_source_kind,
      updated_at = now()
    WHERE id = p_id AND scope = 'platform'
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
      RAISE EXCEPTION 'knowledge_not_found';
    END IF;
  ELSE
    INSERT INTO public.knowledge (
      scope, status, org_id, title, summary, body, content, source_kind,
      provenance, cohort_size, created_by
    ) VALUES (
      'platform', COALESCE(p_status, 'candidate'), NULL, p_title, p_summary, p_body,
      COALESCE(p_content, '{}'::jsonb), p_source_kind,
      COALESCE(p_provenance, '{}'::jsonb), p_cohort_size, auth.uid()
    )
    RETURNING * INTO v_row;

    INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
    VALUES (v_row.id, NULL, 'candidate_created', auth.uid(), jsonb_build_object('source_kind', p_source_kind));
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'knowledge',
    v_row.id,
    'admin.knowledge.upserted',
    jsonb_build_object('title', p_title)
  );

  RETURN v_row;
END;
$$;


--
-- Name: icon_library; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.icon_library (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    category text,
    description text,
    svg_path text,
    stroke_width integer DEFAULT 2,
    aliases text[] DEFAULT '{}'::text[],
    search_vector tsvector
);


--
-- Name: ai_icon_search(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ai_icon_search(query_text text DEFAULT ''::text) RETURNS SETOF public.icon_library
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  v_query TEXT;
  v_first_word TEXT;
  v_expansion TEXT;
  v_tsq TSQUERY;
BEGIN
  IF query_text IS NULL OR trim(query_text) = '' THEN
    RETURN QUERY SELECT * FROM icon_library ORDER BY name ASC LIMIT 5;
    RETURN;
  END IF;

  v_query := trim(lower(query_text));
  v_first_word := split_part(v_query, ' ', 1);

  RETURN QUERY
  SELECT *
  FROM icon_library
  WHERE search_vector @@ plainto_tsquery('english', v_query)
  ORDER BY ts_rank(search_vector, plainto_tsquery('english', v_query)) DESC, name ASC
  LIMIT 5;

  IF FOUND THEN
    RETURN;
  END IF;

  v_expansion := (
    SELECT array_to_string(expansion, ' ')
    FROM icon_search_synonyms
    WHERE word = v_first_word
    LIMIT 1
  );

  IF v_expansion IS NOT NULL AND v_expansion != '' THEN
    v_tsq := websearch_to_tsquery('english', replace(v_expansion, ' ', ' or '));
    RETURN QUERY
    SELECT *
    FROM icon_library
    WHERE search_vector @@ v_tsq
    ORDER BY ts_rank(search_vector, v_tsq) DESC, name ASC
    LIMIT 5;
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  IF v_first_word != '' AND (position(' ' in v_query) > 0 OR v_expansion IS NULL) THEN
    RETURN QUERY
    SELECT *
    FROM icon_library
    WHERE search_vector @@ plainto_tsquery('english', v_first_word)
    ORDER BY ts_rank(search_vector, plainto_tsquery('english', v_first_word)) DESC, name ASC
    LIMIT 5;
  END IF;
END;
$$;


--
-- Name: FUNCTION ai_icon_search(query_text text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.ai_icon_search(query_text text) IS 'AI icon lookup: 5 results, lateral synonym fallback.';


--
-- Name: ai_ops_cost_units(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ai_ops_cost_units(p_function_name text) RETURNS integer
    LANGUAGE sql IMMUTABLE
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


--
-- Name: annotate_property_image(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.annotate_property_image(p_property_id uuid, p_annotated_storage_path text, p_annotated_thumbnail_path text, p_annotation_summary text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_next_version INTEGER;
  v_new_version_id UUID;
  v_current_version_id UUID;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: User must be authenticated';
  END IF;
  
  -- Get property org_id
  SELECT org_id INTO v_org_id
  FROM properties
  WHERE id = p_property_id;
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Property not found: %', p_property_id;
  END IF;
  
  -- Check user is member of org
  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = v_org_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access Denied: User is not a member of this organisation';
  END IF;
  
  -- Get current active version
  SELECT id INTO v_current_version_id
  FROM property_image_versions
  WHERE property_id = p_property_id
    AND is_archived = false
  ORDER BY version_number DESC
  LIMIT 1;
  
  IF v_current_version_id IS NULL THEN
    RAISE EXCEPTION 'No active image version found for property';
  END IF;
  
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
  FROM property_image_versions
  WHERE property_id = p_property_id;
  
  -- Create new annotated version (don't archive current, keep both)
  INSERT INTO property_image_versions (
    property_id,
    version_number,
    storage_path,
    thumbnail_path,
    annotation_summary,
    is_original,
    is_archived,
    created_by
  ) VALUES (
    p_property_id,
    v_next_version,
    p_annotated_storage_path,
    p_annotated_thumbnail_path,
    p_annotation_summary,
    false,
    false,
    v_user_id
  )
  RETURNING id INTO v_new_version_id;
  
  -- Update property thumbnail_url to annotated version
  UPDATE properties
  SET thumbnail_url = p_annotated_thumbnail_path
  WHERE id = p_property_id;
  
  -- Log the action
  INSERT INTO property_image_actions (
    property_id,
    image_version_id,
    action_type,
    user_id,
    metadata
  ) VALUES (
    p_property_id,
    v_new_version_id,
    'annotate',
    v_user_id,
    jsonb_build_object(
      'version_number', v_next_version,
      'storage_path', p_annotated_storage_path,
      'thumbnail_path', p_annotated_thumbnail_path,
      'annotation_summary', p_annotation_summary,
      'based_on_version_id', v_current_version_id
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'version_id', v_new_version_id,
    'version_number', v_next_version
  );
END;
$$;


--
-- Name: annotate_property_image(uuid, text, text, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.annotate_property_image(p_property_id uuid, p_annotated_storage_path text, p_annotated_thumbnail_path text, p_annotation_summary text DEFAULT NULL::text, p_annotation_json jsonb DEFAULT NULL::jsonb, p_original_file_url text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_next_version INTEGER;
  v_new_version_id UUID;
  v_current_version_id UUID;
  v_current_storage_path TEXT;
  v_is_first_annotation BOOLEAN;
  v_original_url TEXT;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: User must be authenticated';
  END IF;
  
  -- Get property org_id
  SELECT org_id INTO v_org_id
  FROM properties
  WHERE id = p_property_id;
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Property not found: %', p_property_id;
  END IF;
  
  -- Check user is member of org
  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = v_org_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access Denied: User is not a member of this organisation';
  END IF;
  
  -- Get current active version
  SELECT id, storage_path INTO v_current_version_id, v_current_storage_path
  FROM property_image_versions
  WHERE property_id = p_property_id
    AND is_archived = false
  ORDER BY version_number DESC
  LIMIT 1;
  
  IF v_current_version_id IS NULL THEN
    RAISE EXCEPTION 'No active image version found for property';
  END IF;
  
  -- Check if this is the first annotation (no metadata.annotation_json exists)
  SELECT (metadata->>'annotation_json') IS NULL INTO v_is_first_annotation
  FROM property_image_versions
  WHERE id = v_current_version_id;
  
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
  FROM property_image_versions
  WHERE property_id = p_property_id;
  
  -- Determine original_file_url: use provided value, or current storage_path if first annotation
  IF p_original_file_url IS NOT NULL THEN
    v_original_url := p_original_file_url;
  ELSIF v_is_first_annotation THEN
    v_original_url := v_current_storage_path;
  ELSE
    -- Get original from current version
    SELECT original_file_url INTO v_original_url
    FROM property_image_versions
    WHERE id = v_current_version_id;
  END IF;
  
  -- Archive current version
  UPDATE property_image_versions
  SET is_archived = true
  WHERE id = v_current_version_id;
  
  -- Create new annotated version
  INSERT INTO property_image_versions (
    property_id,
    version_number,
    storage_path,
    thumbnail_path,
    annotation_summary,
    metadata,
    original_file_url,
    is_original,
    is_archived,
    created_by
  ) VALUES (
    p_property_id,
    v_next_version,
    p_annotated_storage_path,
    p_annotated_thumbnail_path,
    p_annotation_summary,
    COALESCE(p_annotation_json, '{}'::jsonb),
    v_original_url,
    false,
    false,
    v_user_id
  )
  RETURNING id INTO v_new_version_id;
  
  -- Update property thumbnail_url to annotated version
  UPDATE properties
  SET thumbnail_url = p_annotated_thumbnail_path
  WHERE id = p_property_id;
  
  -- Log the action
  INSERT INTO property_image_actions (
    property_id,
    image_version_id,
    action_type,
    user_id,
    metadata
  ) VALUES (
    p_property_id,
    v_new_version_id,
    'annotate',
    v_user_id,
    jsonb_build_object(
      'version_number', v_next_version,
      'storage_path', p_annotated_storage_path,
      'thumbnail_path', p_annotated_thumbnail_path,
      'annotation_summary', p_annotation_summary,
      'has_annotation_json', p_annotation_json IS NOT NULL
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'version_id', v_new_version_id,
    'version_number', v_next_version
  );
END;
$$;


--
-- Name: apply_checklist_template(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_checklist_template(p_task uuid, p_template uuid, p_org uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  item jsonb;
  item_title text;
  item_yes_no boolean;
  item_requires_signature boolean;
  item_step_type text;
  item_is_sub_step boolean;
  item_is_required boolean;
  item_order integer := 0;
  legacy_count integer := 0;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.checklist_templates t
    WHERE t.id = p_template
      AND t.org_id = p_org
      AND jsonb_typeof(t.items) = 'array'
      AND jsonb_array_length(t.items) > 0
  ) THEN
    FOR item IN
      SELECT value
      FROM public.checklist_templates t,
           LATERAL jsonb_array_elements(t.items) AS value
      WHERE t.id = p_template
        AND t.org_id = p_org
    LOOP
      item_title := NULLIF(TRIM(COALESCE(item->>'title', item->>'label', '')), '');
      IF item_title IS NULL THEN
        CONTINUE;
      END IF;

      item_step_type := COALESCE(NULLIF(item->>'step_type', ''), 'check');
      IF item_step_type = 'sub_step' THEN
        item_step_type := 'check';
      END IF;

      item_yes_no := COALESCE((item->>'is_yes_no')::boolean, false);
      item_requires_signature := COALESCE((item->>'requires_signature')::boolean, false);
      IF item_step_type = 'yes_no' THEN
        item_yes_no := true;
        item_requires_signature := false;
      ELSIF item_step_type = 'signature' THEN
        item_yes_no := false;
        item_requires_signature := true;
      END IF;

      item_is_sub_step := COALESCE((item->>'is_sub_step')::boolean, false);
      item_is_required := COALESCE((item->>'is_required')::boolean, false);

      INSERT INTO public.subtasks (
        task_id,
        org_id,
        title,
        is_completed,
        completed,
        is_yes_no,
        requires_signature,
        step_type,
        is_sub_step,
        is_required,
        order_index,
        template_id,
        is_archived
      ) VALUES (
        p_task,
        p_org,
        item_title,
        FALSE,
        FALSE,
        item_yes_no,
        item_requires_signature,
        item_step_type,
        item_is_sub_step,
        item_is_required,
        item_order,
        p_template,
        FALSE
      );

      item_order := item_order + 1;
    END LOOP;

    RETURN;
  END IF;

  SELECT COUNT(*) INTO legacy_count
  FROM public.checklist_template_items
  WHERE template_id = p_template;

  IF legacy_count = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.subtasks (
    task_id,
    org_id,
    title,
    is_completed,
    completed,
    is_yes_no,
    requires_signature,
    step_type,
    is_sub_step,
    is_required,
    order_index,
    template_id,
    is_archived
  )
  SELECT
    p_task,
    p_org,
    i.title,
    FALSE,
    FALSE,
    COALESCE(i.is_yes_no, false),
    COALESCE(i.requires_signature, false),
    CASE
      WHEN COALESCE(i.requires_signature, false) THEN 'signature'
      WHEN COALESCE(i.is_yes_no, false) THEN 'yes_no'
      ELSE 'check'
    END,
    false,
    false,
    COALESCE(i.order_index, 0),
    p_template,
    FALSE
  FROM public.checklist_template_items i
  WHERE i.template_id = p_template
  ORDER BY i.order_index ASC;
END;
$$;


--
-- Name: apply_knowledge_critic_result(uuid, numeric, text, text, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_knowledge_critic_result(p_knowledge_id uuid, p_trust_score numeric, p_critic_notes text DEFAULT NULL::text, p_critic_model text DEFAULT NULL::text, p_critic_provider text DEFAULT NULL::text, p_mark_verified boolean DEFAULT false) RETURNS public.knowledge
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row public.knowledge;
BEGIN
  UPDATE public.knowledge
  SET
    trust_score = p_trust_score,
    provenance = provenance || jsonb_build_object(
      'critic_model', p_critic_model,
      'critic_provider', p_critic_provider,
      'critic_notes', p_critic_notes,
      'critic_at', now()
    ),
    status = CASE
      WHEN p_mark_verified AND status = 'candidate' THEN 'verified'
      ELSE status
    END,
    updated_at = now()
  WHERE id = p_knowledge_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'knowledge_not_found';
  END IF;

  INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
  VALUES (
    v_row.id,
    v_row.org_id,
    'critic',
    NULL,
    jsonb_build_object(
      'trust_score', p_trust_score,
      'notes', p_critic_notes,
      'model', p_critic_model,
      'provider', p_critic_provider,
      'mark_verified', p_mark_verified
    )
  );

  RETURN v_row;
END;
$$;


--
-- Name: apply_template_to_task(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_template_to_task(task uuid, template uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    item RECORD;
BEGIN
    FOR item IN SELECT * FROM public.checklist_template_items WHERE template_id = template ORDER BY order_index LOOP
        INSERT INTO public.subtasks (id, org_id, task_id, title, is_yes_no, order_index, template_id)
        VALUES (
            gen_random_uuid(),
            current_org_id(),
            task,
            item.title,
            item.is_yes_no,
            item.order_index,
            template
        );
    END LOOP;
END;
$$;


--
-- Name: archive_property_image_version(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.archive_property_image_version(p_property_id uuid, p_version_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_version_record RECORD;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: User must be authenticated';
  END IF;
  
  -- Get property org_id
  SELECT org_id INTO v_org_id
  FROM properties
  WHERE id = p_property_id;
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Property not found: %', p_property_id;
  END IF;
  
  -- Check user is member of org
  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = v_org_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access Denied: User is not a member of this organisation';
  END IF;
  
  -- Get version record
  SELECT * INTO v_version_record
  FROM property_image_versions
  WHERE id = p_version_id AND property_id = p_property_id;
  
  IF v_version_record IS NULL THEN
    RAISE EXCEPTION 'Image version not found';
  END IF;
  
  -- Archive the version
  UPDATE property_image_versions
  SET is_archived = true
  WHERE id = p_version_id;
  
  -- Log the action
  INSERT INTO property_image_actions (
    property_id,
    image_version_id,
    action_type,
    user_id,
    metadata
  ) VALUES (
    p_property_id,
    p_version_id,
    'archive',
    v_user_id,
    jsonb_build_object(
      'previous_version_number', v_version_record.version_number,
      'storage_path', v_version_record.storage_path
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'version_id', p_version_id
  );
END;
$$;


--
-- Name: archive_task(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.archive_task(p_task_id uuid, p_org uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    UPDATE public.tasks
    SET status = 'archived',
        updated_at = NOW()
    WHERE id = p_task_id AND org_id = p_org;
END;
$$;


--
-- Name: assert_ai_ops_allowed(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_ai_ops_allowed(p_org_id uuid, p_function_name text, p_cost_units integer DEFAULT NULL::integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: assert_evidence_upload_allowed(uuid, bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_evidence_upload_allowed(p_org_id uuid, p_file_size bigint, p_mime_type text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: assert_premium_messaging_allowed(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_premium_messaging_allowed(p_org_id uuid, p_units integer DEFAULT 1) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: assigned_properties(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assigned_properties() RETURNS uuid[]
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  props JSONB;
BEGIN
  props := auth.jwt() -> 'assigned_properties';
  IF props IS NULL THEN
    RETURN ARRAY[]::UUID[];
  END IF;
  RETURN (
    SELECT ARRAY(
      SELECT jsonb_array_elements_text(props)::UUID
    )
  );
END;
$$;


--
-- Name: brain_infer_asset(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.brain_infer_asset(p_vector jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'filla_brain'
    AS $$
DECLARE
  v_result JSONB;
  v_sample BIGINT;
  v_min INT := public.brain_min_cohort();
BEGIN
  SELECT
    COALESCE(SUM(bap.sample_count), 0),
    jsonb_build_object(
      'failure_probability', COALESCE(AVG(bap.failure_probability), 0.1),
      'mean_time_to_failure_days', COALESCE((AVG(bap.mean_time_to_failure_days))::INT, 365),
      'hazard_correlation', COALESCE(MAX(bap.hazard_correlation), '{}'),
      'sample_count', COALESCE(SUM(bap.sample_count), 0)
    )
  INTO v_sample, v_result
  FROM filla_brain.brain_asset_patterns bap
  WHERE bap.asset_vector @> p_vector OR p_vector @> bap.asset_vector;

  IF v_sample IS NULL OR v_sample < v_min THEN
    RETURN jsonb_build_object(
      'failure_probability', 0.1,
      'mean_time_to_failure_days', 365,
      'sample_count', COALESCE(v_sample, 0),
      'cohort_gated', true
    );
  END IF;

  RETURN v_result || jsonb_build_object('cohort_gated', false);
END;
$$;


--
-- Name: brain_infer_compliance(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.brain_infer_compliance(p_document_type text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'filla_brain'
    AS $$
DECLARE
  v_result JSONB;
  v_sample INT;
  v_min INT := public.brain_min_cohort();
BEGIN
  SELECT
    bcp.sample_count,
    jsonb_build_object(
      'recommended_frequency', bcp.recommended_frequency,
      'risk_level', bcp.risk_level,
      'probability_of_incident', COALESCE(bcp.probability_of_incident, 0.05),
      'sample_count', bcp.sample_count
    )
  INTO v_sample, v_result
  FROM filla_brain.brain_compliance_patterns bcp
  WHERE bcp.document_type = p_document_type
  ORDER BY bcp.sample_count DESC
  LIMIT 1;

  IF v_sample IS NULL OR v_sample < v_min THEN
    RETURN jsonb_build_object(
      'risk_level', 'low',
      'sample_count', COALESCE(v_sample, 0),
      'cohort_gated', true
    );
  END IF;

  RETURN v_result || jsonb_build_object('cohort_gated', false);
END;
$$;


--
-- Name: brain_min_cohort(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.brain_min_cohort() RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT 5;
$$;


--
-- Name: FUNCTION brain_min_cohort(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.brain_min_cohort() IS 'Minimum sample_count before anonymised Brain / Community Knowledge stats may surface. Enforced in SQL, never by LLM.';


--
-- Name: can_access_task(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_task(task_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
    org uuid;
    token text;
BEGIN
    -- Get org_id from JWT
    org := public.current_org_id();

    -- Get contractor token if present
    token := nullif(
      (current_setting('request.jwt.claims', true)::jsonb ->> 'contractor_token'),
      ''
    );

    RETURN EXISTS (
        -----------------------------------------------------------------
        -- ORG ACCESS PATH
        -----------------------------------------------------------------
        SELECT 1
        FROM public.tasks t
        JOIN public.properties p ON p.id = t.property_id
        WHERE t.id = task_id
          AND p.org_id = org

        UNION

        -----------------------------------------------------------------
        -- CONTRACTOR ACCESS PATH
        -----------------------------------------------------------------
        SELECT 1
        FROM public.contractor_task_access c
        WHERE c.task_id = task_id
          AND c.contractor_token = token
    );
END;
$$;


--
-- Name: check_duplicate_org_name(text, uuid, public.org_type); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_duplicate_org_name(p_org_name text, p_user_id uuid, p_org_type public.org_type DEFAULT NULL::public.org_type) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count INTEGER;
  v_personal_count INTEGER;
BEGIN
  IF p_org_type = 'personal' THEN
    SELECT COUNT(*) INTO v_personal_count
    FROM organisations
    WHERE created_by = p_user_id
      AND org_type = 'personal';

    IF v_personal_count > 0 THEN
      RETURN TRUE;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM organisations
  WHERE created_by = p_user_id
    AND LOWER(TRIM(name)) = LOWER(TRIM(p_org_name))
    AND (p_org_type IS NULL OR org_type = p_org_type);

  RETURN v_count > 0;
END;
$$;


--
-- Name: check_duplicate_property_address(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_duplicate_property_address(p_org_id uuid, p_address text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM properties
  WHERE org_id = p_org_id
    AND LOWER(TRIM(address)) = LOWER(TRIM(p_address));

  RETURN v_count > 0;
END;
$$;


--
-- Name: clear_onboarding_demo_for_property(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clear_onboarding_demo_for_property(p_property_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_org_id UUID;
  v_rules_has_property_id boolean;
  v_rules_has_description boolean;
BEGIN
  SET LOCAL row_security = off;

  SELECT org_id INTO v_org_id FROM properties WHERE id = p_property_id;
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_rules' AND column_name = 'property_id'
  ) INTO v_rules_has_property_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_rules' AND column_name = 'description'
  ) INTO v_rules_has_description;

  DELETE FROM tasks
  WHERE property_id = p_property_id
    AND description LIKE '%[onboarding_demo]%';

  DELETE FROM assets
  WHERE property_id = p_property_id
    AND (
      name LIKE 'Sample:%'
      OR COALESCE(notes, '') LIKE '%[onboarding_demo]%'
      OR COALESCE(metadata::text, '') LIKE '%onboarding_demo%'
    );

  DELETE FROM compliance_documents
  WHERE property_id = p_property_id
    AND COALESCE(notes, '') LIKE '%[onboarding_demo]%';

  IF v_rules_has_description THEN
    IF v_rules_has_property_id THEN
      DELETE FROM compliance_rules
      WHERE property_id = p_property_id
        AND COALESCE(description, '') LIKE '%[onboarding_demo]%';
    ELSE
      DELETE FROM compliance_rules
      WHERE org_id = v_org_id
        AND COALESCE(description, '') LIKE '%[onboarding_demo]%';
    END IF;
  END IF;

  DELETE FROM compliance_recommendations cr
  USING compliance_documents cd
  WHERE cr.compliance_document_id = cd.id
    AND cd.property_id = p_property_id
    AND COALESCE(cr.recommended_action, '') LIKE '%[onboarding_demo]%';

  DELETE FROM attachments
  WHERE parent_type = 'property'
    AND parent_id = p_property_id
    AND COALESCE(notes, '') LIKE '%[onboarding_demo]%';

  DELETE FROM checklist_templates
  WHERE org_id = v_org_id
    AND name LIKE 'Sample:%';
END;
$$;


--
-- Name: compliance_event_daily_expiry_check(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compliance_event_daily_expiry_check() RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    INSERT INTO public.compliance_events(org_id, property_id, task_id, rule_id, event_type, title, severity, due_at)
    SELECT
        t.org_id,
        t.property_id,
        t.id,
        NULL,
        'expired',
        t.title,
        'critical',
        t.due_at
    FROM public.tasks t
    WHERE t.is_compliance = TRUE
    AND t.status <> 'completed'
    AND t.due_at < NOW()
    AND NOT EXISTS (
        SELECT 1 FROM public.compliance_events ce
        WHERE ce.task_id = t.id AND ce.event_type = 'expired'
    );
END;
$$;


--
-- Name: compliance_event_on_task_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compliance_event_on_task_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    IF NEW.is_compliance = TRUE THEN
        INSERT INTO public.compliance_events(org_id, property_id, task_id, event_type, title, severity, due_at)
        VALUES (
            NEW.org_id,
            NEW.property_id,
            NEW.id,
            'created',
            COALESCE(NEW.title, 'Compliance Task'),
            'info',
            NEW.due_at
        );
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: compliance_event_on_task_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compliance_event_on_task_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    IF NEW.is_compliance = TRUE AND NEW.due_at IS DISTINCT FROM OLD.due_at THEN
        INSERT INTO public.compliance_events(org_id, property_id, task_id, event_type, title, severity, due_at)
        VALUES (
            NEW.org_id,
            NEW.property_id,
            NEW.id,
            'updated',
            COALESCE(NEW.title, 'Compliance Task Updated'),
            'info',
            NEW.due_at
        );
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: create_attachment_record(uuid, text, text, uuid, text, text, bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_attachment_record(p_org_id uuid, p_file_url text, p_parent_type text, p_parent_id uuid, p_file_name text DEFAULT NULL::text, p_file_type text DEFAULT NULL::text, p_file_size bigint DEFAULT NULL::bigint, p_thumbnail_url text DEFAULT NULL::text) RETURNS TABLE(id uuid, org_id uuid, file_url text, file_name text, file_type text, file_size bigint, parent_type text, parent_id uuid, thumbnail_url text, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_result RECORD;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM organisation_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of the specified organization';
  END IF;

  INSERT INTO public.attachments (
    org_id,
    file_url,
    parent_type,
    parent_id,
    file_name,
    file_type,
    file_size,
    thumbnail_url,
    upload_status
  )
  VALUES (
    p_org_id,
    p_file_url,
    p_parent_type,
    p_parent_id,
    p_file_name,
    p_file_type,
    p_file_size,
    p_thumbnail_url,
    'complete'
  )
  RETURNING * INTO v_result;

  RETURN QUERY SELECT
    v_result.id,
    v_result.org_id,
    v_result.file_url,
    v_result.file_name,
    v_result.file_type,
    v_result.file_size,
    v_result.parent_type,
    v_result.parent_id,
    v_result.thumbnail_url,
    v_result.created_at,
    v_result.updated_at;
END;
$$;


--
-- Name: create_compliance_task(uuid, uuid, uuid, text, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_compliance_task(p_org uuid, p_property uuid, p_rule uuid, p_title text, p_due timestamp with time zone, p_level text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    new_task UUID;
BEGIN
    INSERT INTO public.tasks (
        org_id,
        property_id,
        title,
        description,
        priority,
        due_at,
        is_compliance,
        compliance_level,
        metadata
    ) VALUES (
        p_org,
        p_property,
        p_title,
        CONCAT('Auto-created from compliance rule ', p_rule),
        CASE WHEN p_level = 'critical' THEN 'urgent' ELSE 'normal' END,
        p_due,
        TRUE,
        p_level,
        jsonb_build_object(
            'compliance', jsonb_build_object(
                'rule_id', p_rule,
                'auto_created', true
            )
        )
    )
    RETURNING id INTO new_task;

    INSERT INTO public.compliance_events (
        org_id,
        property_id,
        task_id,
        rule_id,
        event_type,
        details
    ) VALUES (
        p_org,
        p_property,
        new_task,
        p_rule,
        'task_created',
        jsonb_build_object('reason', 'compliance_rule_trigger')
    );

    RETURN new_task;
END;
$$;


--
-- Name: intake_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intake_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    property_id uuid,
    created_by uuid DEFAULT auth.uid() NOT NULL,
    source_type public.intake_source_type DEFAULT 'upload'::public.intake_source_type NOT NULL,
    status public.intake_item_status DEFAULT 'pending'::public.intake_item_status NOT NULL,
    storage_path text,
    file_name text,
    mime_type text,
    file_size bigint,
    ai_classification text,
    ai_extracted jsonb,
    ai_confidence numeric,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    raw_text text
);


--
-- Name: create_intake_item_from_calendar_event(uuid, uuid, text, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_intake_item_from_calendar_event(p_org_id uuid, p_created_by uuid, p_raw_text text, p_ai_extracted jsonb DEFAULT NULL::jsonb, p_id uuid DEFAULT NULL::uuid) RETURNS public.intake_items
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row intake_items;
BEGIN
  IF p_org_id IS NULL OR p_created_by IS NULL THEN
    RAISE EXCEPTION 'org_id and created_by are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = p_org_id AND user_id = p_created_by
  ) THEN
    RAISE EXCEPTION 'created_by is not a member of org';
  END IF;

  INSERT INTO intake_items (
    id,
    org_id,
    created_by,
    source_type,
    status,
    raw_text,
    ai_extracted,
    ai_classification,
    processed_at
  )
  VALUES (
    COALESCE(p_id, gen_random_uuid()),
    p_org_id,
    p_created_by,
    'calendar_event',
    'ready',
    NULLIF(left(p_raw_text, 4000), ''),
    p_ai_extracted,
    'Calendar event',
    now()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


--
-- Name: create_intake_item_from_cloud_file(uuid, uuid, text, text, text, bigint, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_intake_item_from_cloud_file(p_org_id uuid, p_created_by uuid, p_storage_path text, p_file_name text, p_mime_type text, p_file_size bigint, p_id uuid DEFAULT NULL::uuid) RETURNS public.intake_items
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row intake_items;
BEGIN
  IF p_org_id IS NULL OR p_created_by IS NULL OR p_storage_path IS NULL THEN
    RAISE EXCEPTION 'org_id, created_by, and storage_path are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = p_org_id AND user_id = p_created_by
  ) THEN
    RAISE EXCEPTION 'created_by is not a member of org';
  END IF;

  IF split_part(p_storage_path, '/', 1) <> 'orgs'
     OR split_part(p_storage_path, '/', 3) <> 'inbox'
     OR split_part(p_storage_path, '/', 2)::uuid <> p_org_id THEN
    RAISE EXCEPTION 'Invalid inbox storage path for org';
  END IF;

  INSERT INTO intake_items (
    id,
    org_id,
    created_by,
    source_type,
    status,
    storage_path,
    file_name,
    mime_type,
    file_size
  )
  VALUES (
    COALESCE(p_id, gen_random_uuid()),
    p_org_id,
    p_created_by,
    'cloud_file',
    'pending',
    p_storage_path,
    p_file_name,
    NULLIF(p_mime_type, ''),
    p_file_size
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


--
-- Name: create_intake_item_from_email(uuid, uuid, text, text, text, bigint, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_intake_item_from_email(p_org_id uuid, p_created_by uuid, p_storage_path text DEFAULT NULL::text, p_file_name text DEFAULT NULL::text, p_mime_type text DEFAULT NULL::text, p_file_size bigint DEFAULT NULL::bigint, p_raw_text text DEFAULT NULL::text, p_id uuid DEFAULT NULL::uuid) RETURNS public.intake_items
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row intake_items;
BEGIN
  IF p_org_id IS NULL OR p_created_by IS NULL THEN
    RAISE EXCEPTION 'org_id and created_by are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = p_org_id AND user_id = p_created_by
  ) THEN
    RAISE EXCEPTION 'created_by is not a member of org';
  END IF;

  IF p_storage_path IS NOT NULL THEN
    IF split_part(p_storage_path, '/', 1) <> 'orgs'
       OR split_part(p_storage_path, '/', 3) <> 'inbox'
       OR split_part(p_storage_path, '/', 2)::uuid <> p_org_id THEN
      RAISE EXCEPTION 'Invalid inbox storage path for org';
    END IF;
  END IF;

  INSERT INTO intake_items (
    id,
    org_id,
    created_by,
    source_type,
    status,
    storage_path,
    file_name,
    mime_type,
    file_size,
    raw_text
  )
  VALUES (
    COALESCE(p_id, gen_random_uuid()),
    p_org_id,
    p_created_by,
    'forwarded_email',
    'pending',
    p_storage_path,
    p_file_name,
    NULLIF(p_mime_type, ''),
    p_file_size,
    NULLIF(left(p_raw_text, 4000), '')
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


--
-- Name: create_intake_item_from_upload(uuid, text, text, text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_intake_item_from_upload(p_id uuid, p_storage_path text, p_file_name text, p_mime_type text, p_file_size bigint) RETURNS public.intake_items
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_org_id UUID;
  v_row intake_items;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_storage_path IS NULL
     OR split_part(p_storage_path, '/', 1) <> 'orgs'
     OR split_part(p_storage_path, '/', 3) <> 'inbox'
     OR split_part(p_storage_path, '/', 4) = '' THEN
    RAISE EXCEPTION 'Invalid inbox storage path';
  END IF;

  IF split_part(p_storage_path, '/', 2) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Invalid org segment in storage path';
  END IF;

  v_org_id := split_part(p_storage_path, '/', 2)::uuid;

  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = v_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No organisation membership for storage path org';
  END IF;

  INSERT INTO intake_items (
    id,
    org_id,
    created_by,
    source_type,
    status,
    storage_path,
    file_name,
    mime_type,
    file_size
  )
  VALUES (
    COALESCE(p_id, gen_random_uuid()),
    v_org_id,
    auth.uid(),
    'upload',
    'pending',
    p_storage_path,
    p_file_name,
    NULLIF(p_mime_type, ''),
    p_file_size
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$_$;


--
-- Name: create_knowledge_candidate(text, uuid, text, text, text, text, jsonb, jsonb, integer, numeric, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_knowledge_candidate(p_scope text, p_org_id uuid, p_title text, p_summary text, p_body text, p_source_kind text, p_content jsonb DEFAULT '{}'::jsonb, p_provenance jsonb DEFAULT '{}'::jsonb, p_cohort_size integer DEFAULT NULL::integer, p_trust_score numeric DEFAULT NULL::numeric, p_created_by uuid DEFAULT NULL::uuid) RETURNS public.knowledge
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row public.knowledge;
BEGIN
  IF p_scope = 'platform' AND p_org_id IS NOT NULL THEN
    RAISE EXCEPTION 'platform_org_must_be_null';
  END IF;
  IF p_scope = 'organisation' AND p_org_id IS NULL THEN
    RAISE EXCEPTION 'org_required';
  END IF;

  INSERT INTO public.knowledge (
    scope, status, org_id, title, summary, body, content, source_kind,
    provenance, cohort_size, trust_score, created_by
  ) VALUES (
    p_scope, 'candidate', p_org_id, p_title, p_summary, p_body,
    COALESCE(p_content, '{}'::jsonb), p_source_kind,
    COALESCE(p_provenance, '{}'::jsonb), p_cohort_size, p_trust_score, p_created_by
  )
  RETURNING * INTO v_row;

  INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
  VALUES (
    v_row.id, p_org_id, 'candidate_created', p_created_by,
    jsonb_build_object('source_kind', p_source_kind, 'via', 'create_knowledge_candidate')
  );

  RETURN v_row;
END;
$$;


--
-- Name: create_org_api_key(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_org_api_key(p_org_id uuid, p_name text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: create_organisation(text, public.org_type, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_organisation(org_name text, org_type_value public.org_type, creator_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  new_org_id UUID;
  has_duplicate BOOLEAN;
BEGIN
  has_duplicate := check_duplicate_org_name(org_name, creator_id, org_type_value);

  IF has_duplicate THEN
    IF org_type_value = 'personal' THEN
      RAISE EXCEPTION 'You already have a personal organisation. You can only have one personal organisation.';
    ELSE
      RAISE EXCEPTION 'An organisation with this name already exists. Please choose a different name.';
    END IF;
  END IF;

  SET LOCAL row_security = off;

  INSERT INTO organisations (name, org_type, created_by)
  VALUES (org_name, org_type_value, creator_id)
  RETURNING id INTO new_org_id;

  INSERT INTO organisation_members (user_id, org_id, role, is_primary_owner)
  VALUES (creator_id, new_org_id, 'owner', true);

  RETURN new_org_id;
END;
$$;


--
-- Name: create_property_v2(uuid, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_property_v2(p_org_id uuid, p_address text, p_nickname text DEFAULT NULL::text, p_icon_name text DEFAULT NULL::text, p_icon_color_hex text DEFAULT NULL::text, p_thumbnail_url text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: create_task_full(uuid, uuid, text, text, text, timestamp with time zone, uuid, uuid[], uuid[], boolean, text, jsonb, jsonb, uuid[], uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_task_full(p_org uuid, p_property uuid, p_title text, p_description text, p_priority text, p_due_at timestamp with time zone, p_assigned_user uuid, p_assigned_teams uuid[], p_space_ids uuid[], p_is_compliance boolean, p_compliance_level text, p_metadata jsonb, p_subtasks jsonb, p_groups uuid[], p_template uuid, p_images jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    t_id UUID;
    st RECORD;
    g UUID;
    img RECORD;
    new_img UUID;
BEGIN
    -- CREATE TASK
    INSERT INTO public.tasks (
        org_id,
        property_id,
        title,
        description,
        priority,
        due_at,
        assigned_user_id,
        assigned_team_ids,
        space_ids,
        is_compliance,
        compliance_level,
        metadata
    ) VALUES (
        p_org,
        p_property,
        p_title,
        p_description,
        p_priority,
        p_due_at,
        p_assigned_user,
        COALESCE(p_assigned_teams, ARRAY[]::UUID[]),
        COALESCE(p_space_ids, ARRAY[]::UUID[]),
        COALESCE(p_is_compliance, FALSE),
        p_compliance_level,
        COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING id INTO t_id;

    -- APPLY CHECKLIST TEMPLATE IF PROVIDED
    IF p_template IS NOT NULL THEN
        PERFORM public.apply_checklist_template(t_id, p_template, p_org);
    END IF;

    -- INSERT SUBTASKS ARRAY (JSONB)
    IF p_subtasks IS NOT NULL THEN
        FOR st IN SELECT * FROM jsonb_to_recordset(p_subtasks)
            AS x(title TEXT, is_yes_no BOOLEAN, requires_signature BOOLEAN, order_index INTEGER)
        LOOP
            INSERT INTO public.subtasks (
                task_id,
                org_id,
                title,
                is_completed,
                is_yes_no,
                requires_signature,
                order_index
            ) VALUES (
                t_id,
                p_org,
                st.title,
                FALSE,
                COALESCE(st.is_yes_no, FALSE),
                COALESCE(st.requires_signature, FALSE),
                COALESCE(st.order_index, 0)
            );
        END LOOP;
    END IF;

    -- ASSIGN GROUPS (now includes org_id)
    IF p_groups IS NOT NULL THEN
        FOREACH g IN ARRAY p_groups LOOP
            INSERT INTO public.task_groups (task_id, group_id, org_id)
            VALUES (t_id, g, p_org)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    -- INSERT IMAGES (JSONB: [{path, url, original_filename, display_name, file_type}])
    IF p_images IS NOT NULL THEN
        FOR img IN SELECT * FROM jsonb_to_recordset(p_images)
            AS x(storage_path TEXT, image_url TEXT, original_filename TEXT, display_name TEXT, file_type TEXT)
        LOOP
            INSERT INTO public.task_images (
                task_id,
                org_id,
                storage_path,
                image_url,
                original_filename,
                display_name,
                file_type,
                status
            ) VALUES (
                t_id,
                p_org,
                img.storage_path,
                img.image_url,
                img.original_filename,
                img.display_name,
                img.file_type,
                'active'
            )
            RETURNING id INTO new_img;

            INSERT INTO public.task_image_versions (
                task_image_id,
                storage_path,
                version_number,
                is_original,
                created_at
            ) VALUES (
                new_img,
                img.storage_path,
                1,
                TRUE,
                NOW()
            );
        END LOOP;
    END IF;

    RETURN t_id;
END;
$$;


--
-- Name: create_task_safe(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_task_safe(p_org uuid, p_property uuid, p_payload jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    t UUID;
    v_space_ids UUID[];
    v_team_ids UUID[];
    v_group_ids UUID[];
BEGIN
    -- Parse arrays safely
    SELECT ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'space_ids', '[]'::jsonb)))::UUID[]
    INTO v_space_ids;
    
    SELECT ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'assigned_team_ids', '[]'::jsonb)))::UUID[]
    INTO v_team_ids;
    
    SELECT ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'groups', '[]'::jsonb)))::UUID[]
    INTO v_group_ids;

    PERFORM public.validate_task_payload(
        p_payload->>'title',
        p_payload->>'priority',
        v_space_ids
    );

    t := public.create_task_full(
        p_org,
        p_property,
        p_payload->>'title',
        p_payload->>'description',
        COALESCE(p_payload->>'priority', 'medium'),
        (p_payload->>'due_at')::timestamptz,
        (p_payload->>'assigned_user_id')::UUID,
        v_team_ids,
        v_space_ids,
        COALESCE((p_payload->>'is_compliance')::BOOLEAN, FALSE),
        p_payload->>'compliance_level',
        COALESCE(p_payload->'metadata', '{}'::jsonb),
        p_payload->'subtasks',
        v_group_ids,
        (p_payload->>'template_id')::UUID,
        p_payload->'images'
    );

    RETURN t;
END;
$$;


--
-- Name: create_template_from_task(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_template_from_task(p_task uuid, p_org uuid, p_name text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    t UUID;
    s RECORD;
BEGIN
    INSERT INTO public.checklist_templates (org_id, name, created_by)
    VALUES (p_org, p_name, auth.uid())
    RETURNING id INTO t;

    FOR s IN
        SELECT title, is_yes_no, requires_signature, order_index
        FROM public.subtasks
        WHERE task_id = p_task AND org_id = p_org
        ORDER BY order_index ASC
    LOOP
        INSERT INTO public.checklist_template_items (
            template_id,
            title,
            is_yes_no,
            requires_signature,
            order_index
        )
        VALUES (t, s.title, s.is_yes_no, s.requires_signature, s.order_index);
    END LOOP;

    RETURN t;
END;
$$;


--
-- Name: current_contractor_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_contractor_token() RETURNS text
    LANGUAGE sql
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::json->>'contractor_token', '');
$$;


--
-- Name: current_org_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_org_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  SELECT COALESCE(
    NULLIF(
      (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb
        -> 'app_metadata' ->> 'org_id'),
      ''
    )::uuid,
    (
      SELECT om.org_id
      FROM organisation_members om
      LEFT JOIN organisations o ON o.id = om.org_id
      WHERE om.user_id = auth.uid()
      ORDER BY
        CASE WHEN o.org_type IS DISTINCT FROM 'personal' THEN 0 ELSE 1 END,
        om.created_at ASC NULLS LAST
      LIMIT 1
    )
  );
$$;


--
-- Name: current_user_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_id() RETURNS uuid
    LANGUAGE sql
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid;
$$;


--
-- Name: delete_task_full(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_task_full(p_task_id uuid, p_org uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    img RECORD;
BEGIN
    -- VALIDATE TASK BELONGS TO ORG
    IF NOT EXISTS (
        SELECT 1 FROM public.tasks
        WHERE id = p_task_id AND org_id = p_org
    ) THEN
        RAISE EXCEPTION 'Task % not found or not in org %', p_task_id, p_org;
    END IF;

    -- DELETE SIGNALS
    DELETE FROM public.signals
    WHERE task_id = p_task_id AND org_id = p_org;

    -- DELETE GROUP LINKS
    DELETE FROM public.task_groups
    WHERE task_id = p_task_id;

    -- DELETE SUBTASKS
    DELETE FROM public.subtasks
    WHERE task_id = p_task_id AND org_id = p_org;

    -- DELETE IMAGE ACTIONS + VERSIONS + IMAGES
    FOR img IN
        SELECT id FROM public.task_images
        WHERE task_id = p_task_id AND org_id = p_org
    LOOP
        DELETE FROM public.task_image_actions
        WHERE task_image_id = img.id;

        DELETE FROM public.task_image_versions
        WHERE task_image_id = img.id;

        DELETE FROM public.task_images
        WHERE id = img.id;
    END LOOP;

    -- DELETE TASK
    DELETE FROM public.tasks
    WHERE id = p_task_id AND org_id = p_org;
END;
$$;


--
-- Name: emit_signal(uuid, text, text, text, text, text, text, uuid, uuid, uuid, text, text, jsonb, jsonb, text, timestamp with time zone, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emit_signal(p_org_id uuid, p_subtype text, p_title text, p_body text DEFAULT NULL::text, p_kind text DEFAULT 'system'::text, p_category text DEFAULT 'operational'::text, p_severity text DEFAULT 'info'::text, p_property_id uuid DEFAULT NULL::uuid, p_space_id uuid DEFAULT NULL::uuid, p_asset_id uuid DEFAULT NULL::uuid, p_source text DEFAULT 'system'::text, p_source_key text DEFAULT NULL::text, p_payload jsonb DEFAULT '{}'::jsonb, p_recommendation jsonb DEFAULT NULL::jsonb, p_dedupe_key text DEFAULT NULL::text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_disposition text DEFAULT 'recent'::text, p_review_state text DEFAULT 'none'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_id       UUID;
  v_rec      JSONB;
  v_severity TEXT;
BEGIN
  IF p_dedupe_key IS NOT NULL THEN
    SELECT id INTO v_id
    FROM signals
    WHERE org_id = p_org_id
      AND dedupe_key = p_dedupe_key
      AND resolved_at IS NULL
      AND disposition NOT IN ('dismissed')
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  IF p_recommendation IS NULL THEN
    SELECT jsonb_build_object(
      'action', action_type,
      'template_key', template_key,
      'title', title_template,
      'body', body_template,
      'task_priority', task_priority
    ), default_severity::text
    INTO v_rec, v_severity
    FROM signal_recommendation_templates
    WHERE subtype = p_subtype;
  ELSE
    v_rec      := p_recommendation;
    v_severity := p_severity;
  END IF;

  INSERT INTO signals (
    org_id, property_id, space_id, asset_id,
    kind, category, subtype, severity,
    title, body, review_state, disposition,
    source, source_key, payload, recommendation, dedupe_key, expires_at
  )
  VALUES (
    p_org_id,
    p_property_id,
    p_space_id,
    p_asset_id,
    p_kind,
    p_category::signal_category,
    p_subtype,
    COALESCE(v_severity, p_severity)::signal_severity,
    p_title,
    p_body,
    p_review_state::signal_review_state,
    p_disposition::signal_disposition,
    p_source,
    p_source_key,
    p_payload,
    v_rec,
    p_dedupe_key,
    p_expires_at
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


--
-- Name: ensure_task_thread(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_task_thread() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    INSERT INTO public.task_threads (org_id, task_id)
    VALUES (NEW.org_id, NEW.id)
    ON CONFLICT (task_id) DO NOTHING;
    RETURN NEW;
END;
$$;


--
-- Name: expire_old_invitations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_old_invitations() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE invitations
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending'
    AND expires_at < now();
END;
$$;


--
-- Name: expire_stale_environmental_signals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_stale_environmental_signals() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE signals
  SET disposition = 'dismissed',
      resolved_at = now(),
      updated_at = now()
  WHERE category = 'environmental'
    AND resolved_at IS NULL
    AND disposition NOT IN ('dismissed', 'converted_to_issue', 'converted_to_record')
    AND expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    actor_id uuid,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    action text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: export_org_audit_logs(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.export_org_audit_logs(p_org_id uuid, p_days integer DEFAULT 90) RETURNS SETOF public.audit_logs
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: generate_invitation_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invitation_token() RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  token text;
BEGIN
  token := encode(extensions.gen_random_bytes(24), 'base64url');
  RETURN token;
END;
$$;


--
-- Name: generate_recurring_task_instance(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_recurring_task_instance(p_recur uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    r RECORD;
    new_due TIMESTAMPTZ;
    new_id UUID;
BEGIN
    SELECT * INTO r FROM public.task_recurrence WHERE id = p_recur;

    IF r.rule->>'type' = 'daily' THEN
        new_due := r.next_run + ((r.rule->>'interval')::int * INTERVAL '1 day');
    ELSIF r.rule->>'type' = 'weekly' THEN
        new_due := r.next_run + ((r.rule->>'interval')::int * INTERVAL '1 week');
    ELSIF r.rule->>'type' = 'monthly' THEN
        new_due := r.next_run + ((r.rule->>'interval')::int * INTERVAL '1 month');
    ELSE
        RETURN;
    END IF;

    INSERT INTO public.tasks (
        org_id, property_id, title, description, priority, status, due_at,
        assigned_user_id, assigned_team_ids, space_ids, is_compliance, compliance_level, annotation_required, metadata, owner_user_id, owner_team_id
    )
    SELECT
        org_id, property_id, title, description, priority, 'pending', new_due,
        assigned_user_id, assigned_team_ids, space_ids, is_compliance, compliance_level, annotation_required, metadata, owner_user_id, owner_team_id
    FROM public.tasks WHERE id = r.task_id
    RETURNING id INTO new_id;

    UPDATE public.task_recurrence
    SET next_run = new_due
    WHERE id = p_recur;
END;
$$;


--
-- Name: generate_unique_org_slug(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_unique_org_slug(base text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  candidate text := lower(regexp_replace(base, '[^a-zA-Z0-9]+', '-', 'g'));
  final_slug text := candidate;
  counter int := 1;
BEGIN
  WHILE EXISTS (SELECT 1 FROM public.organisations WHERE slug = final_slug) LOOP
    final_slug := candidate || '-' || counter;
    counter := counter + 1;
  END LOOP;

  RETURN final_slug;
END;
$$;


--
-- Name: generate_unique_slug(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_unique_slug(base text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  new_slug text := lower(regexp_replace(base, '[^a-zA-Z0-9]+', '-', 'g'));
  candidate text;
  counter int := 0;
BEGIN
  LOOP
    candidate := new_slug || CASE WHEN counter = 0 THEN '' ELSE '-' || counter END;

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.organisations WHERE slug = candidate
    );

    counter := counter + 1;
  END LOOP;

  RETURN candidate;
END;
$$;


--
-- Name: get_compliance_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_compliance_summary(p_org uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total', SUM(CASE WHEN is_compliance THEN 1 ELSE 0 END),
        'completed', SUM(CASE WHEN is_compliance AND status = 'completed' THEN 1 ELSE 0 END),
        'overdue', SUM(CASE WHEN is_compliance AND due_at < NOW() AND status <> 'completed' THEN 1 ELSE 0 END),
        'due_soon', SUM(CASE WHEN is_compliance AND due_at BETWEEN NOW() AND NOW() + INTERVAL '7 days' AND status <> 'completed' THEN 1 ELSE 0 END)
    )
    INTO result
    FROM public.tasks
    WHERE org_id = p_org;

    RETURN result;
END;
$$;


--
-- Name: get_invitation_by_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_invitation_by_token(p_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_invitation invitations%ROWTYPE;
BEGIN
  SELECT * INTO v_invitation
  FROM invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_invitation.id,
    'org_id', v_invitation.org_id,
    'email', v_invitation.email,
    'first_name', v_invitation.first_name,
    'last_name', v_invitation.last_name,
    'role', v_invitation.role,
    'expires_at', v_invitation.expires_at,
    'token', v_invitation.token
  );
END;
$$;


--
-- Name: get_org_billing_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_org_billing_status(p_org_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: get_org_entitlements(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_org_entitlements(p_org_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: get_org_intake_email(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_org_intake_email(p_org_id uuid) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_token TEXT;
  v_slug TEXT;
  v_domain TEXT := coalesce(current_setting('app.intake_email_domain', true), 'inbox.filla.app');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this organisation';
  END IF;

  SELECT intake_email_token INTO v_token
  FROM org_settings
  WHERE org_id = p_org_id;

  IF v_token IS NULL THEN
    INSERT INTO org_settings (org_id, intake_email_token)
    VALUES (p_org_id, encode(gen_random_bytes(8), 'hex'))
    ON CONFLICT (org_id) DO UPDATE
    SET intake_email_token = COALESCE(org_settings.intake_email_token, encode(gen_random_bytes(8), 'hex'))
    RETURNING intake_email_token INTO v_token;
  END IF;

  SELECT lower(regexp_replace(substring(o.name FROM 1 FOR 24), '[^a-zA-Z0-9]', '', 'g'))
  INTO v_slug
  FROM organisations o
  WHERE o.id = p_org_id;

  IF v_slug IS NULL OR length(v_slug) < 2 THEN
    v_slug := substring(replace(p_org_id::text, '-', '') FROM 1 FOR 8);
  END IF;

  RETURN v_slug || '+' || v_token || '@' || v_domain;
END;
$$;


--
-- Name: get_users_info(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_users_info(user_ids uuid[]) RETURNS TABLE(id uuid, email text, nickname text, avatar_url text, first_name text, last_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    COALESCE(u.raw_user_meta_data->>'nickname', NULL)::TEXT AS nickname,
    COALESCE(u.raw_user_meta_data->>'avatar_url', NULL)::TEXT AS avatar_url,
    COALESCE(u.raw_user_meta_data->>'first_name', NULL)::TEXT AS first_name,
    COALESCE(u.raw_user_meta_data->>'last_name', NULL)::TEXT AS last_name
  FROM auth.users u
  WHERE u.id = ANY(user_ids);
END;
$$;


--
-- Name: FUNCTION get_users_info(user_ids uuid[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_users_info(user_ids uuid[]) IS 'Enrich org member lists: email, nickname, avatar, first_name, last_name from auth.users.';


--
-- Name: handle_new_organisation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_organisation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  -- Add member
  INSERT INTO public.organisation_members (org_id, user_id, role)
  VALUES (NEW.id, uid, 'owner');

  -- Update user metadata
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('org_id', NEW.id)
  WHERE id = uid;

  RETURN NEW;
END;
$$;


--
-- Name: home_entitlement_defaults(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_entitlement_defaults() RETURNS jsonb
    LANGUAGE sql IMMUTABLE
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


--
-- Name: import_plan_extraction_run(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.import_plan_extraction_run(p_extraction_run_id uuid) RETURNS TABLE(created_spaces integer, created_assets integer, created_tasks integer)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT * FROM import_plan_extraction_run(p_extraction_run_id, TRUE);
$$;


--
-- Name: import_plan_extraction_run(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.import_plan_extraction_run(p_extraction_run_id uuid, p_spaces_only boolean DEFAULT true) RETURNS TABLE(created_spaces integer, created_assets integer, created_tasks integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_run RECORD;
  v_file RECORD;
  v_created_spaces INTEGER := 0;
  v_created_assets INTEGER := 0;
  v_created_tasks INTEGER := 0;
  v_space_id UUID;
  v_asset_id UUID;
  v_task_id UUID;
  rec RECORD;
  v_floor TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_run
  FROM plan_extraction_runs r
  WHERE r.id = p_extraction_run_id
    AND r.org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Extraction run not found or no access';
  END IF;

  SELECT *
  INTO v_file
  FROM property_plan_files f
  WHERE f.id = v_run.plan_file_id;

  FOR rec IN
    SELECT *
    FROM extracted_spaces s
    WHERE s.extraction_run_id = p_extraction_run_id
      AND s.org_id = v_run.org_id
      AND s.is_accepted = TRUE
      AND s.imported_space_id IS NULL
  LOOP
    v_floor := COALESCE(NULLIF(rec.floor_label, ''), NULLIF(v_file.floor_label, ''));

    INSERT INTO spaces (org_id, property_id, name, floor_level)
    VALUES (
      rec.org_id,
      rec.property_id,
      COALESCE(NULLIF(rec.edited_name, ''), rec.name),
      v_floor
    )
    RETURNING id INTO v_space_id;

    UPDATE extracted_spaces
    SET imported_space_id = v_space_id
    WHERE id = rec.id;

    v_created_spaces := v_created_spaces + 1;
  END LOOP;

  IF NOT COALESCE(p_spaces_only, TRUE) THEN
    FOR rec IN
      SELECT *
      FROM extracted_assets a
      WHERE a.extraction_run_id = p_extraction_run_id
        AND a.org_id = v_run.org_id
        AND a.is_accepted = TRUE
        AND a.imported_asset_id IS NULL
    LOOP
      INSERT INTO assets (
        org_id,
        property_id,
        name,
        asset_type,
        status,
        condition_score
      )
      VALUES (
        rec.org_id,
        rec.property_id,
        COALESCE(NULLIF(rec.edited_name, ''), rec.name),
        COALESCE(NULLIF(rec.edited_asset_type, ''), rec.asset_type),
        'active',
        100
      )
      RETURNING id INTO v_asset_id;

      UPDATE extracted_assets
      SET imported_asset_id = v_asset_id
      WHERE id = rec.id;

      v_created_assets := v_created_assets + 1;
    END LOOP;

    FOR rec IN
      SELECT *
      FROM extracted_task_suggestions t
      WHERE t.extraction_run_id = p_extraction_run_id
        AND t.org_id = v_run.org_id
        AND t.is_accepted = TRUE
        AND t.imported_task_id IS NULL
    LOOP
      INSERT INTO tasks (
        org_id,
        property_id,
        title,
        description,
        priority,
        status
      )
      VALUES (
        rec.org_id,
        rec.property_id,
        rec.title,
        COALESCE(rec.rationale, 'Imported from building plan extraction'),
        'medium',
        'open'
      )
      RETURNING id INTO v_task_id;

      UPDATE extracted_task_suggestions
      SET imported_task_id = v_task_id
      WHERE id = rec.id;

      v_created_tasks := v_created_tasks + 1;
    END LOOP;
  END IF;

  UPDATE property_plan_files
  SET status = 'imported'
  WHERE id = v_run.plan_file_id;

  UPDATE plan_extraction_runs
  SET status = 'completed'
  WHERE id = p_extraction_run_id;

  RETURN QUERY SELECT v_created_spaces, v_created_assets, v_created_tasks;
END;
$$;


--
-- Name: increment_rule_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_rule_version() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
  NEW.version_number := (
    SELECT coalesce(max(version_number), 0) + 1
    FROM public.compliance_rule_versions
    WHERE rule_id = NEW.rule_id
  );
  RETURN NEW;
END;
$$;


--
-- Name: is_org_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_member(p_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organisation_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
  );
$$;


--
-- Name: is_org_owner_or_manager(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_owner_or_manager(p_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organisation_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND lower(om.role) IN ('owner', 'manager', 'admin')
  );
$$;


--
-- Name: knowledge_metric_default_minutes(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.knowledge_metric_default_minutes(p_event_type text) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE p_event_type
    WHEN 'question_answered' THEN 5::NUMERIC
    WHEN 'reused' THEN 2::NUMERIC
    WHEN 'automation_created' THEN 10::NUMERIC
    WHEN 'time_saved' THEN 0::NUMERIC
    ELSE 0::NUMERIC
  END;
$$;


--
-- Name: knowledge_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    knowledge_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    relationship text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT knowledge_links_entity_type_check CHECK ((entity_type = ANY (ARRAY['property'::text, 'space'::text, 'asset'::text, 'compliance'::text, 'task'::text, 'report'::text, 'document'::text])))
);


--
-- Name: link_knowledge_entity(uuid, uuid, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_knowledge_entity(p_org_id uuid, p_knowledge_id uuid, p_entity_type text, p_entity_id uuid, p_relationship text DEFAULT NULL::text) RETURNS public.knowledge_links
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_link public.knowledge_links;
  v_k public.knowledge;
BEGIN
  IF NOT public.is_org_owner_or_manager(p_org_id) THEN
    RAISE EXCEPTION 'not_org_manager';
  END IF;

  SELECT * INTO v_k FROM public.knowledge WHERE id = p_knowledge_id;
  IF v_k.id IS NULL THEN
    RAISE EXCEPTION 'knowledge_not_found';
  END IF;
  IF v_k.scope = 'organisation' AND v_k.org_id <> p_org_id THEN
    RAISE EXCEPTION 'org_mismatch';
  END IF;
  IF v_k.status <> 'published' AND v_k.scope = 'organisation' AND v_k.status NOT IN ('verified', 'candidate') THEN
    RAISE EXCEPTION 'invalid_link_status';
  END IF;

  INSERT INTO public.knowledge_links (org_id, knowledge_id, entity_type, entity_id, relationship, created_by)
  VALUES (p_org_id, p_knowledge_id, p_entity_type, p_entity_id, p_relationship, auth.uid())
  ON CONFLICT (org_id, knowledge_id, entity_type, entity_id)
  DO UPDATE SET relationship = EXCLUDED.relationship
  RETURNING * INTO v_link;

  RETURN v_link;
END;
$$;


--
-- Name: list_brain_patterns_for_community(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_brain_patterns_for_community(p_limit integer DEFAULT 20) RETURNS TABLE(pattern_kind text, document_type text, asset_vector jsonb, recommended_frequency text, risk_level text, failure_probability numeric, mean_time_to_failure_days integer, sample_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'filla_brain'
    AS $$
DECLARE
  v_min INT := public.brain_min_cohort();
  v_lim INT := GREATEST(COALESCE(p_limit, 20), 1);
BEGIN
  RETURN QUERY
  SELECT
    x.pattern_kind,
    x.document_type,
    x.asset_vector,
    x.recommended_frequency,
    x.risk_level,
    x.failure_probability,
    x.mean_time_to_failure_days,
    x.sample_count
  FROM (
    SELECT
      'compliance'::TEXT AS pattern_kind,
      bcp.document_type,
      NULL::JSONB AS asset_vector,
      bcp.recommended_frequency,
      bcp.risk_level,
      NULL::NUMERIC AS failure_probability,
      NULL::INT AS mean_time_to_failure_days,
      bcp.sample_count
    FROM filla_brain.brain_compliance_patterns bcp
    WHERE bcp.sample_count >= v_min
    ORDER BY bcp.sample_count DESC
    LIMIT v_lim
  ) x;

  RETURN QUERY
  SELECT
    y.pattern_kind,
    y.document_type,
    y.asset_vector,
    y.recommended_frequency,
    y.risk_level,
    y.failure_probability,
    y.mean_time_to_failure_days,
    y.sample_count
  FROM (
    SELECT
      'asset'::TEXT AS pattern_kind,
      NULL::TEXT AS document_type,
      bap.asset_vector,
      NULL::TEXT AS recommended_frequency,
      NULL::TEXT AS risk_level,
      bap.failure_probability,
      bap.mean_time_to_failure_days,
      bap.sample_count
    FROM filla_brain.brain_asset_patterns bap
    WHERE bap.sample_count >= v_min
    ORDER BY bap.sample_count DESC
    LIMIT v_lim
  ) y;
END;
$$;


--
-- Name: list_org_knowledge_review_queue(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_org_knowledge_review_queue(p_org_id uuid) RETURNS SETOF public.knowledge
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_org_owner_or_manager(p_org_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT k.*
  FROM public.knowledge k
  WHERE k.scope = 'organisation'
    AND k.org_id = p_org_id
    AND k.status IN ('candidate', 'verified', 'stale')
  ORDER BY k.updated_at DESC;
END;
$$;


--
-- Name: list_published_knowledge(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_published_knowledge(p_org_id uuid, p_query text DEFAULT NULL::text) RETURNS SETOF public.knowledge
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT k.*
  FROM public.knowledge k
  WHERE k.status = 'published'
    AND (
      k.scope = 'platform'
      OR (k.scope = 'organisation' AND k.org_id = p_org_id)
    )
    AND (
      p_query IS NULL
      OR trim(p_query) = ''
      OR k.title ILIKE '%' || trim(p_query) || '%'
      OR COALESCE(k.summary, '') ILIKE '%' || trim(p_query) || '%'
      OR COALESCE(k.body, '') ILIKE '%' || trim(p_query) || '%'
    )
  ORDER BY k.published_at DESC NULLS LAST, k.updated_at DESC;
END;
$$;


--
-- Name: lock_checklist_template(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_checklist_template(p_template uuid, p_org uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    UPDATE public.checklist_templates
    SET is_locked = TRUE
    WHERE id = p_template AND org_id = p_org;
END;
$$;


--
-- Name: match_org_member_by_email(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_org_member_by_email(p_org_id uuid, p_email text) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT om.user_id
  FROM organisation_members om
  INNER JOIN auth.users u ON u.id = om.user_id
  WHERE om.org_id = p_org_id
    AND lower(u.email) = lower(trim(p_email))
  LIMIT 1;
$$;


--
-- Name: member_can_access_property(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.member_can_access_property(p_org_id uuid, p_property_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organisation_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND COALESCE(om.membership_status, 'active') = 'active'
      AND (
        om.is_primary_owner = true
        OR lower(om.role) = 'owner'
        OR om.assigned_properties IS NULL
        OR cardinality(om.assigned_properties) = 0
        OR p_property_id = ANY (om.assigned_properties)
      )
  );
$$;


--
-- Name: member_can_create_tasks(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.member_can_create_tasks(p_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organisation_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND COALESCE(om.membership_status, 'active') = 'active'
      AND lower(om.role) IN ('owner', 'manager')
  );
$$;


--
-- Name: org_ai_ops_used(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_ai_ops_used(p_org_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(SUM(COALESCE(cost_units, 1)), 0)::integer
  FROM public.ai_requests
  WHERE org_id = p_org_id
    AND status IN ('success', 'fallback')
    AND created_at >= public.org_billing_period_start(p_org_id);
$$;


--
-- Name: org_billing_period_start(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_billing_period_start(p_org_id uuid) RETURNS timestamp with time zone
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: org_expansion_allowed(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_expansion_allowed(p_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    (public.get_org_billing_status(p_org_id) ->> 'expansion_allowed')::boolean,
    true
  );
$$;


--
-- Name: org_knowledge_metrics(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_knowledge_metrics(p_org_id uuid) RETURNS TABLE(knowledge_created bigint, knowledge_verified bigint, knowledge_published bigint, knowledge_reused bigint, questions_answered bigint, automation_created bigint, time_saved_minutes numeric)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::BIGINT FROM knowledge k WHERE k.org_id = p_org_id) AS knowledge_created,
    (SELECT COUNT(*)::BIGINT FROM knowledge k WHERE k.org_id = p_org_id AND k.status IN ('verified', 'published')) AS knowledge_verified,
    (SELECT COUNT(*)::BIGINT FROM knowledge k WHERE k.org_id = p_org_id AND k.status = 'published') AS knowledge_published,
    (SELECT COUNT(*)::BIGINT FROM knowledge_usage_events u WHERE u.org_id = p_org_id AND u.event_type = 'reused') AS knowledge_reused,
    (SELECT COUNT(*)::BIGINT FROM knowledge_usage_events u WHERE u.org_id = p_org_id AND u.event_type = 'question_answered') AS questions_answered,
    (SELECT COUNT(*)::BIGINT FROM knowledge_usage_events u WHERE u.org_id = p_org_id AND u.event_type = 'automation_created') AS automation_created,
    (SELECT COALESCE(SUM(u.estimated_minutes), 0)::NUMERIC FROM knowledge_usage_events u WHERE u.org_id = p_org_id AND u.event_type = 'time_saved') AS time_saved_minutes;
END;
$$;


--
-- Name: org_messaging_units_used(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_messaging_units_used(p_org_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(SUM(units), 0)::integer
  FROM public.messaging_usage_events
  WHERE org_id = p_org_id
    AND status IN ('recorded', 'sent')
    AND created_at >= public.org_billing_period_start(p_org_id);
$$;


--
-- Name: organisation_members_primary_owner_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.organisation_members_primary_owner_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Allow transfer_primary_ownership (SECURITY DEFINER) to clear primary when
  -- session GUC is set.
  IF current_setting('app.allow_primary_owner_transfer', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_primary_owner = true AND NEW.is_primary_owner = false THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.organisation_members
        WHERE org_id = OLD.org_id
          AND id IS DISTINCT FROM OLD.id
          AND is_primary_owner = true
      ) THEN
        RAISE EXCEPTION 'Cannot remove Primary Owner without transferring ownership first';
      END IF;
    END IF;
    IF OLD.is_primary_owner = true AND lower(NEW.role) IS DISTINCT FROM 'owner' THEN
      RAISE EXCEPTION 'Primary Owner must keep the owner role; transfer ownership first';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_primary_owner = true THEN
      RAISE EXCEPTION 'Cannot delete Primary Owner; transfer ownership first';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: organisation_members_role_audit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.organisation_members_role_audit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (
       OLD.role IS DISTINCT FROM NEW.role
       OR OLD.is_primary_owner IS DISTINCT FROM NEW.is_primary_owner
       OR OLD.assigned_properties IS DISTINCT FROM NEW.assigned_properties
       OR OLD.membership_status IS DISTINCT FROM NEW.membership_status
     )
     AND EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'audit_logs'
     )
  THEN
    INSERT INTO public.audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
    VALUES (
      NEW.org_id,
      auth.uid(),
      'organisation_member',
      NEW.id,
      'member.updated',
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'old_primary', OLD.is_primary_owner,
        'new_primary', NEW.is_primary_owner,
        'old_status', OLD.membership_status,
        'new_status', NEW.membership_status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: organisations_slug_before_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.organisations_slug_before_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF new.slug IS NULL OR new.slug = '' THEN
    new.slug := public.generate_unique_org_slug(new.name);
  END IF;

  RETURN new;
END;
$$;


--
-- Name: process_all_recurrences(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_all_recurrences() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT id FROM public.task_recurrence WHERE next_run <= NOW()
    LOOP
        PERFORM public.generate_recurring_task_instance(r.id);
    END LOOP;
END;
$$;


--
-- Name: process_compliance_schedules(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_compliance_schedules() RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    rule RECORD;
    next_due DATE;
BEGIN
    FOR rule IN
        SELECT id, org_id, property_id, recurrence_type, recurrence_value, last_triggered_at
        FROM public.compliance_assignments
        WHERE recurrence_type IS NOT NULL
    LOOP
        IF rule.recurrence_type = 'monthly' THEN
            next_due := (COALESCE(rule.last_triggered_at, NOW() - INTERVAL '1 month') + (rule.recurrence_value || ' months')::interval)::date;
        ELSIF rule.recurrence_type = 'yearly' THEN
            next_due := (COALESCE(rule.last_triggered_at, NOW() - INTERVAL '1 year') + (rule.recurrence_value || ' years')::interval)::date;
        END IF;

        IF next_due <= NOW()::date THEN
            PERFORM public.create_compliance_task(
                rule.org_id,
                rule.property_id,
                rule.id,
                'Scheduled Compliance Check',
                NOW() + INTERVAL '7 days',
                'medium'
            );

            UPDATE public.compliance_assignments
            SET last_triggered_at = NOW()
            WHERE id = rule.id;
        END IF;
    END LOOP;
END;
$$;


--
-- Name: process_escalations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_escalations() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT * FROM public.escalation_rules
        WHERE enabled = TRUE
    LOOP
        IF r.trigger_type = 'overdue_task' THEN
            INSERT INTO public.escalation_events (org_id, rule_id, task_id, event)
            SELECT
                t.org_id,
                r.id,
                t.id,
                jsonb_build_object(
                    'type', 'overdue_trigger',
                    'rule', r.name,
                    'task', t.id,
                    'due_at', t.due_at
                )
            FROM public.tasks t
            WHERE t.org_id = r.org_id
            AND t.due_at < NOW() - ((r.conditions->>'days_overdue')::int * INTERVAL '1 day')
            AND t.status != 'completed'
            AND NOT EXISTS (
                SELECT 1 FROM public.escalation_events ee 
                WHERE ee.task_id = t.id AND ee.rule_id = r.id
            );
        END IF;
    END LOOP;
END;
$$;


--
-- Name: promote_external_email_signal(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.promote_external_email_signal(p_signal_id uuid) RETURNS SETOF public.intake_items
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_uid UUID := auth.uid();
  v_signal signals%ROWTYPE;
  v_paths TEXT[];
  v_path TEXT;
  v_preview TEXT;
  v_subject TEXT;
  v_intake_id UUID;
  v_file_name TEXT;
  v_first_id UUID;
  v_row intake_items;
  v_idx INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_signal_id IS NULL THEN
    RAISE EXCEPTION 'signal_id is required';
  END IF;

  SELECT * INTO v_signal
  FROM signals
  WHERE id = p_signal_id;

  IF v_signal.id IS NULL THEN
    RAISE EXCEPTION 'Signal not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = v_signal.org_id
      AND user_id = v_uid
      AND role IN ('owner', 'manager')
  ) THEN
    RAISE EXCEPTION 'Only owners and managers can promote external email signals';
  END IF;

  IF v_signal.subtype <> 'ingestion.external_email' THEN
    RAISE EXCEPTION 'Signal is not an external email';
  END IF;

  -- Idempotent: already converted → return linked intake rows
  IF v_signal.disposition = 'converted_to_record'
     AND v_signal.converted_entity_type = 'intake_item'
     AND v_signal.converted_entity_id IS NOT NULL THEN
    RETURN QUERY
    SELECT i.*
    FROM intake_items i
    WHERE i.org_id = v_signal.org_id
      AND (
        i.id = v_signal.converted_entity_id
        OR (
          jsonb_typeof(v_signal.payload->'attachment_paths') = 'array'
          AND i.storage_path IS NOT NULL
          AND i.storage_path IN (
            SELECT jsonb_array_elements_text(v_signal.payload->'attachment_paths')
          )
        )
      )
    ORDER BY i.created_at ASC;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Signal already converted but intake items were not found';
    END IF;
    RETURN;
  END IF;

  IF v_signal.disposition IN ('dismissed', 'converted_to_issue', 'converted_to_record')
     OR v_signal.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Signal already resolved';
  END IF;

  v_preview := NULLIF(left(COALESCE(v_signal.payload->>'preview', v_signal.body, ''), 4000), '');
  v_subject := NULLIF(trim(COALESCE(v_signal.payload->>'subject', v_signal.title, 'External email')), '');

  IF jsonb_typeof(v_signal.payload->'attachment_paths') = 'array' THEN
    SELECT COALESCE(array_agg(elem), ARRAY[]::TEXT[])
    INTO v_paths
    FROM jsonb_array_elements_text(v_signal.payload->'attachment_paths') AS elem
    WHERE NULLIF(trim(elem), '') IS NOT NULL;
  ELSE
    v_paths := ARRAY[]::TEXT[];
  END IF;

  IF coalesce(array_length(v_paths, 1), 0) = 0 THEN
    -- Text-only email
    INSERT INTO intake_items (
      org_id,
      created_by,
      source_type,
      status,
      storage_path,
      file_name,
      mime_type,
      file_size,
      raw_text
    )
    VALUES (
      v_signal.org_id,
      v_uid,
      'forwarded_email',
      'pending',
      NULL,
      COALESCE(left(v_subject, 120), 'External email'),
      'text/plain',
      NULL,
      COALESCE(v_preview, v_subject)
    )
    RETURNING * INTO v_row;

    v_first_id := v_row.id;

    UPDATE signals
    SET disposition = 'converted_to_record',
        review_state = 'none',
        resolved_at = now(),
        converted_entity_type = 'intake_item',
        converted_entity_id = v_first_id,
        updated_at = now()
    WHERE id = p_signal_id;

    INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
    VALUES (
      v_signal.org_id,
      v_uid,
      'signal',
      p_signal_id,
      'promoted_to_intake',
      jsonb_build_object('intake_item_id', v_first_id, 'attachment_count', 0)
    );

    RETURN NEXT v_row;
    RETURN;
  END IF;

  FOREACH v_path IN ARRAY v_paths
  LOOP
    v_idx := v_idx + 1;

    IF split_part(v_path, '/', 1) <> 'orgs'
       OR split_part(v_path, '/', 3) <> 'inbox'
       OR split_part(v_path, '/', 2)::uuid <> v_signal.org_id THEN
      RAISE EXCEPTION 'Invalid inbox storage path for org: %', v_path;
    END IF;

    BEGIN
      v_intake_id := NULLIF(split_part(v_path, '/', 4), '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_intake_id := NULL;
    END;

    v_file_name := NULLIF(substring(v_path from '[^/]+$'), '');
    IF v_file_name IS NULL OR v_file_name = '' THEN
      v_file_name := 'attachment';
    END IF;
    -- Strip timestamp prefix if present (123-name.ext)
    IF v_file_name ~ '^[0-9]+-' THEN
      v_file_name := regexp_replace(v_file_name, '^[0-9]+-', '');
    END IF;

    INSERT INTO intake_items (
      id,
      org_id,
      created_by,
      source_type,
      status,
      storage_path,
      file_name,
      mime_type,
      file_size,
      raw_text
    )
    VALUES (
      COALESCE(v_intake_id, gen_random_uuid()),
      v_signal.org_id,
      v_uid,
      'forwarded_email',
      'pending',
      v_path,
      v_file_name,
      NULL,
      NULL,
      CASE WHEN v_idx = 1 THEN v_preview ELSE NULL END
    )
    RETURNING * INTO v_row;

    IF v_first_id IS NULL THEN
      v_first_id := v_row.id;
    END IF;

    RETURN NEXT v_row;
  END LOOP;

  UPDATE signals
  SET disposition = 'converted_to_record',
      review_state = 'none',
      resolved_at = now(),
      converted_entity_type = 'intake_item',
      converted_entity_id = v_first_id,
      updated_at = now()
  WHERE id = p_signal_id;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_signal.org_id,
    v_uid,
    'signal',
    p_signal_id,
    'promoted_to_intake',
    jsonb_build_object(
      'intake_item_id', v_first_id,
      'attachment_count', coalesce(array_length(v_paths, 1), 0)
    )
  );

  RETURN;
END;
$_$;


--
-- Name: purge_completed_tasks(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_completed_tasks(p_org uuid, p_days integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    deleted_count INTEGER;
    task_rec RECORD;
BEGIN
    deleted_count := 0;
    
    FOR task_rec IN
        SELECT id
        FROM public.tasks
        WHERE org_id = p_org
        AND status = 'completed'
        AND completed_at < NOW() - (p_days || ' days')::interval
    LOOP
        PERFORM public.delete_task_full(task_rec.id, p_org);
        deleted_count := deleted_count + 1;
    END LOOP;

    RETURN deleted_count;
END;
$$;


--
-- Name: record_knowledge_usage(text, uuid, uuid, numeric, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_knowledge_usage(p_event_type text, p_org_id uuid DEFAULT NULL::uuid, p_knowledge_id uuid DEFAULT NULL::uuid, p_estimated_minutes numeric DEFAULT NULL::numeric, p_actor_id uuid DEFAULT NULL::uuid, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_id UUID;
  v_minutes NUMERIC;
BEGIN
  IF p_event_type NOT IN ('reused', 'question_answered', 'automation_created', 'time_saved') THEN
    RAISE EXCEPTION 'invalid_usage_event_type';
  END IF;

  v_minutes := COALESCE(p_estimated_minutes, public.knowledge_metric_default_minutes(p_event_type));

  INSERT INTO public.knowledge_usage_events (
    org_id, knowledge_id, event_type, estimated_minutes, actor_id, metadata
  ) VALUES (
    p_org_id, p_knowledge_id, p_event_type, v_minutes, p_actor_id, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  -- Parallel time_saved rollup only when minutes > 0 (callers may pass 0 to count without double-counting value)
  IF p_event_type IN ('reused', 'question_answered', 'automation_created') AND v_minutes > 0 THEN
    INSERT INTO public.knowledge_usage_events (
      org_id, knowledge_id, event_type, estimated_minutes, actor_id, metadata
    ) VALUES (
      p_org_id, p_knowledge_id, 'time_saved', v_minutes, p_actor_id,
      COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('from_event', p_event_type)
    );
  END IF;

  RETURN v_id;
END;
$$;


--
-- Name: record_messaging_usage(uuid, text, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_messaging_usage(p_org_id uuid, p_channel text, p_units integer DEFAULT 1, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: record_task_audit(uuid, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_task_audit(p_org_id uuid, p_task_id uuid, p_action text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_org_id IS NULL OR p_task_id IS NULL OR p_action IS NULL OR btrim(p_action) = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    p_org_id,
    auth.uid(),
    'task',
    p_task_id,
    p_action,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;


--
-- Name: refresh_onboarding_education_for_property(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_onboarding_education_for_property(p_property_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM clear_onboarding_demo_for_property(p_property_id);
  PERFORM seed_onboarding_demo_for_property(p_property_id);
END;
$$;


--
-- Name: org_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_usage (
    org_id uuid NOT NULL,
    storage_used_bytes bigint DEFAULT 0 NOT NULL,
    property_count integer DEFAULT 0 NOT NULL,
    staff_count integer DEFAULT 0 NOT NULL,
    compliance_docs_count integer DEFAULT 0 NOT NULL,
    metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_updated timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refresh_org_usage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_org_usage(p_org_id uuid) RETURNS public.org_usage
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: replace_property_image(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_property_image(p_property_id uuid, p_new_storage_path text, p_new_thumbnail_path text, p_annotation_summary text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_next_version INTEGER;
  v_new_version_id UUID;
  v_current_version_id UUID;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: User must be authenticated';
  END IF;
  
  -- Get property org_id
  SELECT org_id INTO v_org_id
  FROM properties
  WHERE id = p_property_id;
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Property not found: %', p_property_id;
  END IF;
  
  -- Check user is member of org
  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = v_org_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access Denied: User is not a member of this organisation';
  END IF;
  
  -- Get current active version (not archived)
  SELECT id INTO v_current_version_id
  FROM property_image_versions
  WHERE property_id = p_property_id
    AND is_archived = false
  ORDER BY version_number DESC
  LIMIT 1;
  
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
  FROM property_image_versions
  WHERE property_id = p_property_id;
  
  -- Archive current version if exists
  IF v_current_version_id IS NOT NULL THEN
    UPDATE property_image_versions
    SET is_archived = true
    WHERE id = v_current_version_id;
  END IF;
  
  -- Create new version
  INSERT INTO property_image_versions (
    property_id,
    version_number,
    storage_path,
    thumbnail_path,
    annotation_summary,
    is_original,
    is_archived,
    created_by
  ) VALUES (
    p_property_id,
    v_next_version,
    p_new_storage_path,
    p_new_thumbnail_path,
    p_annotation_summary,
    v_current_version_id IS NULL, -- First version is original
    false,
    v_user_id
  )
  RETURNING id INTO v_new_version_id;
  
  -- Update property thumbnail_url
  UPDATE properties
  SET thumbnail_url = p_new_thumbnail_path
  WHERE id = p_property_id;
  
  -- Log the action
  INSERT INTO property_image_actions (
    property_id,
    image_version_id,
    action_type,
    user_id,
    metadata
  ) VALUES (
    p_property_id,
    v_new_version_id,
    CASE WHEN v_current_version_id IS NOT NULL THEN 'replace' ELSE 'upload' END,
    v_user_id,
    jsonb_build_object(
      'version_number', v_next_version,
      'storage_path', p_new_storage_path,
      'thumbnail_path', p_new_thumbnail_path,
      'previous_version_id', v_current_version_id,
      'annotation_summary', p_annotation_summary
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'version_id', v_new_version_id,
    'version_number', v_next_version
  );
END;
$$;


--
-- Name: resolve_org_by_intake_email_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_org_by_intake_email_token(p_token text) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT org_id
  FROM org_settings
  WHERE intake_email_token = p_token
  LIMIT 1;
$$;


--
-- Name: restore_task(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.restore_task(p_task_id uuid, p_org uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    UPDATE public.tasks
    SET status = 'pending',
        updated_at = NOW()
    WHERE id = p_task_id AND org_id = p_org;
END;
$$;


--
-- Name: revoke_invitation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_invitation(p_invitation_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_org_id uuid;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT org_id INTO v_org_id FROM public.invitations WHERE id = p_invitation_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE org_id = v_org_id
      AND user_id = v_actor
      AND COALESCE(membership_status, 'active') = 'active'
      AND lower(role) IN ('owner', 'manager')
  ) THEN
    RAISE EXCEPTION 'Only owners and managers can revoke invitations';
  END IF;

  UPDATE public.invitations
  SET status = 'revoked'
  WHERE id = p_invitation_id
    AND status = 'pending';
END;
$$;


--
-- Name: revoke_org_api_key(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_org_api_key(p_key_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: revoke_org_entitlement_override(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_org_entitlement_override(p_override_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: save_ai_extraction(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_ai_extraction(p_task uuid, p_data jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    org uuid;
BEGIN
    SELECT org_id INTO org FROM public.tasks WHERE id = p_task;

    INSERT INTO public.ai_extraction_history (org_id, task_id, payload)
    VALUES (org, p_task, p_data);

    UPDATE public.tasks SET metadata = jsonb_set(COALESCE(metadata,'{}'), '{ai}', p_data)
    WHERE id = p_task;
END;
$$;


--
-- Name: seed_onboarding_demo_for_property(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_onboarding_demo_for_property(p_property_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_org_id UUID;
  v_anchor TIMESTAMPTZ := now();
  v_kitchen_id UUID;
  v_boiler_room_id UUID;
  v_plant_room_id UUID;
  v_archive_id UUID;
  v_first_aid_id UUID;
  v_electrical_id UUID;
  v_rule_id UUID;
  v_doc_fire_ext UUID;
  v_doc_gas UUID;
  v_attachment_id UUID;
  v_has_due_date boolean;
  v_has_due_at boolean;
  v_has_image_url boolean;
  v_has_notes boolean;
  v_task_id UUID;
BEGIN
  SET LOCAL row_security = off;

  SELECT org_id INTO v_org_id FROM properties WHERE id = p_property_id;
  IF v_org_id IS NULL THEN RETURN; END IF;

  PERFORM seed_property_defaults(p_property_id, v_org_id);

  IF EXISTS (
    SELECT 1 FROM tasks
    WHERE property_id = p_property_id
      AND title = 'Review Fire Extinguisher Certificate'
      AND description LIKE '%[onboarding_demo]%'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM tasks
    WHERE property_id = p_property_id AND title = 'Take a quick tour of your workspace'
  ) THEN
    PERFORM clear_onboarding_demo_for_property(p_property_id);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_date'
  ) INTO v_has_due_date;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_at'
  ) INTO v_has_due_at;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'image_url'
  ) INTO v_has_image_url;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'notes'
  ) INTO v_has_notes;

  BEGIN
  UPDATE properties
  SET thumbnail_url = '/spaces/mini-cards/lobby.png'
  WHERE id = p_property_id
    AND (thumbnail_url IS NULL OR btrim(thumbnail_url) = '' OR thumbnail_url LIKE '/onboarding/%');

  IF NOT EXISTS (SELECT 1 FROM spaces WHERE property_id = p_property_id AND lower(name) = 'kitchen') THEN
    INSERT INTO spaces (org_id, property_id, name) VALUES (v_org_id, p_property_id, 'Kitchen');
  END IF;

  SELECT id INTO v_kitchen_id FROM spaces WHERE property_id = p_property_id AND lower(name) = 'kitchen' LIMIT 1;

  INSERT INTO spaces (org_id, property_id, name)
  SELECT v_org_id, p_property_id, n FROM (VALUES
    ('Boiler Room'), ('Plant Room'), ('Archive Room'), ('First Aid Station'), ('Electrical Room')
  ) AS t(n)
  WHERE NOT EXISTS (
    SELECT 1 FROM spaces s WHERE s.property_id = p_property_id AND lower(s.name) = lower(t.n)
  );

  SELECT id INTO v_boiler_room_id FROM spaces WHERE property_id = p_property_id AND lower(name) = 'boiler room' LIMIT 1;
  SELECT id INTO v_plant_room_id FROM spaces WHERE property_id = p_property_id AND lower(name) = 'plant room' LIMIT 1;
  SELECT id INTO v_archive_id FROM spaces WHERE property_id = p_property_id AND lower(name) = 'archive room' LIMIT 1;
  SELECT id INTO v_first_aid_id FROM spaces WHERE property_id = p_property_id AND lower(name) = 'first aid station' LIMIT 1;
  SELECT id INTO v_electrical_id FROM spaces WHERE property_id = p_property_id AND lower(name) = 'electrical room' LIMIT 1;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name)
  VALUES (
    v_org_id, p_property_id,
    'Review Fire Extinguisher Certificate',
    'A certificate was uploaded but needs confirmation. Example — Filla tracks compliance from your documents. [onboarding_demo]',
    'waiting_review', 'urgent', 'shield-check'
  ) RETURNING id INTO v_task_id;
  IF v_has_due_at THEN UPDATE tasks SET due_at = v_anchor + interval '1 day' WHERE id = v_task_id;
  ELSIF v_has_due_date THEN UPDATE tasks SET due_date = v_anchor + interval '1 day' WHERE id = v_task_id;
  END IF;
  IF v_first_aid_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_spaces') THEN
    INSERT INTO task_spaces (task_id, space_id) VALUES (v_task_id, v_first_aid_id) ON CONFLICT DO NOTHING;
  END IF;
  IF v_has_image_url THEN UPDATE tasks SET image_url = '/spaces/mini-cards/first-aid.png' WHERE id = v_task_id; END IF;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name)
  VALUES (
    v_org_id, p_property_id, 'Boiler Service Due Soon',
    'Annual service due in 14 days. Example — Filla schedules maintenance from asset records. [onboarding_demo]',
    'open', 'high', 'flame'
  ) RETURNING id INTO v_task_id;
  IF v_has_due_at THEN UPDATE tasks SET due_at = v_anchor + interval '14 days' WHERE id = v_task_id;
  ELSIF v_has_due_date THEN UPDATE tasks SET due_date = v_anchor + interval '14 days' WHERE id = v_task_id;
  END IF;
  IF v_boiler_room_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_spaces') THEN
    INSERT INTO task_spaces (task_id, space_id) VALUES (v_task_id, v_boiler_room_id) ON CONFLICT DO NOTHING;
  END IF;
  IF v_has_image_url THEN UPDATE tasks SET image_url = '/spaces/mini-cards/boiler-room.png' WHERE id = v_task_id; END IF;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name)
  VALUES (
    v_org_id, p_property_id, 'Unknown Document Uploaded',
    'Filla could not identify a recently uploaded file. Example — review and categorise uploads. [onboarding_demo]',
    'waiting_review', 'medium', 'file-question'
  ) RETURNING id INTO v_task_id;
  IF v_has_due_at THEN UPDATE tasks SET due_at = v_anchor + interval '2 days' WHERE id = v_task_id;
  ELSIF v_has_due_date THEN UPDATE tasks SET due_date = v_anchor + interval '2 days' WHERE id = v_task_id;
  END IF;
  IF v_archive_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_spaces') THEN
    INSERT INTO task_spaces (task_id, space_id) VALUES (v_task_id, v_archive_id) ON CONFLICT DO NOTHING;
  END IF;
  IF v_has_image_url THEN UPDATE tasks SET image_url = '/spaces/mini-cards/archive-room.png' WHERE id = v_task_id; END IF;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name)
  VALUES
    (v_org_id, p_property_id, 'Label Your Spaces',
     'Add names to spaces such as Kitchen, Garage, and Hallway. Why: Helps organise tasks and records. [onboarding_demo]',
     'open', 'low', 'map-pin'),
    (v_org_id, p_property_id, 'Invite Your Team',
     'Add staff, family members, or contractors. Why: Assign work and share responsibility. [onboarding_demo]',
     'open', 'medium', 'users'),
    (v_org_id, p_property_id, 'Upload Property Documents',
     'Add warranties, certificates, manuals, and contracts. Why: Filla can organise and monitor them. [onboarding_demo]',
     'open', 'medium', 'file-up'),
    (v_org_id, p_property_id, 'Add Key Assets',
     'Record important equipment such as boilers, HVAC units, lifts, or vehicles. Why: Enables maintenance tracking. [onboarding_demo]',
     'open', 'low', 'wrench'),
    (v_org_id, p_property_id, 'Upload One Document',
     'Drag and drop any PDF or image to see how Filla organises records. [onboarding_demo]',
     'open', 'low', 'upload'),
    (v_org_id, p_property_id, 'Create Your First Task',
     'See how Filla organises work — try creating a task from the Add button. [onboarding_demo]',
     'open', 'low', 'plus-circle');

  IF v_has_due_at OR v_has_due_date THEN
    IF v_has_due_at THEN
      UPDATE tasks SET due_at = v_anchor + interval '5 days'
      WHERE property_id = p_property_id AND title = 'Label Your Spaces' AND description LIKE '%[onboarding_demo]%';
      UPDATE tasks SET due_at = v_anchor + interval '7 days'
      WHERE property_id = p_property_id AND title = 'Invite Your Team' AND description LIKE '%[onboarding_demo]%';
      UPDATE tasks SET due_at = v_anchor + interval '10 days'
      WHERE property_id = p_property_id AND title = 'Upload Property Documents' AND description LIKE '%[onboarding_demo]%';
      UPDATE tasks SET due_at = v_anchor + interval '14 days'
      WHERE property_id = p_property_id AND title = 'Add Key Assets' AND description LIKE '%[onboarding_demo]%';
    ELSE
      UPDATE tasks SET due_date = v_anchor + interval '5 days'
      WHERE property_id = p_property_id AND title = 'Label Your Spaces' AND description LIKE '%[onboarding_demo]%';
      UPDATE tasks SET due_date = v_anchor + interval '7 days'
      WHERE property_id = p_property_id AND title = 'Invite Your Team' AND description LIKE '%[onboarding_demo]%';
      UPDATE tasks SET due_date = v_anchor + interval '10 days'
      WHERE property_id = p_property_id AND title = 'Upload Property Documents' AND description LIKE '%[onboarding_demo]%';
      UPDATE tasks SET due_date = v_anchor + interval '14 days'
      WHERE property_id = p_property_id AND title = 'Add Key Assets' AND description LIKE '%[onboarding_demo]%';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM assets WHERE property_id = p_property_id AND name = 'Sample: boiler unit') THEN
    IF v_has_notes THEN
      INSERT INTO assets (org_id, property_id, space_id, name, asset_type, icon_name, condition_score, status, notes, metadata)
      VALUES (v_org_id, p_property_id, v_boiler_room_id, 'Sample: boiler unit', 'HVAC', 'flame', 88, 'active',
        'Example asset — swap for your plant register. [onboarding_demo]',
        '{"onboarding_demo": true, "placeholder_image_hint": "/spaces/mini-cards/boiler-room.png"}'::jsonb);
    ELSE
      INSERT INTO assets (org_id, property_id, space_id, name, asset_type, icon_name, condition_score, status, metadata)
      VALUES (v_org_id, p_property_id, v_boiler_room_id, 'Sample: boiler unit', 'HVAC', 'flame', 88, 'active',
        '{"onboarding_demo": true, "placeholder_image_hint": "/spaces/mini-cards/boiler-room.png"}'::jsonb);
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM assets WHERE property_id = p_property_id AND name = 'Sample: fire extinguisher') THEN
    IF v_has_notes THEN
      INSERT INTO assets (org_id, property_id, space_id, name, asset_type, icon_name, condition_score, status, notes, metadata)
      VALUES (v_org_id, p_property_id, v_first_aid_id, 'Sample: fire extinguisher', 'Safety', 'shield', 95, 'active',
        'Link compliance renewals to assets when you go live. [onboarding_demo]',
        '{"onboarding_demo": true, "placeholder_image_hint": "/spaces/mini-cards/first-aid.png"}'::jsonb);
    ELSE
      INSERT INTO assets (org_id, property_id, space_id, name, asset_type, icon_name, condition_score, status, metadata)
      VALUES (v_org_id, p_property_id, v_first_aid_id, 'Sample: fire extinguisher', 'Safety', 'shield', 95, 'active',
        '{"onboarding_demo": true, "placeholder_image_hint": "/spaces/mini-cards/first-aid.png"}'::jsonb);
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM assets WHERE property_id = p_property_id AND name = 'Sample: lift unit') THEN
    IF v_has_notes THEN
      INSERT INTO assets (org_id, property_id, space_id, name, asset_type, icon_name, condition_score, status, notes, metadata)
      VALUES (v_org_id, p_property_id, v_plant_room_id, 'Sample: lift unit', 'Lift', 'arrow-up-down', 90, 'active',
        'Example maintainable asset with service history. [onboarding_demo]',
        '{"onboarding_demo": true, "placeholder_image_hint": "/spaces/mini-cards/lift.png"}'::jsonb);
    ELSE
      INSERT INTO assets (org_id, property_id, space_id, name, asset_type, icon_name, condition_score, status, metadata)
      VALUES (v_org_id, p_property_id, v_plant_room_id, 'Sample: lift unit', 'Lift', 'arrow-up-down', 90, 'active',
        '{"onboarding_demo": true, "placeholder_image_hint": "/spaces/mini-cards/lift.png"}'::jsonb);
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_rules' AND column_name = 'auto_create'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'compliance_rules' AND column_name = 'property_id'
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM compliance_rules WHERE property_id = p_property_id AND name = 'Annual fire safety review (sample)'
      ) THEN
        INSERT INTO compliance_rules (
          org_id, property_id, name, description, frequency, scope_type, notify_days_before, next_due_date, auto_create
        ) VALUES (
          v_org_id, p_property_id, 'Annual fire safety review (sample)',
          'Example renewal cycle — replace with your building''s real programme. [onboarding_demo]',
          'annual', 'property', 30, (v_anchor::date + interval '90 days')::date, false
        ) RETURNING id INTO v_rule_id;
      END IF;
    END IF;
  END IF;

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name
  ) VALUES (
    v_org_id, p_property_id, 'Fire Extinguisher Certificate (sample)', 'Fire Safety Certificate', 'due_soon',
    '/spaces/mini-cards/first-aid.png',
    (v_anchor::date + interval '3 days')::date, (v_anchor::date + interval '3 days')::date,
    'annual', 'Example certificate awaiting your confirmation. [onboarding_demo]', 'shield-check'
  ) RETURNING id INTO v_doc_fire_ext;

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name
  ) VALUES (
    v_org_id, p_property_id, 'Building Insurance Policy (sample)', 'Insurance', 'valid',
    '/spaces/mini-cards/archive-room.png',
    (v_anchor::date + interval '200 days')::date, NULL,
    NULL, 'Suggested category: Insurance. Example record. [onboarding_demo]', 'file-text'
  );

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name
  ) VALUES (
    v_org_id, p_property_id, 'Emergency Lighting Report (sample)', 'Compliance', 'valid',
    '/spaces/mini-cards/electrical-room.png',
    (v_anchor::date + interval '120 days')::date, (v_anchor::date + interval '120 days')::date,
    'annual', 'Suggested category: Compliance. Example record. [onboarding_demo]', 'lightbulb'
  );

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name
  ) VALUES (
    v_org_id, p_property_id, 'Water System Inspection (sample)', 'Maintenance', 'valid',
    '/spaces/mini-cards/boiler-room.png',
    (v_anchor::date + interval '60 days')::date, (v_anchor::date + interval '60 days')::date,
    'annual', 'Suggested category: Maintenance. Example record. [onboarding_demo]', 'droplets'
  );

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name, rule_id
  ) VALUES (
    v_org_id, p_property_id, 'Gas Safety Certificate (sample)', 'Gas Safety Certificate', 'valid',
    '/spaces/mini-cards/kitchen.png',
    (v_anchor::date + interval '200 days')::date, (v_anchor::date + interval '200 days')::date,
    'annual', 'Sample valid record with placeholder preview. [onboarding_demo]', 'shield-check', v_rule_id
  ) RETURNING id INTO v_doc_gas;

  IF v_first_aid_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compliance_spaces') THEN
    IF v_doc_fire_ext IS NOT NULL THEN
      INSERT INTO compliance_spaces (org_id, compliance_document_id, space_id)
      VALUES (v_org_id, v_doc_fire_ext, v_first_aid_id) ON CONFLICT DO NOTHING;
    END IF;
    IF v_doc_gas IS NOT NULL THEN
      INSERT INTO compliance_spaces (org_id, compliance_document_id, space_id)
      VALUES (v_org_id, v_doc_gas, v_first_aid_id) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  IF v_doc_fire_ext IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compliance_recommendations') THEN
    INSERT INTO compliance_recommendations (
      org_id, compliance_document_id, property_id, risk_level, recommended_action, status, hazards
    ) VALUES (
      v_org_id, v_doc_fire_ext, p_property_id, 'medium',
      'Example: Fire safety certificate expires soon — confirm expiry date after upload. [onboarding_demo]',
      'pending', ARRAY['fire']::text[]
    ) ON CONFLICT (compliance_document_id) DO NOTHING;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'checklist_templates' AND column_name = 'items')
    AND NOT EXISTS (SELECT 1 FROM checklist_templates WHERE org_id = v_org_id AND name = 'Sample: property walkthrough')
  THEN
    INSERT INTO checklist_templates (org_id, name, category, items)
    VALUES (
      v_org_id, 'Sample: property walkthrough', 'operations',
      $ct$[
        {"id":"d1111111-1111-4111-8111-111111111111","title":"Check fire exits are clear","is_yes_no":true,"requires_signature":false},
        {"id":"d2222222-2222-4222-8222-222222222222","title":"Note any visible maintenance issues","is_yes_no":false,"requires_signature":false},
        {"id":"d3333333-3333-4333-8333-333333333333","title":"Photo of meter readings","is_yes_no":false,"requires_signature":false}
      ]$ct$::jsonb
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attachments')
    AND NOT EXISTS (
      SELECT 1 FROM attachments
      WHERE org_id = v_org_id AND parent_id = p_property_id AND title = 'Sample: building insurance schedule'
    )
  THEN
    INSERT INTO attachments (
      org_id, file_url, parent_type, parent_id, title, category, document_type, status, notes
    ) VALUES (
      v_org_id, '/spaces/mini-cards/archive-room.png', 'property', p_property_id,
      'Sample: building insurance schedule', 'Insurance', 'Insurance', 'valid',
      'Example property document — suggested category Insurance. [onboarding_demo]'
    ) RETURNING id INTO v_attachment_id;

    IF v_archive_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attachment_spaces') THEN
      INSERT INTO attachment_spaces (attachment_id, space_id, org_id)
      VALUES (v_attachment_id, v_archive_id, v_org_id) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'seed_onboarding_demo_for_property failed for %: %', p_property_id, SQLERRM;
  END;
END;
$_$;


--
-- Name: seed_property_defaults(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_property_defaults(p_property_id uuid, p_org_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  SET LOCAL row_security = off;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'property_details'
  ) THEN
    INSERT INTO property_details (property_id, org_id)
    VALUES (p_property_id, p_org_id)
    ON CONFLICT (property_id) DO NOTHING;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'themes'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'property_themes'
  ) THEN
    INSERT INTO themes (org_id, name, type, color, icon)
    SELECT p_org_id, v.name, v.type, v.color, v.icon
    FROM (VALUES
      ('Compliance', 'group', '#EB6834', 'shield-check'),
      ('Utilities', 'group', '#8EC9CE', 'zap'),
      ('Maintenance', 'group', '#4ECDC4', 'wrench'),
      ('Safety', 'group', '#FF6B6B', 'alert-triangle'),
      ('Assets', 'group', '#96CEB4', 'package')
    ) AS v(name, type, color, icon)
    WHERE NOT EXISTS (
      SELECT 1 FROM themes t
      WHERE t.org_id = p_org_id AND t.name = v.name AND t.type = v.type
    );

    INSERT INTO property_themes (property_id, theme_id)
    SELECT p_property_id, t.id
    FROM themes t
    WHERE t.org_id = p_org_id
      AND t.name IN ('Compliance', 'Utilities', 'Maintenance', 'Safety', 'Assets')
      AND t.type = 'group'
    ON CONFLICT (property_id, theme_id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM spaces WHERE property_id = p_property_id LIMIT 1) THEN
    INSERT INTO spaces (org_id, property_id, name)
    VALUES
      (p_org_id, p_property_id, 'Kitchen'),
      (p_org_id, p_property_id, 'Living Room'),
      (p_org_id, p_property_id, 'Bedroom'),
      (p_org_id, p_property_id, 'Bathroom'),
      (p_org_id, p_property_id, 'Exterior'),
      (p_org_id, p_property_id, 'Basement'),
      (p_org_id, p_property_id, 'Attic');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'seed_property_defaults failed for %: %', p_property_id, SQLERRM;
END;
$$;


--
-- Name: seed_property_plan_fixture(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_property_plan_fixture(p_property_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_org_id UUID;
  v_file_id UUID;
  v_run_id UUID;
  v_page_id UUID;
BEGIN
  SELECT p.org_id INTO v_org_id
  FROM properties p
  WHERE p.id = p_property_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  INSERT INTO property_plan_files (
    org_id, property_id, file_name, mime_type, storage_path, status, page_count
  )
  VALUES (
    v_org_id, p_property_id, 'sample-plan-ground-floor.pdf', 'application/pdf',
    format('orgs/%s/properties/%s/plans/sample-plan-ground-floor.pdf', v_org_id::text, p_property_id::text),
    'ready_for_review',
    1
  )
  RETURNING id INTO v_file_id;

  INSERT INTO property_plan_pages (
    org_id, plan_file_id, page_number, processing_status
  )
  VALUES (
    v_org_id, v_file_id, 1, 'extracted'
  )
  RETURNING id INTO v_page_id;

  INSERT INTO plan_extraction_runs (
    org_id, property_id, plan_file_id, model_name, run_type, status, raw_output, normalised_output
  )
  VALUES (
    v_org_id,
    p_property_id,
    v_file_id,
    'fixture-v1',
    'fixture',
    'completed',
    '{"note":"fixture"}'::jsonb,
    '{"note":"fixture"}'::jsonb
  )
  RETURNING id INTO v_run_id;

  INSERT INTO extracted_spaces (
    org_id, extraction_run_id, property_id, source_page_id, name, space_type, confidence
  ) VALUES
    (v_org_id, v_run_id, p_property_id, v_page_id, 'Main Stair', 'stairwell', 0.92),
    (v_org_id, v_run_id, p_property_id, v_page_id, 'Electrical Room', 'electrical_room', 0.88),
    (v_org_id, v_run_id, p_property_id, v_page_id, 'Boiler Room', 'plant_room', 0.87);

  INSERT INTO extracted_assets (
    org_id, extraction_run_id, property_id, source_page_id, name, asset_type, confidence
  ) VALUES
    (v_org_id, v_run_id, p_property_id, v_page_id, 'Main Electrical Panel', 'electrical_panel', 0.83),
    (v_org_id, v_run_id, p_property_id, v_page_id, 'Boiler Unit', 'boiler', 0.81);

  INSERT INTO extracted_compliance_elements (
    org_id, extraction_run_id, property_id, source_page_id, name, element_type, confidence
  ) VALUES
    (v_org_id, v_run_id, p_property_id, v_page_id, 'Fire Exit', 'exit', 0.9),
    (v_org_id, v_run_id, p_property_id, v_page_id, 'Emergency Signage', 'emergency_signage', 0.77);

  INSERT INTO extracted_task_suggestions (
    org_id, extraction_run_id, property_id, source_page_id, suggestion_type, title, rationale, confidence
  ) VALUES
    (v_org_id, v_run_id, p_property_id, v_page_id, 'fire_safety', 'Schedule fire safety inspection', 'Detected fire exit and safety elements.', 0.84),
    (v_org_id, v_run_id, p_property_id, v_page_id, 'electrical', 'Schedule electrical inspection', 'Detected electrical room and panel.', 0.82);

  RETURN v_run_id;
END;
$$;


--
-- Name: seed_staff_training_tasks(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_staff_training_tasks(p_org_id uuid, p_user_id uuid, p_property_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_anchor TIMESTAMPTZ := now();
  v_property_id UUID := p_property_id;
  v_kitchen_id UUID;
  v_has_due_date boolean;
  v_has_due_at boolean;
  v_has_assigned_user boolean;
  v_has_image_url boolean;
  v_role TEXT;
  v_task_id UUID;
BEGIN
  SET LOCAL row_security = off;

  IF EXISTS (
    SELECT 1 FROM tasks
    WHERE org_id = p_org_id AND assigned_user_id = p_user_id AND description LIKE '%[staff_training]%'
  ) THEN RETURN; END IF;

  SELECT role INTO v_role FROM organisation_members WHERE org_id = p_org_id AND user_id = p_user_id;
  IF v_role IN ('owner', 'manager') THEN RETURN; END IF;

  IF v_property_id IS NULL THEN
    SELECT p.id INTO v_property_id FROM properties p
    WHERE p.org_id = p_org_id ORDER BY p.created_at ASC LIMIT 1;
  END IF;
  IF v_property_id IS NULL THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_date'
  ) INTO v_has_due_date;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_at'
  ) INTO v_has_due_at;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'assigned_user_id'
  ) INTO v_has_assigned_user;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'image_url'
  ) INTO v_has_image_url;

  SELECT id INTO v_kitchen_id FROM spaces WHERE property_id = v_property_id AND lower(name) = 'kitchen' LIMIT 1;
  IF v_kitchen_id IS NULL THEN
    INSERT INTO spaces (org_id, property_id, name) VALUES (p_org_id, v_property_id, 'Kitchen') RETURNING id INTO v_kitchen_id;
  END IF;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name, assigned_user_id)
  VALUES (
    p_org_id, v_property_id, 'Learn Filla: Open your assigned work',
    'Find tasks assigned to you in My Work. This is where you execute day-to-day jobs. [staff_training]',
    'open', 'medium', 'graduation-cap',
    CASE WHEN v_has_assigned_user THEN p_user_id ELSE NULL END
  ) RETURNING id INTO v_task_id;
  IF v_has_due_at THEN UPDATE tasks SET due_at = v_anchor WHERE id = v_task_id;
  ELSIF v_has_due_date THEN UPDATE tasks SET due_date = v_anchor WHERE id = v_task_id; END IF;
  IF v_kitchen_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_spaces') THEN
    INSERT INTO task_spaces (task_id, space_id) VALUES (v_task_id, v_kitchen_id) ON CONFLICT DO NOTHING;
  END IF;
  IF v_has_image_url THEN UPDATE tasks SET image_url = '/spaces/mini-cards/kitchen.png' WHERE id = v_task_id; END IF;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name, assigned_user_id)
  VALUES (
    p_org_id, v_property_id, 'Learn Filla: Complete a checklist step',
    'Open a task and tick one checklist item — checklists guide consistent work on site. [staff_training]',
    'open', 'low', 'graduation-cap',
    CASE WHEN v_has_assigned_user THEN p_user_id ELSE NULL END
  ) RETURNING id INTO v_task_id;
  IF v_has_due_at THEN UPDATE tasks SET due_at = v_anchor + interval '1 day' WHERE id = v_task_id;
  ELSIF v_has_due_date THEN UPDATE tasks SET due_date = v_anchor + interval '1 day' WHERE id = v_task_id; END IF;
  IF v_has_image_url THEN UPDATE tasks SET image_url = '/spaces/mini-cards/office.png' WHERE id = v_task_id; END IF;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name, assigned_user_id)
  VALUES (
    p_org_id, v_property_id, 'Learn Filla: Add photo evidence',
    'Attach a photo to a task — evidence creates an audit trail for managers. [staff_training]',
    'open', 'medium', 'graduation-cap',
    CASE WHEN v_has_assigned_user THEN p_user_id ELSE NULL END
  ) RETURNING id INTO v_task_id;
  IF v_has_due_at THEN UPDATE tasks SET due_at = v_anchor + interval '2 days' WHERE id = v_task_id;
  ELSIF v_has_due_date THEN UPDATE tasks SET due_date = v_anchor + interval '2 days' WHERE id = v_task_id; END IF;
  IF v_has_image_url THEN UPDATE tasks SET image_url = '/spaces/mini-cards/bathroom.png' WHERE id = v_task_id; END IF;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name, assigned_user_id)
  VALUES (
    p_org_id, v_property_id, 'Learn Filla: Mark a task complete',
    'Complete this training task to see how progress updates for your team. [staff_training]',
    'open', 'low', 'graduation-cap',
    CASE WHEN v_has_assigned_user THEN p_user_id ELSE NULL END
  ) RETURNING id INTO v_task_id;
  IF v_has_due_at THEN UPDATE tasks SET due_at = v_anchor + interval '3 days' WHERE id = v_task_id;
  ELSIF v_has_due_date THEN UPDATE tasks SET due_date = v_anchor + interval '3 days' WHERE id = v_task_id; END IF;
  IF v_has_image_url THEN UPDATE tasks SET image_url = '/spaces/mini-cards/garden.png' WHERE id = v_task_id; END IF;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name, assigned_user_id)
  VALUES (
    p_org_id, v_property_id, 'Learn Filla: Report something on site',
    'Use Report issue to capture photos, location, and priority when something needs attention. [staff_training]',
    'open', 'medium', 'graduation-cap',
    CASE WHEN v_has_assigned_user THEN p_user_id ELSE NULL END
  ) RETURNING id INTO v_task_id;
  IF v_has_due_at THEN UPDATE tasks SET due_at = v_anchor + interval '5 days' WHERE id = v_task_id;
  ELSIF v_has_due_date THEN UPDATE tasks SET due_date = v_anchor + interval '5 days' WHERE id = v_task_id; END IF;
  IF v_has_image_url THEN UPDATE tasks SET image_url = '/spaces/mini-cards/workshop.png' WHERE id = v_task_id; END IF;
END;
$$;


--
-- Name: select_active_properties_for_limit(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.select_active_properties_for_limit(p_org_id uuid, p_keep_property_ids uuid[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: set_compliance_rules_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_compliance_rules_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: set_knowledge_status(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_knowledge_status(p_knowledge_id uuid, p_status text, p_org_id uuid DEFAULT NULL::uuid) RETURNS public.knowledge
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row public.knowledge;
  v_min INT := public.brain_min_cohort();
BEGIN
  IF p_status NOT IN ('candidate', 'verified', 'published', 'stale', 'archived') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT * INTO v_row FROM public.knowledge WHERE id = p_knowledge_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'knowledge_not_found';
  END IF;

  IF v_row.scope = 'organisation' THEN
    IF p_org_id IS NULL OR v_row.org_id <> p_org_id THEN
      RAISE EXCEPTION 'org_mismatch';
    END IF;
    IF NOT public.is_org_owner_or_manager(v_row.org_id) THEN
      RAISE EXCEPTION 'not_org_manager';
    END IF;
  ELSIF v_row.scope = 'platform' THEN
    IF NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'not_platform_admin';
    END IF;
  END IF;

  IF p_status = 'published' THEN
    IF v_row.source_kind = 'community_brain'
       AND (v_row.cohort_size IS NULL OR v_row.cohort_size < v_min) THEN
      RAISE EXCEPTION 'cohort_below_minimum' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  UPDATE public.knowledge
  SET
    status = p_status,
    reviewed_by = auth.uid(),
    published_at = CASE WHEN p_status = 'published' THEN COALESCE(published_at, now()) ELSE published_at END,
    updated_at = now()
  WHERE id = p_knowledge_id
  RETURNING * INTO v_row;

  INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
  VALUES (
    v_row.id,
    v_row.org_id,
    CASE
      WHEN p_status = 'published' THEN 'publish'
      WHEN p_status = 'archived' THEN 'archive'
      WHEN p_status = 'stale' THEN 'stale'
      WHEN p_status = 'verified' THEN 'human_approve'
      ELSE 'human_edit'
    END,
    auth.uid(),
    jsonb_build_object('status', p_status)
  );

  RETURN v_row;
END;
$$;


--
-- Name: set_org_entitlement_override(uuid, text, jsonb, text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_org_entitlement_override(p_org_id uuid, p_entitlement_key text, p_value jsonb, p_reason text, p_effective_until timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: set_row_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_row_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: set_subtask_org_from_task(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_subtask_org_from_task() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
  -- Auto-inherit org_id from parent task if not provided
  IF NEW.org_id IS NULL THEN
    SELECT t.org_id
    INTO NEW.org_id
    FROM public.tasks AS t
    WHERE t.id = NEW.task_id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: subtask_sign(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.subtask_sign(subtask uuid, user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    UPDATE public.subtasks
    SET signed_by = user_id,
        signed_at = NOW()
    WHERE id = subtask;
END;
$$;


--
-- Name: subtask_unsign(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.subtask_unsign(subtask uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    UPDATE public.subtasks
    SET signed_by = NULL,
        signed_at = NULL
    WHERE id = subtask;
END;
$$;


--
-- Name: subtasks_activity_audit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.subtasks_activity_audit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_org_id uuid;
  v_task_id uuid;
  v_item_num int;
  v_summary text;
  v_title text;
  v_archived_old boolean;
  v_archived_new boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_task_id := OLD.task_id;
    v_org_id := OLD.org_id;
    v_title := COALESCE(NULLIF(btrim(OLD.title), ''), 'Untitled step');
    PERFORM public.record_task_audit(
      v_org_id,
      v_task_id,
      'task.checklist_item_removed',
      jsonb_build_object(
        'summary', format('Checklist item removed (%s)', left(v_title, 60)),
        'field', 'checklist',
        'subtask_id', OLD.id,
        'title', OLD.title
      )
    );
    RETURN OLD;
  END IF;

  v_task_id := NEW.task_id;
  v_org_id := NEW.org_id;
  v_title := COALESCE(NULLIF(btrim(NEW.title), ''), 'Untitled step');

  IF TG_OP = 'INSERT' THEN
    -- Skip checklist rows inserted as part of initial task creation.
    IF EXISTS (
      SELECT 1
        FROM public.tasks t
       WHERE t.id = NEW.task_id
         AND t.created_at > (now() - interval '10 seconds')
         AND NOT EXISTS (
           SELECT 1
             FROM public.audit_logs al
            WHERE al.entity_type = 'task'
              AND al.entity_id = NEW.task_id
              AND al.action NOT LIKE 'task.checklist%'
         )
    ) THEN
      RETURN NEW;
    END IF;

    SELECT COUNT(*)::int
      INTO v_item_num
      FROM public.subtasks s
     WHERE s.task_id = NEW.task_id
       AND COALESCE(s.is_archived, false) = false;

    v_summary := format('Checklist item #%s added', v_item_num);
    IF NEW.title IS NOT NULL AND btrim(NEW.title) <> '' THEN
      v_summary := v_summary || format(' (%s)', left(btrim(NEW.title), 40));
    END IF;

    PERFORM public.record_task_audit(
      v_org_id,
      v_task_id,
      'task.checklist_item_added',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'checklist',
        'item_index', v_item_num,
        'subtask_id', NEW.id,
        'title', NEW.title,
        'step_type', NEW.step_type
      )
    );
    RETURN NEW;
  END IF;

  -- UPDATE
  v_archived_old := COALESCE(OLD.is_archived, false);
  v_archived_new := COALESCE(NEW.is_archived, false);

  IF v_archived_old IS DISTINCT FROM v_archived_new AND v_archived_new = true THEN
    SELECT COUNT(*)::int
      INTO v_item_num
      FROM public.subtasks s
     WHERE s.task_id = NEW.task_id
       AND s.id <> NEW.id
       AND COALESCE(s.is_archived, false) = false;

    -- Approximate former position as remaining + 1
    v_item_num := v_item_num + 1;
    v_summary := format('Checklist item #%s removed', v_item_num);
    IF OLD.title IS NOT NULL AND btrim(OLD.title) <> '' THEN
      v_summary := v_summary || format(' (%s)', left(btrim(OLD.title), 40));
    END IF;

    PERFORM public.record_task_audit(
      v_org_id,
      v_task_id,
      'task.checklist_item_removed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'checklist',
        'subtask_id', NEW.id,
        'title', OLD.title
      )
    );
    RETURN NEW;
  END IF;

  -- Ignore pure geo / metadata enrichment patches after completion.
  IF COALESCE(NEW.is_completed, false) IS DISTINCT FROM COALESCE(OLD.is_completed, false)
     AND COALESCE(NEW.is_completed, false) = true THEN
    v_summary := format('Checklist item completed (%s)', left(v_title, 60));
    PERFORM public.record_task_audit(
      v_org_id,
      v_task_id,
      'task.checklist_item_completed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'checklist',
        'subtask_id', NEW.id,
        'title', NEW.title,
        'step_type', NEW.step_type,
        'response_value', NEW.response_value
      )
    );
  ELSIF NEW.title IS DISTINCT FROM OLD.title THEN
    v_summary := format('Checklist item renamed to %s', left(v_title, 60));
    PERFORM public.record_task_audit(
      v_org_id,
      v_task_id,
      'task.checklist_item_renamed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'checklist',
        'subtask_id', NEW.id,
        'previous', OLD.title,
        'next', NEW.title
      )
    );
  ELSIF NEW.step_type IS DISTINCT FROM OLD.step_type THEN
    v_summary := format(
      'Checklist item type changed to %s',
      replace(COALESCE(NEW.step_type, 'check'), '_', ' ')
    );
    PERFORM public.record_task_audit(
      v_org_id,
      v_task_id,
      'task.checklist_item_type_changed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'checklist',
        'subtask_id', NEW.id,
        'previous', OLD.step_type,
        'next', NEW.step_type
      )
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: task_activity_on_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.task_activity_on_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    INSERT INTO public.task_activity(org_id, task_id, activity_type, body, created_by)
    VALUES (
        NEW.org_id,
        NEW.id,
        'created',
        NEW.title,
        NEW.owner_user_id
    );
    RETURN NEW;
END;
$$;


--
-- Name: task_activity_on_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.task_activity_on_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    IF NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id THEN
        INSERT INTO public.task_activity(org_id, task_id, activity_type, body, metadata)
        VALUES (
            NEW.org_id,
            NEW.id,
            'assigned',
            'Task assigned',
            jsonb_build_object('user_id', NEW.assigned_user_id)
        );
    END IF;

    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
        INSERT INTO public.task_activity(org_id, task_id, activity_type, body)
        VALUES (
            NEW.org_id,
            NEW.id,
            'priority_changed',
            NEW.priority
        );
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO public.task_activity(org_id, task_id, activity_type, body)
        VALUES (
            NEW.org_id,
            NEW.id,
            'status_changed',
            NEW.status
        );
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: task_ai_confidence(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.task_ai_confidence(task_id uuid) RETURNS numeric
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE c NUMERIC;
BEGIN
    SELECT (metadata->'ai'->>'confidence')::numeric INTO c FROM public.tasks WHERE id = task_id;
    RETURN c;
END;
$$;


--
-- Name: task_get_ai_metadata(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.task_get_ai_metadata(task_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE ai JSONB;
BEGIN
    SELECT metadata->'ai' INTO ai FROM public.tasks WHERE id = task_id;
    RETURN ai;
END;
$$;


--
-- Name: task_get_repeat_rule(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.task_get_repeat_rule(task_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE r JSONB;
BEGIN
    SELECT metadata->'repeat' INTO r FROM public.tasks WHERE id = task_id;
    RETURN r;
END;
$$;


--
-- Name: task_next_due_date(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.task_next_due_date(task_id uuid) RETURNS timestamp with time zone
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE
    base TIMESTAMPTZ;
    rule JSONB;
    rtype TEXT;
BEGIN
    SELECT due_at, metadata->'repeat' INTO base, rule FROM public.tasks WHERE id = task_id;

    IF rule IS NULL THEN
        RETURN base;
    END IF;

    rtype := rule->>'type';

    IF rtype = 'daily' THEN
        RETURN base + INTERVAL '1 day';
    ELSIF rtype = 'weekly' THEN
        RETURN base + INTERVAL '1 week';
    ELSIF rtype = 'monthly' THEN
        RETURN base + INTERVAL '1 month';
    ELSE
        RETURN base;
    END IF;
END;
$$;


--
-- Name: task_set_ai_metadata(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.task_set_ai_metadata(task_id uuid, ai jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    UPDATE public.tasks
    SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{ai}',
        ai,
        true
    ),
    updated_at = NOW()
    WHERE id = task_id;
END;
$$;


--
-- Name: task_set_repeat_rule(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.task_set_repeat_rule(task_id uuid, rule jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    UPDATE public.tasks
    SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{repeat}',
        rule,
        true
    ),
    updated_at = NOW()
    WHERE id = task_id;
END;
$$;


--
-- Name: tasks_activity_audit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tasks_activity_audit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_summary text;
BEGIN
  -- Title
  IF NEW.title IS DISTINCT FROM OLD.title THEN
    v_summary := format(
      'Title changed to %s',
      CASE
        WHEN NEW.title IS NULL OR btrim(NEW.title) = '' THEN 'untitled'
        ELSE left(btrim(NEW.title), 80)
      END
    );
    PERFORM public.record_task_audit(
      NEW.org_id,
      NEW.id,
      'task.title_changed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'title',
        'previous', OLD.title,
        'next', NEW.title
      )
    );
  END IF;

  -- Description
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    v_summary := CASE
      WHEN NEW.description IS NULL OR btrim(NEW.description) = '' THEN 'Description cleared'
      ELSE 'Description updated'
    END;
    PERFORM public.record_task_audit(
      NEW.org_id,
      NEW.id,
      'task.description_changed',
      jsonb_build_object('summary', v_summary, 'field', 'description')
    );
  END IF;

  -- Due date (column is due_at)
  IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN
    v_summary := CASE
      WHEN NEW.due_at IS NULL THEN 'Due Date cleared'
      ELSE format('Due Date changed to %s', public._audit_day_label(NEW.due_at))
    END;
    PERFORM public.record_task_audit(
      NEW.org_id,
      NEW.id,
      'task.due_date_changed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'due_date',
        'previous', OLD.due_at,
        'next', NEW.due_at
      )
    );
  END IF;

  -- Status
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_summary := format(
      'Status changed to %s',
      replace(COALESCE(NEW.status::text, 'unknown'), '_', ' ')
    );
    PERFORM public.record_task_audit(
      NEW.org_id,
      NEW.id,
      'task.status_changed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'status',
        'previous', OLD.status,
        'next', NEW.status
      )
    );
  END IF;

  -- Priority
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    v_summary := CASE
      WHEN NEW.priority IS NULL OR btrim(NEW.priority) = '' THEN 'Priority cleared'
      ELSE format('Priority changed to %s', NEW.priority)
    END;
    PERFORM public.record_task_audit(
      NEW.org_id,
      NEW.id,
      'task.priority_changed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'priority',
        'previous', OLD.priority,
        'next', NEW.priority
      )
    );
  END IF;

  -- Assignee
  IF NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id THEN
    v_summary := CASE
      WHEN NEW.assigned_user_id IS NULL THEN 'Assignee cleared'
      ELSE 'Assignee changed'
    END;
    PERFORM public.record_task_audit(
      NEW.org_id,
      NEW.id,
      'task.assignment_changed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'assigned_user_id',
        'previous', OLD.assigned_user_id,
        'next', NEW.assigned_user_id
      )
    );
  END IF;

  -- Property
  IF NEW.property_id IS DISTINCT FROM OLD.property_id THEN
    v_summary := CASE
      WHEN NEW.property_id IS NULL THEN 'Property cleared'
      ELSE 'Property changed'
    END;
    PERFORM public.record_task_audit(
      NEW.org_id,
      NEW.id,
      'task.property_changed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'property_id',
        'previous', OLD.property_id,
        'next', NEW.property_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: tasks_set_owner_user_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tasks_set_owner_user_id() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.owner_user_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.owner_user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION tasks_set_owner_user_id(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.tasks_set_owner_user_id() IS 'Defaults tasks.owner_user_id to auth.uid() so card From/assigner meta works for every create path.';


--
-- Name: touch_knowledge_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_knowledge_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: transfer_primary_ownership(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.transfer_primary_ownership(p_org_id uuid, p_new_primary_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_new_member_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE org_id = p_org_id
      AND user_id = v_actor
      AND is_primary_owner = true
      AND COALESCE(membership_status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'Only the Primary Owner can transfer ownership';
  END IF;

  SELECT id INTO v_new_member_id
  FROM public.organisation_members
  WHERE org_id = p_org_id
    AND user_id = p_new_primary_user_id
    AND COALESCE(membership_status, 'active') = 'active';

  IF v_new_member_id IS NULL THEN
    RAISE EXCEPTION 'Target user is not an active member of this organisation';
  END IF;

  PERFORM set_config('app.allow_primary_owner_transfer', 'on', true);

  UPDATE public.organisation_members
  SET is_primary_owner = false
  WHERE org_id = p_org_id AND is_primary_owner = true;

  UPDATE public.organisation_members
  SET
    role = 'owner',
    is_primary_owner = true
  WHERE id = v_new_member_id;

  PERFORM set_config('app.allow_primary_owner_transfer', 'off', true);
END;
$$;


--
-- Name: trigger_seed_property_defaults(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_seed_property_defaults() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM seed_property_defaults(NEW.id, NEW.org_id);
  PERFORM seed_onboarding_demo_for_property(NEW.id);
  RETURN NEW;
END;
$$;


--
-- Name: unlock_checklist_template(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unlock_checklist_template(p_template uuid, p_org uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    UPDATE public.checklist_templates
    SET is_locked = FALSE
    WHERE id = p_template AND org_id = p_org;
END;
$$;


--
-- Name: update_checklist_template_items_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_checklist_template_items_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_intake_item_status(uuid, public.intake_item_status); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_intake_item_status(p_intake_item_id uuid, p_status public.intake_item_status) RETURNS public.intake_items
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row intake_items;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_status NOT IN ('confirmed', 'ignored') THEN
    RAISE EXCEPTION 'Only confirmed or ignored status allowed from client';
  END IF;

  SELECT * INTO v_row
  FROM intake_items
  WHERE id = p_intake_item_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Intake item not found';
  END IF;

  IF v_row.created_by <> auth.uid() THEN
    RAISE EXCEPTION 'Only the creator may update this intake item';
  END IF;

  IF v_row.status NOT IN ('ready', 'failed') THEN
    RAISE EXCEPTION 'Intake item is not in a reviewable state';
  END IF;

  UPDATE intake_items
  SET status = p_status
  WHERE id = p_intake_item_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


--
-- Name: update_org_compliance_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_org_compliance_summary(org uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
  UPDATE public.org_compliance_summary
  SET updated_at = now()
  WHERE org_id = org;

  RETURN;
END;
$$;


--
-- Name: update_property_geo(uuid, double precision, double precision, text, text, jsonb, double precision, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_property_geo(p_property_id uuid, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_place_id text DEFAULT NULL::text, p_address_formatted text DEFAULT NULL::text, p_address_components jsonb DEFAULT NULL::jsonb, p_geo_accuracy_m double precision DEFAULT NULL::double precision, p_address_validated boolean DEFAULT false) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_service_role BOOLEAN;
BEGIN
  v_is_service_role := COALESCE(auth.jwt() ->> 'role', '') = 'service_role';

  UPDATE properties
  SET
    latitude = COALESCE(p_latitude, latitude),
    longitude = COALESCE(p_longitude, longitude),
    place_id = COALESCE(p_place_id, place_id),
    address_formatted = COALESCE(p_address_formatted, address_formatted),
    address_components = COALESCE(p_address_components, address_components),
    geo_accuracy_m = COALESCE(p_geo_accuracy_m, geo_accuracy_m),
    geocoded_at = CASE WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN now() ELSE geocoded_at END,
    address_validated_at = CASE WHEN p_address_validated THEN now() ELSE address_validated_at END,
    updated_at = now()
  WHERE id = p_property_id
    AND (
      v_is_service_role
      OR org_id IN (
        SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
      )
    );

  RETURN FOUND;
END;
$$;


--
-- Name: update_property_thumbnail(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_property_thumbnail(p_property_id uuid, p_thumbnail_url text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_property_org_id UUID;
  v_membership_count INTEGER;
  v_updated_property JSON;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: User must be authenticated';
  END IF;
  
  -- Get the property's org_id (bypasses RLS due to SECURITY DEFINER)
  SELECT org_id INTO v_property_org_id
  FROM properties
  WHERE id = p_property_id;
  
  -- Check if property exists
  IF v_property_org_id IS NULL THEN
    RAISE EXCEPTION 'Property not found';
  END IF;
  
  -- Check if user is a member of the property's organisation
  -- This query bypasses RLS due to SECURITY DEFINER
  SELECT COUNT(*) INTO v_membership_count
  FROM organisation_members
  WHERE org_id = v_property_org_id
    AND user_id = v_user_id;
  
  -- If not a member, deny access
  IF v_membership_count = 0 THEN
    RAISE EXCEPTION 'Access Denied: User is not a member of this organisation';
  END IF;
  
  -- Update the property (bypasses RLS due to SECURITY DEFINER)
  UPDATE properties
  SET thumbnail_url = p_thumbnail_url,
      updated_at = NOW()
  WHERE id = p_property_id
  RETURNING json_build_object(
    'id', id,
    'org_id', org_id,
    'address', address,
    'nickname', nickname,
    'thumbnail_url', thumbnail_url,
    'updated_at', updated_at
  ) INTO v_updated_property;
  
  -- Return the updated property as JSON
  RETURN v_updated_property;
END;
$$;


--
-- Name: update_spaces_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_spaces_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_subtasks_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_subtasks_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_thread_ai_summary(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_thread_ai_summary(p_thread_id uuid, p_summary jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    org uuid;
BEGIN
    SELECT org_id INTO org FROM public.task_threads WHERE id = p_thread_id;
    
    INSERT INTO public.thread_messages (org_id, thread_id, task_id, sender_id, body, ai_summary)
    SELECT org_id, p_thread_id, task_id, NULL, 'AI Summary Updated', p_summary
    FROM public.task_threads
    WHERE id = p_thread_id;
END;
$$;


--
-- Name: update_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_timestamp_on_metadata_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_timestamp_on_metadata_change() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    IF NEW.metadata IS DISTINCT FROM OLD.metadata THEN
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: upsert_org_knowledge(uuid, text, text, text, text, jsonb, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_org_knowledge(p_org_id uuid, p_title text, p_summary text DEFAULT NULL::text, p_body text DEFAULT NULL::text, p_source_kind text DEFAULT 'org_upload'::text, p_content jsonb DEFAULT '{}'::jsonb, p_provenance jsonb DEFAULT '{}'::jsonb, p_id uuid DEFAULT NULL::uuid) RETURNS public.knowledge
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row public.knowledge;
BEGIN
  IF NOT public.is_org_owner_or_manager(p_org_id) THEN
    RAISE EXCEPTION 'not_org_manager';
  END IF;

  IF p_source_kind NOT IN ('org_upload', 'operational_discovery', 'filla_curated') THEN
    RAISE EXCEPTION 'invalid_source_kind_for_org';
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE public.knowledge
    SET
      title = p_title,
      summary = p_summary,
      body = p_body,
      content = COALESCE(p_content, '{}'::jsonb),
      provenance = COALESCE(p_provenance, provenance),
      updated_at = now()
    WHERE id = p_id
      AND scope = 'organisation'
      AND org_id = p_org_id
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
      RAISE EXCEPTION 'knowledge_not_found';
    END IF;

    INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
    VALUES (v_row.id, p_org_id, 'human_edit', auth.uid(), jsonb_build_object('title', p_title));

    RETURN v_row;
  END IF;

  INSERT INTO public.knowledge (
    scope, status, org_id, title, summary, body, content, source_kind, provenance, created_by
  ) VALUES (
    'organisation', 'candidate', p_org_id, p_title, p_summary, p_body,
    COALESCE(p_content, '{}'::jsonb), p_source_kind, COALESCE(p_provenance, '{}'::jsonb), auth.uid()
  )
  RETURNING * INTO v_row;

  INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
  VALUES (v_row.id, p_org_id, 'candidate_created', auth.uid(), jsonb_build_object('source_kind', p_source_kind));

  RETURN v_row;
END;
$$;


--
-- Name: org_retention_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_retention_settings (
    org_id uuid NOT NULL,
    policy text DEFAULT 'standard'::text NOT NULL,
    retention_days integer DEFAULT 365 NOT NULL,
    legal_hold boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT org_retention_settings_policy_check CHECK ((policy = ANY (ARRAY['standard'::text, 'extended'::text, 'custom'::text]))),
    CONSTRAINT org_retention_settings_retention_days_check CHECK (((retention_days >= 30) AND (retention_days <= 3650)))
);


--
-- Name: TABLE org_retention_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.org_retention_settings IS 'Org retention policy (Business). Aligns with @Docs/21 — no automatic hard-delete in Phase 6.';


--
-- Name: upsert_org_retention_settings(uuid, text, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_org_retention_settings(p_org_id uuid, p_policy text, p_retention_days integer, p_legal_hold boolean DEFAULT false) RETURNS public.org_retention_settings
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: org_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_subscriptions (
    org_id uuid NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    status text DEFAULT 'active'::text NOT NULL,
    current_period_end timestamp with time zone,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    plan_id text,
    seat_count integer,
    usage_limits jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    billing_state text DEFAULT 'active'::text NOT NULL,
    grace_ends_at timestamp with time zone,
    last_payment_failed_at timestamp with time zone,
    current_period_start timestamp with time zone,
    storage_addon_bytes bigint DEFAULT 0 NOT NULL,
    ai_addon_ops integer DEFAULT 0 NOT NULL,
    messaging_addon_units integer DEFAULT 0 NOT NULL,
    CONSTRAINT org_subscriptions_billing_state_check CHECK ((billing_state = ANY (ARRAY['active'::text, 'past_due'::text, 'grace'::text, 'expansion_locked'::text, 'canceled'::text])))
);


--
-- Name: COLUMN org_subscriptions.seat_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.org_subscriptions.seat_count IS 'Add-on coordinating seats beyond the plan pack (0 = no add-ons).';


--
-- Name: COLUMN org_subscriptions.billing_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.org_subscriptions.billing_state IS 'Canonical commercial state: active | past_due | grace | expansion_locked | canceled. Prefer get_org_billing_status() for effective state.';


--
-- Name: COLUMN org_subscriptions.grace_ends_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.org_subscriptions.grace_ends_at IS 'When set after payment failure, existing ops continue until this timestamp; then expansion locks.';


--
-- Name: COLUMN org_subscriptions.storage_addon_bytes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.org_subscriptions.storage_addon_bytes IS 'Purchased evidence storage pack bytes beyond plan evidence_bytes_allowance.';


--
-- Name: COLUMN org_subscriptions.ai_addon_ops; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.org_subscriptions.ai_addon_ops IS 'Purchased AI operation pack units beyond plan ai_ops_allowance.';


--
-- Name: COLUMN org_subscriptions.messaging_addon_units; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.org_subscriptions.messaging_addon_units IS 'Purchased premium messaging units (SMS/WhatsApp) beyond plan allowance.';


--
-- Name: upsert_org_subscription_from_billing(uuid, text, text, text, text, text, integer, boolean, timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone, bigint, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_org_subscription_from_billing(p_org_id uuid, p_plan_id text, p_status text, p_billing_state text, p_stripe_customer_id text DEFAULT NULL::text, p_stripe_subscription_id text DEFAULT NULL::text, p_seat_count integer DEFAULT NULL::integer, p_cancel_at_period_end boolean DEFAULT NULL::boolean, p_current_period_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_current_period_end timestamp with time zone DEFAULT NULL::timestamp with time zone, p_grace_ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_last_payment_failed_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_storage_addon_bytes bigint DEFAULT NULL::bigint, p_ai_addon_ops integer DEFAULT NULL::integer, p_messaging_addon_units integer DEFAULT NULL::integer) RETURNS public.org_subscriptions
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: user_org_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_org_ids() RETURNS uuid[]
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN (
    SELECT COALESCE(array_agg(org_id), ARRAY[]::UUID[])
    FROM organisation_members
    WHERE user_id = auth.uid()
  );
END;
$$;


--
-- Name: validate_space_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_space_ids() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.space_ids IS NOT NULL AND array_length(NEW.space_ids, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(NEW.space_ids) AS sid
      WHERE NOT EXISTS (
        SELECT 1 FROM public.spaces WHERE spaces.id = sid
      )
    ) THEN
      RAISE EXCEPTION 'Invalid space_ids: some spaces do not exist';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION validate_space_ids(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.validate_space_ids() IS 'Validates that all space_ids in tasks array reference existing spaces.';


--
-- Name: validate_task_payload(text, text, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_task_payload(p_title text, p_priority text, p_space_ids uuid[]) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
        RAISE EXCEPTION 'Task title cannot be empty';
    END IF;

    IF p_priority IS NOT NULL AND p_priority NOT IN ('low', 'medium', 'high', 'urgent') THEN
        RAISE EXCEPTION 'Invalid priority';
    END IF;

    IF p_space_ids IS NOT NULL AND array_length(p_space_ids, 1) > 20 THEN
        RAISE EXCEPTION 'Too many spaces linked to task';
    END IF;
END;
$$;


--
-- Name: activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    user_id uuid,
    entity_type text,
    entity_id uuid,
    action text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_extraction_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_extraction_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    task_id uuid,
    extracted_at timestamp with time zone DEFAULT now(),
    payload jsonb NOT NULL
);


--
-- Name: ai_extractions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_extractions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    task_id uuid,
    model_id uuid,
    extracted jsonb DEFAULT '{}'::jsonb,
    confidence numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    version text NOT NULL,
    provider text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_prompts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_prompts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    model_id uuid,
    prompt text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid,
    function_name text NOT NULL,
    model_used text NOT NULL,
    provider text NOT NULL,
    prompt_version text,
    input_tokens integer,
    output_tokens integer,
    cost_usd numeric(10,6),
    cost_units integer DEFAULT 1 NOT NULL,
    latency_ms integer,
    status text NOT NULL,
    error_message text,
    entity_type text,
    entity_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_requests_status_check CHECK ((status = ANY (ARRAY['success'::text, 'error'::text, 'timeout'::text, 'fallback'::text])))
);


--
-- Name: COLUMN ai_requests.cost_units; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_requests.cost_units IS 'Product-level AI cost units for this call (not USD).';


--
-- Name: ai_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    prompt_id uuid,
    response text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: asset_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    file_url text NOT NULL,
    file_type text,
    thumbnail_url text,
    uploaded_by uuid,
    uploaded_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE asset_files; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.asset_files IS 'File references for assets (manuals, certificates, photos). Storage objects live in task-images.';


--
-- Name: COLUMN asset_files.thumbnail_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_files.thumbnail_url IS 'URL to optimized thumbnail (WebP, ~200px) for list/card display.';


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    property_id uuid NOT NULL,
    space_id uuid,
    name text DEFAULT 'Unnamed Asset'::text NOT NULL,
    serial_number text,
    condition_score integer DEFAULT 100,
    asset_type text,
    category text,
    status text DEFAULT 'active'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    icon_name text,
    notes text
);


--
-- Name: COLUMN assets.icon_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.assets.icon_name IS 'Lucide icon name (kebab-case) for asset display.';


--
-- Name: properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.properties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    address text NOT NULL,
    nickname text,
    thumbnail_url text,
    icon_name text DEFAULT 'home'::text,
    icon_color_hex text DEFAULT '#334155'::text,
    health_score integer DEFAULT 100,
    units integer DEFAULT 1,
    org_id uuid,
    owner_name text,
    owner_email text,
    contact_name text,
    contact_email text,
    contact_phone text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_environmental_scan_at timestamp with time zone,
    is_archived boolean DEFAULT false NOT NULL
);


--
-- Name: spaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    property_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    parent_space_id uuid,
    icon text,
    created_by uuid,
    updated_by uuid,
    is_archived boolean DEFAULT false,
    archived_at timestamp with time zone,
    archived_by uuid,
    space_type_id uuid,
    icon_name text,
    thumbnail_url text
);


--
-- Name: COLUMN spaces.parent_space_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.spaces.parent_space_id IS 'Optional parent for nested spaces.';


--
-- Name: COLUMN spaces.icon; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.spaces.icon IS 'Icon used for chips and UI.';


--
-- Name: COLUMN spaces.icon_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.spaces.icon_name IS 'Lucide icon name (kebab-case) for space display.';


--
-- Name: COLUMN spaces.thumbnail_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.spaces.thumbnail_url IS 'Public path or URL for space identity thumbnail (typically /spaces/mini-cards/*.png).';


--
-- Name: assets_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.assets_view WITH (security_invoker='true') AS
 SELECT a.id,
    a.org_id,
    a.property_id,
    a.space_id,
    a.name,
    a.asset_type,
    a.category,
    a.serial_number,
    a.condition_score,
    a.status,
    a.metadata,
    a.created_at,
    a.updated_at,
    a.icon_name,
    p.nickname AS property_name,
    p.address AS property_address,
    s.name AS space_name,
    0 AS open_tasks_count
   FROM ((public.assets a
     LEFT JOIN public.properties p ON (((p.id = a.property_id) AND (p.org_id = a.org_id))))
     LEFT JOIN public.spaces s ON (((s.id = a.space_id) AND (s.org_id = a.org_id))));


--
-- Name: attachment_spaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachment_spaces (
    attachment_id uuid NOT NULL,
    space_id uuid NOT NULL,
    org_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    file_url text NOT NULL,
    parent_type text NOT NULL,
    parent_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    file_name text,
    file_type text,
    file_size bigint,
    thumbnail_url text,
    ocr_text text,
    metadata jsonb DEFAULT '{}'::jsonb,
    ai_confidence numeric,
    title text,
    category text,
    document_type text,
    expiry_date date,
    renewal_frequency text,
    status text,
    notes text,
    optimized_url text,
    annotation_json jsonb DEFAULT '[]'::jsonb,
    upload_status text DEFAULT 'complete'::text
);


--
-- Name: COLUMN attachments.optimized_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.attachments.optimized_url IS 'URL to optimized version (1200px max, WebP)';


--
-- Name: COLUMN attachments.annotation_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.attachments.annotation_json IS 'JSON array of annotations attached to this image';


--
-- Name: COLUMN attachments.upload_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.attachments.upload_status IS 'Upload status: pending, uploading, complete, failed';


--
-- Name: billing_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_events (
    id text NOT NULL,
    type text NOT NULL,
    org_id uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: checklist_template_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_template_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    template_id uuid NOT NULL,
    title text NOT NULL,
    is_yes_no boolean DEFAULT false,
    order_index integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    is_archived boolean DEFAULT false,
    archived_at timestamp with time zone,
    archived_by uuid,
    requires_signature boolean DEFAULT false
);


--
-- Name: TABLE checklist_template_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.checklist_template_items IS 'Individual items within a checklist template.';


--
-- Name: COLUMN checklist_template_items.is_yes_no; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.checklist_template_items.is_yes_no IS 'If true, this item is a Yes/No verification question.';


--
-- Name: checklist_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid,
    is_archived boolean DEFAULT false,
    archived_at timestamp with time zone,
    archived_by uuid,
    is_yes_no boolean DEFAULT false,
    icon text,
    is_locked boolean DEFAULT false,
    category text DEFAULT 'operations'::text NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT checklist_templates_category_check CHECK ((category = ANY (ARRAY['compliance'::text, 'maintenance'::text, 'security'::text, 'operations'::text])))
);


--
-- Name: TABLE checklist_templates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.checklist_templates IS 'Reusable checklist templates for task creation.';


--
-- Name: checklist_templates_with_items; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.checklist_templates_with_items WITH (security_invoker='true') AS
 SELECT t.id AS template_id,
    t.org_id,
    t.name AS template_name,
    ti.id AS item_id,
    ti.title AS item_title,
    ti.is_yes_no,
    ti.order_index
   FROM (public.checklist_templates t
     LEFT JOIN public.checklist_template_items ti ON ((ti.template_id = t.id)))
  WHERE (t.org_id = public.current_org_id())
  ORDER BY t.id, ti.order_index;


--
-- Name: compliance_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    rule_version_id uuid,
    property_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    recurrence_type text,
    recurrence_value integer,
    last_triggered_at timestamp with time zone,
    last_applied_at timestamp with time zone,
    next_due_at timestamp with time zone
);


--
-- Name: compliance_clauses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_clauses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    rule_id uuid,
    version_id uuid,
    text text NOT NULL,
    category text,
    confidence numeric,
    flagged boolean DEFAULT false,
    critic_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: compliance_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    expiry_date date,
    status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    property_id uuid,
    title text,
    next_due_date date,
    linked_asset_ids uuid[] DEFAULT '{}'::uuid[],
    document_type text,
    ai_confidence numeric,
    hazards text[] DEFAULT '{}'::text[],
    icon_name text,
    file_url text,
    frequency text,
    notes text,
    rule_id uuid
);


--
-- Name: COLUMN compliance_documents.icon_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compliance_documents.icon_name IS 'Lucide icon name (kebab-case). AI-suggested from document type.';


--
-- Name: compliance_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    property_id uuid,
    task_id uuid,
    rule_id uuid,
    event_type text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    occurred_at timestamp with time zone DEFAULT now(),
    title text,
    body text,
    severity text DEFAULT 'info'::text,
    due_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: compliance_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    source_id uuid,
    type text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT compliance_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'success'::text, 'error'::text]))),
    CONSTRAINT compliance_jobs_type_check CHECK ((type = ANY (ARRAY['extraction'::text, 'critic'::text])))
);


--
-- Name: compliance_occurrences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_occurrences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    rule_id uuid NOT NULL,
    asset_id uuid,
    due_date date NOT NULL,
    completed_at timestamp with time zone,
    task_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_occurrences_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'complete'::text, 'missed'::text])))
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    property_id uuid,
    title text NOT NULL,
    description text,
    status text,
    priority text,
    type text,
    source text DEFAULT 'manual'::text,
    due_at timestamp with time zone,
    completed_at timestamp with time zone,
    assigned_vendor_name text,
    assigned_user_id uuid,
    image_url text,
    org_id uuid,
    assigned_team_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    space_ids uuid[] DEFAULT '{}'::uuid[],
    is_compliance boolean DEFAULT false,
    compliance_level text,
    annotation_required boolean DEFAULT false,
    owner_user_id uuid,
    owner_team_id uuid,
    compliance_rule_id uuid,
    compliance_source_id uuid,
    compliance_event_id uuid,
    compliance_status text DEFAULT 'pending'::text,
    compliance_due_at timestamp with time zone,
    compliance_metadata jsonb DEFAULT '{}'::jsonb,
    milestones jsonb DEFAULT '[]'::jsonb,
    icon_name text,
    CONSTRAINT compliance_level_valid CHECK (((compliance_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])) OR (compliance_level IS NULL))),
    CONSTRAINT tasks_metadata_is_object CHECK ((jsonb_typeof(metadata) = 'object'::text)),
    CONSTRAINT tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'waiting_review'::text, 'completed'::text, 'archived'::text])))
);


--
-- Name: COLUMN tasks.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.metadata IS 'Flexible storage for AI suggestions, repeat rules, chips, and future metadata.';


--
-- Name: COLUMN tasks.space_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.space_ids IS 'Associates a task with one or more spaces. Parallel to property_id. Optional.';


--
-- Name: COLUMN tasks.is_compliance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.is_compliance IS 'Marks the task as a compliance-related task.';


--
-- Name: COLUMN tasks.compliance_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.compliance_level IS 'Severity or category of compliance requirement.';


--
-- Name: COLUMN tasks.annotation_required; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.annotation_required IS 'Indicates if image annotation is required for task completion.';


--
-- Name: COLUMN tasks.owner_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.owner_user_id IS 'User who owns this task (for direct ownership visibility).';


--
-- Name: COLUMN tasks.owner_team_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.owner_team_id IS 'Team that owns this task (for team-based visibility).';


--
-- Name: COLUMN tasks.icon_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.icon_name IS 'Lucide icon name (kebab-case) for task display.';


--
-- Name: compliance_org_health; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.compliance_org_health WITH (security_invoker='true') AS
 SELECT org_id,
    count(*) FILTER (WHERE (is_compliance = true)) AS total_tasks,
    count(*) FILTER (WHERE ((is_compliance = true) AND (due_at < now()) AND (status <> 'completed'::text))) AS critical_overdue,
    count(*) FILTER (WHERE ((is_compliance = true) AND (status = 'completed'::text))) AS completed,
    max(updated_at) AS last_update
   FROM public.tasks
  GROUP BY org_id;


--
-- Name: compliance_spaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_spaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    compliance_document_id uuid NOT NULL,
    space_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: compliance_portfolio_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.compliance_portfolio_view WITH (security_invoker='true') AS
 SELECT cd.id,
    cd.org_id,
    cd.property_id,
    p.nickname AS property_name,
    cd.title,
    cd.document_type,
    cd.expiry_date,
    cd.status,
    cd.next_due_date,
    cd.ai_confidence,
    cd.linked_asset_ids,
    cd.hazards,
    ( SELECT COALESCE(array_agg(cs.space_id), ARRAY[]::uuid[]) AS "coalesce"
           FROM public.compliance_spaces cs
          WHERE (cs.compliance_document_id = cd.id)) AS space_ids,
        CASE
            WHEN (COALESCE(cd.next_due_date, cd.expiry_date) IS NULL) THEN 'none'::text
            WHEN (COALESCE(cd.next_due_date, cd.expiry_date) < CURRENT_DATE) THEN 'expired'::text
            WHEN (COALESCE(cd.next_due_date, cd.expiry_date) <= (CURRENT_DATE + '30 days'::interval)) THEN 'expiring'::text
            ELSE 'valid'::text
        END AS expiry_state
   FROM (public.compliance_documents cd
     LEFT JOIN public.properties p ON ((cd.property_id = p.id)));


--
-- Name: compliance_property_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.compliance_property_summary WITH (security_invoker='true') AS
 SELECT p.id AS property_id,
    COALESCE(p.nickname, p.address) AS property_name,
    p.org_id,
    count(*) FILTER (WHERE (t.is_compliance = true)) AS total,
    count(*) FILTER (WHERE ((t.is_compliance = true) AND (t.status = 'completed'::text))) AS completed,
    count(*) FILTER (WHERE ((t.is_compliance = true) AND (t.due_at < now()) AND (t.status <> 'completed'::text))) AS overdue,
    count(*) FILTER (WHERE ((t.is_compliance = true) AND ((t.due_at >= now()) AND (t.due_at <= (now() + '7 days'::interval))))) AS due_soon
   FROM (public.properties p
     LEFT JOIN public.tasks t ON ((t.property_id = p.id)))
  GROUP BY p.id, p.nickname, p.address, p.org_id;


--
-- Name: compliance_recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_recommendations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    compliance_document_id uuid NOT NULL,
    property_id uuid,
    asset_ids uuid[] DEFAULT '{}'::uuid[],
    space_ids uuid[] DEFAULT '{}'::uuid[],
    risk_level text DEFAULT 'medium'::text NOT NULL,
    recommended_action text NOT NULL,
    recommended_tasks jsonb DEFAULT '[]'::jsonb,
    hazards text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    CONSTRAINT compliance_recommendations_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT compliance_recommendations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'dismissed'::text])))
);


--
-- Name: compliance_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    rule_id uuid,
    status text DEFAULT 'pending_review'::text NOT NULL,
    reviewer_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT compliance_reviews_status_check CHECK ((status = ANY (ARRAY['pending_review'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: compliance_rule_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_rule_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_id uuid NOT NULL,
    org_id uuid,
    reviewer_id uuid,
    review_type public.compliance_review_type NOT NULL,
    verdict public.compliance_review_verdict NOT NULL,
    comments text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: compliance_rule_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_rule_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    rule_id uuid,
    version_number integer NOT NULL,
    approved_at timestamp with time zone,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: compliance_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    source_id uuid NOT NULL,
    country text NOT NULL,
    region_or_city text,
    domain public.compliance_domain NOT NULL,
    entity_type text,
    obligation_type public.compliance_obligation_type NOT NULL,
    obligation_text text NOT NULL,
    source_quote text NOT NULL,
    source_reference text,
    source_url text,
    effective_from date,
    last_updated date,
    ai_confidence integer,
    status public.compliance_rule_status DEFAULT 'extracted'::public.compliance_rule_status NOT NULL,
    ai_consensus boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT compliance_rules_ai_confidence_check CHECK (((ai_confidence >= 1) AND (ai_confidence <= 5)))
);


--
-- Name: compliance_schedule_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_schedule_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    property_id uuid,
    name text,
    description text,
    frequency text,
    scope_type text DEFAULT 'property'::text NOT NULL,
    scope_asset_type text,
    scope_ids jsonb,
    auto_create boolean DEFAULT false NOT NULL,
    template_config jsonb,
    notify_days_before integer DEFAULT 30 NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    last_completed_at timestamp with time zone,
    next_due_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: compliance_schedule_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.compliance_schedule_view WITH (security_invoker='true') AS
 SELECT co.id,
    cr.org_id,
    cr.property_id,
    cr.name AS title,
    cr.name AS certificate_name,
    cr.name AS document_type,
    (co.due_date)::text AS next_due_date,
    NULL::text AS expiry_date,
    (co.completed_at)::text AS last_completed_date,
    cr.frequency,
    co.status,
        CASE
            WHEN (co.due_date < CURRENT_DATE) THEN 'expired'::text
            WHEN (co.due_date < (CURRENT_DATE + 30)) THEN 'expiring'::text
            ELSE 'valid'::text
        END AS expiry_status,
    (co.due_date - CURRENT_DATE) AS days_until_expiry,
    co.task_id,
    cr.id AS rule_id,
    'rule'::text AS source_type,
    NULL::text AS file_url
   FROM (public.compliance_occurrences co
     JOIN public.compliance_schedule_rules cr ON ((cr.id = co.rule_id)))
  WHERE ((co.status = 'pending'::text) AND (cr.is_archived = false))
UNION ALL
 SELECT cd.id,
    cd.org_id,
    cd.property_id,
    cd.title,
    cd.title AS certificate_name,
    cd.document_type,
    (cd.next_due_date)::text AS next_due_date,
    (cd.expiry_date)::text AS expiry_date,
    NULL::text AS last_completed_date,
    cd.frequency,
    cd.status,
        CASE
            WHEN ((cd.expiry_date IS NOT NULL) AND (cd.expiry_date < CURRENT_DATE)) THEN 'expired'::text
            WHEN ((cd.expiry_date IS NOT NULL) AND (cd.expiry_date < (CURRENT_DATE + 30))) THEN 'expiring'::text
            ELSE 'valid'::text
        END AS expiry_status,
        CASE
            WHEN (cd.expiry_date IS NOT NULL) THEN (cd.expiry_date - CURRENT_DATE)
            ELSE NULL::integer
        END AS days_until_expiry,
    NULL::uuid AS task_id,
    cd.rule_id,
    'document'::text AS source_type,
    cd.file_url
   FROM public.compliance_documents cd
  WHERE ((cd.rule_id IS NULL) OR (cd.file_url IS NOT NULL));


--
-- Name: compliance_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    title text NOT NULL,
    source_type public.compliance_source_type DEFAULT 'url'::public.compliance_source_type NOT NULL,
    url_or_path text,
    jurisdiction_hint text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: compliance_upcoming; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.compliance_upcoming WITH (security_invoker='true') AS
 SELECT id,
    org_id,
    property_id,
    title,
    due_at,
    EXTRACT(day FROM (due_at - now())) AS days_until_due,
        CASE
            WHEN (due_at < now()) THEN 'overdue'::text
            WHEN (due_at < (now() + '3 days'::interval)) THEN 'urgent'::text
            WHEN (due_at < (now() + '7 days'::interval)) THEN 'soon'::text
            ELSE 'normal'::text
        END AS urgency
   FROM public.tasks t
  WHERE ((is_compliance = true) AND (status <> 'completed'::text));


--
-- Name: connected_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connected_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    provider public.connected_account_provider NOT NULL,
    provider_account_id text NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    status public.connected_account_status DEFAULT 'active'::public.connected_account_status NOT NULL,
    access_token_enc text,
    refresh_token_enc text,
    token_expires_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE connected_accounts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.connected_accounts IS 'Phase 2 OAuth shell: per-user provider connections for calendar and cloud pickers.';


--
-- Name: contractor_task_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contractor_task_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contractor_token text NOT NULL,
    task_id uuid NOT NULL,
    accessed_at timestamp with time zone DEFAULT now(),
    org_id uuid
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    property_id uuid,
    task_id uuid,
    channel text NOT NULL,
    subject text,
    external_ref text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT conversations_channel_check CHECK ((channel = ANY (ARRAY['app'::text, 'task'::text, 'property'::text, 'compliance'::text, 'contractor'::text, 'email'::text, 'whatsapp'::text, 'sms'::text, 'other'::text])))
);


--
-- Name: escalation_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escalation_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    rule_id uuid,
    signal_id uuid,
    task_id uuid,
    event jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: escalation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escalation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    trigger_type text NOT NULL,
    conditions jsonb NOT NULL,
    actions jsonb NOT NULL,
    enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: extracted_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extracted_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    extraction_run_id uuid NOT NULL,
    property_id uuid NOT NULL,
    source_page_id uuid,
    asset_type text,
    name text NOT NULL,
    confidence numeric DEFAULT 0 NOT NULL,
    raw_reference jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_accepted boolean DEFAULT false NOT NULL,
    edited_name text,
    edited_asset_type text,
    imported_asset_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: extracted_compliance_elements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extracted_compliance_elements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    extraction_run_id uuid NOT NULL,
    property_id uuid NOT NULL,
    source_page_id uuid,
    element_type text,
    name text NOT NULL,
    confidence numeric DEFAULT 0 NOT NULL,
    raw_reference jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_accepted boolean DEFAULT false NOT NULL,
    edited_name text,
    edited_element_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: extracted_spaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extracted_spaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    extraction_run_id uuid NOT NULL,
    property_id uuid NOT NULL,
    source_page_id uuid,
    name text NOT NULL,
    space_type text,
    confidence numeric DEFAULT 0 NOT NULL,
    raw_reference jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_accepted boolean DEFAULT false NOT NULL,
    edited_name text,
    edited_space_type text,
    imported_space_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    floor_label text,
    review_band text
);


--
-- Name: COLUMN extracted_spaces.floor_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.extracted_spaces.floor_label IS 'Floor assignment proposed or confirmed for this space suggestion.';


--
-- Name: COLUMN extracted_spaces.review_band; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.extracted_spaces.review_band IS 'UI band: reliable | needs_confirmation | incomplete.';


--
-- Name: extracted_task_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extracted_task_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    extraction_run_id uuid NOT NULL,
    property_id uuid NOT NULL,
    source_page_id uuid,
    suggestion_type text,
    title text NOT NULL,
    rationale text,
    confidence numeric DEFAULT 0 NOT NULL,
    is_accepted boolean DEFAULT false NOT NULL,
    imported_task_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid,
    space_id uuid,
    property_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_deleted boolean DEFAULT false,
    created_by uuid,
    updated_by uuid,
    archived_at timestamp with time zone,
    archived_by uuid,
    team_id uuid,
    CONSTRAINT one_member_type CHECK ((((((user_id IS NOT NULL))::integer + ((space_id IS NOT NULL))::integer) + ((property_id IS NOT NULL))::integer) = 1))
);


--
-- Name: TABLE group_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.group_members IS 'Polymorphic membership linking users, spaces, properties, or teams to groups.';


--
-- Name: CONSTRAINT one_member_type ON group_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT one_member_type ON public.group_members IS 'Ensures exactly one of user_id, space_id, or property_id is set per row.';


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    category text,
    icon text,
    image_url text,
    parent_group_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    is_archived boolean DEFAULT false,
    updated_by uuid,
    color text,
    display_order integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    archived_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    accent_color text,
    description text,
    display_name text,
    slug text,
    archived_by uuid
);


--
-- Name: TABLE groups; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.groups IS 'Hierarchical grouping system for chips, collections, and organization.';


--
-- Name: COLUMN groups.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.category IS 'Group type: team, space, mixed, etc.';


--
-- Name: COLUMN groups.parent_group_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.parent_group_id IS 'Self-referencing for nested group hierarchies.';


--
-- Name: icon_search_synonyms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.icon_search_synonyms (
    word text NOT NULL,
    expansion text[] NOT NULL
);


--
-- Name: invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    role text DEFAULT 'member'::text NOT NULL,
    invited_by uuid NOT NULL,
    token text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    accepted_at timestamp with time zone,
    property_ids uuid[],
    team_ids uuid[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: knowledge_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    knowledge_id uuid NOT NULL,
    source_type text NOT NULL,
    label text,
    url text,
    attachment_id uuid,
    external_ref text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_sources_source_type_check CHECK ((source_type = ANY (ARRAY['attachment'::text, 'url'::text, 'compliance_document'::text, 'intake_item'::text, 'brain_pattern'::text, 'message'::text, 'manual'::text, 'other'::text])))
);


--
-- Name: knowledge_usage_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_usage_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    knowledge_id uuid,
    event_type text NOT NULL,
    estimated_minutes numeric DEFAULT 0 NOT NULL,
    actor_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_usage_events_event_type_check CHECK ((event_type = ANY (ARRAY['reused'::text, 'question_answered'::text, 'automation_created'::text, 'time_saved'::text])))
);


--
-- Name: knowledge_verification_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_verification_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    knowledge_id uuid NOT NULL,
    org_id uuid,
    event_type text NOT NULL,
    actor_id uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_verification_events_event_type_check CHECK ((event_type = ANY (ARRAY['extractor'::text, 'critic'::text, 'human_approve'::text, 'human_reject'::text, 'human_edit'::text, 'publish'::text, 'stale'::text, 'archive'::text, 'candidate_created'::text])))
);


--
-- Name: labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.labels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    name text NOT NULL,
    color text,
    icon text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    author_user_id uuid,
    author_name text NOT NULL,
    author_role text,
    direction text NOT NULL,
    source text NOT NULL,
    body text NOT NULL,
    raw_payload jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT messages_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text]))),
    CONSTRAINT messages_source_check CHECK ((source = ANY (ARRAY['app'::text, 'web'::text, 'email'::text, 'whatsapp'::text, 'ai'::text, 'system'::text, 'other'::text, 'sms'::text])))
);


--
-- Name: messaging_usage_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messaging_usage_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    channel text NOT NULL,
    units integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'recorded'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT messaging_usage_events_channel_check CHECK ((channel = ANY (ARRAY['sms'::text, 'whatsapp'::text, 'voice'::text, 'transactional_email'::text]))),
    CONSTRAINT messaging_usage_events_status_check CHECK ((status = ANY (ARRAY['recorded'::text, 'sent'::text, 'failed'::text, 'blocked'::text]))),
    CONSTRAINT messaging_usage_events_units_check CHECK ((units > 0))
);


--
-- Name: notification_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid,
    type text NOT NULL,
    destination text NOT NULL,
    enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: org_api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    key_prefix text NOT NULL,
    key_hash text NOT NULL,
    created_by uuid,
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: org_compliance_summary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_compliance_summary (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    total_rules integer DEFAULT 0,
    compliant integer DEFAULT 0,
    non_compliant integer DEFAULT 0,
    pending integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: org_entitlement_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_entitlement_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    entitlement_key text NOT NULL,
    value jsonb NOT NULL,
    reason text NOT NULL,
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    effective_until timestamp with time zone,
    created_by uuid,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT org_entitlement_overrides_until_after_from CHECK (((effective_until IS NULL) OR (effective_until > effective_from)))
);


--
-- Name: TABLE org_entitlement_overrides; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.org_entitlement_overrides IS 'Time-bounded entitlement overrides (enterprise / support). Merged in get_org_entitlements; audited on write.';


--
-- Name: org_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_settings (
    org_id uuid NOT NULL,
    auto_schedule_compliance boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    auto_task_creation boolean DEFAULT false,
    auto_assignment boolean DEFAULT false,
    automation_aggressiveness text DEFAULT 'recommended'::text,
    automation_mode text DEFAULT 'recommended'::text,
    auto_task_generation boolean DEFAULT false,
    auto_task_levels text[],
    auto_assign_contractors boolean DEFAULT false,
    auto_assign_confidence numeric DEFAULT 0.8,
    auto_expiry_update boolean DEFAULT false,
    auto_expiry_confidence numeric DEFAULT 0.85,
    auto_link_assets boolean DEFAULT false,
    auto_link_asset_confidence numeric DEFAULT 0.75,
    auto_link_spaces boolean DEFAULT false,
    auto_link_space_confidence numeric DEFAULT 0.70,
    automated_intelligence text DEFAULT 'suggestions_only'::text,
    prediction_aggressiveness text DEFAULT 'recommended'::text,
    hazard_sensitivity text DEFAULT 'medium'::text,
    data_sharing_level text DEFAULT 'standard'::text,
    ai_icon_suggestions boolean DEFAULT true,
    ai_icon_override boolean DEFAULT false,
    ai_icon_mode text DEFAULT 'recommended'::text,
    ai_icon_prefer text DEFAULT 'global'::text,
    ai_icon_fallback text DEFAULT 'wrench'::text,
    intake_email_token text DEFAULT encode(extensions.gen_random_bytes(8), 'hex'::text)
);


--
-- Name: organisation_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organisation_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_properties uuid[] DEFAULT ARRAY[]::uuid[],
    is_primary_owner boolean DEFAULT false NOT NULL,
    membership_status text DEFAULT 'active'::text NOT NULL
);


--
-- Name: COLUMN organisation_members.is_primary_owner; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organisation_members.is_primary_owner IS 'Exactly one Primary Owner per org; controls transfer/delete/billing defaults.';


--
-- Name: COLUMN organisation_members.membership_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organisation_members.membership_status IS 'active | suspended — suspended members lose product access.';


--
-- Name: organisations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organisations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text,
    billing_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    org_type public.org_type DEFAULT 'business'::public.org_type NOT NULL,
    starter_templates_disclaimer_accepted_at timestamp with time zone
);


--
-- Name: COLUMN organisations.starter_templates_disclaimer_accepted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organisations.starter_templates_disclaimer_accepted_at IS 'When the org accepted the starter template disclaimer (Add to library).';


--
-- Name: plan_extraction_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_extraction_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    property_id uuid NOT NULL,
    plan_file_id uuid NOT NULL,
    model_name text,
    run_type text DEFAULT 'initial'::text NOT NULL,
    status public.plan_run_status DEFAULT 'queued'::public.plan_run_status NOT NULL,
    raw_output jsonb DEFAULT '{}'::jsonb NOT NULL,
    normalised_output jsonb DEFAULT '{}'::jsonb NOT NULL,
    error_message text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: properties_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.properties_view WITH (security_invoker='true') AS
 SELECT p.id,
    p.org_id,
    p.address,
    p.nickname,
    p.thumbnail_url,
    p.icon_name,
    p.icon_color_hex,
    p.owner_name,
    p.owner_email,
    p.contact_name,
    p.contact_email,
    p.contact_phone,
    p.created_at,
    p.updated_at,
    (COALESCE(count(DISTINCT t.id) FILTER (WHERE (t.status = ANY (ARRAY['open'::text, 'in_progress'::text]))), (0)::bigint))::integer AS open_tasks_count,
    (COALESCE(count(DISTINCT a.id), (0)::bigint))::integer AS assets_count,
    (COALESCE(count(DISTINCT cd.id) FILTER (WHERE (cd.expiry_date < CURRENT_DATE)), (0)::bigint))::integer AS expired_compliance_count,
    (COALESCE(count(DISTINCT cd.id) FILTER (WHERE ((cd.expiry_date >= CURRENT_DATE) OR (cd.expiry_date IS NULL))), (0)::bigint))::integer AS valid_compliance_count,
    (COALESCE(count(DISTINCT s.id), (0)::bigint))::integer AS spaces_count
   FROM ((((public.properties p
     LEFT JOIN public.tasks t ON (((t.property_id = p.id) AND (t.org_id = p.org_id))))
     LEFT JOIN public.assets a ON (((a.property_id = p.id) AND (a.org_id = p.org_id))))
     LEFT JOIN public.compliance_documents cd ON ((cd.org_id = p.org_id)))
     LEFT JOIN public.spaces s ON (((s.property_id = p.id) AND (s.org_id = p.org_id))))
  GROUP BY p.id, p.org_id, p.address, p.nickname, p.thumbnail_url, p.icon_name, p.icon_color_hex, p.owner_name, p.owner_email, p.contact_name, p.contact_email, p.contact_phone, p.created_at, p.updated_at;


--
-- Name: property_compliance_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_compliance_status (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    property_id uuid NOT NULL,
    rule_version_id uuid,
    status text NOT NULL,
    reason text,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT property_compliance_status_status_check CHECK ((status = ANY (ARRAY['compliant'::text, 'non_compliant'::text, 'pending'::text])))
);


--
-- Name: property_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_details (
    property_id uuid NOT NULL,
    org_id uuid NOT NULL,
    site_type public.site_type,
    ownership_type public.ownership_type,
    total_area_sqft integer,
    floor_count integer,
    listing_grade text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: property_image_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_image_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid NOT NULL,
    image_version_id uuid,
    action_type text NOT NULL,
    user_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: property_image_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_image_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid NOT NULL,
    version_number integer NOT NULL,
    storage_path text NOT NULL,
    thumbnail_path text,
    annotation_summary text,
    is_original boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    original_file_url text
);


--
-- Name: property_plan_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_plan_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    property_id uuid NOT NULL,
    uploaded_by uuid,
    file_name text NOT NULL,
    mime_type text,
    storage_path text NOT NULL,
    file_size bigint,
    page_count integer,
    status public.plan_file_status DEFAULT 'uploaded'::public.plan_file_status NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    building_label text,
    floor_label text,
    scale_known boolean,
    units text,
    setup_notes text
);


--
-- Name: COLUMN property_plan_files.building_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.property_plan_files.building_label IS 'User-confirmed building name for this plan sheet (setup assistant).';


--
-- Name: COLUMN property_plan_files.floor_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.property_plan_files.floor_label IS 'User-confirmed floor / level for this plan sheet (setup assistant).';


--
-- Name: property_plan_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_plan_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    plan_file_id uuid NOT NULL,
    page_number integer NOT NULL,
    image_storage_path text,
    thumbnail_storage_path text,
    width integer,
    height integer,
    processing_status public.plan_page_processing_status DEFAULT 'queued'::public.plan_page_processing_status NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: property_themes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_themes (
    property_id uuid NOT NULL,
    theme_id uuid NOT NULL
);


--
-- Name: rule_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rule_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    description text
);


--
-- Name: signal_recommendation_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.signal_recommendation_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subtype text NOT NULL,
    action_type text NOT NULL,
    template_key text NOT NULL,
    title_template text NOT NULL,
    body_template text,
    task_priority text DEFAULT 'normal'::text,
    checklist_template_key text,
    default_severity public.signal_severity DEFAULT 'warning'::public.signal_severity NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT signal_recommendation_templates_action_type_check CHECK ((action_type = ANY (ARRAY['create_task'::text, 'create_record'::text, 'alert'::text, 'review'::text])))
);


--
-- Name: signal_source_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.signal_source_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_key text NOT NULL,
    org_id uuid,
    run_type text DEFAULT 'manual'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    status text DEFAULT 'running'::text NOT NULL,
    orgs_scanned integer DEFAULT 0 NOT NULL,
    properties_scanned integer DEFAULT 0 NOT NULL,
    skipped integer DEFAULT 0 NOT NULL,
    api_calls integer DEFAULT 0 NOT NULL,
    signals_created integer DEFAULT 0 NOT NULL,
    duplicates_ignored integer DEFAULT 0 NOT NULL,
    expired_cleared integer DEFAULT 0 NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT signal_source_runs_run_type_check CHECK ((run_type = ANY (ARRAY['scheduled'::text, 'manual'::text, 'event'::text]))),
    CONSTRAINT signal_source_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'partial'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: signals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.signals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    property_id uuid,
    task_id uuid,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    source text DEFAULT 'system'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    due_at timestamp with time zone,
    snooze_until timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    severity text,
    scope text,
    ai_recommendation jsonb,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    source_key text,
    CONSTRAINT signals_status_check CHECK ((status = ANY (ARRAY['open'::text, 'snoozed'::text, 'resolved'::text, 'dismissed'::text]))),
    CONSTRAINT signals_type_check CHECK ((type = ANY (ARRAY['reminder'::text, 'automation'::text])))
);


--
-- Name: space_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.space_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    functional_class public.functional_class DEFAULT 'habitable'::public.functional_class NOT NULL,
    default_ui_group text DEFAULT 'General'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    default_icon text,
    icon_alternates jsonb DEFAULT '[]'::jsonb
);


--
-- Name: COLUMN space_types.default_icon; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.space_types.default_icon IS 'Lucide icon name (kebab-case) for space display.';


--
-- Name: COLUMN space_types.icon_alternates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.space_types.icon_alternates IS 'JSON array of alternate Lucide icon names for this space type.';


--
-- Name: subscription_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_tiers (
    id text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    price_id text,
    entitlements jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subtasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subtasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    title text NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    org_id uuid NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    is_yes_no boolean DEFAULT false,
    requires_signature boolean DEFAULT false,
    signed_by uuid,
    signed_at timestamp with time zone,
    template_id uuid,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    archived_at timestamp with time zone,
    archived_by uuid,
    is_archived boolean DEFAULT false,
    step_type text DEFAULT 'check'::text NOT NULL,
    is_sub_step boolean DEFAULT false NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    response_value text,
    response_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    completed_by uuid,
    completed_at timestamp with time zone,
    response_attachment_id uuid,
    CONSTRAINT subtasks_signature_valid CHECK ((((signed_by IS NULL) = (signed_at IS NULL)) AND ((requires_signature = true) OR ((signed_by IS NULL) AND (signed_at IS NULL))))),
    CONSTRAINT subtasks_step_type_valid CHECK ((step_type = ANY (ARRAY['check'::text, 'yes_no'::text, 'text'::text, 'number'::text, 'photo'::text, 'file'::text, 'signature'::text, 'scan'::text, 'pass_fail'::text, 'title'::text, 'note'::text, 'divider'::text])))
);


--
-- Name: COLUMN subtasks.is_yes_no; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subtasks.is_yes_no IS 'If true, this subtask is a Yes/No verification item.';


--
-- Name: COLUMN subtasks.requires_signature; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subtasks.requires_signature IS 'If true, this subtask requires a digital signature.';


--
-- Name: COLUMN subtasks.signed_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subtasks.signed_by IS 'User who completed the signature.';


--
-- Name: COLUMN subtasks.signed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subtasks.signed_at IS 'Timestamp of signature event.';


--
-- Name: COLUMN subtasks.template_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subtasks.template_id IS 'Reference to checklist template when subtask is generated from a template.';


--
-- Name: COLUMN subtasks.step_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subtasks.step_type IS 'Checklist response/structure requirement set by the assigner (photo, yes_no, signature, …).';


--
-- Name: COLUMN subtasks.response_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subtasks.response_value IS 'Recorded answer for the step (yes/no, pass/fail, text, number, scan code, etc.).';


--
-- Name: COLUMN subtasks.response_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subtasks.response_json IS 'Structured metadata for the response (units, file name, geo, device, signature present, etc.).';


--
-- Name: COLUMN subtasks.completed_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subtasks.completed_by IS 'User who completed / submitted the step response.';


--
-- Name: COLUMN subtasks.completed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subtasks.completed_at IS 'When the step response was recorded.';


--
-- Name: COLUMN subtasks.response_attachment_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subtasks.response_attachment_id IS 'Primary evidence attachment for photo/file/signature steps (attachments.parent_type=subtask).';


--
-- Name: task_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    task_id uuid,
    activity_type text NOT NULL,
    body text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: task_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    task_id uuid,
    message_id uuid,
    file_url text NOT NULL,
    file_name text NOT NULL,
    file_type text NOT NULL,
    org_id uuid
);


--
-- Name: task_compliance_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_compliance_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    task_id uuid NOT NULL,
    rule_id uuid,
    clause_id uuid,
    status text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    task_id uuid NOT NULL,
    group_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_deleted boolean DEFAULT false,
    created_by uuid,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    is_archived boolean DEFAULT false,
    archived_at timestamp with time zone,
    archived_by uuid
);


--
-- Name: TABLE task_groups; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.task_groups IS 'Junction table linking tasks to groups.';


--
-- Name: task_image_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_image_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_image_id uuid,
    image_version_id uuid,
    user_id text,
    action_type text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    org_id uuid,
    extended_metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: COLUMN task_image_actions.extended_metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.task_image_actions.extended_metadata IS 'Extended action metadata for annotation tools.';


--
-- Name: task_image_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_image_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_image_id uuid,
    version_number integer DEFAULT 1,
    storage_path text,
    is_original boolean DEFAULT false,
    annotation_summary text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    org_id uuid,
    annotation_json jsonb DEFAULT '{}'::jsonb,
    ai_metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: COLUMN task_image_versions.annotation_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.task_image_versions.annotation_json IS 'Stores annotation shapes, markers, and drawing data.';


--
-- Name: COLUMN task_image_versions.ai_metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.task_image_versions.ai_metadata IS 'AI-generated metadata like captions, detected objects, etc.';


--
-- Name: task_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid,
    created_by text,
    latest_version_id uuid,
    is_deleted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    file_type text,
    org_id uuid,
    storage_path text,
    original_filename text,
    image_url text,
    status text,
    display_name text,
    ai_caption text
);


--
-- Name: task_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_labels (
    task_id uuid NOT NULL,
    label_id uuid NOT NULL,
    org_id uuid NOT NULL
);


--
-- Name: task_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    task_id uuid,
    source text,
    message_type text,
    body_text text,
    body_html text,
    author_name text,
    author_role text,
    org_id uuid,
    CONSTRAINT task_messages_message_type_check CHECK ((message_type = ANY (ARRAY['comment'::text, 'status_change'::text, 'quote'::text, 'note'::text, 'system_event'::text]))),
    CONSTRAINT task_messages_source_check CHECK ((source = ANY (ARRAY['internal'::text, 'email'::text, 'external_link'::text, 'system'::text, 'ai'::text])))
);


--
-- Name: task_recurrence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_recurrence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    task_id uuid NOT NULL,
    rule jsonb NOT NULL,
    next_run timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: task_repeat_rules; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.task_repeat_rules WITH (security_invoker='true') AS
 SELECT id,
    org_id,
    (metadata -> 'repeat'::text) AS repeat_rule
   FROM public.tasks;


--
-- Name: task_spaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_spaces (
    task_id uuid NOT NULL,
    space_id uuid NOT NULL
);


--
-- Name: task_themes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_themes (
    task_id uuid NOT NULL,
    theme_id uuid NOT NULL
);


--
-- Name: task_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    task_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    member_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    icon text,
    image_url text
);


--
-- Name: COLUMN teams.icon; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teams.icon IS 'Icon for chip and UI representation.';


--
-- Name: COLUMN teams.image_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teams.image_url IS 'Optional team avatar or badge.';


--
-- Name: themes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.themes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    color text,
    icon text,
    parent_id uuid,
    type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT themes_no_circular_parent CHECK ((id IS DISTINCT FROM parent_id)),
    CONSTRAINT themes_type_check CHECK ((type = ANY (ARRAY['category'::text, 'project'::text, 'tag'::text, 'group'::text])))
);


--
-- Name: tasks_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.tasks_view WITH (security_invoker='true') AS
 SELECT t.id,
    t.org_id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.due_at AS due_date,
    COALESCE(t.milestones, '[]'::jsonb) AS milestones,
    t.assigned_user_id,
    t.owner_user_id,
    t.property_id,
    t.created_at,
    t.updated_at,
    p.nickname AS property_name,
    p.address AS property_address,
    p.thumbnail_url AS property_thumbnail_url,
    COALESCE(( SELECT json_agg(DISTINCT jsonb_build_object('id', sp_1.id, 'name', sp_1.name)) AS json_agg
           FROM (unnest(COALESCE(t.space_ids, ARRAY[]::uuid[])) sid(space_id)
             JOIN public.spaces sp_1 ON (((sp_1.id = sid.space_id) AND (sp_1.org_id = t.org_id))))), '[]'::json) AS spaces,
    COALESCE(json_agg(DISTINCT jsonb_build_object('id', th.id, 'name', th.name, 'color', th.color, 'icon', th.icon)) FILTER (WHERE (th.id IS NOT NULL)), '[]'::json) AS themes,
    COALESCE(( SELECT json_agg(DISTINCT jsonb_build_object('id', tm.id, 'name', tm.name, 'color', tm.color, 'icon', tm.icon)) AS json_agg
           FROM (unnest(COALESCE(t.assigned_team_ids, ARRAY[]::uuid[])) tid(team_id)
             JOIN public.teams tm ON ((tm.id = tid.team_id)))), '[]'::json) AS teams,
    COALESCE(( SELECT json_agg(jsonb_build_object('id', att.id, 'file_url', att.file_url, 'thumbnail_url', att.thumbnail_url, 'file_name', att.file_name, 'file_type', att.file_type) ORDER BY att.created_at DESC) AS json_agg
           FROM public.attachments att
          WHERE ((att.parent_id = t.id) AND (att.parent_type = 'task'::text) AND (att.org_id = t.org_id) AND (COALESCE(lower(att.file_name), ''::text) !~~ 'signature.%'::text) AND (COALESCE((att.metadata ->> 'evidence_kind'::text), ''::text) IS DISTINCT FROM 'signature'::text))),
        CASE
            WHEN (t.image_url IS NOT NULL) THEN json_build_array(jsonb_build_object('file_url', t.image_url, 'file_type', 'image/*'))
            ELSE '[]'::json
        END) AS images
   FROM (((public.tasks t
     LEFT JOIN public.properties p ON (((p.id = t.property_id) AND (p.org_id = t.org_id))))
     LEFT JOIN public.task_themes tt ON ((tt.task_id = t.id)))
     LEFT JOIN public.themes th ON (((th.id = tt.theme_id) AND (th.org_id = t.org_id))))
  GROUP BY t.id, t.org_id, t.title, t.description, t.status, t.priority, t.due_at, t.assigned_user_id, t.owner_user_id, t.property_id, t.created_at, t.updated_at, t.space_ids, t.assigned_team_ids, t.image_url, t.milestones, p.nickname, p.address, p.thumbnail_url;


--
-- Name: VIEW tasks_view; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.tasks_view IS 'Tasks with relationships. images aggregates task attachments excluding checklist signatures; owner_user_id is From, assigned_user_id is For.';


--
-- Name: thread_message_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thread_message_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    message_id uuid NOT NULL,
    storage_path text NOT NULL,
    file_url text,
    file_type text,
    ai_caption text,
    metadata jsonb DEFAULT '{}'::jsonb,
    uploaded_at timestamp with time zone DEFAULT now()
);


--
-- Name: thread_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thread_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    thread_id uuid NOT NULL,
    task_id uuid NOT NULL,
    sender_id uuid,
    body text,
    ai_summary jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);


--
-- Name: ai_extraction_history ai_extraction_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_extraction_history
    ADD CONSTRAINT ai_extraction_history_pkey PRIMARY KEY (id);


--
-- Name: ai_extractions ai_extractions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_extractions
    ADD CONSTRAINT ai_extractions_pkey PRIMARY KEY (id);


--
-- Name: ai_models ai_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_pkey PRIMARY KEY (id);


--
-- Name: ai_prompts ai_prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT ai_prompts_pkey PRIMARY KEY (id);


--
-- Name: ai_requests ai_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_requests
    ADD CONSTRAINT ai_requests_pkey PRIMARY KEY (id);


--
-- Name: ai_responses ai_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_responses
    ADD CONSTRAINT ai_responses_pkey PRIMARY KEY (id);


--
-- Name: asset_files asset_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_files
    ADD CONSTRAINT asset_files_pkey PRIMARY KEY (id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: attachment_spaces attachment_spaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachment_spaces
    ADD CONSTRAINT attachment_spaces_pkey PRIMARY KEY (attachment_id, space_id);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: billing_events billing_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_events
    ADD CONSTRAINT billing_events_pkey PRIMARY KEY (id);


--
-- Name: checklist_template_items checklist_template_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_template_items
    ADD CONSTRAINT checklist_template_items_pkey PRIMARY KEY (id);


--
-- Name: checklist_templates checklist_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_pkey PRIMARY KEY (id);


--
-- Name: compliance_assignments compliance_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_assignments
    ADD CONSTRAINT compliance_assignments_pkey PRIMARY KEY (id);


--
-- Name: compliance_clauses compliance_clauses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_clauses
    ADD CONSTRAINT compliance_clauses_pkey PRIMARY KEY (id);


--
-- Name: compliance_documents compliance_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_documents
    ADD CONSTRAINT compliance_documents_pkey PRIMARY KEY (id);


--
-- Name: compliance_events compliance_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_events
    ADD CONSTRAINT compliance_events_pkey PRIMARY KEY (id);


--
-- Name: compliance_jobs compliance_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_jobs
    ADD CONSTRAINT compliance_jobs_pkey PRIMARY KEY (id);


--
-- Name: compliance_occurrences compliance_occurrences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_occurrences
    ADD CONSTRAINT compliance_occurrences_pkey PRIMARY KEY (id);


--
-- Name: compliance_recommendations compliance_recommendations_compliance_document_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_recommendations
    ADD CONSTRAINT compliance_recommendations_compliance_document_id_key UNIQUE (compliance_document_id);


--
-- Name: compliance_recommendations compliance_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_recommendations
    ADD CONSTRAINT compliance_recommendations_pkey PRIMARY KEY (id);


--
-- Name: compliance_reviews compliance_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_reviews
    ADD CONSTRAINT compliance_reviews_pkey PRIMARY KEY (id);


--
-- Name: compliance_rule_reviews compliance_rule_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_rule_reviews
    ADD CONSTRAINT compliance_rule_reviews_pkey PRIMARY KEY (id);


--
-- Name: compliance_rule_versions compliance_rule_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_rule_versions
    ADD CONSTRAINT compliance_rule_versions_pkey PRIMARY KEY (id);


--
-- Name: compliance_rules compliance_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_rules
    ADD CONSTRAINT compliance_rules_pkey PRIMARY KEY (id);


--
-- Name: compliance_schedule_rules compliance_schedule_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_schedule_rules
    ADD CONSTRAINT compliance_schedule_rules_pkey PRIMARY KEY (id);


--
-- Name: compliance_sources compliance_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_sources
    ADD CONSTRAINT compliance_sources_pkey PRIMARY KEY (id);


--
-- Name: compliance_spaces compliance_spaces_compliance_document_id_space_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_spaces
    ADD CONSTRAINT compliance_spaces_compliance_document_id_space_id_key UNIQUE (compliance_document_id, space_id);


--
-- Name: compliance_spaces compliance_spaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_spaces
    ADD CONSTRAINT compliance_spaces_pkey PRIMARY KEY (id);


--
-- Name: connected_accounts connected_accounts_org_id_user_id_provider_provider_account_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connected_accounts
    ADD CONSTRAINT connected_accounts_org_id_user_id_provider_provider_account_key UNIQUE (org_id, user_id, provider, provider_account_id);


--
-- Name: connected_accounts connected_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connected_accounts
    ADD CONSTRAINT connected_accounts_pkey PRIMARY KEY (id);


--
-- Name: contractor_task_access contractor_task_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_task_access
    ADD CONSTRAINT contractor_task_access_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: escalation_events escalation_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalation_events
    ADD CONSTRAINT escalation_events_pkey PRIMARY KEY (id);


--
-- Name: escalation_rules escalation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalation_rules
    ADD CONSTRAINT escalation_rules_pkey PRIMARY KEY (id);


--
-- Name: extracted_assets extracted_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_assets
    ADD CONSTRAINT extracted_assets_pkey PRIMARY KEY (id);


--
-- Name: extracted_compliance_elements extracted_compliance_elements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_compliance_elements
    ADD CONSTRAINT extracted_compliance_elements_pkey PRIMARY KEY (id);


--
-- Name: extracted_spaces extracted_spaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_spaces
    ADD CONSTRAINT extracted_spaces_pkey PRIMARY KEY (id);


--
-- Name: extracted_task_suggestions extracted_task_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_task_suggestions
    ADD CONSTRAINT extracted_task_suggestions_pkey PRIMARY KEY (id);


--
-- Name: group_members group_members_one_member; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.group_members
    ADD CONSTRAINT group_members_one_member CHECK (((((((user_id IS NOT NULL))::integer + ((team_id IS NOT NULL))::integer) + ((space_id IS NOT NULL))::integer) + ((property_id IS NOT NULL))::integer) = 1)) NOT VALID;


--
-- Name: group_members group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (id);


--
-- Name: groups groups_org_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_org_name_unique UNIQUE (org_id, name);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: icon_library icon_library_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icon_library
    ADD CONSTRAINT icon_library_name_key UNIQUE (name);


--
-- Name: icon_library icon_library_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icon_library
    ADD CONSTRAINT icon_library_pkey PRIMARY KEY (id);


--
-- Name: icon_search_synonyms icon_search_synonyms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icon_search_synonyms
    ADD CONSTRAINT icon_search_synonyms_pkey PRIMARY KEY (word);


--
-- Name: intake_items intake_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_items
    ADD CONSTRAINT intake_items_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_token_key UNIQUE (token);


--
-- Name: knowledge_links knowledge_links_org_id_knowledge_id_entity_type_entity_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_links
    ADD CONSTRAINT knowledge_links_org_id_knowledge_id_entity_type_entity_id_key UNIQUE (org_id, knowledge_id, entity_type, entity_id);


--
-- Name: knowledge_links knowledge_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_links
    ADD CONSTRAINT knowledge_links_pkey PRIMARY KEY (id);


--
-- Name: knowledge knowledge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge
    ADD CONSTRAINT knowledge_pkey PRIMARY KEY (id);


--
-- Name: knowledge_sources knowledge_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sources
    ADD CONSTRAINT knowledge_sources_pkey PRIMARY KEY (id);


--
-- Name: knowledge_usage_events knowledge_usage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_usage_events
    ADD CONSTRAINT knowledge_usage_events_pkey PRIMARY KEY (id);


--
-- Name: knowledge_verification_events knowledge_verification_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_verification_events
    ADD CONSTRAINT knowledge_verification_events_pkey PRIMARY KEY (id);


--
-- Name: labels labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: messaging_usage_events messaging_usage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_usage_events
    ADD CONSTRAINT messaging_usage_events_pkey PRIMARY KEY (id);


--
-- Name: notification_channels notification_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_channels
    ADD CONSTRAINT notification_channels_pkey PRIMARY KEY (id);


--
-- Name: org_api_keys org_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_api_keys
    ADD CONSTRAINT org_api_keys_pkey PRIMARY KEY (id);


--
-- Name: org_compliance_summary org_compliance_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_compliance_summary
    ADD CONSTRAINT org_compliance_summary_pkey PRIMARY KEY (id);


--
-- Name: org_entitlement_overrides org_entitlement_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_entitlement_overrides
    ADD CONSTRAINT org_entitlement_overrides_pkey PRIMARY KEY (id);


--
-- Name: org_retention_settings org_retention_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_retention_settings
    ADD CONSTRAINT org_retention_settings_pkey PRIMARY KEY (org_id);


--
-- Name: org_settings org_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_settings
    ADD CONSTRAINT org_settings_pkey PRIMARY KEY (org_id);


--
-- Name: org_subscriptions org_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_subscriptions
    ADD CONSTRAINT org_subscriptions_pkey PRIMARY KEY (org_id);


--
-- Name: org_usage org_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_usage
    ADD CONSTRAINT org_usage_pkey PRIMARY KEY (org_id);


--
-- Name: organisation_members organisation_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organisation_members
    ADD CONSTRAINT organisation_members_pkey PRIMARY KEY (id);


--
-- Name: organisations organisations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organisations
    ADD CONSTRAINT organisations_pkey PRIMARY KEY (id);


--
-- Name: organisations organisations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organisations
    ADD CONSTRAINT organisations_slug_key UNIQUE (slug);


--
-- Name: plan_extraction_runs plan_extraction_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_extraction_runs
    ADD CONSTRAINT plan_extraction_runs_pkey PRIMARY KEY (id);


--
-- Name: properties properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (id);


--
-- Name: property_compliance_status property_compliance_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_compliance_status
    ADD CONSTRAINT property_compliance_status_pkey PRIMARY KEY (id);


--
-- Name: property_details property_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_details
    ADD CONSTRAINT property_details_pkey PRIMARY KEY (property_id);


--
-- Name: property_image_actions property_image_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_image_actions
    ADD CONSTRAINT property_image_actions_pkey PRIMARY KEY (id);


--
-- Name: property_image_versions property_image_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_image_versions
    ADD CONSTRAINT property_image_versions_pkey PRIMARY KEY (id);


--
-- Name: property_image_versions property_image_versions_property_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_image_versions
    ADD CONSTRAINT property_image_versions_property_id_version_number_key UNIQUE (property_id, version_number);


--
-- Name: property_plan_files property_plan_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_plan_files
    ADD CONSTRAINT property_plan_files_pkey PRIMARY KEY (id);


--
-- Name: property_plan_pages property_plan_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_plan_pages
    ADD CONSTRAINT property_plan_pages_pkey PRIMARY KEY (id);


--
-- Name: property_plan_pages property_plan_pages_unique_page; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_plan_pages
    ADD CONSTRAINT property_plan_pages_unique_page UNIQUE (plan_file_id, page_number);


--
-- Name: property_themes property_themes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_themes
    ADD CONSTRAINT property_themes_pkey PRIMARY KEY (property_id, theme_id);


--
-- Name: rule_categories rule_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rule_categories
    ADD CONSTRAINT rule_categories_pkey PRIMARY KEY (id);


--
-- Name: signal_recommendation_templates signal_recommendation_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signal_recommendation_templates
    ADD CONSTRAINT signal_recommendation_templates_pkey PRIMARY KEY (id);


--
-- Name: signal_recommendation_templates signal_recommendation_templates_subtype_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signal_recommendation_templates
    ADD CONSTRAINT signal_recommendation_templates_subtype_key UNIQUE (subtype);


--
-- Name: signal_source_runs signal_source_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signal_source_runs
    ADD CONSTRAINT signal_source_runs_pkey PRIMARY KEY (id);


--
-- Name: signals signals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signals
    ADD CONSTRAINT signals_pkey PRIMARY KEY (id);


--
-- Name: space_types space_types_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_types
    ADD CONSTRAINT space_types_name_unique UNIQUE (name);


--
-- Name: space_types space_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_types
    ADD CONSTRAINT space_types_pkey PRIMARY KEY (id);


--
-- Name: spaces spaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_pkey PRIMARY KEY (id);


--
-- Name: subscription_tiers subscription_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_tiers
    ADD CONSTRAINT subscription_tiers_pkey PRIMARY KEY (id);


--
-- Name: subtasks subtasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subtasks
    ADD CONSTRAINT subtasks_pkey PRIMARY KEY (id);


--
-- Name: task_activity task_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_activity
    ADD CONSTRAINT task_activity_pkey PRIMARY KEY (id);


--
-- Name: task_attachments task_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_pkey PRIMARY KEY (id);


--
-- Name: task_compliance_events task_compliance_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_compliance_events
    ADD CONSTRAINT task_compliance_events_pkey PRIMARY KEY (id);


--
-- Name: task_groups task_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_groups
    ADD CONSTRAINT task_groups_pkey PRIMARY KEY (id);


--
-- Name: task_groups task_groups_unique_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_groups
    ADD CONSTRAINT task_groups_unique_pair UNIQUE (task_id, group_id);


--
-- Name: task_image_actions task_image_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_image_actions
    ADD CONSTRAINT task_image_actions_pkey PRIMARY KEY (id);


--
-- Name: task_image_versions task_image_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_image_versions
    ADD CONSTRAINT task_image_versions_pkey PRIMARY KEY (id);


--
-- Name: task_images task_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_images
    ADD CONSTRAINT task_images_pkey PRIMARY KEY (id);


--
-- Name: task_labels task_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_labels
    ADD CONSTRAINT task_labels_pkey PRIMARY KEY (task_id, label_id);


--
-- Name: task_messages task_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_messages
    ADD CONSTRAINT task_messages_pkey PRIMARY KEY (id);


--
-- Name: task_recurrence task_recurrence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_recurrence
    ADD CONSTRAINT task_recurrence_pkey PRIMARY KEY (id);


--
-- Name: task_spaces task_spaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_spaces
    ADD CONSTRAINT task_spaces_pkey PRIMARY KEY (task_id, space_id);


--
-- Name: task_themes task_themes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_themes
    ADD CONSTRAINT task_themes_pkey PRIMARY KEY (task_id, theme_id);


--
-- Name: task_threads task_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_threads
    ADD CONSTRAINT task_threads_pkey PRIMARY KEY (id);


--
-- Name: task_threads task_threads_task_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_threads
    ADD CONSTRAINT task_threads_task_id_key UNIQUE (task_id);


--
-- Name: tasks tasks_metadata_repeat_format; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_metadata_repeat_format CHECK ((((metadata ? 'repeat'::text) AND (jsonb_typeof((metadata -> 'repeat'::text)) = 'object'::text)) OR (NOT (metadata ? 'repeat'::text)))) NOT VALID;


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: themes themes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.themes
    ADD CONSTRAINT themes_pkey PRIMARY KEY (id);


--
-- Name: thread_message_attachments thread_message_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_message_attachments
    ADD CONSTRAINT thread_message_attachments_pkey PRIMARY KEY (id);


--
-- Name: thread_messages thread_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_messages
    ADD CONSTRAINT thread_messages_pkey PRIMARY KEY (id);


--
-- Name: ai_requests_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_requests_created_at_idx ON public.ai_requests USING btree (created_at DESC);


--
-- Name: ai_requests_function_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_requests_function_name_idx ON public.ai_requests USING btree (function_name);


--
-- Name: ai_requests_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_requests_org_id_idx ON public.ai_requests USING btree (org_id);


--
-- Name: checklist_template_items_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX checklist_template_items_org_id_idx ON public.checklist_template_items USING btree (org_id);


--
-- Name: checklist_template_items_template_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX checklist_template_items_template_id_idx ON public.checklist_template_items USING btree (template_id);


--
-- Name: checklist_template_items_template_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX checklist_template_items_template_idx ON public.checklist_template_items USING btree (template_id);


--
-- Name: checklist_templates_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX checklist_templates_active_idx ON public.checklist_templates USING btree (org_id) WHERE (is_archived = false);


--
-- Name: checklist_templates_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX checklist_templates_org_id_idx ON public.checklist_templates USING btree (org_id);


--
-- Name: compliance_occurrences_org_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_occurrences_org_status_idx ON public.compliance_occurrences USING btree (org_id, status, due_date);


--
-- Name: compliance_occurrences_rule_status_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_occurrences_rule_status_due_idx ON public.compliance_occurrences USING btree (rule_id, status, due_date);


--
-- Name: compliance_schedule_rules_property_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_schedule_rules_property_id_idx ON public.compliance_schedule_rules USING btree (property_id) WHERE (is_archived = false);


--
-- Name: connected_accounts_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX connected_accounts_org_id_idx ON public.connected_accounts USING btree (org_id);


--
-- Name: connected_accounts_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX connected_accounts_user_id_idx ON public.connected_accounts USING btree (user_id);


--
-- Name: group_members_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_members_active_idx ON public.group_members USING btree (group_id, user_id, space_id) WHERE (is_deleted = false);


--
-- Name: group_members_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_members_created_at_idx ON public.group_members USING btree (created_at);


--
-- Name: group_members_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_members_group_id_idx ON public.group_members USING btree (group_id);


--
-- Name: group_members_is_deleted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_members_is_deleted_idx ON public.group_members USING btree (is_deleted);


--
-- Name: group_members_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_members_org_id_idx ON public.group_members USING btree (org_id);


--
-- Name: group_members_space_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_members_space_id_idx ON public.group_members USING btree (space_id) WHERE (space_id IS NOT NULL);


--
-- Name: group_members_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_members_user_id_idx ON public.group_members USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: groups_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_active_idx ON public.groups USING btree (org_id, name) WHERE (is_archived = false);


--
-- Name: groups_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_created_by_idx ON public.groups USING btree (created_by);


--
-- Name: groups_display_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_display_order_idx ON public.groups USING btree (display_order);


--
-- Name: groups_icon_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_icon_idx ON public.groups USING btree (icon);


--
-- Name: groups_is_archived_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_is_archived_idx ON public.groups USING btree (is_archived);


--
-- Name: groups_metadata_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_metadata_idx ON public.groups USING gin (metadata);


--
-- Name: groups_name_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_name_trgm_idx ON public.groups USING gin (name extensions.gin_trgm_ops);


--
-- Name: groups_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_org_id_idx ON public.groups USING btree (org_id);


--
-- Name: groups_org_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX groups_org_slug_idx ON public.groups USING btree (org_id, slug);


--
-- Name: groups_parent_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_parent_group_idx ON public.groups USING btree (parent_group_id);


--
-- Name: groups_updated_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_updated_by_idx ON public.groups USING btree (updated_by);


--
-- Name: idx_activity_log_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_entity ON public.activity_log USING btree (entity_type, entity_id);


--
-- Name: idx_activity_log_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_org ON public.activity_log USING btree (org_id);


--
-- Name: idx_ai_extraction_history_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_extraction_history_org ON public.ai_extraction_history USING btree (org_id);


--
-- Name: idx_ai_extraction_history_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_extraction_history_task ON public.ai_extraction_history USING btree (task_id);


--
-- Name: idx_ai_extractions_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_extractions_task_id ON public.ai_extractions USING btree (task_id);


--
-- Name: idx_ai_responses_prompt_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_responses_prompt_id ON public.ai_responses USING btree (prompt_id);


--
-- Name: idx_asset_files_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_files_asset ON public.asset_files USING btree (asset_id);


--
-- Name: idx_assignments_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_property ON public.compliance_assignments USING btree (property_id);


--
-- Name: idx_attachment_spaces_attachment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachment_spaces_attachment ON public.attachment_spaces USING btree (attachment_id);


--
-- Name: idx_attachment_spaces_space; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachment_spaces_space ON public.attachment_spaces USING btree (space_id);


--
-- Name: idx_attachments_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_parent ON public.attachments USING btree (parent_type, parent_id);


--
-- Name: idx_attachments_subtask_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_subtask_parent ON public.attachments USING btree (parent_type, parent_id) WHERE (parent_type = 'subtask'::text);


--
-- Name: idx_attachments_upload_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_upload_status ON public.attachments USING btree (upload_status) WHERE (upload_status IS DISTINCT FROM 'complete'::text);


--
-- Name: idx_audit_logs_actor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs USING btree (actor_id) WHERE (actor_id IS NOT NULL);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_audit_logs_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_org_id ON public.audit_logs USING btree (org_id);


--
-- Name: idx_checklist_template_items_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_template_items_template_id ON public.checklist_template_items USING btree (template_id);


--
-- Name: idx_checklist_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_templates_category ON public.checklist_templates USING btree (category) WHERE (is_archived = false);


--
-- Name: idx_clauses_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clauses_rule ON public.compliance_clauses USING btree (rule_id);


--
-- Name: idx_compliance_assignments_next_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_assignments_next_due ON public.compliance_assignments USING btree (next_due_at);


--
-- Name: idx_compliance_events_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_events_due ON public.compliance_events USING btree (due_at);


--
-- Name: idx_compliance_events_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_events_org ON public.compliance_events USING btree (org_id);


--
-- Name: idx_compliance_events_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_events_property ON public.compliance_events USING btree (property_id);


--
-- Name: idx_compliance_events_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_events_rule ON public.compliance_events USING btree (rule_id);


--
-- Name: idx_compliance_events_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_events_task ON public.compliance_events USING btree (task_id);


--
-- Name: idx_compliance_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_events_type ON public.compliance_events USING btree (event_type);


--
-- Name: idx_compliance_events_when; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_events_when ON public.compliance_events USING btree (occurred_at);


--
-- Name: idx_compliance_rule_reviews_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_rule_reviews_org_id ON public.compliance_rule_reviews USING btree (org_id);


--
-- Name: idx_compliance_rule_reviews_rule_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_rule_reviews_rule_id ON public.compliance_rule_reviews USING btree (rule_id);


--
-- Name: idx_compliance_rules_country_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_rules_country_domain ON public.compliance_rules USING btree (country, domain);


--
-- Name: idx_compliance_rules_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_rules_source ON public.compliance_rules USING btree (source_id);


--
-- Name: idx_compliance_sources_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_sources_org_id ON public.compliance_sources USING btree (org_id);


--
-- Name: idx_compliance_spaces_compliance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_spaces_compliance ON public.compliance_spaces USING btree (compliance_document_id);


--
-- Name: idx_compliance_spaces_space; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_spaces_space ON public.compliance_spaces USING btree (space_id);


--
-- Name: idx_compliance_upcoming_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_upcoming_due ON public.tasks USING btree (due_at) WHERE (is_compliance = true);


--
-- Name: idx_conversations_org_prop_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_org_prop_task ON public.conversations USING btree (org_id, property_id, task_id);


--
-- Name: idx_escalation_events_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escalation_events_org ON public.escalation_events USING btree (org_id);


--
-- Name: idx_escalation_rules_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escalation_rules_org ON public.escalation_rules USING btree (org_id);


--
-- Name: idx_extracted_assets_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_extracted_assets_run ON public.extracted_assets USING btree (extraction_run_id);


--
-- Name: idx_extracted_compliance_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_extracted_compliance_run ON public.extracted_compliance_elements USING btree (extraction_run_id);


--
-- Name: idx_extracted_spaces_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_extracted_spaces_run ON public.extracted_spaces USING btree (extraction_run_id);


--
-- Name: idx_extracted_tasks_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_extracted_tasks_run ON public.extracted_task_suggestions USING btree (extraction_run_id);


--
-- Name: idx_group_members_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_members_group ON public.group_members USING btree (group_id);


--
-- Name: idx_group_members_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_members_group_id ON public.group_members USING btree (group_id);


--
-- Name: idx_group_members_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_members_property ON public.group_members USING btree (property_id);


--
-- Name: idx_group_members_space; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_members_space ON public.group_members USING btree (space_id);


--
-- Name: idx_group_members_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_members_team_id ON public.group_members USING btree (team_id);


--
-- Name: idx_group_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_members_user ON public.group_members USING btree (user_id);


--
-- Name: idx_group_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_members_user_id ON public.group_members USING btree (user_id);


--
-- Name: idx_groups_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_groups_org_id ON public.groups USING btree (org_id);


--
-- Name: idx_groups_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_groups_parent ON public.groups USING btree (parent_group_id);


--
-- Name: idx_groups_parent_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_groups_parent_group ON public.groups USING btree (parent_group_id);


--
-- Name: idx_groups_parent_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_groups_parent_group_id ON public.groups USING btree (parent_group_id);


--
-- Name: idx_icon_library_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icon_library_name ON public.icon_library USING btree (name);


--
-- Name: idx_icon_library_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icon_library_search ON public.icon_library USING gin (search_vector);


--
-- Name: idx_intake_items_created_by_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intake_items_created_by_status ON public.intake_items USING btree (created_by, status, created_at DESC);


--
-- Name: idx_intake_items_org_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intake_items_org_created_at ON public.intake_items USING btree (org_id, created_at DESC);


--
-- Name: idx_intake_items_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intake_items_org_status ON public.intake_items USING btree (org_id, status, created_at DESC);


--
-- Name: idx_invitations_org_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_org_email ON public.invitations USING btree (org_id, email);


--
-- Name: idx_invitations_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_token ON public.invitations USING btree (token) WHERE (status = 'pending'::text);


--
-- Name: idx_messages_org_conv_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_org_conv_created ON public.messages USING btree (org_id, conversation_id, created_at);


--
-- Name: idx_notification_channels_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_channels_org ON public.notification_channels USING btree (org_id);


--
-- Name: idx_notification_channels_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_channels_user ON public.notification_channels USING btree (user_id);


--
-- Name: idx_organisation_members_org_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organisation_members_org_user ON public.organisation_members USING btree (org_id, user_id);


--
-- Name: idx_organisations_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organisations_slug ON public.organisations USING btree (slug);


--
-- Name: idx_plan_extraction_runs_file; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_extraction_runs_file ON public.plan_extraction_runs USING btree (plan_file_id, created_at DESC);


--
-- Name: idx_plan_extraction_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_extraction_runs_status ON public.plan_extraction_runs USING btree (status);


--
-- Name: idx_properties_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_properties_org_id ON public.properties USING btree (org_id);


--
-- Name: idx_property_details_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_details_org_id ON public.property_details USING btree (org_id);


--
-- Name: idx_property_image_actions_action_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_image_actions_action_type ON public.property_image_actions USING btree (action_type);


--
-- Name: idx_property_image_actions_image_version_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_image_actions_image_version_id ON public.property_image_actions USING btree (image_version_id);


--
-- Name: idx_property_image_actions_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_image_actions_property_id ON public.property_image_actions USING btree (property_id);


--
-- Name: idx_property_image_versions_is_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_image_versions_is_archived ON public.property_image_versions USING btree (is_archived);


--
-- Name: idx_property_image_versions_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_image_versions_metadata ON public.property_image_versions USING gin (metadata);


--
-- Name: idx_property_image_versions_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_image_versions_property_id ON public.property_image_versions USING btree (property_id);


--
-- Name: idx_property_plan_files_org_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_plan_files_org_property ON public.property_plan_files USING btree (org_id, property_id, created_at DESC);


--
-- Name: idx_property_plan_files_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_plan_files_status ON public.property_plan_files USING btree (status);


--
-- Name: idx_property_plan_pages_file; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_plan_pages_file ON public.property_plan_pages USING btree (plan_file_id, page_number);


--
-- Name: idx_property_themes_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_themes_property ON public.property_themes USING btree (property_id);


--
-- Name: idx_signals_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_signals_org_id ON public.signals USING btree (org_id);


--
-- Name: idx_signals_org_prop_type_status_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_signals_org_prop_type_status_due ON public.signals USING btree (org_id, property_id, type, status, due_at);


--
-- Name: idx_signals_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_signals_scope ON public.signals USING btree (scope);


--
-- Name: idx_signals_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_signals_severity ON public.signals USING btree (severity);


--
-- Name: idx_signals_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_signals_task_id ON public.signals USING btree (task_id);


--
-- Name: idx_spaces_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spaces_parent ON public.spaces USING btree (parent_space_id);


--
-- Name: idx_spaces_parent_space_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spaces_parent_space_id ON public.spaces USING btree (parent_space_id);


--
-- Name: idx_status_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_status_property ON public.property_compliance_status USING btree (property_id);


--
-- Name: idx_subtasks_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subtasks_completed ON public.subtasks USING btree (is_completed);


--
-- Name: idx_subtasks_completed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subtasks_completed_at ON public.subtasks USING btree (task_id, completed_at DESC) WHERE (completed_at IS NOT NULL);


--
-- Name: idx_subtasks_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subtasks_order ON public.subtasks USING btree (order_index);


--
-- Name: idx_subtasks_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subtasks_org_id ON public.subtasks USING btree (org_id);


--
-- Name: idx_subtasks_signed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subtasks_signed_by ON public.subtasks USING btree (signed_by);


--
-- Name: idx_subtasks_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subtasks_task ON public.subtasks USING btree (task_id);


--
-- Name: idx_subtasks_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subtasks_task_id ON public.subtasks USING btree (task_id);


--
-- Name: idx_subtasks_task_id_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subtasks_task_id_order ON public.subtasks USING btree (task_id, order_index);


--
-- Name: idx_subtasks_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subtasks_template ON public.subtasks USING btree (template_id);


--
-- Name: idx_subtasks_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subtasks_template_id ON public.subtasks USING btree (template_id);


--
-- Name: idx_task_activity_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_activity_org ON public.task_activity USING btree (org_id);


--
-- Name: idx_task_activity_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_activity_task ON public.task_activity USING btree (task_id);


--
-- Name: idx_task_compliance_events_rule_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_compliance_events_rule_id ON public.task_compliance_events USING btree (rule_id);


--
-- Name: idx_task_compliance_events_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_compliance_events_task_id ON public.task_compliance_events USING btree (task_id);


--
-- Name: idx_task_groups_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_groups_group ON public.task_groups USING btree (group_id);


--
-- Name: idx_task_groups_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_groups_group_id ON public.task_groups USING btree (group_id);


--
-- Name: idx_task_groups_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_groups_task ON public.task_groups USING btree (task_id);


--
-- Name: idx_task_groups_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_groups_task_id ON public.task_groups USING btree (task_id);


--
-- Name: idx_task_image_actions_image_version_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_image_actions_image_version_id ON public.task_image_actions USING btree (image_version_id);


--
-- Name: idx_task_image_versions_task_image_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_image_versions_task_image_id ON public.task_image_versions USING btree (task_image_id);


--
-- Name: idx_task_images_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_images_org_id ON public.task_images USING btree (org_id);


--
-- Name: idx_task_images_org_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_images_org_task ON public.task_images USING btree (org_id, task_id);


--
-- Name: idx_task_images_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_images_task_id ON public.task_images USING btree (task_id);


--
-- Name: idx_task_messages_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_messages_org_id ON public.task_messages USING btree (org_id);


--
-- Name: idx_task_recurrence_next; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_recurrence_next ON public.task_recurrence USING btree (next_run);


--
-- Name: idx_task_recurrence_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_recurrence_org ON public.task_recurrence USING btree (org_id);


--
-- Name: idx_task_themes_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_themes_task ON public.task_themes USING btree (task_id);


--
-- Name: idx_task_themes_theme; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_themes_theme ON public.task_themes USING btree (theme_id);


--
-- Name: idx_task_threads_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_threads_org ON public.task_threads USING btree (org_id);


--
-- Name: idx_tasks_ai_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_ai_metadata ON public.tasks USING btree (((metadata -> 'ai'::text)));


--
-- Name: idx_tasks_compliance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_compliance ON public.tasks USING btree (is_compliance, compliance_level);


--
-- Name: idx_tasks_compliance_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_compliance_level ON public.tasks USING btree (compliance_level);


--
-- Name: idx_tasks_due_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_due_at ON public.tasks USING btree (due_at);


--
-- Name: idx_tasks_is_compliance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_is_compliance ON public.tasks USING btree (is_compliance);


--
-- Name: idx_tasks_metadata_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_metadata_gin ON public.tasks USING gin (metadata);


--
-- Name: idx_tasks_owner_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_owner_team_id ON public.tasks USING btree (owner_team_id);


--
-- Name: idx_tasks_owner_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_owner_user_id ON public.tasks USING btree (owner_user_id);


--
-- Name: idx_tasks_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_priority ON public.tasks USING btree (priority);


--
-- Name: idx_tasks_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_property_id ON public.tasks USING btree (property_id);


--
-- Name: idx_tasks_repeat_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_repeat_rule ON public.tasks USING btree (((metadata -> 'repeat'::text)));


--
-- Name: idx_tasks_space_ids_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_space_ids_gin ON public.tasks USING gin (space_ids);


--
-- Name: idx_tasks_status_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_status_completed ON public.tasks USING btree (status, completed_at);


--
-- Name: idx_template_items_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_items_order ON public.checklist_template_items USING btree (order_index);


--
-- Name: idx_template_items_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_items_template_id ON public.checklist_template_items USING btree (template_id);


--
-- Name: idx_templates_locked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_locked ON public.checklist_templates USING btree (is_locked);


--
-- Name: idx_templates_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_org ON public.checklist_templates USING btree (org_id);


--
-- Name: idx_themes_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_themes_org ON public.themes USING btree (org_id);


--
-- Name: idx_themes_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_themes_type ON public.themes USING btree (org_id, type);


--
-- Name: idx_thread_messages_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_messages_org ON public.thread_messages USING btree (org_id);


--
-- Name: idx_thread_messages_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_messages_task ON public.thread_messages USING btree (task_id);


--
-- Name: idx_thread_messages_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_messages_thread ON public.thread_messages USING btree (thread_id);


--
-- Name: idx_thread_msg_attachments_msg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_msg_attachments_msg ON public.thread_message_attachments USING btree (message_id);


--
-- Name: idx_thread_msg_attachments_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_msg_attachments_org ON public.thread_message_attachments USING btree (org_id);


--
-- Name: idx_versions_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_versions_rule ON public.compliance_rule_versions USING btree (rule_id);


--
-- Name: knowledge_links_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_links_entity_idx ON public.knowledge_links USING btree (org_id, entity_type, entity_id);


--
-- Name: knowledge_org_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_org_status_idx ON public.knowledge USING btree (org_id, status);


--
-- Name: knowledge_platform_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_platform_published_idx ON public.knowledge USING btree (status) WHERE ((scope = 'platform'::text) AND (status = 'published'::text));


--
-- Name: knowledge_source_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_source_kind_idx ON public.knowledge USING btree (source_kind);


--
-- Name: knowledge_sources_knowledge_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_sources_knowledge_id_idx ON public.knowledge_sources USING btree (knowledge_id);


--
-- Name: knowledge_usage_events_knowledge_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_usage_events_knowledge_idx ON public.knowledge_usage_events USING btree (knowledge_id) WHERE (knowledge_id IS NOT NULL);


--
-- Name: knowledge_usage_events_org_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_usage_events_org_created_idx ON public.knowledge_usage_events USING btree (org_id, created_at DESC);


--
-- Name: knowledge_usage_events_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_usage_events_type_idx ON public.knowledge_usage_events USING btree (event_type, created_at DESC);


--
-- Name: knowledge_verification_events_knowledge_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_verification_events_knowledge_idx ON public.knowledge_verification_events USING btree (knowledge_id, created_at DESC);


--
-- Name: messaging_usage_events_org_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messaging_usage_events_org_created_idx ON public.messaging_usage_events USING btree (org_id, created_at DESC);


--
-- Name: org_api_keys_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_api_keys_org_idx ON public.org_api_keys USING btree (org_id);


--
-- Name: org_entitlement_overrides_org_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_entitlement_overrides_org_active_idx ON public.org_entitlement_overrides USING btree (org_id, entitlement_key) WHERE (revoked_at IS NULL);


--
-- Name: org_settings_intake_email_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX org_settings_intake_email_token_key ON public.org_settings USING btree (intake_email_token);


--
-- Name: organisation_members_one_primary_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX organisation_members_one_primary_owner ON public.organisation_members USING btree (org_id) WHERE (is_primary_owner = true);


--
-- Name: organisation_members_org_user_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX organisation_members_org_user_unique ON public.organisation_members USING btree (org_id, user_id);


--
-- Name: signal_source_runs_org_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX signal_source_runs_org_started ON public.signal_source_runs USING btree (org_id, started_at DESC) WHERE (org_id IS NOT NULL);


--
-- Name: signal_source_runs_source_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX signal_source_runs_source_started ON public.signal_source_runs USING btree (source_key, started_at DESC);


--
-- Name: signals_source_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX signals_source_key ON public.signals USING btree (source_key) WHERE (source_key IS NOT NULL);


--
-- Name: spaces_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spaces_active_idx ON public.spaces USING btree (org_id) WHERE (is_archived = false);


--
-- Name: spaces_parent_space_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spaces_parent_space_id_idx ON public.spaces USING btree (parent_space_id);


--
-- Name: subtasks_task_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subtasks_task_active_idx ON public.subtasks USING btree (task_id) WHERE (is_archived = false);


--
-- Name: task_groups_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_groups_active_idx ON public.task_groups USING btree (task_id, group_id) WHERE (is_archived = false);


--
-- Name: task_groups_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_groups_created_by_idx ON public.task_groups USING btree (created_by);


--
-- Name: task_groups_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_groups_group_id_idx ON public.task_groups USING btree (group_id);


--
-- Name: task_groups_is_deleted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_groups_is_deleted_idx ON public.task_groups USING btree (is_deleted);


--
-- Name: task_groups_task_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_groups_task_id_idx ON public.task_groups USING btree (task_id);


--
-- Name: task_groups_updated_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_groups_updated_by_idx ON public.task_groups USING btree (updated_by);


--
-- Name: unique_pending_invitation; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_pending_invitation ON public.invitations USING btree (org_id, email) WHERE (status = 'pending'::text);


--
-- Name: checklist_templates checklist_templates_update_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER checklist_templates_update_timestamp BEFORE UPDATE ON public.checklist_templates FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: group_members group_members_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER group_members_set_updated_at BEFORE UPDATE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: group_members group_members_update_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER group_members_update_timestamp BEFORE UPDATE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: groups groups_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER groups_set_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: groups groups_update_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER groups_update_timestamp BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: knowledge knowledge_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER knowledge_touch_updated_at BEFORE UPDATE ON public.knowledge FOR EACH ROW EXECUTE FUNCTION public.touch_knowledge_updated_at();


--
-- Name: organisations on_org_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_org_created AFTER INSERT ON public.organisations FOR EACH ROW EXECUTE FUNCTION public.handle_new_organisation();


--
-- Name: organisation_members organisation_members_primary_owner_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER organisation_members_primary_owner_guard BEFORE DELETE OR UPDATE ON public.organisation_members FOR EACH ROW EXECUTE FUNCTION public.organisation_members_primary_owner_guard();


--
-- Name: organisation_members organisation_members_role_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER organisation_members_role_audit AFTER UPDATE ON public.organisation_members FOR EACH ROW EXECUTE FUNCTION public.organisation_members_role_audit();


--
-- Name: properties seed_property_defaults_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER seed_property_defaults_trigger AFTER INSERT ON public.properties FOR EACH ROW EXECUTE FUNCTION public.trigger_seed_property_defaults();


--
-- Name: compliance_rules set_compliance_rules_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_compliance_rules_updated_at_trigger BEFORE UPDATE ON public.compliance_rules FOR EACH ROW EXECUTE FUNCTION public.set_compliance_rules_updated_at();


--
-- Name: task_groups task_groups_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER task_groups_set_updated_at BEFORE UPDATE ON public.task_groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: task_groups task_groups_update_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER task_groups_update_timestamp BEFORE UPDATE ON public.task_groups FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: tasks trg_compliance_event_task_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_compliance_event_task_insert AFTER INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.compliance_event_on_task_insert();


--
-- Name: tasks trg_compliance_event_task_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_compliance_event_task_update AFTER UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.compliance_event_on_task_update();


--
-- Name: extracted_assets trg_extracted_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_extracted_assets_updated_at BEFORE UPDATE ON public.extracted_assets FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();


--
-- Name: extracted_compliance_elements trg_extracted_compliance_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_extracted_compliance_updated_at BEFORE UPDATE ON public.extracted_compliance_elements FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();


--
-- Name: extracted_spaces trg_extracted_spaces_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_extracted_spaces_updated_at BEFORE UPDATE ON public.extracted_spaces FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();


--
-- Name: extracted_task_suggestions trg_extracted_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_extracted_tasks_updated_at BEFORE UPDATE ON public.extracted_task_suggestions FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();


--
-- Name: compliance_rule_versions trg_increment_rule_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_increment_rule_version BEFORE INSERT ON public.compliance_rule_versions FOR EACH ROW EXECUTE FUNCTION public.increment_rule_version();


--
-- Name: organisations trg_new_org; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_new_org AFTER INSERT ON public.organisations FOR EACH ROW EXECUTE FUNCTION public.handle_new_organisation();


--
-- Name: organisations trg_org_slug; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_org_slug BEFORE INSERT ON public.organisations FOR EACH ROW EXECUTE FUNCTION public.organisations_slug_before_insert();


--
-- Name: property_plan_files trg_property_plan_files_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_property_plan_files_updated_at BEFORE UPDATE ON public.property_plan_files FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();


--
-- Name: property_plan_pages trg_property_plan_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_property_plan_pages_updated_at BEFORE UPDATE ON public.property_plan_pages FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();


--
-- Name: subtasks trg_set_subtask_org; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_subtask_org BEFORE INSERT ON public.subtasks FOR EACH ROW EXECUTE FUNCTION public.set_subtask_org_from_task();


--
-- Name: subtasks trg_subtasks_activity_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_subtasks_activity_audit AFTER INSERT OR DELETE OR UPDATE ON public.subtasks FOR EACH ROW EXECUTE FUNCTION public.subtasks_activity_audit();


--
-- Name: tasks trg_task_activity_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_task_activity_insert AFTER INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.task_activity_on_insert();


--
-- Name: tasks trg_task_activity_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_task_activity_update AFTER UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.task_activity_on_update();


--
-- Name: tasks trg_task_thread_create; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_task_thread_create AFTER INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.ensure_task_thread();


--
-- Name: tasks trg_tasks_activity_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tasks_activity_audit AFTER UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.tasks_activity_audit();


--
-- Name: tasks trg_tasks_set_owner_user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tasks_set_owner_user_id BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.tasks_set_owner_user_id();


--
-- Name: checklist_template_items trg_update_checklist_template_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_checklist_template_items_updated_at BEFORE UPDATE ON public.checklist_template_items FOR EACH ROW EXECUTE FUNCTION public.update_checklist_template_items_updated_at();


--
-- Name: compliance_clauses trg_update_clauses; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_clauses BEFORE UPDATE ON public.compliance_clauses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tasks trg_update_metadata_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_metadata_timestamp BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_on_metadata_change();


--
-- Name: compliance_rules trg_update_rules; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_rules BEFORE UPDATE ON public.compliance_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: spaces trg_update_spaces_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_spaces_updated_at BEFORE UPDATE ON public.spaces FOR EACH ROW EXECUTE FUNCTION public.update_spaces_updated_at();


--
-- Name: subtasks trg_update_subtasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_subtasks_updated_at BEFORE UPDATE ON public.subtasks FOR EACH ROW EXECUTE FUNCTION public.update_subtasks_updated_at();


--
-- Name: tasks trg_validate_space_ids; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_space_ids BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.validate_space_ids();


--
-- Name: activity_log activity_log_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: ai_extraction_history ai_extraction_history_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_extraction_history
    ADD CONSTRAINT ai_extraction_history_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: ai_extractions ai_extractions_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_extractions
    ADD CONSTRAINT ai_extractions_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ai_models(id);


--
-- Name: ai_extractions ai_extractions_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_extractions
    ADD CONSTRAINT ai_extractions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: ai_extractions ai_extractions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_extractions
    ADD CONSTRAINT ai_extractions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: ai_prompts ai_prompts_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT ai_prompts_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ai_models(id);


--
-- Name: ai_prompts ai_prompts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT ai_prompts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: ai_requests ai_requests_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_requests
    ADD CONSTRAINT ai_requests_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: ai_requests ai_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_requests
    ADD CONSTRAINT ai_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: ai_responses ai_responses_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_responses
    ADD CONSTRAINT ai_responses_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: ai_responses ai_responses_prompt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_responses
    ADD CONSTRAINT ai_responses_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.ai_prompts(id) ON DELETE CASCADE;


--
-- Name: asset_files asset_files_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_files
    ADD CONSTRAINT asset_files_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_files asset_files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_files
    ADD CONSTRAINT asset_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);


--
-- Name: assets assets_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: assets assets_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: assets assets_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.spaces(id) ON DELETE SET NULL;


--
-- Name: attachment_spaces attachment_spaces_attachment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachment_spaces
    ADD CONSTRAINT attachment_spaces_attachment_id_fkey FOREIGN KEY (attachment_id) REFERENCES public.attachments(id) ON DELETE CASCADE;


--
-- Name: attachment_spaces attachment_spaces_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachment_spaces
    ADD CONSTRAINT attachment_spaces_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: attachment_spaces attachment_spaces_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachment_spaces
    ADD CONSTRAINT attachment_spaces_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.spaces(id) ON DELETE CASCADE;


--
-- Name: attachments attachments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: billing_events billing_events_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_events
    ADD CONSTRAINT billing_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE SET NULL;


--
-- Name: checklist_template_items checklist_template_items_template_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_template_items
    ADD CONSTRAINT checklist_template_items_template_fk FOREIGN KEY (template_id) REFERENCES public.checklist_templates(id) ON DELETE CASCADE;


--
-- Name: checklist_template_items checklist_template_items_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_template_items
    ADD CONSTRAINT checklist_template_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.checklist_templates(id) ON DELETE CASCADE;


--
-- Name: compliance_assignments compliance_assignments_rule_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_assignments
    ADD CONSTRAINT compliance_assignments_rule_version_id_fkey FOREIGN KEY (rule_version_id) REFERENCES public.compliance_rule_versions(id);


--
-- Name: compliance_clauses compliance_clauses_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_clauses
    ADD CONSTRAINT compliance_clauses_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.compliance_rules(id);


--
-- Name: compliance_clauses compliance_clauses_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_clauses
    ADD CONSTRAINT compliance_clauses_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.compliance_rule_versions(id);


--
-- Name: compliance_documents compliance_documents_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_documents
    ADD CONSTRAINT compliance_documents_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: compliance_documents compliance_documents_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_documents
    ADD CONSTRAINT compliance_documents_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;


--
-- Name: compliance_documents compliance_documents_schedule_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_documents
    ADD CONSTRAINT compliance_documents_schedule_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.compliance_schedule_rules(id) ON DELETE SET NULL;


--
-- Name: compliance_events compliance_events_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_events
    ADD CONSTRAINT compliance_events_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: compliance_events compliance_events_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_events
    ADD CONSTRAINT compliance_events_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.compliance_rules(id) ON DELETE SET NULL;


--
-- Name: compliance_events compliance_events_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_events
    ADD CONSTRAINT compliance_events_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: compliance_jobs compliance_jobs_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_jobs
    ADD CONSTRAINT compliance_jobs_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.compliance_sources(id);


--
-- Name: compliance_occurrences compliance_occurrences_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_occurrences
    ADD CONSTRAINT compliance_occurrences_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: compliance_occurrences compliance_occurrences_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_occurrences
    ADD CONSTRAINT compliance_occurrences_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: compliance_occurrences compliance_occurrences_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_occurrences
    ADD CONSTRAINT compliance_occurrences_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.compliance_schedule_rules(id) ON DELETE CASCADE;


--
-- Name: compliance_occurrences compliance_occurrences_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_occurrences
    ADD CONSTRAINT compliance_occurrences_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: compliance_recommendations compliance_recommendations_compliance_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_recommendations
    ADD CONSTRAINT compliance_recommendations_compliance_document_id_fkey FOREIGN KEY (compliance_document_id) REFERENCES public.compliance_documents(id) ON DELETE CASCADE;


--
-- Name: compliance_recommendations compliance_recommendations_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_recommendations
    ADD CONSTRAINT compliance_recommendations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: compliance_recommendations compliance_recommendations_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_recommendations
    ADD CONSTRAINT compliance_recommendations_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;


--
-- Name: compliance_reviews compliance_reviews_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_reviews
    ADD CONSTRAINT compliance_reviews_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.compliance_rules(id);


--
-- Name: compliance_rule_reviews compliance_rule_reviews_org_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_rule_reviews
    ADD CONSTRAINT compliance_rule_reviews_org_fk FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: compliance_rule_reviews compliance_rule_reviews_reviewer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_rule_reviews
    ADD CONSTRAINT compliance_rule_reviews_reviewer_fk FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: compliance_rule_reviews compliance_rule_reviews_rule_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_rule_reviews
    ADD CONSTRAINT compliance_rule_reviews_rule_fk FOREIGN KEY (rule_id) REFERENCES public.compliance_rules(id) ON DELETE CASCADE;


--
-- Name: compliance_rule_versions compliance_rule_versions_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_rule_versions
    ADD CONSTRAINT compliance_rule_versions_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.compliance_rules(id);


--
-- Name: compliance_rules compliance_rules_created_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_rules
    ADD CONSTRAINT compliance_rules_created_by_fk FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: compliance_rules compliance_rules_org_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_rules
    ADD CONSTRAINT compliance_rules_org_fk FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: compliance_rules compliance_rules_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_rules
    ADD CONSTRAINT compliance_rules_source_fk FOREIGN KEY (source_id) REFERENCES public.compliance_sources(id) ON DELETE CASCADE;


--
-- Name: compliance_rules compliance_rules_updated_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_rules
    ADD CONSTRAINT compliance_rules_updated_by_fk FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: compliance_schedule_rules compliance_schedule_rules_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_schedule_rules
    ADD CONSTRAINT compliance_schedule_rules_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: compliance_schedule_rules compliance_schedule_rules_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_schedule_rules
    ADD CONSTRAINT compliance_schedule_rules_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: compliance_sources compliance_sources_created_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_sources
    ADD CONSTRAINT compliance_sources_created_by_fk FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: compliance_sources compliance_sources_org_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_sources
    ADD CONSTRAINT compliance_sources_org_fk FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: compliance_spaces compliance_spaces_compliance_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_spaces
    ADD CONSTRAINT compliance_spaces_compliance_document_id_fkey FOREIGN KEY (compliance_document_id) REFERENCES public.compliance_documents(id) ON DELETE CASCADE;


--
-- Name: compliance_spaces compliance_spaces_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_spaces
    ADD CONSTRAINT compliance_spaces_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: compliance_spaces compliance_spaces_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_spaces
    ADD CONSTRAINT compliance_spaces_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.spaces(id) ON DELETE CASCADE;


--
-- Name: connected_accounts connected_accounts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connected_accounts
    ADD CONSTRAINT connected_accounts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: connected_accounts connected_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connected_accounts
    ADD CONSTRAINT connected_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: contractor_task_access contractor_task_access_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_task_access
    ADD CONSTRAINT contractor_task_access_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id);


--
-- Name: contractor_task_access contractor_task_access_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_task_access
    ADD CONSTRAINT contractor_task_access_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id);


--
-- Name: conversations conversations_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_organisation_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: escalation_events escalation_events_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalation_events
    ADD CONSTRAINT escalation_events_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.escalation_rules(id) ON DELETE CASCADE;


--
-- Name: escalation_events escalation_events_signal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalation_events
    ADD CONSTRAINT escalation_events_signal_id_fkey FOREIGN KEY (signal_id) REFERENCES public.signals(id);


--
-- Name: escalation_events escalation_events_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalation_events
    ADD CONSTRAINT escalation_events_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);


--
-- Name: extracted_assets extracted_assets_extraction_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_assets
    ADD CONSTRAINT extracted_assets_extraction_run_id_fkey FOREIGN KEY (extraction_run_id) REFERENCES public.plan_extraction_runs(id) ON DELETE CASCADE;


--
-- Name: extracted_assets extracted_assets_imported_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_assets
    ADD CONSTRAINT extracted_assets_imported_asset_id_fkey FOREIGN KEY (imported_asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: extracted_assets extracted_assets_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_assets
    ADD CONSTRAINT extracted_assets_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: extracted_assets extracted_assets_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_assets
    ADD CONSTRAINT extracted_assets_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: extracted_assets extracted_assets_source_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_assets
    ADD CONSTRAINT extracted_assets_source_page_id_fkey FOREIGN KEY (source_page_id) REFERENCES public.property_plan_pages(id) ON DELETE SET NULL;


--
-- Name: extracted_compliance_elements extracted_compliance_elements_extraction_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_compliance_elements
    ADD CONSTRAINT extracted_compliance_elements_extraction_run_id_fkey FOREIGN KEY (extraction_run_id) REFERENCES public.plan_extraction_runs(id) ON DELETE CASCADE;


--
-- Name: extracted_compliance_elements extracted_compliance_elements_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_compliance_elements
    ADD CONSTRAINT extracted_compliance_elements_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: extracted_compliance_elements extracted_compliance_elements_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_compliance_elements
    ADD CONSTRAINT extracted_compliance_elements_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: extracted_compliance_elements extracted_compliance_elements_source_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_compliance_elements
    ADD CONSTRAINT extracted_compliance_elements_source_page_id_fkey FOREIGN KEY (source_page_id) REFERENCES public.property_plan_pages(id) ON DELETE SET NULL;


--
-- Name: extracted_spaces extracted_spaces_extraction_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_spaces
    ADD CONSTRAINT extracted_spaces_extraction_run_id_fkey FOREIGN KEY (extraction_run_id) REFERENCES public.plan_extraction_runs(id) ON DELETE CASCADE;


--
-- Name: extracted_spaces extracted_spaces_imported_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_spaces
    ADD CONSTRAINT extracted_spaces_imported_space_id_fkey FOREIGN KEY (imported_space_id) REFERENCES public.spaces(id) ON DELETE SET NULL;


--
-- Name: extracted_spaces extracted_spaces_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_spaces
    ADD CONSTRAINT extracted_spaces_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: extracted_spaces extracted_spaces_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_spaces
    ADD CONSTRAINT extracted_spaces_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: extracted_spaces extracted_spaces_source_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_spaces
    ADD CONSTRAINT extracted_spaces_source_page_id_fkey FOREIGN KEY (source_page_id) REFERENCES public.property_plan_pages(id) ON DELETE SET NULL;


--
-- Name: extracted_task_suggestions extracted_task_suggestions_extraction_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_task_suggestions
    ADD CONSTRAINT extracted_task_suggestions_extraction_run_id_fkey FOREIGN KEY (extraction_run_id) REFERENCES public.plan_extraction_runs(id) ON DELETE CASCADE;


--
-- Name: extracted_task_suggestions extracted_task_suggestions_imported_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_task_suggestions
    ADD CONSTRAINT extracted_task_suggestions_imported_task_id_fkey FOREIGN KEY (imported_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: extracted_task_suggestions extracted_task_suggestions_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_task_suggestions
    ADD CONSTRAINT extracted_task_suggestions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: extracted_task_suggestions extracted_task_suggestions_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_task_suggestions
    ADD CONSTRAINT extracted_task_suggestions_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: extracted_task_suggestions extracted_task_suggestions_source_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extracted_task_suggestions
    ADD CONSTRAINT extracted_task_suggestions_source_page_id_fkey FOREIGN KEY (source_page_id) REFERENCES public.property_plan_pages(id) ON DELETE SET NULL;


--
-- Name: group_members group_members_group_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_fk FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_members group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_members group_members_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;


--
-- Name: group_members group_members_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.spaces(id) ON DELETE SET NULL;


--
-- Name: group_members group_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: groups groups_parent_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_parent_fk FOREIGN KEY (parent_group_id) REFERENCES public.groups(id) ON DELETE SET NULL;


--
-- Name: groups groups_parent_group_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_parent_group_fk FOREIGN KEY (parent_group_id) REFERENCES public.groups(id) ON DELETE SET NULL;


--
-- Name: groups groups_parent_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_parent_group_id_fkey FOREIGN KEY (parent_group_id) REFERENCES public.groups(id) ON DELETE SET NULL;


--
-- Name: intake_items intake_items_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_items
    ADD CONSTRAINT intake_items_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: intake_items intake_items_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_items
    ADD CONSTRAINT intake_items_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;


--
-- Name: invitations invitations_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: knowledge knowledge_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge
    ADD CONSTRAINT knowledge_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: knowledge_links knowledge_links_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_links
    ADD CONSTRAINT knowledge_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: knowledge_links knowledge_links_knowledge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_links
    ADD CONSTRAINT knowledge_links_knowledge_id_fkey FOREIGN KEY (knowledge_id) REFERENCES public.knowledge(id) ON DELETE CASCADE;


--
-- Name: knowledge_links knowledge_links_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_links
    ADD CONSTRAINT knowledge_links_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: knowledge knowledge_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge
    ADD CONSTRAINT knowledge_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: knowledge knowledge_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge
    ADD CONSTRAINT knowledge_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: knowledge_sources knowledge_sources_knowledge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sources
    ADD CONSTRAINT knowledge_sources_knowledge_id_fkey FOREIGN KEY (knowledge_id) REFERENCES public.knowledge(id) ON DELETE CASCADE;


--
-- Name: knowledge knowledge_supersedes_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge
    ADD CONSTRAINT knowledge_supersedes_id_fkey FOREIGN KEY (supersedes_id) REFERENCES public.knowledge(id) ON DELETE SET NULL;


--
-- Name: knowledge_usage_events knowledge_usage_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_usage_events
    ADD CONSTRAINT knowledge_usage_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: knowledge_usage_events knowledge_usage_events_knowledge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_usage_events
    ADD CONSTRAINT knowledge_usage_events_knowledge_id_fkey FOREIGN KEY (knowledge_id) REFERENCES public.knowledge(id) ON DELETE SET NULL;


--
-- Name: knowledge_usage_events knowledge_usage_events_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_usage_events
    ADD CONSTRAINT knowledge_usage_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: knowledge_verification_events knowledge_verification_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_verification_events
    ADD CONSTRAINT knowledge_verification_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: knowledge_verification_events knowledge_verification_events_knowledge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_verification_events
    ADD CONSTRAINT knowledge_verification_events_knowledge_id_fkey FOREIGN KEY (knowledge_id) REFERENCES public.knowledge(id) ON DELETE CASCADE;


--
-- Name: knowledge_verification_events knowledge_verification_events_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_verification_events
    ADD CONSTRAINT knowledge_verification_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: labels labels_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: messages messages_author_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id);


--
-- Name: messages messages_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_organisation_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: messaging_usage_events messaging_usage_events_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_usage_events
    ADD CONSTRAINT messaging_usage_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: org_api_keys org_api_keys_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_api_keys
    ADD CONSTRAINT org_api_keys_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: org_api_keys org_api_keys_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_api_keys
    ADD CONSTRAINT org_api_keys_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: org_entitlement_overrides org_entitlement_overrides_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_entitlement_overrides
    ADD CONSTRAINT org_entitlement_overrides_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: org_entitlement_overrides org_entitlement_overrides_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_entitlement_overrides
    ADD CONSTRAINT org_entitlement_overrides_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: org_retention_settings org_retention_settings_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_retention_settings
    ADD CONSTRAINT org_retention_settings_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: org_retention_settings org_retention_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_retention_settings
    ADD CONSTRAINT org_retention_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: org_settings org_settings_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_settings
    ADD CONSTRAINT org_settings_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: org_subscriptions org_subscriptions_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_subscriptions
    ADD CONSTRAINT org_subscriptions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: org_subscriptions org_subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_subscriptions
    ADD CONSTRAINT org_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_tiers(id);


--
-- Name: org_usage org_usage_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_usage
    ADD CONSTRAINT org_usage_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: organisation_members organisation_members_org_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organisation_members
    ADD CONSTRAINT organisation_members_org_fk FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: organisation_members organisation_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organisation_members
    ADD CONSTRAINT organisation_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: organisation_members organisation_members_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organisation_members
    ADD CONSTRAINT organisation_members_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: organisations organisations_created_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organisations
    ADD CONSTRAINT organisations_created_by_fk FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: plan_extraction_runs plan_extraction_runs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_extraction_runs
    ADD CONSTRAINT plan_extraction_runs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: plan_extraction_runs plan_extraction_runs_plan_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_extraction_runs
    ADD CONSTRAINT plan_extraction_runs_plan_file_id_fkey FOREIGN KEY (plan_file_id) REFERENCES public.property_plan_files(id) ON DELETE CASCADE;


--
-- Name: plan_extraction_runs plan_extraction_runs_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_extraction_runs
    ADD CONSTRAINT plan_extraction_runs_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: properties properties_org_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_org_fk FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE SET NULL;


--
-- Name: properties properties_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: property_compliance_status property_compliance_status_rule_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_compliance_status
    ADD CONSTRAINT property_compliance_status_rule_version_id_fkey FOREIGN KEY (rule_version_id) REFERENCES public.compliance_rule_versions(id);


--
-- Name: property_details property_details_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_details
    ADD CONSTRAINT property_details_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: property_details property_details_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_details
    ADD CONSTRAINT property_details_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: property_image_actions property_image_actions_image_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_image_actions
    ADD CONSTRAINT property_image_actions_image_version_id_fkey FOREIGN KEY (image_version_id) REFERENCES public.property_image_versions(id) ON DELETE SET NULL;


--
-- Name: property_image_actions property_image_actions_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_image_actions
    ADD CONSTRAINT property_image_actions_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: property_image_actions property_image_actions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_image_actions
    ADD CONSTRAINT property_image_actions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: property_image_versions property_image_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_image_versions
    ADD CONSTRAINT property_image_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: property_image_versions property_image_versions_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_image_versions
    ADD CONSTRAINT property_image_versions_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: property_plan_files property_plan_files_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_plan_files
    ADD CONSTRAINT property_plan_files_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: property_plan_files property_plan_files_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_plan_files
    ADD CONSTRAINT property_plan_files_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: property_plan_pages property_plan_pages_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_plan_pages
    ADD CONSTRAINT property_plan_pages_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: property_plan_pages property_plan_pages_plan_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_plan_pages
    ADD CONSTRAINT property_plan_pages_plan_file_id_fkey FOREIGN KEY (plan_file_id) REFERENCES public.property_plan_files(id) ON DELETE CASCADE;


--
-- Name: property_themes property_themes_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_themes
    ADD CONSTRAINT property_themes_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: property_themes property_themes_theme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_themes
    ADD CONSTRAINT property_themes_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.themes(id) ON DELETE CASCADE;


--
-- Name: signal_source_runs signal_source_runs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signal_source_runs
    ADD CONSTRAINT signal_source_runs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE SET NULL;


--
-- Name: signals signals_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signals
    ADD CONSTRAINT signals_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: signals signals_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signals
    ADD CONSTRAINT signals_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;


--
-- Name: signals signals_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signals
    ADD CONSTRAINT signals_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: spaces spaces_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id);


--
-- Name: spaces spaces_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_organisation_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: spaces spaces_parent_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_parent_fk FOREIGN KEY (parent_space_id) REFERENCES public.spaces(id) ON DELETE SET NULL;


--
-- Name: spaces spaces_parent_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_parent_space_id_fkey FOREIGN KEY (parent_space_id) REFERENCES public.spaces(id) ON DELETE SET NULL;


--
-- Name: spaces spaces_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: spaces spaces_space_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_space_type_id_fkey FOREIGN KEY (space_type_id) REFERENCES public.space_types(id) ON DELETE SET NULL;


--
-- Name: subtasks subtasks_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subtasks
    ADD CONSTRAINT subtasks_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES auth.users(id);


--
-- Name: subtasks subtasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subtasks
    ADD CONSTRAINT subtasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: subtasks subtasks_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subtasks
    ADD CONSTRAINT subtasks_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: subtasks subtasks_response_attachment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subtasks
    ADD CONSTRAINT subtasks_response_attachment_id_fkey FOREIGN KEY (response_attachment_id) REFERENCES public.attachments(id) ON DELETE SET NULL;


--
-- Name: subtasks subtasks_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subtasks
    ADD CONSTRAINT subtasks_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: subtasks subtasks_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subtasks
    ADD CONSTRAINT subtasks_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.checklist_templates(id) ON DELETE SET NULL;


--
-- Name: task_activity task_activity_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_activity
    ADD CONSTRAINT task_activity_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_attachments task_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.task_messages(id) ON DELETE CASCADE;


--
-- Name: task_attachments task_attachments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id);


--
-- Name: task_attachments task_attachments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_compliance_events task_compliance_events_clause_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_compliance_events
    ADD CONSTRAINT task_compliance_events_clause_id_fkey FOREIGN KEY (clause_id) REFERENCES public.compliance_clauses(id) ON DELETE SET NULL;


--
-- Name: task_compliance_events task_compliance_events_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_compliance_events
    ADD CONSTRAINT task_compliance_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: task_compliance_events task_compliance_events_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_compliance_events
    ADD CONSTRAINT task_compliance_events_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.compliance_rules(id) ON DELETE SET NULL;


--
-- Name: task_compliance_events task_compliance_events_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_compliance_events
    ADD CONSTRAINT task_compliance_events_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_groups task_groups_group_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_groups
    ADD CONSTRAINT task_groups_group_fk FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: task_groups task_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_groups
    ADD CONSTRAINT task_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: task_groups task_groups_task_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_groups
    ADD CONSTRAINT task_groups_task_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_groups task_groups_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_groups
    ADD CONSTRAINT task_groups_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_image_actions task_image_actions_image_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_image_actions
    ADD CONSTRAINT task_image_actions_image_version_id_fkey FOREIGN KEY (image_version_id) REFERENCES public.task_image_versions(id);


--
-- Name: task_image_actions task_image_actions_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_image_actions
    ADD CONSTRAINT task_image_actions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id);


--
-- Name: task_image_actions task_image_actions_task_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_image_actions
    ADD CONSTRAINT task_image_actions_task_image_id_fkey FOREIGN KEY (task_image_id) REFERENCES public.task_images(id);


--
-- Name: task_image_versions task_image_versions_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_image_versions
    ADD CONSTRAINT task_image_versions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id);


--
-- Name: task_image_versions task_image_versions_task_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_image_versions
    ADD CONSTRAINT task_image_versions_task_image_id_fkey FOREIGN KEY (task_image_id) REFERENCES public.task_images(id) ON DELETE CASCADE;


--
-- Name: task_images task_images_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_images
    ADD CONSTRAINT task_images_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: task_images task_images_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_images
    ADD CONSTRAINT task_images_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_labels task_labels_label_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_labels
    ADD CONSTRAINT task_labels_label_id_fkey FOREIGN KEY (label_id) REFERENCES public.labels(id) ON DELETE CASCADE;


--
-- Name: task_labels task_labels_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_labels
    ADD CONSTRAINT task_labels_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: task_labels task_labels_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_labels
    ADD CONSTRAINT task_labels_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_messages task_messages_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_messages
    ADD CONSTRAINT task_messages_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: task_messages task_messages_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_messages
    ADD CONSTRAINT task_messages_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_recurrence task_recurrence_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_recurrence
    ADD CONSTRAINT task_recurrence_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_spaces task_spaces_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_spaces
    ADD CONSTRAINT task_spaces_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.spaces(id) ON DELETE CASCADE;


--
-- Name: task_spaces task_spaces_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_spaces
    ADD CONSTRAINT task_spaces_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_themes task_themes_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_themes
    ADD CONSTRAINT task_themes_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_themes task_themes_theme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_themes
    ADD CONSTRAINT task_themes_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.themes(id) ON DELETE CASCADE;


--
-- Name: task_threads task_threads_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_threads
    ADD CONSTRAINT task_threads_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_compliance_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_compliance_event_id_fkey FOREIGN KEY (compliance_event_id) REFERENCES public.compliance_events(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_compliance_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_compliance_rule_id_fkey FOREIGN KEY (compliance_rule_id) REFERENCES public.compliance_rules(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_compliance_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_compliance_source_id_fkey FOREIGN KEY (compliance_source_id) REFERENCES public.compliance_sources(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_organisation_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id);


--
-- Name: tasks tasks_owner_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_owner_team_id_fkey FOREIGN KEY (owner_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: teams teams_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: teams teams_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id);


--
-- Name: teams teams_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_organisation_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: themes themes_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.themes
    ADD CONSTRAINT themes_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: themes themes_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.themes
    ADD CONSTRAINT themes_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.themes(id) ON DELETE SET NULL;


--
-- Name: thread_message_attachments thread_message_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_message_attachments
    ADD CONSTRAINT thread_message_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.thread_messages(id) ON DELETE CASCADE;


--
-- Name: thread_messages thread_messages_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_messages
    ADD CONSTRAINT thread_messages_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: thread_messages thread_messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_messages
    ADD CONSTRAINT thread_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.task_threads(id) ON DELETE CASCADE;


--
-- Name: organisation_members Allow onboarding insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow onboarding insert" ON public.organisation_members FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: organisation_members Insert own membership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Insert own membership" ON public.organisation_members FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: invitations Owners and managers can delete invitations in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and managers can delete invitations in their org" ON public.invitations FOR DELETE TO authenticated USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE ((organisation_members.user_id = auth.uid()) AND (organisation_members.role = ANY (ARRAY['owner'::text, 'manager'::text]))))));


--
-- Name: invitations Public can view invitations by token; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view invitations by token" ON public.invitations FOR SELECT TO authenticated, anon USING (((status = 'pending'::text) AND (token IS NOT NULL) AND (expires_at > now())));


--
-- Name: organisation_members Update own membership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Update own membership" ON public.organisation_members FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: organisation_members Users can UPDATE their own organisation membership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can UPDATE their own organisation membership" ON public.organisation_members FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: organisation_members Users can be added to an organisation via trigger; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can be added to an organisation via trigger" ON public.organisation_members FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: invitations Users can create invitations in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create invitations in their org" ON public.invitations FOR INSERT TO authenticated WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE ((organisation_members.user_id = auth.uid()) AND (organisation_members.role = ANY (ARRAY['owner'::text, 'manager'::text]))))));


--
-- Name: property_image_actions Users can insert property image actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert property image actions" ON public.property_image_actions FOR INSERT TO authenticated WITH CHECK ((property_id IN ( SELECT p.id
   FROM (public.properties p
     JOIN public.organisation_members om ON ((p.org_id = om.org_id)))
  WHERE (om.user_id = auth.uid()))));


--
-- Name: property_image_versions Users can insert property image versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert property image versions" ON public.property_image_versions FOR INSERT TO authenticated WITH CHECK ((property_id IN ( SELECT p.id
   FROM (public.properties p
     JOIN public.organisation_members om ON ((p.org_id = om.org_id)))
  WHERE (om.user_id = auth.uid()))));


--
-- Name: invitations Users can update invitations in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update invitations in their org" ON public.invitations FOR UPDATE TO authenticated USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: property_image_versions Users can update property image versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update property image versions" ON public.property_image_versions FOR UPDATE TO authenticated USING ((property_id IN ( SELECT p.id
   FROM (public.properties p
     JOIN public.organisation_members om ON ((p.org_id = om.org_id)))
  WHERE (om.user_id = auth.uid()))));


--
-- Name: invitations Users can view invitations in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view invitations in their org" ON public.invitations FOR SELECT TO authenticated USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: property_image_actions Users can view property image actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view property image actions" ON public.property_image_actions FOR SELECT TO authenticated USING ((property_id IN ( SELECT p.id
   FROM (public.properties p
     JOIN public.organisation_members om ON ((p.org_id = om.org_id)))
  WHERE (om.user_id = auth.uid()))));


--
-- Name: property_image_versions Users can view property image versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view property image versions" ON public.property_image_versions FOR SELECT TO authenticated USING ((property_id IN ( SELECT p.id
   FROM (public.properties p
     JOIN public.organisation_members om ON ((p.org_id = om.org_id)))
  WHERE (om.user_id = auth.uid()))));


--
-- Name: invitations Users can view their own pending invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own pending invitations" ON public.invitations FOR SELECT TO authenticated USING (((status = 'pending'::text) AND (email = (( SELECT users.email
   FROM auth.users
  WHERE (users.id = auth.uid())))::text)));


--
-- Name: activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_log activity_log_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activity_log_insert ON public.activity_log FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: activity_log activity_log_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activity_log_select ON public.activity_log FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: ai_extraction_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_extraction_history ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_extraction_history ai_extraction_history_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_extraction_history_delete ON public.ai_extraction_history FOR DELETE USING ((org_id = public.current_org_id()));


--
-- Name: ai_extraction_history ai_extraction_history_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_extraction_history_insert ON public.ai_extraction_history FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: ai_extraction_history ai_extraction_history_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_extraction_history_select ON public.ai_extraction_history FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: ai_extraction_history ai_extraction_history_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_extraction_history_update ON public.ai_extraction_history FOR UPDATE USING ((org_id = public.current_org_id()));


--
-- Name: ai_extractions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_extractions ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_extractions ai_extractions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_extractions_insert ON public.ai_extractions FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: ai_extractions ai_extractions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_extractions_select ON public.ai_extractions FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: ai_models; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_models ai_models_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_models_select ON public.ai_models FOR SELECT USING (true);


--
-- Name: ai_prompts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_prompts ai_prompts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_prompts_insert ON public.ai_prompts FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: ai_prompts ai_prompts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_prompts_select ON public.ai_prompts FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: ai_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_requests ai_requests_select_org_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_requests_select_org_members ON public.ai_requests FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: ai_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_responses ai_responses_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_responses_insert ON public.ai_responses FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: ai_responses ai_responses_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_responses_select ON public.ai_responses FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: asset_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asset_files ENABLE ROW LEVEL SECURITY;

--
-- Name: asset_files asset_files_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY asset_files_delete ON public.asset_files FOR DELETE USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.assets a
  WHERE ((a.id = asset_files.asset_id) AND (a.org_id IN ( SELECT om.org_id
           FROM public.organisation_members om
          WHERE (om.user_id = auth.uid()))))))));


--
-- Name: asset_files asset_files_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY asset_files_insert ON public.asset_files FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.assets a
  WHERE ((a.id = asset_files.asset_id) AND (a.org_id IN ( SELECT om.org_id
           FROM public.organisation_members om
          WHERE (om.user_id = auth.uid()))))))));


--
-- Name: asset_files asset_files_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY asset_files_select ON public.asset_files FOR SELECT USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.assets a
  WHERE ((a.id = asset_files.asset_id) AND (a.org_id IN ( SELECT om.org_id
           FROM public.organisation_members om
          WHERE (om.user_id = auth.uid()))))))));


--
-- Name: asset_files asset_files_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY asset_files_update ON public.asset_files FOR UPDATE USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.assets a
  WHERE ((a.id = asset_files.asset_id) AND (a.org_id IN ( SELECT om.org_id
           FROM public.organisation_members om
          WHERE (om.user_id = auth.uid())))))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.assets a
  WHERE ((a.id = asset_files.asset_id) AND (a.org_id IN ( SELECT om.org_id
           FROM public.organisation_members om
          WHERE (om.user_id = auth.uid()))))))));


--
-- Name: assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

--
-- Name: assets assets_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY assets_delete ON public.assets FOR DELETE TO authenticated USING (((auth.uid() IS NOT NULL) AND (org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))));


--
-- Name: assets assets_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY assets_insert ON public.assets FOR INSERT TO authenticated WITH CHECK (((auth.uid() IS NOT NULL) AND (org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))));


--
-- Name: assets assets_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY assets_select ON public.assets FOR SELECT TO authenticated USING (((auth.uid() IS NOT NULL) AND (org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))));


--
-- Name: assets assets_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY assets_update ON public.assets FOR UPDATE TO authenticated USING (((auth.uid() IS NOT NULL) AND (org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))));


--
-- Name: attachment_spaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attachment_spaces ENABLE ROW LEVEL SECURITY;

--
-- Name: attachment_spaces attachment_spaces_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attachment_spaces_delete ON public.attachment_spaces FOR DELETE USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: attachment_spaces attachment_spaces_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attachment_spaces_insert ON public.attachment_spaces FOR INSERT WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: attachment_spaces attachment_spaces_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attachment_spaces_select ON public.attachment_spaces FOR SELECT USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: attachments attachments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attachments_delete ON public.attachments FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = attachments.org_id) AND (om.user_id = auth.uid())))));


--
-- Name: attachments attachments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attachments_insert ON public.attachments FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = attachments.org_id) AND (om.user_id = auth.uid())))));


--
-- Name: attachments attachments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attachments_select ON public.attachments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = attachments.org_id) AND (om.user_id = auth.uid())))));


--
-- Name: attachments attachments_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attachments_update ON public.attachments FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = attachments.org_id) AND (om.user_id = auth.uid())))));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT TO authenticated WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: audit_logs audit_logs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: billing_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_events billing_events_select_primary_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_events_select_primary_owner ON public.billing_events FOR SELECT USING (((org_id = public.current_org_id()) AND (EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = billing_events.org_id) AND (om.user_id = auth.uid()) AND (om.is_primary_owner = true))))));


--
-- Name: checklist_template_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;

--
-- Name: checklist_template_items checklist_template_items_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_template_items_delete ON public.checklist_template_items FOR DELETE USING ((template_id IN ( SELECT checklist_templates.id
   FROM public.checklist_templates
  WHERE (checklist_templates.org_id = public.current_org_id()))));


--
-- Name: checklist_template_items checklist_template_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_template_items_insert ON public.checklist_template_items FOR INSERT WITH CHECK ((template_id IN ( SELECT checklist_templates.id
   FROM public.checklist_templates
  WHERE (checklist_templates.org_id = public.current_org_id()))));


--
-- Name: checklist_template_items checklist_template_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_template_items_select ON public.checklist_template_items FOR SELECT USING ((template_id IN ( SELECT checklist_templates.id
   FROM public.checklist_templates
  WHERE (checklist_templates.org_id = public.current_org_id()))));


--
-- Name: checklist_template_items checklist_template_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_template_items_update ON public.checklist_template_items FOR UPDATE USING ((template_id IN ( SELECT checklist_templates.id
   FROM public.checklist_templates
  WHERE (checklist_templates.org_id = public.current_org_id()))));


--
-- Name: checklist_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: checklist_templates checklist_templates_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_templates_delete ON public.checklist_templates FOR DELETE TO authenticated USING (((auth.uid() IS NOT NULL) AND (org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))));


--
-- Name: checklist_templates checklist_templates_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_templates_insert ON public.checklist_templates FOR INSERT TO authenticated WITH CHECK (((auth.uid() IS NOT NULL) AND (org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))));


--
-- Name: checklist_templates checklist_templates_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_templates_select ON public.checklist_templates FOR SELECT TO authenticated USING (((auth.uid() IS NOT NULL) AND (org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))));


--
-- Name: checklist_templates checklist_templates_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_templates_update ON public.checklist_templates FOR UPDATE TO authenticated USING (((auth.uid() IS NOT NULL) AND (org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))));


--
-- Name: compliance_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_assignments compliance_assignments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_assignments_delete ON public.compliance_assignments FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_assignments compliance_assignments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_assignments_insert ON public.compliance_assignments FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_assignments compliance_assignments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_assignments_select ON public.compliance_assignments FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_assignments compliance_assignments_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_assignments_update ON public.compliance_assignments FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_clauses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_clauses ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_clauses compliance_clauses_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_clauses_delete ON public.compliance_clauses FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_clauses compliance_clauses_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_clauses_insert ON public.compliance_clauses FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_clauses compliance_clauses_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_clauses_select ON public.compliance_clauses FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_clauses compliance_clauses_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_clauses_update ON public.compliance_clauses FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_documents compliance_documents_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_documents_insert ON public.compliance_documents FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = compliance_documents.org_id) AND (om.user_id = auth.uid())))));


--
-- Name: compliance_documents compliance_documents_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_documents_select ON public.compliance_documents FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = compliance_documents.org_id) AND (om.user_id = auth.uid())))));


--
-- Name: compliance_documents compliance_documents_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_documents_update ON public.compliance_documents FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = compliance_documents.org_id) AND (om.user_id = auth.uid())))));


--
-- Name: compliance_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_events ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_events compliance_events_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_events_delete ON public.compliance_events FOR DELETE USING ((org_id = public.current_org_id()));


--
-- Name: compliance_events compliance_events_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_events_insert ON public.compliance_events FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: compliance_events compliance_events_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_events_select ON public.compliance_events FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: compliance_events compliance_events_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_events_update ON public.compliance_events FOR UPDATE USING ((org_id = public.current_org_id()));


--
-- Name: compliance_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_jobs compliance_jobs_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_jobs_delete ON public.compliance_jobs FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_jobs compliance_jobs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_jobs_insert ON public.compliance_jobs FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_jobs compliance_jobs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_jobs_select ON public.compliance_jobs FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_jobs compliance_jobs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_jobs_update ON public.compliance_jobs FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_occurrences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_occurrences ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_occurrences compliance_occurrences_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_occurrences_org_access ON public.compliance_occurrences USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: compliance_recommendations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_recommendations ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_recommendations compliance_recommendations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_recommendations_insert ON public.compliance_recommendations FOR INSERT WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: compliance_recommendations compliance_recommendations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_recommendations_select ON public.compliance_recommendations FOR SELECT USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: compliance_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_reviews compliance_reviews_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_reviews_delete ON public.compliance_reviews FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_reviews compliance_reviews_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_reviews_insert ON public.compliance_reviews FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_reviews compliance_reviews_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_reviews_select ON public.compliance_reviews FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_reviews compliance_reviews_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_reviews_update ON public.compliance_reviews FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_rule_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_rule_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_rule_reviews compliance_rule_reviews_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_rule_reviews_delete ON public.compliance_rule_reviews FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_rule_reviews compliance_rule_reviews_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_rule_reviews_insert ON public.compliance_rule_reviews FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_rule_reviews compliance_rule_reviews_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_rule_reviews_select ON public.compliance_rule_reviews FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_rule_reviews compliance_rule_reviews_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_rule_reviews_update ON public.compliance_rule_reviews FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_rule_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_rule_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_rule_versions compliance_rule_versions_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_rule_versions_delete ON public.compliance_rule_versions FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_rule_versions compliance_rule_versions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_rule_versions_insert ON public.compliance_rule_versions FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_rule_versions compliance_rule_versions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_rule_versions_select ON public.compliance_rule_versions FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_rule_versions compliance_rule_versions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_rule_versions_update ON public.compliance_rule_versions FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_rules compliance_rules_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_rules_delete ON public.compliance_rules FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_rules compliance_rules_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_rules_insert ON public.compliance_rules FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_rules compliance_rules_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_rules_select ON public.compliance_rules FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_rules compliance_rules_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_rules_update ON public.compliance_rules FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_schedule_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_schedule_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_schedule_rules compliance_schedule_rules_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_schedule_rules_org_access ON public.compliance_schedule_rules USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: compliance_sources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_sources compliance_sources_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_sources_delete ON public.compliance_sources FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_sources compliance_sources_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_sources_insert ON public.compliance_sources FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_sources compliance_sources_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_sources_select ON public.compliance_sources FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_sources compliance_sources_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_sources_update ON public.compliance_sources FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: compliance_spaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_spaces ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_spaces compliance_spaces_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_spaces_delete ON public.compliance_spaces FOR DELETE USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: compliance_spaces compliance_spaces_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_spaces_insert ON public.compliance_spaces FOR INSERT WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: compliance_spaces compliance_spaces_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_spaces_select ON public.compliance_spaces FOR SELECT USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: compliance_spaces compliance_spaces_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_spaces_update ON public.compliance_spaces FOR UPDATE USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: connected_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: connected_accounts connected_accounts_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connected_accounts_delete_own ON public.connected_accounts FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: connected_accounts connected_accounts_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connected_accounts_insert_own ON public.connected_accounts FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = connected_accounts.org_id) AND (om.user_id = auth.uid()))))));


--
-- Name: connected_accounts connected_accounts_select_org_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connected_accounts_select_org_owner ON public.connected_accounts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = connected_accounts.org_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'manager'::text]))))));


--
-- Name: connected_accounts connected_accounts_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connected_accounts_select_own ON public.connected_accounts FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: connected_accounts connected_accounts_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connected_accounts_update_own ON public.connected_accounts FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: contractor_task_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contractor_task_access ENABLE ROW LEVEL SECURITY;

--
-- Name: contractor_task_access contractor_task_access_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contractor_task_access_delete ON public.contractor_task_access FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: contractor_task_access contractor_task_access_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contractor_task_access_insert ON public.contractor_task_access FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: contractor_task_access contractor_task_access_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contractor_task_access_select ON public.contractor_task_access FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: contractor_task_access contractor_task_access_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contractor_task_access_update ON public.contractor_task_access FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations conversations_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_delete ON public.conversations FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: conversations conversations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_insert ON public.conversations FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: conversations conversations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_select ON public.conversations FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: conversations conversations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_update ON public.conversations FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: escalation_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.escalation_events ENABLE ROW LEVEL SECURITY;

--
-- Name: escalation_events escalation_events_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY escalation_events_insert ON public.escalation_events FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: escalation_events escalation_events_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY escalation_events_select ON public.escalation_events FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: escalation_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.escalation_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: escalation_rules escalation_rules_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY escalation_rules_delete ON public.escalation_rules FOR DELETE USING ((org_id = public.current_org_id()));


--
-- Name: escalation_rules escalation_rules_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY escalation_rules_insert ON public.escalation_rules FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: escalation_rules escalation_rules_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY escalation_rules_select ON public.escalation_rules FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: escalation_rules escalation_rules_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY escalation_rules_update ON public.escalation_rules FOR UPDATE USING ((org_id = public.current_org_id()));


--
-- Name: extracted_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.extracted_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: extracted_assets extracted_assets_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY extracted_assets_insert ON public.extracted_assets FOR INSERT WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: extracted_assets extracted_assets_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY extracted_assets_select ON public.extracted_assets FOR SELECT USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: extracted_assets extracted_assets_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY extracted_assets_update ON public.extracted_assets FOR UPDATE USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: extracted_compliance_elements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.extracted_compliance_elements ENABLE ROW LEVEL SECURITY;

--
-- Name: extracted_compliance_elements extracted_compliance_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY extracted_compliance_insert ON public.extracted_compliance_elements FOR INSERT WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: extracted_compliance_elements extracted_compliance_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY extracted_compliance_select ON public.extracted_compliance_elements FOR SELECT USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: extracted_compliance_elements extracted_compliance_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY extracted_compliance_update ON public.extracted_compliance_elements FOR UPDATE USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: extracted_spaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.extracted_spaces ENABLE ROW LEVEL SECURITY;

--
-- Name: extracted_spaces extracted_spaces_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY extracted_spaces_insert ON public.extracted_spaces FOR INSERT WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: extracted_spaces extracted_spaces_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY extracted_spaces_select ON public.extracted_spaces FOR SELECT USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: extracted_spaces extracted_spaces_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY extracted_spaces_update ON public.extracted_spaces FOR UPDATE USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: extracted_task_suggestions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.extracted_task_suggestions ENABLE ROW LEVEL SECURITY;

--
-- Name: extracted_task_suggestions extracted_tasks_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY extracted_tasks_insert ON public.extracted_task_suggestions FOR INSERT WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: extracted_task_suggestions extracted_tasks_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY extracted_tasks_select ON public.extracted_task_suggestions FOR SELECT USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: extracted_task_suggestions extracted_tasks_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY extracted_tasks_update ON public.extracted_task_suggestions FOR UPDATE USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: group_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

--
-- Name: group_members group_members_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY group_members_delete ON public.group_members FOR DELETE USING ((group_id IN ( SELECT groups.id
   FROM public.groups
  WHERE (groups.org_id = public.current_org_id()))));


--
-- Name: group_members group_members_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY group_members_insert ON public.group_members FOR INSERT WITH CHECK ((group_id IN ( SELECT groups.id
   FROM public.groups
  WHERE (groups.org_id = public.current_org_id()))));


--
-- Name: group_members group_members_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY group_members_select ON public.group_members FOR SELECT USING ((group_id IN ( SELECT groups.id
   FROM public.groups
  WHERE (groups.org_id = public.current_org_id()))));


--
-- Name: group_members group_members_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY group_members_update ON public.group_members FOR UPDATE USING ((group_id IN ( SELECT groups.id
   FROM public.groups
  WHERE (groups.org_id = public.current_org_id()))));


--
-- Name: groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

--
-- Name: groups groups_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY groups_delete ON public.groups FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: groups groups_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY groups_insert ON public.groups FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: groups groups_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY groups_select ON public.groups FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: groups groups_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY groups_update ON public.groups FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: icon_library; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.icon_library ENABLE ROW LEVEL SECURITY;

--
-- Name: icon_library icon_library_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icon_library_select_authenticated ON public.icon_library FOR SELECT TO authenticated USING (true);


--
-- Name: icon_search_synonyms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.icon_search_synonyms ENABLE ROW LEVEL SECURITY;

--
-- Name: icon_search_synonyms icon_search_synonyms_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icon_search_synonyms_select_authenticated ON public.icon_search_synonyms FOR SELECT TO authenticated USING (true);


--
-- Name: intake_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.intake_items ENABLE ROW LEVEL SECURITY;

--
-- Name: intake_items intake_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY intake_items_insert ON public.intake_items FOR INSERT TO authenticated WITH CHECK (((auth.uid() IS NOT NULL) AND (created_by = auth.uid()) AND (org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))));


--
-- Name: intake_items intake_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY intake_items_select ON public.intake_items FOR SELECT TO authenticated USING (((auth.uid() IS NOT NULL) AND (org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))) AND ((created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = intake_items.org_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'manager'::text]))))))));


--
-- Name: intake_items intake_items_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY intake_items_update_own ON public.intake_items FOR UPDATE TO authenticated USING (((auth.uid() IS NOT NULL) AND (created_by = auth.uid()) AND (status <> ALL (ARRAY['confirmed'::public.intake_item_status, 'ignored'::public.intake_item_status, 'failed'::public.intake_item_status])))) WITH CHECK (((auth.uid() IS NOT NULL) AND (created_by = auth.uid())));


--
-- Name: invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge knowledge_insert_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_insert_org ON public.knowledge FOR INSERT TO authenticated WITH CHECK (((scope = 'organisation'::text) AND (org_id IS NOT NULL) AND public.is_org_owner_or_manager(org_id)));


--
-- Name: knowledge_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_links ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_links knowledge_links_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_links_select ON public.knowledge_links FOR SELECT TO authenticated USING (public.is_org_member(org_id));


--
-- Name: knowledge_links knowledge_links_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_links_write ON public.knowledge_links TO authenticated USING (public.is_org_owner_or_manager(org_id)) WITH CHECK (public.is_org_owner_or_manager(org_id));


--
-- Name: knowledge knowledge_select_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_select_org ON public.knowledge FOR SELECT TO authenticated USING ((((scope = 'organisation'::text) AND (org_id IS NOT NULL) AND public.is_org_member(org_id)) OR ((scope = 'platform'::text) AND (status = 'published'::text))));


--
-- Name: knowledge_sources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_sources knowledge_sources_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_sources_select ON public.knowledge_sources FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.knowledge k
  WHERE ((k.id = knowledge_sources.knowledge_id) AND (((k.scope = 'organisation'::text) AND (k.org_id IS NOT NULL) AND public.is_org_member(k.org_id)) OR ((k.scope = 'platform'::text) AND (k.status = 'published'::text)))))));


--
-- Name: knowledge_sources knowledge_sources_write_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_sources_write_org ON public.knowledge_sources TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.knowledge k
  WHERE ((k.id = knowledge_sources.knowledge_id) AND (k.scope = 'organisation'::text) AND (k.org_id IS NOT NULL) AND public.is_org_owner_or_manager(k.org_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.knowledge k
  WHERE ((k.id = knowledge_sources.knowledge_id) AND (k.scope = 'organisation'::text) AND (k.org_id IS NOT NULL) AND public.is_org_owner_or_manager(k.org_id)))));


--
-- Name: knowledge knowledge_update_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_update_org ON public.knowledge FOR UPDATE TO authenticated USING (((scope = 'organisation'::text) AND (org_id IS NOT NULL) AND public.is_org_owner_or_manager(org_id))) WITH CHECK (((scope = 'organisation'::text) AND (org_id IS NOT NULL) AND public.is_org_owner_or_manager(org_id)));


--
-- Name: knowledge_usage_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_usage_events ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_usage_events knowledge_usage_events_select_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_usage_events_select_org ON public.knowledge_usage_events FOR SELECT TO authenticated USING (((org_id IS NOT NULL) AND public.is_org_member(org_id)));


--
-- Name: knowledge_verification_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_verification_events ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_verification_events knowledge_verification_events_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_verification_events_select ON public.knowledge_verification_events FOR SELECT TO authenticated USING ((((org_id IS NOT NULL) AND public.is_org_member(org_id)) OR (EXISTS ( SELECT 1
   FROM public.knowledge k
  WHERE ((k.id = knowledge_verification_events.knowledge_id) AND (k.scope = 'platform'::text) AND (k.status = 'published'::text))))));


--
-- Name: labels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

--
-- Name: labels labels_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY labels_delete ON public.labels FOR DELETE USING ((org_id = public.current_org_id()));


--
-- Name: labels labels_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY labels_insert ON public.labels FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: labels labels_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY labels_select ON public.labels FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: labels labels_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY labels_update ON public.labels FOR UPDATE USING ((org_id = public.current_org_id()));


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_delete ON public.messages FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: messages messages_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_insert ON public.messages FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: messages messages_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_select ON public.messages FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: messages messages_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_update ON public.messages FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: messaging_usage_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messaging_usage_events ENABLE ROW LEVEL SECURITY;

--
-- Name: messaging_usage_events messaging_usage_select_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messaging_usage_select_members ON public.messaging_usage_events FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: notification_channels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_channels notification_channels_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_channels_delete ON public.notification_channels FOR DELETE USING ((org_id = public.current_org_id()));


--
-- Name: notification_channels notification_channels_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_channels_insert ON public.notification_channels FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: notification_channels notification_channels_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_channels_select ON public.notification_channels FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: notification_channels notification_channels_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_channels_update ON public.notification_channels FOR UPDATE USING ((org_id = public.current_org_id()));


--
-- Name: org_api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: org_api_keys org_api_keys_select_owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_api_keys_select_owners ON public.org_api_keys FOR SELECT USING (((org_id = public.current_org_id()) AND (EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = org_api_keys.org_id) AND (om.user_id = auth.uid()) AND ((om.is_primary_owner = true) OR (lower(om.role) = 'owner'::text)))))));


--
-- Name: org_compliance_summary; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_compliance_summary ENABLE ROW LEVEL SECURITY;

--
-- Name: org_compliance_summary org_compliance_summary_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_compliance_summary_delete ON public.org_compliance_summary FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: org_compliance_summary org_compliance_summary_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_compliance_summary_insert ON public.org_compliance_summary FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: org_compliance_summary org_compliance_summary_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_compliance_summary_select ON public.org_compliance_summary FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: org_compliance_summary org_compliance_summary_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_compliance_summary_update ON public.org_compliance_summary FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: org_entitlement_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_entitlement_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: org_entitlement_overrides org_entitlement_overrides_select_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_entitlement_overrides_select_members ON public.org_entitlement_overrides FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: organisations org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_insert ON public.organisations FOR INSERT TO authenticated WITH CHECK (((auth.uid() IS NOT NULL) AND ((created_by IS NULL) OR (created_by = auth.uid()))));


--
-- Name: org_retention_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_retention_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: org_retention_settings org_retention_settings_select_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_retention_settings_select_members ON public.org_retention_settings FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: org_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: org_settings org_settings_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_settings_insert ON public.org_settings FOR INSERT WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: org_settings org_settings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_settings_select ON public.org_settings FOR SELECT USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: org_settings org_settings_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_settings_update ON public.org_settings FOR UPDATE USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: org_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: org_subscriptions org_subscriptions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_subscriptions_select ON public.org_subscriptions FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: org_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: org_usage org_usage_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_usage_select ON public.org_usage FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: organisation_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organisation_members ENABLE ROW LEVEL SECURITY;

--
-- Name: organisation_members organisation_members_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organisation_members_select ON public.organisation_members FOR SELECT TO authenticated USING (((auth.uid() IS NOT NULL) AND (org_id = ANY (public.user_org_ids()))));


--
-- Name: POLICY organisation_members_select ON organisation_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY organisation_members_select ON public.organisation_members IS 'Any authenticated member can list all memberships for orgs they belong to (team roster / assignees).';


--
-- Name: organisations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

--
-- Name: organisations organisations_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organisations_member_select ON public.organisations FOR SELECT USING (((id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))) OR (id = public.current_org_id())));


--
-- Name: organisations organisations_slug_lookup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organisations_slug_lookup ON public.organisations FOR SELECT USING (true);


--
-- Name: plan_extraction_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_extraction_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_extraction_runs plan_extraction_runs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_extraction_runs_insert ON public.plan_extraction_runs FOR INSERT WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: plan_extraction_runs plan_extraction_runs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_extraction_runs_select ON public.plan_extraction_runs FOR SELECT USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: plan_extraction_runs plan_extraction_runs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_extraction_runs_update ON public.plan_extraction_runs FOR UPDATE USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: properties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

--
-- Name: properties properties_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY properties_delete ON public.properties FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: properties properties_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY properties_insert ON public.properties FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: properties properties_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY properties_select ON public.properties FOR SELECT TO authenticated USING (((auth.uid() IS NOT NULL) AND public.member_can_access_property(org_id, id)));


--
-- Name: properties properties_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY properties_update ON public.properties FOR UPDATE USING (((auth.uid() IS NOT NULL) AND (org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))));


--
-- Name: property_compliance_status; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_compliance_status ENABLE ROW LEVEL SECURITY;

--
-- Name: property_compliance_status property_compliance_status_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_compliance_status_delete ON public.property_compliance_status FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: property_compliance_status property_compliance_status_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_compliance_status_insert ON public.property_compliance_status FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: property_compliance_status property_compliance_status_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_compliance_status_select ON public.property_compliance_status FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: property_compliance_status property_compliance_status_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_compliance_status_update ON public.property_compliance_status FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: property_details; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_details ENABLE ROW LEVEL SECURITY;

--
-- Name: property_details property_details_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_details_insert ON public.property_details FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = property_details.org_id) AND (om.user_id = auth.uid())))));


--
-- Name: property_details property_details_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_details_select ON public.property_details FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = property_details.org_id) AND (om.user_id = auth.uid())))));


--
-- Name: property_details property_details_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_details_update ON public.property_details FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = property_details.org_id) AND (om.user_id = auth.uid())))));


--
-- Name: property_image_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_image_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: property_image_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_image_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: property_plan_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_plan_files ENABLE ROW LEVEL SECURITY;

--
-- Name: property_plan_files property_plan_files_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_plan_files_insert ON public.property_plan_files FOR INSERT WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: property_plan_files property_plan_files_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_plan_files_select ON public.property_plan_files FOR SELECT USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: property_plan_files property_plan_files_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_plan_files_update ON public.property_plan_files FOR UPDATE USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: property_plan_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_plan_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: property_plan_pages property_plan_pages_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_plan_pages_insert ON public.property_plan_pages FOR INSERT WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: property_plan_pages property_plan_pages_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_plan_pages_select ON public.property_plan_pages FOR SELECT USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: property_plan_pages property_plan_pages_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_plan_pages_update ON public.property_plan_pages FOR UPDATE USING ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid()))));


--
-- Name: property_themes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_themes ENABLE ROW LEVEL SECURITY;

--
-- Name: property_themes property_themes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_themes_insert ON public.property_themes FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.properties p
     JOIN public.organisation_members om ON (((om.org_id = p.org_id) AND (om.user_id = auth.uid()))))
  WHERE (p.id = property_themes.property_id))));


--
-- Name: property_themes property_themes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_themes_select ON public.property_themes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.properties p
     JOIN public.organisation_members om ON (((om.org_id = p.org_id) AND (om.user_id = auth.uid()))))
  WHERE (p.id = property_themes.property_id))));


--
-- Name: rule_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rule_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: rule_categories rule_categories_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rule_categories_delete ON public.rule_categories FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: rule_categories rule_categories_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rule_categories_insert ON public.rule_categories FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: rule_categories rule_categories_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rule_categories_select ON public.rule_categories FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: rule_categories rule_categories_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rule_categories_update ON public.rule_categories FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: signal_recommendation_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.signal_recommendation_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: signal_recommendation_templates signal_recommendation_templates_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY signal_recommendation_templates_select_authenticated ON public.signal_recommendation_templates FOR SELECT TO authenticated USING (true);


--
-- Name: signal_source_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.signal_source_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: signal_source_runs signal_source_runs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY signal_source_runs_select ON public.signal_source_runs FOR SELECT USING (((org_id IS NULL) OR (org_id = public.current_org_id())));


--
-- Name: signals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

--
-- Name: signals signals_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY signals_delete ON public.signals FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: signals signals_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY signals_insert ON public.signals FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: signals signals_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY signals_select ON public.signals FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: signals signals_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY signals_update ON public.signals FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: space_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.space_types ENABLE ROW LEVEL SECURITY;

--
-- Name: space_types space_types_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY space_types_select ON public.space_types FOR SELECT USING (true);


--
-- Name: spaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

--
-- Name: spaces spaces_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY spaces_delete ON public.spaces FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: spaces spaces_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY spaces_insert ON public.spaces FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: spaces spaces_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY spaces_select ON public.spaces FOR SELECT TO authenticated USING (((auth.uid() IS NOT NULL) AND (org_id IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))));


--
-- Name: spaces spaces_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY spaces_update ON public.spaces FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: subscription_tiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_tiers subscription_tiers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subscription_tiers_select ON public.subscription_tiers FOR SELECT USING ((is_active = true));


--
-- Name: subtasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

--
-- Name: subtasks subtasks_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subtasks_delete ON public.subtasks FOR DELETE TO authenticated USING (((auth.uid() IS NOT NULL) AND (org_id IN ( SELECT om.org_id
   FROM public.organisation_members om
  WHERE (om.user_id = auth.uid())))));


--
-- Name: subtasks subtasks_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subtasks_insert ON public.subtasks FOR INSERT TO authenticated WITH CHECK (((auth.uid() IS NOT NULL) AND (org_id IN ( SELECT om.org_id
   FROM public.organisation_members om
  WHERE (om.user_id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM public.tasks t
  WHERE ((t.id = subtasks.task_id) AND (t.org_id = subtasks.org_id))))));


--
-- Name: subtasks subtasks_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subtasks_select ON public.subtasks FOR SELECT TO authenticated USING (((auth.uid() IS NOT NULL) AND ((org_id IN ( SELECT om.org_id
   FROM public.organisation_members om
  WHERE (om.user_id = auth.uid()))) OR (task_id IN ( SELECT cta.task_id
   FROM public.contractor_task_access cta
  WHERE (cta.contractor_token = public.current_contractor_token()))))));


--
-- Name: subtasks subtasks_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subtasks_update ON public.subtasks FOR UPDATE TO authenticated USING (((auth.uid() IS NOT NULL) AND ((org_id IN ( SELECT om.org_id
   FROM public.organisation_members om
  WHERE (om.user_id = auth.uid()))) OR (task_id IN ( SELECT cta.task_id
   FROM public.contractor_task_access cta
  WHERE (cta.contractor_token = public.current_contractor_token())))))) WITH CHECK (((auth.uid() IS NOT NULL) AND ((org_id IN ( SELECT om.org_id
   FROM public.organisation_members om
  WHERE (om.user_id = auth.uid()))) OR (task_id IN ( SELECT cta.task_id
   FROM public.contractor_task_access cta
  WHERE (cta.contractor_token = public.current_contractor_token()))))));


--
-- Name: task_activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

--
-- Name: task_activity task_activity_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_activity_delete ON public.task_activity FOR DELETE USING ((org_id = public.current_org_id()));


--
-- Name: task_activity task_activity_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_activity_insert ON public.task_activity FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: task_activity task_activity_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_activity_select ON public.task_activity FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: task_activity task_activity_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_activity_update ON public.task_activity FOR UPDATE USING ((org_id = public.current_org_id()));


--
-- Name: task_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: task_attachments task_attachments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_attachments_delete ON public.task_attachments FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_attachments task_attachments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_attachments_insert ON public.task_attachments FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_attachments task_attachments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_attachments_select ON public.task_attachments FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_attachments task_attachments_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_attachments_update ON public.task_attachments FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_compliance_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_compliance_events ENABLE ROW LEVEL SECURITY;

--
-- Name: task_compliance_events task_compliance_events_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_compliance_events_delete ON public.task_compliance_events FOR DELETE USING ((org_id = public.current_org_id()));


--
-- Name: task_compliance_events task_compliance_events_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_compliance_events_insert ON public.task_compliance_events FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: task_compliance_events task_compliance_events_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_compliance_events_select ON public.task_compliance_events FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: task_compliance_events task_compliance_events_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_compliance_events_update ON public.task_compliance_events FOR UPDATE USING ((org_id = public.current_org_id()));


--
-- Name: task_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: task_groups task_groups_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_groups_delete ON public.task_groups FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_groups task_groups_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_groups_insert ON public.task_groups FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_groups task_groups_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_groups_select ON public.task_groups FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_groups task_groups_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_groups_update ON public.task_groups FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_image_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_image_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: task_image_actions task_image_actions_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_image_actions_delete ON public.task_image_actions FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_image_actions task_image_actions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_image_actions_insert ON public.task_image_actions FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_image_actions task_image_actions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_image_actions_select ON public.task_image_actions FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_image_actions task_image_actions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_image_actions_update ON public.task_image_actions FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_image_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_image_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: task_image_versions task_image_versions_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_image_versions_delete ON public.task_image_versions FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_image_versions task_image_versions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_image_versions_insert ON public.task_image_versions FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_image_versions task_image_versions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_image_versions_select ON public.task_image_versions FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_image_versions task_image_versions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_image_versions_update ON public.task_image_versions FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_images ENABLE ROW LEVEL SECURITY;

--
-- Name: task_images task_images_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_images_delete ON public.task_images FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_images task_images_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_images_insert ON public.task_images FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_images task_images_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_images_select ON public.task_images FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_images task_images_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_images_update ON public.task_images FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_labels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;

--
-- Name: task_labels task_labels_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_labels_delete ON public.task_labels FOR DELETE USING ((org_id = public.current_org_id()));


--
-- Name: task_labels task_labels_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_labels_insert ON public.task_labels FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: task_labels task_labels_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_labels_select ON public.task_labels FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: task_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: task_messages task_messages_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_messages_delete ON public.task_messages FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_messages task_messages_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_messages_insert ON public.task_messages FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_messages task_messages_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_messages_select ON public.task_messages FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_messages task_messages_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_messages_update ON public.task_messages FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: task_recurrence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_recurrence ENABLE ROW LEVEL SECURITY;

--
-- Name: task_recurrence task_recurrence_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_recurrence_delete ON public.task_recurrence FOR DELETE USING ((org_id = public.current_org_id()));


--
-- Name: task_recurrence task_recurrence_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_recurrence_insert ON public.task_recurrence FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: task_recurrence task_recurrence_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_recurrence_select ON public.task_recurrence FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: task_recurrence task_recurrence_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_recurrence_update ON public.task_recurrence FOR UPDATE USING ((org_id = public.current_org_id()));


--
-- Name: task_spaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_spaces ENABLE ROW LEVEL SECURITY;

--
-- Name: task_spaces task_spaces_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_spaces_insert ON public.task_spaces FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.tasks t
     JOIN public.organisation_members om ON (((om.org_id = t.org_id) AND (om.user_id = auth.uid()))))
  WHERE (t.id = task_spaces.task_id))));


--
-- Name: task_spaces task_spaces_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_spaces_select ON public.task_spaces FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.tasks t
     JOIN public.organisation_members om ON (((om.org_id = t.org_id) AND (om.user_id = auth.uid()))))
  WHERE (t.id = task_spaces.task_id))));


--
-- Name: task_themes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_themes ENABLE ROW LEVEL SECURITY;

--
-- Name: task_themes task_themes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_themes_delete ON public.task_themes FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.tasks t
     JOIN public.organisation_members om ON ((om.org_id = t.org_id)))
  WHERE ((t.id = task_themes.task_id) AND (om.user_id = auth.uid())))));


--
-- Name: task_themes task_themes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_themes_insert ON public.task_themes FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.tasks t
     JOIN public.organisation_members om ON ((om.org_id = t.org_id)))
  WHERE ((t.id = task_themes.task_id) AND (om.user_id = auth.uid())))));


--
-- Name: task_themes task_themes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_themes_select ON public.task_themes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.tasks t
     JOIN public.organisation_members om ON ((om.org_id = t.org_id)))
  WHERE ((t.id = task_themes.task_id) AND (om.user_id = auth.uid())))));


--
-- Name: task_threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: task_threads task_threads_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_threads_delete ON public.task_threads FOR DELETE USING ((org_id = public.current_org_id()));


--
-- Name: task_threads task_threads_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_threads_insert ON public.task_threads FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: task_threads task_threads_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_threads_select ON public.task_threads FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: task_threads task_threads_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_threads_update ON public.task_threads FOR UPDATE USING ((org_id = public.current_org_id()));


--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks tasks_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_delete ON public.tasks FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: tasks tasks_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated WITH CHECK (((auth.uid() IS NOT NULL) AND public.member_can_create_tasks(org_id) AND ((property_id IS NULL) OR public.member_can_access_property(org_id, property_id))));


--
-- Name: tasks tasks_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.organisation_members
  WHERE ((organisation_members.org_id = tasks.org_id) AND (organisation_members.user_id = auth.uid())))) AND ((((auth.jwt() -> 'app_metadata'::text) ->> 'dev_mode'::text) = 'true'::text) OR (((auth.jwt() -> 'app_metadata'::text) -> 'dev_mode'::text) = 'true'::jsonb) OR ((auth.jwt() ->> 'role'::text) IS DISTINCT FROM 'staff'::text) OR (((auth.jwt() ->> 'role'::text) = 'staff'::text) AND ((property_id IS NULL) OR (property_id = ANY (public.assigned_properties())))))));


--
-- Name: tasks tasks_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_update ON public.tasks FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: teams teams_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teams_delete ON public.teams FOR DELETE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: teams teams_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teams_insert ON public.teams FOR INSERT WITH CHECK (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: teams teams_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teams_select ON public.teams FOR SELECT USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: teams teams_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teams_update ON public.teams FOR UPDATE USING (((org_id IS NOT NULL) AND (org_id = public.current_org_id())));


--
-- Name: checklist_template_items template_items_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY template_items_delete ON public.checklist_template_items FOR DELETE USING ((template_id IN ( SELECT checklist_templates.id
   FROM public.checklist_templates
  WHERE (checklist_templates.org_id = public.current_org_id()))));


--
-- Name: checklist_template_items template_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY template_items_insert ON public.checklist_template_items FOR INSERT WITH CHECK ((template_id IN ( SELECT checklist_templates.id
   FROM public.checklist_templates
  WHERE (checklist_templates.org_id = public.current_org_id()))));


--
-- Name: checklist_template_items template_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY template_items_select ON public.checklist_template_items FOR SELECT USING ((template_id IN ( SELECT checklist_templates.id
   FROM public.checklist_templates
  WHERE (checklist_templates.org_id = public.current_org_id()))));


--
-- Name: checklist_template_items template_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY template_items_update ON public.checklist_template_items FOR UPDATE USING ((template_id IN ( SELECT checklist_templates.id
   FROM public.checklist_templates
  WHERE (checklist_templates.org_id = public.current_org_id()))));


--
-- Name: themes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;

--
-- Name: themes themes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY themes_delete ON public.themes FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = themes.org_id) AND (om.user_id = auth.uid())))));


--
-- Name: themes themes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY themes_insert ON public.themes FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = themes.org_id) AND (om.user_id = auth.uid())))));


--
-- Name: themes themes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY themes_select ON public.themes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = themes.org_id) AND (om.user_id = auth.uid())))));


--
-- Name: themes themes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY themes_update ON public.themes FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = themes.org_id) AND (om.user_id = auth.uid())))));


--
-- Name: thread_message_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.thread_message_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: thread_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: thread_messages thread_messages_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY thread_messages_delete ON public.thread_messages FOR DELETE USING ((org_id = public.current_org_id()));


--
-- Name: thread_messages thread_messages_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY thread_messages_insert ON public.thread_messages FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: thread_messages thread_messages_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY thread_messages_select ON public.thread_messages FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: thread_messages thread_messages_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY thread_messages_update ON public.thread_messages FOR UPDATE USING ((org_id = public.current_org_id()));


--
-- Name: thread_message_attachments thread_msg_attachments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY thread_msg_attachments_delete ON public.thread_message_attachments FOR DELETE USING ((org_id = public.current_org_id()));


--
-- Name: thread_message_attachments thread_msg_attachments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY thread_msg_attachments_insert ON public.thread_message_attachments FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: thread_message_attachments thread_msg_attachments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY thread_msg_attachments_select ON public.thread_message_attachments FOR SELECT USING ((org_id = public.current_org_id()));


--
-- Name: thread_message_attachments thread_msg_attachments_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY thread_msg_attachments_update ON public.thread_message_attachments FOR UPDATE USING ((org_id = public.current_org_id()));


--
-- PostgreSQL database dump complete
--



-- Default PostgREST grants (RLS remains the access control).
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
