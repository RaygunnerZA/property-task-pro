-- Exclude checklist signature captures from tasks_view.images so they never
-- become the task card / gallery thumbnail. Signatures remain on subtask
-- attachments and are opened via checklist "View evidence".

DROP VIEW IF EXISTS public.tasks_view CASCADE;

CREATE VIEW public.tasks_view
WITH (security_invoker = true)
AS
SELECT
  t.id,
  t.org_id,
  t.title,
  t.description,
  t.status,
  t.priority,
  t.due_at AS due_date,
  COALESCE(t.milestones, '[]'::jsonb) AS milestones,
  t.assigned_user_id,
  t.owner_user_id,
  t.property_id,
  t.created_at,
  t.updated_at,
  p.nickname AS property_name,
  p.address AS property_address,
  p.thumbnail_url AS property_thumbnail_url,
  COALESCE((
    SELECT json_agg(DISTINCT jsonb_build_object('id', sp_1.id, 'name', sp_1.name))
    FROM unnest(COALESCE(t.space_ids, ARRAY[]::uuid[])) sid(space_id)
    JOIN spaces sp_1 ON sp_1.id = sid.space_id AND sp_1.org_id = t.org_id
  ), '[]'::json) AS spaces,
  COALESCE(
    json_agg(DISTINCT jsonb_build_object('id', th.id, 'name', th.name, 'color', th.color, 'icon', th.icon))
      FILTER (WHERE th.id IS NOT NULL),
    '[]'::json
  ) AS themes,
  COALESCE((
    SELECT json_agg(DISTINCT jsonb_build_object('id', tm.id, 'name', tm.name, 'color', tm.color, 'icon', tm.icon))
    FROM unnest(COALESCE(t.assigned_team_ids, ARRAY[]::uuid[])) tid(team_id)
    JOIN teams tm ON tm.id = tid.team_id
  ), '[]'::json) AS teams,
  COALESCE((
    SELECT json_agg(
      jsonb_build_object(
        'id', att.id,
        'file_url', att.file_url,
        'thumbnail_url', att.thumbnail_url,
        'file_name', att.file_name,
        'file_type', att.file_type
      )
      ORDER BY att.created_at DESC
    )
    FROM attachments att
    WHERE att.parent_id = t.id
      AND att.parent_type = 'task'
      AND att.org_id = t.org_id
      AND COALESCE(lower(att.file_name), '') NOT LIKE 'signature.%'
      AND COALESCE(att.metadata->>'evidence_kind', '') IS DISTINCT FROM 'signature'
  ), CASE
    WHEN t.image_url IS NOT NULL THEN
      json_build_array(jsonb_build_object('file_url', t.image_url, 'file_type', 'image/*'))
    ELSE '[]'::json
  END) AS images
FROM tasks t
LEFT JOIN properties p ON p.id = t.property_id AND p.org_id = t.org_id
LEFT JOIN task_themes tt ON tt.task_id = t.id
LEFT JOIN themes th ON th.id = tt.theme_id AND th.org_id = t.org_id
GROUP BY
  t.id, t.org_id, t.title, t.description, t.status, t.priority, t.due_at,
  t.assigned_user_id, t.owner_user_id, t.property_id, t.created_at, t.updated_at,
  t.space_ids, t.assigned_team_ids, t.image_url, t.milestones,
  p.nickname, p.address, p.thumbnail_url;

GRANT SELECT ON public.tasks_view TO anon, authenticated;

COMMENT ON VIEW public.tasks_view IS
  'Tasks with relationships. images aggregates task attachments excluding checklist signatures; owner_user_id is From, assigned_user_id is For.';

NOTIFY pgrst, 'reload schema';
