-- Ensure inbox storage bucket exists on remote (migration was recorded but bucket row was missing).
-- Path convention: orgs/<org_uuid>/inbox/<intake_id>/<filename>

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inbox',
  'inbox',
  false,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can upload inbox files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read inbox files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update inbox files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete inbox files" ON storage.objects;

CREATE POLICY "Users can upload inbox files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'inbox'
  AND auth.uid() IS NOT NULL
  AND split_part(name, '/', 1) = 'orgs'
  AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND split_part(name, '/', 3) = 'inbox'
  AND split_part(name, '/', 4) <> ''
  AND split_part(name, '/', 2)::uuid IN (
    SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can read inbox files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'inbox'
  AND auth.uid() IS NOT NULL
  AND split_part(name, '/', 1) = 'orgs'
  AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND split_part(name, '/', 3) = 'inbox'
  AND split_part(name, '/', 4) <> ''
  AND split_part(name, '/', 2)::uuid IN (
    SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete inbox files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'inbox'
  AND auth.uid() IS NOT NULL
  AND split_part(name, '/', 1) = 'orgs'
  AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND split_part(name, '/', 3) = 'inbox'
  AND split_part(name, '/', 4) <> ''
  AND split_part(name, '/', 2)::uuid IN (
    SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
  )
);
