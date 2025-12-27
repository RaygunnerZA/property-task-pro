-- Create RPC function for task creation
-- Similar to create_property_v2, this uses SECURITY DEFINER to bypass RLS
-- and ensures proper membership checks

CREATE OR REPLACE FUNCTION create_task_v2(
  p_org_id UUID,
  p_title TEXT,
  p_property_id UUID DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal',
  p_due_date TIMESTAMPTZ DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_membership_count INTEGER;
  v_new_task JSON;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: User must be authenticated';
  END IF;
  
  -- Check if user is a member of the organisation
  SELECT COUNT(*) INTO v_membership_count
  FROM organisation_members
  WHERE org_id = p_org_id
    AND user_id = v_user_id;
  
  -- If not a member, deny access
  IF v_membership_count = 0 THEN
    RAISE EXCEPTION 'Access Denied: User is not a member of this organisation';
  END IF;
  
  -- Validate priority (normalize to lowercase)
  -- Allowed values: 'low', 'normal', 'medium', 'high', 'urgent'
  -- Map 'medium' to 'normal' for consistency
  -- Default to 'normal' if invalid
  IF p_priority IS NOT NULL THEN
    p_priority := LOWER(p_priority);
    IF p_priority = 'medium' THEN
      p_priority := 'normal';
    ELSIF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
      p_priority := 'normal';
    END IF;
  ELSE
    p_priority := 'normal';
  END IF;
  
  -- Insert the task
  -- Explicitly set status to 'open' to satisfy NOT NULL constraint
  INSERT INTO tasks (org_id, title, description, property_id, priority, due_date, status)
  VALUES (p_org_id, p_title, p_description, p_property_id, COALESCE(p_priority, 'normal'), p_due_date, 'open'::task_status)
  RETURNING json_build_object(
    'id', id,
    'org_id', org_id,
    'title', title,
    'description', description,
    'property_id', property_id,
    'status', status,
    'priority', priority,
    'due_date', due_date,
    'created_at', created_at,
    'updated_at', updated_at
  ) INTO v_new_task;
  
  RETURN v_new_task;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_task_v2(UUID, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_task_v2(UUID, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT) TO anon;

