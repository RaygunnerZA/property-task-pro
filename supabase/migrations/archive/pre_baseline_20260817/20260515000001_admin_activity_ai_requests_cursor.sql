-- Admin panel: keyset pagination for activity + AI requests (Phase B.2).
-- See @Docs/25_Admin_Cursor_Pagination_Design.md

CREATE OR REPLACE FUNCTION public.admin_get_org_activity(
  p_org_id UUID,
  p_limit INT DEFAULT 50,
  p_after_created_at TIMESTAMPTZ DEFAULT NULL,
  p_after_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id          UUID,
  actor_id    UUID,
  entity_type TEXT,
  entity_id   UUID,
  action      TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ,
  has_more    BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lim INT := LEAST(GREATEST(COALESCE(NULLIF(p_limit, 0), 50), 1), 200);
BEGIN
  IF (p_after_created_at IS NULL) <> (p_after_id IS NULL) THEN
    RAISE EXCEPTION 'admin_get_org_activity: p_after_created_at and p_after_id must both be null or both set';
  END IF;

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
  WITH batch AS (
    SELECT
      al.id,
      al.actor_id,
      al.entity_type,
      al.entity_id,
      al.action,
      al.metadata,
      al.created_at
    FROM audit_logs al
    WHERE al.org_id = p_org_id
      AND (
        (p_after_created_at IS NULL AND p_after_id IS NULL)
        OR (
          p_after_created_at IS NOT NULL
          AND p_after_id IS NOT NULL
          AND (al.created_at, al.id) < (p_after_created_at, p_after_id)
        )
      )
    ORDER BY al.created_at DESC, al.id DESC
    LIMIT lim + 1
  )
  SELECT
    b.id,
    b.actor_id,
    b.entity_type,
    b.entity_id,
    b.action,
    b.metadata,
    b.created_at,
    (SELECT COUNT(*)::INT FROM batch) > lim AS has_more
  FROM batch b
  ORDER BY b.created_at DESC, b.id DESC
  LIMIT lim;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_org_ai_requests(
  p_org_id UUID,
  p_limit INT DEFAULT 100,
  p_after_created_at TIMESTAMPTZ DEFAULT NULL,
  p_after_id UUID DEFAULT NULL
)
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
  created_at    TIMESTAMPTZ,
  has_more      BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lim INT := LEAST(GREATEST(COALESCE(NULLIF(p_limit, 0), 100), 1), 500);
BEGIN
  IF (p_after_created_at IS NULL) <> (p_after_id IS NULL) THEN
    RAISE EXCEPTION 'admin_get_org_ai_requests: p_after_created_at and p_after_id must both be null or both set';
  END IF;

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
  WITH batch AS (
    SELECT
      r.id,
      r.user_id,
      r.function_name,
      r.model_used,
      r.provider,
      r.status,
      r.latency_ms,
      r.cost_usd,
      r.input_tokens,
      r.output_tokens,
      r.entity_type,
      r.entity_id,
      r.error_message,
      r.created_at
    FROM ai_requests r
    WHERE r.org_id = p_org_id
      AND (
        (p_after_created_at IS NULL AND p_after_id IS NULL)
        OR (
          p_after_created_at IS NOT NULL
          AND p_after_id IS NOT NULL
          AND (r.created_at, r.id) < (p_after_created_at, p_after_id)
        )
      )
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT lim + 1
  )
  SELECT
    b.id,
    b.user_id,
    b.function_name,
    b.model_used,
    b.provider,
    b.status,
    b.latency_ms,
    b.cost_usd,
    b.input_tokens,
    b.output_tokens,
    b.entity_type,
    b.entity_id,
    b.error_message,
    b.created_at,
    (SELECT COUNT(*)::INT FROM batch) > lim AS has_more
  FROM batch b
  ORDER BY b.created_at DESC, b.id DESC
  LIMIT lim;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created_id
  ON audit_logs (org_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_ai_requests_org_created_id
  ON ai_requests (org_id, created_at DESC, id DESC);
