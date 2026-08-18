-- Create storage bucket for task images and attachments
-- This bucket stores images and files for tasks, messages, themes, teams, etc.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-images',
  'task-images',
  true,
  10485760, -- 10MB limit for images and attachments
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- RLS POLICIES FOR task-images BUCKET
-- ============================================================================

-- Policy: Users can upload files to their organization's folder
-- Path format: org/{org_id}/messages/{message_id}/{filename} or org/{org_id}/themes/{theme_id}/{filename}
DROP POLICY IF EXISTS "Users can upload task images" ON storage.objects;
CREATE POLICY "Users can upload task images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-images' AND
  auth.uid() IS NOT NULL AND
  -- Check if path starts with org/ and extract org_id from path
  name LIKE 'org/%' AND
  EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
      AND name LIKE 'org/' || organisation_members.org_id::text || '/%'
  )
);

-- Policy: Users can read files from their organization's folders
DROP POLICY IF EXISTS "Users can read task images" ON storage.objects;
CREATE POLICY "Users can read task images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-images' AND
  auth.uid() IS NOT NULL AND
  -- Allow access if path starts with org/{org_id}/ where org_id matches user's org
  name LIKE 'org/%' AND
  EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
      AND name LIKE 'org/' || organisation_members.org_id::text || '/%'
  )
);

-- Policy: Users can update files in their organization's folders
DROP POLICY IF EXISTS "Users can update task images" ON storage.objects;
CREATE POLICY "Users can update task images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'task-images' AND
  auth.uid() IS NOT NULL AND
  name LIKE 'org/%' AND
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
  name LIKE 'org/%' AND
  EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
      AND name LIKE 'org/' || organisation_members.org_id::text || '/%'
  )
);

-- Policy: Users can delete files from their organization's folders
DROP POLICY IF EXISTS "Users can delete task images" ON storage.objects;
CREATE POLICY "Users can delete task images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-images' AND
  auth.uid() IS NOT NULL AND
  name LIKE 'org/%' AND
  EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE organisation_members.user_id = auth.uid()
      AND name LIKE 'org/' || organisation_members.org_id::text || '/%'
  )
);

