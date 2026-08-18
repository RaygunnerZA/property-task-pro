-- Description: Canonical objects missing from live gbtexo (keep-docs). Does not drop live legacy tables.
-- See @Docs/Schema_Discrepancy_Register.md. Do not weaken existing live RLS.

-- ---------------------------------------------------------------------------
-- Membership helper used by newer policies (was never on live)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_user_org_membership(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.organisation_members
    WHERE org_id = p_org_id
      AND user_id = v_user_id
      AND COALESCE(membership_status, 'active') = 'active'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_user_org_membership(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_user_org_membership(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- geo_captures (enum missing on live; signals table already exists)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.geo_capture_context AS ENUM (
    'task_complete', 'inspection_complete', 'photo_upload',
    'asset_verify', 'compliance_record', 'site_visit'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.geo_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  attachment_id UUID,
  compliance_document_id UUID,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  capture_context public.geo_capture_context NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS geo_captures_org_property
  ON public.geo_captures (org_id, property_id, captured_at DESC);

ALTER TABLE public.geo_captures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "geo_captures_select" ON public.geo_captures;
CREATE POLICY "geo_captures_select" ON public.geo_captures
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "geo_captures_insert" ON public.geo_captures;
CREATE POLICY "geo_captures_insert" ON public.geo_captures
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(org_id)
    AND user_id = auth.uid()
  );

GRANT SELECT, INSERT ON public.geo_captures TO authenticated;

-- ---------------------------------------------------------------------------
-- Docs Ch 3 stubs that never landed on live (minimal columns + org RLS)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.schedule_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS schedule_items_org ON public.schedule_items;
CREATE POLICY schedule_items_org ON public.schedule_items
  FOR ALL TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

CREATE TABLE IF NOT EXISTS public.task_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_instances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS task_instances_org ON public.task_instances;
CREATE POLICY task_instances_org ON public.task_instances
  FOR ALL TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

CREATE TABLE IF NOT EXISTS public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  title TEXT,
  severity TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS issues_org ON public.issues;
CREATE POLICY issues_org ON public.issues
  FOR ALL TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

CREATE TABLE IF NOT EXISTS public.evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  attachment_id UUID NOT NULL REFERENCES public.attachments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS evidence_org ON public.evidence;
CREATE POLICY evidence_org ON public.evidence
  FOR ALL TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

CREATE TABLE IF NOT EXISTS public.contractor_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contractor_tokens ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_items, public.task_instances, public.issues, public.evidence, public.contractor_tokens TO authenticated;

-- Phase 2: Admin Panel — platform_admins table and helper function.
--
-- The sentinel organisation row (00000000-...) is required so that admin RPCs
-- can write to audit_logs (which has org_id NOT NULL REFERENCES organisations(id)).
-- platform_admins can only be inserted directly in the DB — no API path exists.
--
-- Bootstrap the first admin (Supabase SQL editor or `psql`; use auth.users.id for that login):
--   INSERT INTO public.platform_admins (user_id) VALUES ('YOUR_AUTH_USER_UUID'::uuid);

-- Sentinel organisation for platform-level audit log entries.
-- ON CONFLICT DO NOTHING makes this migration idempotent.
SET session_replication_role = replica;
INSERT INTO organisations (id, name, org_type, created_by)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  '_platform',
  'business',
  NULL
)
ON CONFLICT (id) DO NOTHING;
SET session_replication_role = origin;

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes     TEXT
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may check whether they are a platform admin.
-- This is required by the frontend guard and by the SECURITY DEFINER RPCs.
CREATE POLICY "platform_admins_self_select" ON public.platform_admins
  FOR SELECT USING (user_id = auth.uid());

-- No INSERT or DELETE policy: manage via service role / direct DB only.

-- Helper used by all admin RPCs.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  );
$$;


REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;


-- Phase 2: Admin Panel — SECURITY DEFINER RPCs for cross-org read access.
--
-- All functions:
--   1. Check is_platform_admin() and return empty result if not admin.
--   2. Write an audit_logs entry using the sentinel org_id.
--   3. Return only the fields needed by the UI.
--
-- Dependency: 20260511000001_create_platform_admins.sql must run first.
-- Dependency: 20260317000002_create_ai_requests.sql must exist for admin_get_org_ai_requests.

-- ---------------------------------------------------------------------------
-- admin_list_orgs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_orgs()
RETURNS TABLE (
  org_id         UUID,
  org_name       TEXT,
  org_type       TEXT,
  created_at     TIMESTAMPTZ,
  member_count   BIGINT,
  property_count BIGINT,
  task_count     BIGINT,
  last_activity  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RETURN;
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'platform',
    auth.uid(),
    'admin.orgs.listed',
    jsonb_build_object('timestamp', now())
  );

  RETURN QUERY
  SELECT
    o.id                                             AS org_id,
    o.name                                           AS org_name,
    o.org_type::TEXT                                 AS org_type,
    o.created_at                                     AS created_at,
    COUNT(DISTINCT om.user_id)                       AS member_count,
    COUNT(DISTINCT p.id)                             AS property_count,
    COUNT(DISTINCT t.id)                             AS task_count,
    MAX(GREATEST(
      COALESCE(t.updated_at, t.created_at),
      COALESCE(p.updated_at, p.created_at)
    ))                                               AS last_activity
  FROM organisations o
  LEFT JOIN organisation_members om ON om.org_id = o.id
  LEFT JOIN properties p            ON p.org_id = o.id
  LEFT JOIN tasks t                 ON t.org_id = o.id
  WHERE o.id != '00000000-0000-0000-0000-000000000000'::uuid -- exclude sentinel
  GROUP BY o.id, o.name, o.org_type, o.created_at
  ORDER BY o.created_at DESC;
END;
$$;

-- ---------------------------------------------------------------------------
-- admin_get_org
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_org(p_org_id UUID)
RETURNS TABLE (
  org_id     UUID,
  org_name   TEXT,
  org_type   TEXT,
  created_at TIMESTAMPTZ,
  created_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RETURN;
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'organisation',
    p_org_id,
    'admin.org.viewed',
    jsonb_build_object('viewed_org_id', p_org_id)
  );

  RETURN QUERY
  SELECT o.id, o.name, o.org_type::TEXT, o.created_at, o.created_by
  FROM organisations o
  WHERE o.id = p_org_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- admin_list_org_members
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_org_members(p_org_id UUID)
RETURNS TABLE (
  user_id         UUID,
  email           TEXT,
  role            TEXT,
  joined_at       TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RETURN;
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'organisation',
    p_org_id,
    'admin.org.members.listed',
    jsonb_build_object('viewed_org_id', p_org_id)
  );

  RETURN QUERY
  SELECT
    om.user_id,
    au.email,
    om.role,
    om.created_at AS joined_at,
    au.last_sign_in_at
  FROM organisation_members om
  JOIN auth.users au ON au.id = om.user_id
  WHERE om.org_id = p_org_id
  ORDER BY om.created_at DESC;
END;
$$;

-- ---------------------------------------------------------------------------
-- admin_get_org_activity
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_org_activity(p_org_id UUID, p_limit INT DEFAULT 50)
RETURNS TABLE (
  id          UUID,
  actor_id    UUID,
  entity_type TEXT,
  entity_id   UUID,
  action      TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RETURN;
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'organisation',
    p_org_id,
    'admin.org.activity.viewed',
    jsonb_build_object('viewed_org_id', p_org_id)
  );

  RETURN QUERY
  SELECT al.id, al.actor_id, al.entity_type, al.entity_id, al.action, al.metadata, al.created_at
  FROM audit_logs al
  WHERE al.org_id = p_org_id
  ORDER BY al.created_at DESC
  LIMIT LEAST(p_limit, 200);
END;
$$;

-- ---------------------------------------------------------------------------
-- admin_get_org_ai_requests
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_org_ai_requests(p_org_id UUID, p_limit INT DEFAULT 100)
RETURNS TABLE (
  id            UUID,
  user_id       UUID,
  function_name TEXT,
  model_used    TEXT,
  provider      TEXT,
  status        TEXT,
  latency_ms    INT,
  cost_usd      NUMERIC,
  input_tokens  INT,
  output_tokens INT,
  entity_type   TEXT,
  entity_id     UUID,
  error_message TEXT,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RETURN;
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'organisation',
    p_org_id,
    'admin.org.ai_requests.viewed',
    jsonb_build_object('viewed_org_id', p_org_id)
  );

  RETURN QUERY
  SELECT
    r.id, r.user_id, r.function_name, r.model_used, r.provider,
    r.status, r.latency_ms, r.cost_usd, r.input_tokens, r.output_tokens,
    r.entity_type, r.entity_id, r.error_message, r.created_at
  FROM ai_requests r
  WHERE r.org_id = p_org_id
  ORDER BY r.created_at DESC
  LIMIT LEAST(p_limit, 500);
END;
$$;


-- Task followers: watchers who are not the responsible party.
-- @Docs/02_Identity.md §11 · @Docs/05_Task_Engine.md §5.2
--
-- Followers may comment. They do not gain UPDATE on task status/details unless
-- they are Owner/Manager or the assigned user. Staff "complete assigned work"
-- is the assigned user, not a follower.

-- ---------------------------------------------------------------------------
-- 1) Who may change task status / details
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.member_can_mutate_task(
  p_org_id uuid,
  p_assigned_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organisation_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND COALESCE(om.membership_status, 'active') = 'active'
      AND (
        om.is_primary_owner = true
        OR lower(om.role) IN ('owner', 'manager')
        OR (p_assigned_user_id IS NOT NULL AND p_assigned_user_id = auth.uid())
      )
  );
