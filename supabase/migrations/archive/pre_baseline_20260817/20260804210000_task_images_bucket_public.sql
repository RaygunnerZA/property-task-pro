-- Task image URLs are stored via storage.getPublicUrl() (…/object/public/task-images/…).
-- The bucket was private, so public URLs returned 400 and org members could not see
-- each other's uploads even though attachments + tasks_view rows existed.

UPDATE storage.buckets
SET public = true
WHERE id = 'task-images';

-- Keep authenticated org-scoped policies for non-public clients / future signed access.
DROP POLICY IF EXISTS "Authenticated users can view task images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload task images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their task images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their task images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload task images" ON storage.objects;
DROP POLICY IF EXISTS "Users can read task images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update task images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete task images" ON storage.objects;

CREATE POLICY "Users can upload task images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-images'
  AND auth.uid() IS NOT NULL
  AND (name ~ '^org/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/')
  AND EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
      AND name LIKE 'org/' || organisation_members.org_id::text || '/%'
  )
);

CREATE POLICY "Users can read task images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-images'
  AND auth.uid() IS NOT NULL
  AND (name ~ '^org/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/')
  AND EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
      AND name LIKE 'org/' || organisation_members.org_id::text || '/%'
  )
);

CREATE POLICY "Users can update task images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'task-images'
  AND auth.uid() IS NOT NULL
  AND (name ~ '^org/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/')
  AND EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
      AND name LIKE 'org/' || organisation_members.org_id::text || '/%'
  )
)
WITH CHECK (
  bucket_id = 'task-images'
  AND auth.uid() IS NOT NULL
  AND (name ~ '^org/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/')
  AND EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
      AND name LIKE 'org/' || organisation_members.org_id::text || '/%'
  )
);

CREATE POLICY "Users can delete task images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-images'
  AND auth.uid() IS NOT NULL
  AND (name ~ '^org/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/')
  AND EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
      AND name LIKE 'org/' || organisation_members.org_id::text || '/%'
  )
);

-- Public read for public bucket URLs used by <img src> across the workbench.
CREATE POLICY "Public can read task images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'task-images');
