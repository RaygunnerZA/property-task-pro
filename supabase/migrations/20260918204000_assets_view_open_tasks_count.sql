-- Restore assets_view.open_tasks_count from task_assets.
-- Baseline stubbed the count as 0 when task_assets was absent; after the junction
-- landed, Attention / filters still treated every asset as having no open work.

DROP VIEW IF EXISTS public.assets_view CASCADE;

CREATE VIEW public.assets_view
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.org_id,
  a.property_id,
  a.space_id,
  a.name,
  a.asset_type,
  a.category,
  a.serial_number,
  a.condition_score,
  a.status,
  a.metadata,
  a.created_at,
  a.updated_at,
  a.icon_name,
  p.nickname AS property_name,
  p.address AS property_address,
  s.name AS space_name,
  COALESCE(
    (
      SELECT COUNT(DISTINCT ta.task_id)::integer
      FROM public.task_assets ta
      JOIN public.tasks t
        ON t.id = ta.task_id
       AND t.org_id = a.org_id
      WHERE ta.asset_id = a.id
        AND t.status IN ('open', 'in_progress', 'waiting_review')
    ),
    0
  ) AS open_tasks_count
FROM public.assets a
LEFT JOIN public.properties p
  ON p.id = a.property_id AND p.org_id = a.org_id
LEFT JOIN public.spaces s
  ON s.id = a.space_id AND s.org_id = a.org_id;

GRANT SELECT ON public.assets_view TO anon, authenticated;

COMMENT ON VIEW public.assets_view IS
  'Assets with property/space labels and open task counts via task_assets.';

NOTIFY pgrst, 'reload schema';
