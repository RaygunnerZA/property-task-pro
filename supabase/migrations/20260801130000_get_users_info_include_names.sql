-- Team roster: expose first/last name from auth metadata so UI can show
-- a title with first name only (surname optional). Previously get_users_info
-- only returned nickname, so members with first_name/last_name still showed email.

DROP FUNCTION IF EXISTS public.get_users_info(UUID[]);

CREATE FUNCTION public.get_users_info(user_ids UUID[])
RETURNS TABLE (
  id UUID,
  email TEXT,
  nickname TEXT,
  avatar_url TEXT,
  first_name TEXT,
  last_name TEXT
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
    COALESCE(u.raw_user_meta_data->>'nickname', NULL)::TEXT AS nickname,
    COALESCE(u.raw_user_meta_data->>'avatar_url', NULL)::TEXT AS avatar_url,
    COALESCE(u.raw_user_meta_data->>'first_name', NULL)::TEXT AS first_name,
    COALESCE(u.raw_user_meta_data->>'last_name', NULL)::TEXT AS last_name
  FROM auth.users u
  WHERE u.id = ANY(user_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_users_info(UUID[]) TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.get_users_info(UUID[]) IS
  'Enrich org member lists: email, nickname, avatar, first_name, last_name from auth.users.';
