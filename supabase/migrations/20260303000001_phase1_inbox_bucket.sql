-- Phase 1 tactical completion:
-- 1) Add inbox storage bucket for GlobalDropZone intake
-- 2) Add compliance_sources INSERT policy for client-side source record creation

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inbox',
  'inbox',
  false,
  52428800, -- 50MB
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

-- Storage policies for inbox bucket (org-scoped paths)
DROP POLICY IF EXISTS "Users can upload inbox files" ON storage.objects;
CREATE POLICY "Users can upload inbox files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'inbox'
  AND auth.uid() IS NOT NULL
  AND name LIKE 'org/%'
  AND EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
      AND name LIKE 'org/' || organisation_members.org_id::text || '/%'
  )
);

DROP POLICY IF EXISTS "Users can read inbox files" ON storage.objects;
CREATE POLICY "Users can read inbox files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'inbox'
  AND auth.uid() IS NOT NULL
  AND name LIKE 'org/%'
  AND EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
      AND name LIKE 'org/' || organisation_members.org_id::text || '/%'
  )
);

DROP POLICY IF EXISTS "Users can update inbox files" ON storage.objects;
CREATE POLICY "Users can update inbox files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'inbox'
  AND auth.uid() IS NOT NULL
  AND name LIKE 'org/%'
  AND EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
      AND name LIKE 'org/' || organisation_members.org_id::text || '/%'
  )
)
WITH CHECK (
  bucket_id = 'inbox'
  AND auth.uid() IS NOT NULL
  AND name LIKE 'org/%'
  AND EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
      AND name LIKE 'org/' || organisation_members.org_id::text || '/%'
  )
);

DROP POLICY IF EXISTS "Users can delete inbox files" ON storage.objects;
CREATE POLICY "Users can delete inbox files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'inbox'
  AND auth.uid() IS NOT NULL
  AND name LIKE 'org/%'
  AND EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
      AND name LIKE 'org/' || organisation_members.org_id::text || '/%'
  )
);

DROP POLICY IF EXISTS "compliance_sources_insert" ON compliance_sources;
CREATE POLICY "compliance_sources_insert" ON compliance_sources
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id
      FROM organisation_members
      WHERE user_id = auth.uid()
    )
  );
