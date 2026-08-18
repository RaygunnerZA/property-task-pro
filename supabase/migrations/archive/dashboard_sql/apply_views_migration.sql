-- Performance Standard: Optimized Views for Core Entities
-- Run this SQL in your Supabase Dashboard SQL Editor
-- Dashboard > SQL Editor > New Query > Paste this > Run

-- ============================================================================
-- 1. properties_view
-- ============================================================================
CREATE OR REPLACE VIEW properties_view
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
  p.created_at,
  p.updated_at,
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
GROUP BY p.id, p.org_id, p.address, p.nickname, p.thumbnail_url, p.icon_name, p.icon_color_hex, p.created_at, p.updated_at;

-- ============================================================================
-- 2. assets_view
-- ============================================================================
CREATE OR REPLACE VIEW assets_view
WITH (security_invoker = true)
AS
SELECT 
  a.id,
  a.org_id,
  a.property_id,
  a.space_id,
  a.serial,
  a.condition_score,
  a.created_at,
  a.updated_at,
  p.nickname AS property_name,
  p.address AS property_address,
  s.name AS space_name,
  COALESCE(COUNT(DISTINCT t.id) FILTER (WHERE t.status IN ('open', 'in_progress')), 0)::integer AS open_tasks_count
FROM assets a
LEFT JOIN properties p ON p.id = a.property_id AND p.org_id = a.org_id
LEFT JOIN spaces s ON s.id = a.space_id AND s.org_id = a.org_id
LEFT JOIN tasks t ON t.property_id = a.property_id AND t.org_id = a.org_id
GROUP BY 
  a.id, a.org_id, a.property_id, a.space_id, a.serial, 
  a.condition_score, a.created_at, a.updated_at,
  p.nickname, p.address, s.name;

-- ============================================================================
-- 3. compliance_view
-- ============================================================================
CREATE OR REPLACE VIEW compliance_view
WITH (security_invoker = true)
AS
SELECT 
  cd.id,
  cd.org_id,
  cd.expiry_date,
  cd.status,
  cd.created_at,
  cd.updated_at,
  CASE 
    WHEN cd.expiry_date IS NULL THEN NULL::integer
    ELSE (cd.expiry_date - CURRENT_DATE)::integer
  END AS days_until_expiry,
  CASE
    WHEN cd.expiry_date IS NULL THEN 'none'
    WHEN cd.expiry_date < CURRENT_DATE THEN 'expired'
    WHEN cd.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring'
    ELSE 'valid'
  END AS expiry_status
FROM compliance_documents cd;

-- ============================================================================
-- 4. tasks_view
-- ============================================================================
CREATE OR REPLACE VIEW tasks_view
WITH (security_invoker = true)
AS
SELECT 
  t.id,
  t.org_id,
  t.title,
  t.description,
  t.status,
  t.priority,
  t.due_date,
  t.assigned_user_id,
  t.property_id,
  t.created_at,
  t.updated_at,
  p.nickname AS property_name,
  p.address AS property_address,
  p.thumbnail_url AS property_thumbnail_url,
  COALESCE(
    json_agg(DISTINCT jsonb_build_object(
      'id', sp.id,
      'name', sp.name
    )) FILTER (WHERE sp.id IS NOT NULL),
    '[]'::json
  ) AS spaces,
  COALESCE(
    json_agg(DISTINCT jsonb_build_object(
      'id', th.id,
      'name', th.name,
      'color', th.color,
      'icon', th.icon
    )) FILTER (WHERE th.id IS NOT NULL),
    '[]'::json
  ) AS themes,
  COALESCE(
    json_agg(DISTINCT jsonb_build_object(
      'id', tm.id,
      'name', tm.name,
      'color', tm.color,
      'icon', tm.icon
    )) FILTER (WHERE tm.id IS NOT NULL),
    '[]'::json
  ) AS teams,
  t.assigned_user_id AS assignee_user_id
FROM tasks t
LEFT JOIN properties p ON p.id = t.property_id AND p.org_id = t.org_id
LEFT JOIN task_spaces ts ON ts.task_id = t.id
LEFT JOIN spaces sp ON sp.id = ts.space_id AND sp.org_id = t.org_id
LEFT JOIN task_themes tt ON tt.task_id = t.id
LEFT JOIN themes th ON th.id = tt.theme_id AND th.org_id = t.org_id
LEFT JOIN task_teams ttm ON ttm.task_id = t.id
LEFT JOIN teams tm ON tm.id = ttm.team_id AND tm.org_id = t.org_id
GROUP BY 
  t.id, t.org_id, t.title, t.description, t.status, t.priority, 
  t.due_date, t.assigned_user_id, t.property_id, t.created_at, 
  t.updated_at,
  p.nickname, p.address, p.thumbnail_url;

-- ============================================================================
-- Indexes for Performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tasks_property_status ON tasks(property_id, status) WHERE status IN ('open', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_assets_property ON assets(property_id);
CREATE INDEX IF NOT EXISTS idx_compliance_expiry ON compliance_documents(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_spaces_task ON task_spaces(task_id);
CREATE INDEX IF NOT EXISTS idx_task_themes_task ON task_themes(task_id);
CREATE INDEX IF NOT EXISTS idx_task_teams_task ON task_teams(task_id);

