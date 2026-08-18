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
