-- RPC function to fetch task with contractor token validation
-- This allows contractors to access tasks without needing JWT claims

CREATE OR REPLACE FUNCTION get_task_with_contractor_token(
  p_task_id UUID,
  p_token TEXT
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  status TEXT,
  priority TEXT,
  due_date TIMESTAMPTZ,
  property_id UUID,
  org_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Verify the token exists and is linked to this task
  IF NOT EXISTS (
    SELECT 1
    FROM contractor_tokens
    WHERE contractor_tokens.token = p_token
      AND contractor_tokens.task_id = p_task_id
  ) THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  -- Return the task data
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.due_date,
    t.property_id,
    t.org_id,
    t.created_at,
    t.updated_at
  FROM tasks t
  WHERE t.id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (or anon if needed)
GRANT EXECUTE ON FUNCTION get_task_with_contractor_token(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_task_with_contractor_token(UUID, TEXT) TO anon;

