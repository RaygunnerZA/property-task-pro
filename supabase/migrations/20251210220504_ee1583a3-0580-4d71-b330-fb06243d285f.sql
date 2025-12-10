-- Create storage policies for task-images bucket to allow authenticated users to upload/read
CREATE POLICY "Authenticated users can upload task images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-images');

CREATE POLICY "Authenticated users can view task images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'task-images');

CREATE POLICY "Authenticated users can update their task images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'task-images');

CREATE POLICY "Authenticated users can delete their task images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'task-images');