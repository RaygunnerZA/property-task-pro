-- Description: Storage buckets and object policies from live project (2026-08-17).
-- Does not recreate the storage schema (owned by local Supabase).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('inbox', 'inbox', false, 52428800, NULL),
  ('property-images', 'property-images', true, 10485760, ARRAY['image/jpeg','image/jpg','image/png','image/webp']),
  ('property-plan-pages', 'property-plan-pages', false, NULL, NULL),
  ('property-plans', 'property-plans', false, NULL, NULL),
  ('task-images', 'task-images', true, 10485760, ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif']),
  ('user-avatars', 'user-avatars', true, 2097152, ARRAY['image/jpeg','image/jpg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = COALESCE(EXCLUDED.file_size_limit, storage.buckets.file_size_limit);

DROP POLICY IF EXISTS "Public can read avatars" ON storage.objects;
CREATE POLICY "Public can read avatars" ON storage.objects FOR SELECT USING ((bucket_id = 'user-avatars'::text));

DROP POLICY IF EXISTS "Public can read task images" ON storage.objects;
CREATE POLICY "Public can read task images" ON storage.objects FOR SELECT USING ((bucket_id = 'task-images'::text));

DROP POLICY IF EXISTS "Users can delete inbox files" ON storage.objects;
CREATE POLICY "Users can delete inbox files" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'inbox'::text) AND (auth.uid() IS NOT NULL) AND (split_part(name, '/'::text, 1) = 'orgs'::text) AND (split_part(name, '/'::text, 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) AND (split_part(name, '/'::text, 3) = 'inbox'::text) AND (split_part(name, '/'::text, 4) <> ''::text) AND ((split_part(name, '/'::text, 2))::uuid IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'user-avatars'::text) AND (auth.uid() IS NOT NULL) AND (name ~~ (('avatars/'::text || (auth.uid())::text) || '/%'::text))));

DROP POLICY IF EXISTS "Users can delete property images" ON storage.objects;
CREATE POLICY "Users can delete property images" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'property-images'::text) AND (auth.uid() IS NOT NULL)));

DROP POLICY IF EXISTS "Users can delete property plan files" ON storage.objects;
CREATE POLICY "Users can delete property plan files" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'property-plans'::text) AND (split_part(name, '/'::text, 1) = 'orgs'::text) AND (split_part(name, '/'::text, 2) ~* '^[0-9a-f-]{36}$'::text) AND (EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = (split_part(objects.name, '/'::text, 2))::uuid) AND (om.user_id = auth.uid()))))));

DROP POLICY IF EXISTS "Users can delete property plan pages" ON storage.objects;
CREATE POLICY "Users can delete property plan pages" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'property-plan-pages'::text) AND (split_part(name, '/'::text, 1) = 'orgs'::text) AND (split_part(name, '/'::text, 2) ~* '^[0-9a-f-]{36}$'::text) AND (EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = (split_part(objects.name, '/'::text, 2))::uuid) AND (om.user_id = auth.uid()))))));

DROP POLICY IF EXISTS "Users can delete task images" ON storage.objects;
CREATE POLICY "Users can delete task images" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'task-images'::text) AND (auth.uid() IS NOT NULL) AND (name ~ '^org/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'::text) AND (EXISTS ( SELECT 1
   FROM public.organisation_members
  WHERE ((organisation_members.user_id = auth.uid()) AND (objects.name ~~ (('org/'::text || (organisation_members.org_id)::text) || '/%'::text)))))));

DROP POLICY IF EXISTS "Users can read inbox files" ON storage.objects;
CREATE POLICY "Users can read inbox files" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'inbox'::text) AND (auth.uid() IS NOT NULL) AND (split_part(name, '/'::text, 1) = 'orgs'::text) AND (split_part(name, '/'::text, 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) AND (split_part(name, '/'::text, 3) = 'inbox'::text) AND (split_part(name, '/'::text, 4) <> ''::text) AND ((split_part(name, '/'::text, 2))::uuid IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can read property images" ON storage.objects;
CREATE POLICY "Users can read property images" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'property-images'::text) AND (auth.uid() IS NOT NULL)));

DROP POLICY IF EXISTS "Users can read property plan files" ON storage.objects;
CREATE POLICY "Users can read property plan files" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'property-plans'::text) AND (split_part(name, '/'::text, 1) = 'orgs'::text) AND (split_part(name, '/'::text, 2) ~* '^[0-9a-f-]{36}$'::text) AND (EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = (split_part(objects.name, '/'::text, 2))::uuid) AND (om.user_id = auth.uid()))))));

