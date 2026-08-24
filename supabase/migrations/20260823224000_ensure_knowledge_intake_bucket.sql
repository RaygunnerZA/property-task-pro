-- Private knowledge-intake storage bucket (platform admin spreadsheet/PDF upload).
-- Applies bucket + policies if missing after baseline/history divergence.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-intake',
  'knowledge-intake',
  false,
  52428800,
  ARRAY[
    'text/csv',
    'text/plain',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Platform admins read knowledge intake" ON storage.objects;
CREATE POLICY "Platform admins read knowledge intake"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'knowledge-intake' AND public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins upload knowledge intake" ON storage.objects;
CREATE POLICY "Platform admins upload knowledge intake"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'knowledge-intake'
    AND public.is_platform_admin()
    AND split_part(name, '/', 1) = 'platform'
  );

DROP POLICY IF EXISTS "Platform admins delete knowledge intake" ON storage.objects;
CREATE POLICY "Platform admins delete knowledge intake"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'knowledge-intake' AND public.is_platform_admin());

NOTIFY pgrst, 'reload schema';