$$;

REVOKE ALL ON FUNCTION public.member_can_mutate_task(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.member_can_mutate_task(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.member_can_mutate_task(uuid, uuid) IS
  'Owner/Manager or the assigned user may change task status and details. Followers and other Staff cannot.';

DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (public.member_can_mutate_task(org_id, assigned_user_id))
  WITH CHECK (public.member_can_mutate_task(org_id, assigned_user_id));

-- ---------------------------------------------------------------------------
-- 2) Junction
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_followers (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_followers_org ON public.task_followers (org_id);
CREATE INDEX IF NOT EXISTS idx_task_followers_user ON public.task_followers (user_id);

COMMENT ON TABLE public.task_followers IS
  'Users watching a task. Not the responsible assignee. Comment-only unless Owner/Manager.';

ALTER TABLE public.task_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_followers_select" ON public.task_followers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_followers.task_id
        AND t.org_id = task_followers.org_id
    )
  );

CREATE POLICY "task_followers_insert" ON public.task_followers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by IS NOT DISTINCT FROM auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_followers.task_id
        AND t.org_id = task_followers.org_id
        AND public.member_can_mutate_task(t.org_id, t.assigned_user_id)
        AND t.assigned_user_id IS DISTINCT FROM task_followers.user_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.organisation_members om
      WHERE om.org_id = task_followers.org_id
        AND om.user_id = task_followers.user_id
        AND COALESCE(om.membership_status, 'active') = 'active'
    )
  );

