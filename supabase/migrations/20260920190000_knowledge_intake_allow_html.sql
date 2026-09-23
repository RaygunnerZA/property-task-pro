-- Allow official guidance HTML pages in knowledge-intake (Watch / URL intake).
-- Bucket remains private; platform admin only. HTML is treated as untrusted text.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'text/csv',
  'text/plain',
  'text/html',
  'application/xhtml+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream'
]
WHERE id = 'knowledge-intake';
