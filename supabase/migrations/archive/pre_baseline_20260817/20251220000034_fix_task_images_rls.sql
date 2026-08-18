-- Fix RLS policies for task-images bucket
-- Use simpler path matching that works with Supabase storage

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload task images" ON storage.objects;
DROP POLICY IF EXISTS "Users can read task images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update task images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete task images" ON storage.objects;

-- Policy: Users can upload files to their organization's folder
-- Path format: org/{org_id}/messages/{message_id}/{filename}
CREATE POLICY "Users can upload task images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-images' AND
  auth.uid() IS NOT NULL AND
  -- Check if path starts with org/ and user belongs to that org
  (name ~ '^org/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/') AND
  EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
      AND name LIKE 'org/' || organisation_members.org_id::text || '/%'
  )
);

-- Policy: Users can read files from their organization's folders
CREATE POLICY "Users can read task images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-images' AND
  auth.uid() IS NOT NULL AND
  -- Allow access if path starts with org/{org_id}/ where org_id matches user's org
  (name ~ '^org/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/') AND
  EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
      AND name LIKE 'org/' || organisation_members.org_id::text || '/%'
  )
);

-- Policy: Users can update files in their organization's folders
CREATE POLICY "Users can update task images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'task-images' AND
  auth.uid() IS NOT NULL AND
  (name ~ '^org/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/') AND
  EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
      AND name LIKE 'org/' || organisation_members.org_id::text || '/%'
  )
)
WITH CHECK (
  bucket_id = 'task-images' AND
  auth.uid() IS NOT NULL AND
  (name ~ '^org/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/') AND
  EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
      AND name LIKE 'org/' || organisation_members.org_id::text || '/%'
  )
);

-- Policy: Users can delete files from their organization's folders
CREATE POLICY "Users can delete task images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-images' AND
  auth.uid() IS NOT NULL AND
  (name ~ '^org/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/') AND
  EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
      AND name LIKE 'org/' || organisation_members.org_id::text || '/%'
  )
);

