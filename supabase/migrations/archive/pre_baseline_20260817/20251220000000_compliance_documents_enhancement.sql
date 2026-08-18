-- Add title and file_url columns to compliance_documents table
ALTER TABLE compliance_documents
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Create storage bucket for compliance documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'compliance-docs',
  'compliance-docs',
  true,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for compliance-docs bucket
-- Allow authenticated users to upload files
DROP POLICY IF EXISTS "Users can upload compliance documents" ON storage.objects;
CREATE POLICY "Users can upload compliance documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'compliance-docs' AND
  auth.uid() IS NOT NULL
);

-- Allow users to read their organization's compliance documents
DROP POLICY IF EXISTS "Users can read compliance documents" ON storage.objects;
CREATE POLICY "Users can read compliance documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'compliance-docs' AND
  auth.uid() IS NOT NULL
);

-- Allow users to delete their organization's compliance documents
DROP POLICY IF EXISTS "Users can delete compliance documents" ON storage.objects;
CREATE POLICY "Users can delete compliance documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'compliance-docs' AND
  auth.uid() IS NOT NULL
);

