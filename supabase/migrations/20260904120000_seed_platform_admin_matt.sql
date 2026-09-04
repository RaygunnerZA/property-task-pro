-- Seed platform admin for Matt (existing Auth user). Idempotent.
-- Does not change organisation membership or customer roles.
-- Fails closed: if the Auth user does not exist, no row is inserted.

INSERT INTO public.platform_admins (user_id, notes)
SELECT
  u.id,
  'Production Knowledge admin access — mattlegrange@me.com'
FROM auth.users u
WHERE lower(u.email) = lower('mattlegrange@me.com')
ON CONFLICT (user_id) DO NOTHING;
