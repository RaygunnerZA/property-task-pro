-- Admin: add cursor-keyset pagination to admin_list_orgs
--
-- Adds p_cursor UUID and p_limit INT parameters.
-- p_cursor is the org_id of the last row returned by the previous page.
-- Returns has_more BOOLEAN so the client can decide whether to show "Load more".
--
-- Sort: organisations.created_at DESC, id DESC (stable keyset).
-- Default page size: 25. Hard cap: 100.

CREATE OR REPLACE FUNCTION public.admin_list_orgs(
  p_cursor UUID DEFAULT NULL,
  p_limit  INT  DEFAULT 25
)
RETURNS TABLE (
  org_id         UUID,
  org_name       TEXT,
  org_type       TEXT,
  created_at     TIMESTAMPTZ,
  member_count   BIGINT,
  property_count BIGINT,
  task_count     BIGINT,
  last_activity  TIMESTAMPTZ,
  has_more       BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit            INT := LEAST(COALESCE(p_limit, 25), 100);
  v_cursor_created_at TIMESTAMPTZ;
  v_cursor_id         UUID := p_cursor;
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
    jsonb_build_object('timestamp', now(), 'cursor', p_cursor, 'limit', v_limit)
  );

  -- Resolve cursor position (only if cursor provided)
  IF v_cursor_id IS NOT NULL THEN
    SELECT o.created_at
      INTO v_cursor_created_at
      FROM organisations o
     WHERE o.id = v_cursor_id
     LIMIT 1;

    -- If cursor org no longer exists, treat as first page
    IF v_cursor_created_at IS NULL THEN
      v_cursor_id := NULL;
    END IF;
  END IF;

  RETURN QUERY
  WITH page_plus_one AS (
    SELECT
      o.id                                             AS org_id,
      o.name                                           AS org_name,
      o.org_type::TEXT                                 AS org_type,
      o.created_at                                     AS created_at,
      COUNT(DISTINCT om.user_id)::BIGINT               AS member_count,
      COUNT(DISTINCT p.id)::BIGINT                     AS property_count,
      COUNT(DISTINCT t.id)::BIGINT                     AS task_count,
      MAX(GREATEST(
        COALESCE(t.updated_at, t.created_at),
        COALESCE(p.updated_at, p.created_at)
      ))                                               AS last_activity,
      ROW_NUMBER() OVER ()                             AS rn
    FROM organisations o
    LEFT JOIN organisation_members om ON om.org_id = o.id
    LEFT JOIN properties p            ON p.org_id = o.id
    LEFT JOIN tasks t                 ON t.org_id = o.id
    WHERE o.id != '00000000-0000-0000-0000-000000000000'::uuid
      AND (
        v_cursor_id IS NULL
        OR (o.created_at, o.id) < (v_cursor_created_at, v_cursor_id)
      )
    GROUP BY o.id, o.name, o.org_type, o.created_at
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT v_limit + 1
  )
  SELECT
    pp.org_id,
    pp.org_name,
    pp.org_type,
    pp.created_at,
    pp.member_count,
    pp.property_count,
    pp.task_count,
    pp.last_activity,
    -- has_more is true for every row when there is an extra row beyond the page
    (SELECT COUNT(*) FROM page_plus_one) > v_limit AS has_more
  FROM page_plus_one pp
  WHERE pp.rn <= v_limit
  ORDER BY pp.created_at DESC, pp.org_id DESC;
END;
$$;