CREATE POLICY "task_followers_delete" ON public.task_followers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_followers.task_id
        AND t.org_id = task_followers.org_id
        AND public.member_can_mutate_task(t.org_id, t.assigned_user_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Expose follower ids on tasks_view (same shape as latest view + followers)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.tasks_view CASCADE;

CREATE VIEW public.tasks_view
WITH (security_invoker = true)
AS
SELECT
  t.id,
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
  COALESCE((
    SELECT array_agg(tf.user_id ORDER BY tf.created_at)
    FROM public.task_followers tf
    WHERE tf.task_id = t.id
  ), ARRAY[]::uuid[]) AS follower_user_ids,
  COALESCE((
    SELECT json_agg(DISTINCT jsonb_build_object('id', sp_1.id, 'name', sp_1.name))
    FROM unnest(COALESCE(t.space_ids, ARRAY[]::uuid[])) sid(space_id)
    JOIN spaces sp_1 ON sp_1.id = sid.space_id AND sp_1.org_id = t.org_id
  ), '[]'::json) AS spaces,
  COALESCE(
    json_agg(DISTINCT jsonb_build_object('id', th.id, 'name', th.name, 'color', th.color, 'icon', th.icon))
      FILTER (WHERE th.id IS NOT NULL),
    '[]'::json
  ) AS themes,
  COALESCE((
    SELECT json_agg(DISTINCT jsonb_build_object('id', tm.id, 'name', tm.name, 'color', tm.color, 'icon', tm.icon))
    FROM unnest(COALESCE(t.assigned_team_ids, ARRAY[]::uuid[])) tid(team_id)
    JOIN teams tm ON tm.id = tid.team_id
  ), '[]'::json) AS teams,
  COALESCE((
    SELECT json_agg(
      jsonb_build_object(
        'id', att.id,
        'file_url', att.file_url,
        'thumbnail_url', att.thumbnail_url,
        'file_name', att.file_name,
        'file_type', att.file_type
      )
      ORDER BY att.created_at DESC
    )
    FROM attachments att
    WHERE att.parent_id = t.id
      AND att.parent_type = 'task'
      AND att.org_id = t.org_id
      AND COALESCE(lower(att.file_name), '') NOT LIKE 'signature.%'
      AND COALESCE(att.metadata->>'evidence_kind', '') IS DISTINCT FROM 'signature'
  ), CASE
    WHEN t.image_url IS NOT NULL THEN
      json_build_array(jsonb_build_object('file_url', t.image_url, 'file_type', 'image/*'))
    ELSE '[]'::json
  END) AS images
FROM tasks t
LEFT JOIN properties p ON p.id = t.property_id AND p.org_id = t.org_id
LEFT JOIN task_themes tt ON tt.task_id = t.id
LEFT JOIN themes th ON th.id = tt.theme_id AND th.org_id = t.org_id
GROUP BY
  t.id, t.org_id, t.title, t.description, t.status, t.priority, t.due_at,
  t.assigned_user_id, t.owner_user_id, t.property_id, t.created_at, t.updated_at,
  t.space_ids, t.assigned_team_ids, t.image_url, t.milestones,
  p.nickname, p.address, p.thumbnail_url;

GRANT SELECT ON public.tasks_view TO anon, authenticated;

COMMENT ON VIEW public.tasks_view IS
  'Tasks with relationships. follower_user_ids are watchers, not the assignee. images exclude checklist signatures.';

GRANT SELECT, INSERT, DELETE ON public.task_followers TO authenticated;
REVOKE UPDATE ON public.task_followers FROM authenticated, anon;

NOTIFY pgrst, 'reload schema';


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
  capability TEXT NOT NULL UNIQUE,
  strategy TEXT NOT NULL,
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

