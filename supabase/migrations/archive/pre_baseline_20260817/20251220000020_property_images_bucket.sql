-- Create storage bucket for property images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-images',
  'property-images',
  true,
  10485760, -- 10MB limit for property images
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for property-images bucket
-- Allow authenticated users to upload property images
DROP POLICY IF EXISTS "Users can upload property images" ON storage.objects;
CREATE POLICY "Users can upload property images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'property-images' AND
  auth.uid() IS NOT NULL
);

-- Allow users to read property images
DROP POLICY IF EXISTS "Users can read property images" ON storage.objects;
CREATE POLICY "Users can read property images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'property-images' AND
  auth.uid() IS NOT NULL
);

-- Allow users to delete property images
DROP POLICY IF EXISTS "Users can delete property images" ON storage.objects;
CREATE POLICY "Users can delete property images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'property-images' AND
  auth.uid() IS NOT NULL
);

