-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio',
  'audio',
  true,
  104857600, -- 100MB limit for audio files
  ARRAY['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for audio bucket
-- Allow authenticated users to upload audio files
DROP POLICY IF EXISTS "Users can upload audio files" ON storage.objects;
CREATE POLICY "Users can upload audio files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audio' AND
  auth.uid() IS NOT NULL
);

-- Allow users to read audio files
DROP POLICY IF EXISTS "Users can read audio files" ON storage.objects;
CREATE POLICY "Users can read audio files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'audio' AND
  auth.uid() IS NOT NULL
);

-- Allow users to delete audio files
DROP POLICY IF EXISTS "Users can delete audio files" ON storage.objects;
CREATE POLICY "Users can delete audio files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'audio' AND
  auth.uid() IS NOT NULL
);

