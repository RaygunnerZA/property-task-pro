-- Add milestones JSONB column to tasks table and update tasks_view

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS milestones JSONB DEFAULT '[]';

COMMENT ON COLUMN tasks.milestones IS 'Array of milestone objects: [{id, dateTime, label?}]. Displayed on calendar alongside due_date.';

-- Recreate tasks_view to include milestones
DROP VIEW IF EXISTS tasks_view CASCADE;

CREATE VIEW tasks_view
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
  t.milestones,
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
  COALESCE(
    json_agg(DISTINCT jsonb_build_object(
      'id', att.id,
      'file_url', att.file_url,
      'thumbnail_url', att.thumbnail_url,
      'file_name', att.file_name,
      'file_type', att.file_type
    )) FILTER (WHERE att.id IS NOT NULL),
    '[]'::json
  ) AS images
FROM tasks t
LEFT JOIN properties p ON p.id = t.property_id AND p.org_id = t.org_id
LEFT JOIN task_spaces ts ON ts.task_id = t.id
LEFT JOIN spaces sp ON sp.id = ts.space_id AND sp.org_id = t.org_id
LEFT JOIN task_themes tt ON tt.task_id = t.id
LEFT JOIN themes th ON th.id = tt.theme_id AND th.org_id = t.org_id
LEFT JOIN task_teams ttm ON ttm.task_id = t.id
LEFT JOIN teams tm ON tm.id = ttm.team_id AND tm.org_id = t.org_id
LEFT JOIN attachments att ON att.parent_id = t.id AND att.parent_type = 'task' AND att.org_id = t.org_id
GROUP BY 
  t.id, t.org_id, t.title, t.description, t.status, t.priority, 
  t.due_date, t.milestones, t.assigned_user_id, t.property_id, t.created_at, 
  t.updated_at,
  p.nickname, p.address, p.thumbnail_url;
