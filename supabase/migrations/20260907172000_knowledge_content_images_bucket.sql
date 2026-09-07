-- Description: Public platform bucket for Knowledge Content Tree editorial images.
-- Not tenant data. Write is platform-admin only. Public read matches published illustrations.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-content-images',
  'knowledge-content-images',
  true,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can read knowledge content images" ON storage.objects;
CREATE POLICY "Public can read knowledge content images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'knowledge-content-images');

DROP POLICY IF EXISTS "Platform admins upload knowledge content images" ON storage.objects;
CREATE POLICY "Platform admins upload knowledge content images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'knowledge-content-images'
    AND public.is_platform_admin()
    AND split_part(name, '/', 1) = 'content'
  );

DROP POLICY IF EXISTS "Platform admins update knowledge content images" ON storage.objects;
CREATE POLICY "Platform admins update knowledge content images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'knowledge-content-images'
    AND public.is_platform_admin()
    AND split_part(name, '/', 1) = 'content'
  )
  WITH CHECK (
    bucket_id = 'knowledge-content-images'
    AND public.is_platform_admin()
    AND split_part(name, '/', 1) = 'content'
  );

DROP POLICY IF EXISTS "Platform admins delete knowledge content images" ON storage.objects;
CREATE POLICY "Platform admins delete knowledge content images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'knowledge-content-images'
    AND public.is_platform_admin()
    AND split_part(name, '/', 1) = 'content'
  );

NOTIFY pgrst, 'reload schema';
