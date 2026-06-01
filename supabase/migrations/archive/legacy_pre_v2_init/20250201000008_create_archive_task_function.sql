-- Create RPC function to archive a task
-- Sets task status to 'archived' while keeping it available to view

CREATE OR REPLACE FUNCTION archive_task(
  p_task_id UUID,
  p_org UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_membership_count INTEGER;
  v_task_exists BOOLEAN;
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
  WHERE org_id = p_org
    AND user_id = v_user_id;
  
  -- If not a member, deny access
  IF v_membership_count = 0 THEN
    RAISE EXCEPTION 'Access Denied: User is not a member of this organisation';
  END IF;
  
  -- Check if task exists and belongs to the organisation
  SELECT EXISTS(
    SELECT 1 FROM tasks
    WHERE id = p_task_id
      AND org_id = p_org
  ) INTO v_task_exists;
  
  IF NOT v_task_exists THEN
    RAISE EXCEPTION 'Task not found or access denied';
  END IF;
  
  -- Update task status to 'archived'
  UPDATE tasks
  SET status = 'archived'::task_status,
      updated_at = now()
  WHERE id = p_task_id
    AND org_id = p_org;
  
  RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION archive_task(UUID, UUID) TO authenticated;

-- Create restore_task function as well (for completeness)
CREATE OR REPLACE FUNCTION restore_task(
  p_task_id UUID,
  p_org UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_membership_count INTEGER;
  v_task_exists BOOLEAN;
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
  WHERE org_id = p_org
    AND user_id = v_user_id;
  
  -- If not a member, deny access
  IF v_membership_count = 0 THEN
    RAISE EXCEPTION 'Access Denied: User is not a member of this organisation';
  END IF;
  
  -- Check if task exists and belongs to the organisation
  SELECT EXISTS(
    SELECT 1 FROM tasks
    WHERE id = p_task_id
      AND org_id = p_org
  ) INTO v_task_exists;
  
  IF NOT v_task_exists THEN
    RAISE EXCEPTION 'Task not found or access denied';
  END IF;
  
  -- Restore task status to 'open' (or 'completed' if it was completed before archiving)
  -- For now, we'll restore to 'open' - you can enhance this to remember previous status
  UPDATE tasks
  SET status = 'open'::task_status,
      updated_at = now()
  WHERE id = p_task_id
    AND org_id = p_org;
  
  RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION restore_task(UUID, UUID) TO authenticated;

