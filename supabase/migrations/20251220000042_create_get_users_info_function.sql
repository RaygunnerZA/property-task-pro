-- Create function to get user info from auth.users
-- This function allows fetching user metadata (email, nickname, avatar_url) for a list of user IDs

CREATE OR REPLACE FUNCTION get_users_info(user_ids UUID[])
RETURNS TABLE (
  id UUID,
  email TEXT,
  nickname TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    COALESCE(u.raw_user_meta_data->>'nickname', NULL)::TEXT as nickname,
    COALESCE(u.raw_user_meta_data->>'avatar_url', NULL)::TEXT as avatar_url
  FROM auth.users u
  WHERE u.id = ANY(user_ids);
END;
$$;

