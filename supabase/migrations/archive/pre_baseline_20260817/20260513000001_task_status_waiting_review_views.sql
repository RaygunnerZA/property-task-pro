-- Depends on: 20260513000000_task_status_waiting_review.sql (enum committed).
-- Refresh aggregates: "open work" includes waiting_review (blocked on manager).

DROP VIEW IF EXISTS properties_view CASCADE;

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
  COALESCE(
    COUNT(DISTINCT t.id) FILTER (
      WHERE t.status IN ('open', 'in_progress', 'waiting_review')
    ),
    0
  )::integer AS open_tasks_count,
  COALESCE(COUNT(DISTINCT a.id), 0)::integer AS assets_count,
  COALESCE(COUNT(DISTINCT cd.id) FILTER (WHERE cd.expiry_date < CURRENT_DATE), 0)::integer AS expired_compliance_count,
  COALESCE(
    COUNT(DISTINCT cd.id) FILTER (WHERE cd.expiry_date >= CURRENT_DATE OR cd.expiry_date IS NULL),
    0
  )::integer AS valid_compliance_count,
  COALESCE(COUNT(DISTINCT s.id), 0)::integer AS spaces_count
FROM properties p
LEFT JOIN tasks t ON t.property_id = p.id AND t.org_id = p.org_id
LEFT JOIN assets a ON a.property_id = p.id AND a.org_id = p.org_id
LEFT JOIN compliance_documents cd ON cd.org_id = p.org_id
LEFT JOIN spaces s ON s.property_id = p.id AND s.org_id = p.org_id
WHERE (p.is_archived = false OR p.is_archived IS NULL)
GROUP BY
  p.id, p.org_id, p.address, p.nickname, p.thumbnail_url, p.icon_name, p.icon_color_hex,
  p.owner_name, p.owner_email, p.contact_name, p.contact_email, p.contact_phone,
  p.created_at, p.updated_at;

DROP VIEW IF EXISTS assets_view CASCADE;

CREATE VIEW assets_view
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.org_id,
  a.property_id,
  a.space_id,
  a.parent_asset_id,
  a.name,
  a.asset_type,
  a.category,
  a.serial_number,
  a.manufacturer,
  a.model,
  a.install_date,
  a.warranty_expiry,
  a.compliance_required,
  a.compliance_type,
  a.condition_score,
  a.status,
  a.notes,
  a.metadata,
  a.created_by,
  a.created_at,
  a.updated_at,
  a.icon_name,
  p.nickname AS property_name,
  p.address AS property_address,
  s.name AS space_name,
  COALESCE(
    COUNT(DISTINCT ta.task_id) FILTER (
      WHERE t.status IN ('open', 'in_progress', 'waiting_review')
    ),
    0
  )::integer AS open_tasks_count
FROM assets a
LEFT JOIN properties p ON p.id = a.property_id AND p.org_id = a.org_id
LEFT JOIN spaces s ON s.id = a.space_id AND s.org_id = a.org_id
LEFT JOIN task_assets ta ON ta.asset_id = a.id
LEFT JOIN tasks t ON t.id = ta.task_id AND t.org_id = a.org_id
GROUP BY
  a.id, a.org_id, a.property_id, a.space_id, a.parent_asset_id,
  a.name, a.asset_type, a.category, a.serial_number,
  a.manufacturer, a.model, a.install_date, a.warranty_expiry,
  a.compliance_required, a.compliance_type,
  a.condition_score, a.status, a.notes, a.metadata,
  a.created_by, a.created_at, a.updated_at, a.icon_name,
  p.nickname, p.address, s.name;

DROP INDEX IF EXISTS idx_tasks_property_status;

CREATE INDEX idx_tasks_property_status
  ON tasks (property_id, status)
  WHERE status IN ('open', 'in_progress', 'waiting_review');

COMMENT ON TYPE task_status IS 'Task lifecycle: open | in_progress | waiting_review (vendor submitted, manager pending) | completed | archived';