DROP POLICY IF EXISTS "Users can read property plan pages" ON storage.objects;
CREATE POLICY "Users can read property plan pages" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'property-plan-pages'::text) AND (split_part(name, '/'::text, 1) = 'orgs'::text) AND (split_part(name, '/'::text, 2) ~* '^[0-9a-f-]{36}$'::text) AND (EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = (split_part(objects.name, '/'::text, 2))::uuid) AND (om.user_id = auth.uid()))))));

DROP POLICY IF EXISTS "Users can read task images" ON storage.objects;
CREATE POLICY "Users can read task images" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'task-images'::text) AND (auth.uid() IS NOT NULL) AND (name ~ '^org/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'::text) AND (EXISTS ( SELECT 1
   FROM public.organisation_members
  WHERE ((organisation_members.user_id = auth.uid()) AND (objects.name ~~ (('org/'::text || (organisation_members.org_id)::text) || '/%'::text)))))));

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'user-avatars'::text) AND (auth.uid() IS NOT NULL) AND (name ~~ (('avatars/'::text || (auth.uid())::text) || '/%'::text)))) WITH CHECK (((bucket_id = 'user-avatars'::text) AND (auth.uid() IS NOT NULL) AND (name ~~ (('avatars/'::text || (auth.uid())::text) || '/%'::text))));

DROP POLICY IF EXISTS "Users can update task images" ON storage.objects;
CREATE POLICY "Users can update task images" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'task-images'::text) AND (auth.uid() IS NOT NULL) AND (name ~ '^org/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'::text) AND (EXISTS ( SELECT 1
   FROM public.organisation_members
  WHERE ((organisation_members.user_id = auth.uid()) AND (objects.name ~~ (('org/'::text || (organisation_members.org_id)::text) || '/%'::text))))))) WITH CHECK (((bucket_id = 'task-images'::text) AND (auth.uid() IS NOT NULL) AND (name ~ '^org/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'::text) AND (EXISTS ( SELECT 1
   FROM public.organisation_members
  WHERE ((organisation_members.user_id = auth.uid()) AND (objects.name ~~ (('org/'::text || (organisation_members.org_id)::text) || '/%'::text)))))));

DROP POLICY IF EXISTS "Users can upload inbox files" ON storage.objects;
CREATE POLICY "Users can upload inbox files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'inbox'::text) AND (auth.uid() IS NOT NULL) AND (split_part(name, '/'::text, 1) = 'orgs'::text) AND (split_part(name, '/'::text, 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) AND (split_part(name, '/'::text, 3) = 'inbox'::text) AND (split_part(name, '/'::text, 4) <> ''::text) AND ((split_part(name, '/'::text, 2))::uuid IN ( SELECT organisation_members.org_id
   FROM public.organisation_members
  WHERE (organisation_members.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'user-avatars'::text) AND (auth.uid() IS NOT NULL) AND (name ~~ (('avatars/'::text || (auth.uid())::text) || '/%'::text))));

DROP POLICY IF EXISTS "Users can upload property images" ON storage.objects;
CREATE POLICY "Users can upload property images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'property-images'::text) AND (auth.uid() IS NOT NULL)));

DROP POLICY IF EXISTS "Users can upload property plan files" ON storage.objects;
CREATE POLICY "Users can upload property plan files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'property-plans'::text) AND (split_part(name, '/'::text, 1) = 'orgs'::text) AND (split_part(name, '/'::text, 2) ~* '^[0-9a-f-]{36}$'::text) AND (EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = (split_part(objects.name, '/'::text, 2))::uuid) AND (om.user_id = auth.uid()))))));

DROP POLICY IF EXISTS "Users can upload property plan pages" ON storage.objects;
CREATE POLICY "Users can upload property plan pages" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'property-plan-pages'::text) AND (split_part(name, '/'::text, 1) = 'orgs'::text) AND (split_part(name, '/'::text, 2) ~* '^[0-9a-f-]{36}$'::text) AND (EXISTS ( SELECT 1
   FROM public.organisation_members om
  WHERE ((om.org_id = (split_part(objects.name, '/'::text, 2))::uuid) AND (om.user_id = auth.uid()))))));

DROP POLICY IF EXISTS "Users can upload task images" ON storage.objects;
CREATE POLICY "Users can upload task images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'task-images'::text) AND (auth.uid() IS NOT NULL) AND (name ~ '^org/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'::text) AND (EXISTS ( SELECT 1
   FROM public.organisation_members
  WHERE ((organisation_members.user_id = auth.uid()) AND (objects.name ~~ (('org/'::text || (organisation_members.org_id)::text) || '/%'::text)))))));

