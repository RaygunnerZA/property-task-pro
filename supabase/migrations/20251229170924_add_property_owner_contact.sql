-- Add owner and contact columns to properties table

-- Add owner columns
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS owner_name TEXT;

ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS owner_email TEXT;

-- Add contact columns
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS contact_name TEXT;

ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS contact_email TEXT;

ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Update properties_view to include owner and contact columns
-- Must DROP and recreate because PostgreSQL doesn't allow changing column order with CREATE OR REPLACE
DROP VIEW IF EXISTS properties_view;

CREATE VIEW properties_view
WITH (security_invoker = true)
AS
SELECT 
  p.id,
  p.org_id,
  p.address,
  p.nickname,
  p.thumbnail_url,
  p.icon_name,
  p.icon_color_hex,
  p.owner_name,
  p.owner_email,
  p.contact_name,
  p.contact_email,
  p.contact_phone,
  p.created_at,
  p.updated_at,
  -- Aggregated counts
  COALESCE(COUNT(DISTINCT t.id) FILTER (WHERE t.status IN ('open', 'in_progress')), 0)::integer AS open_tasks_count,
  COALESCE(COUNT(DISTINCT a.id), 0)::integer AS assets_count,
  COALESCE(COUNT(DISTINCT cd.id) FILTER (WHERE cd.expiry_date < CURRENT_DATE), 0)::integer AS expired_compliance_count,
  COALESCE(COUNT(DISTINCT cd.id) FILTER (WHERE cd.expiry_date >= CURRENT_DATE OR cd.expiry_date IS NULL), 0)::integer AS valid_compliance_count,
  COALESCE(COUNT(DISTINCT s.id), 0)::integer AS spaces_count
FROM properties p
LEFT JOIN tasks t ON t.property_id = p.id AND t.org_id = p.org_id
LEFT JOIN assets a ON a.property_id = p.id AND a.org_id = p.org_id
LEFT JOIN compliance_documents cd ON cd.org_id = p.org_id
LEFT JOIN spaces s ON s.property_id = p.id AND s.org_id = p.org_id
WHERE (p.is_archived = false OR p.is_archived IS NULL)
GROUP BY p.id, p.org_id, p.address, p.nickname, p.thumbnail_url, p.icon_name, p.icon_color_hex, p.owner_name, p.owner_email, p.contact_name, p.contact_email, p.contact_phone, p.created_at, p.updated_at;

