-- properties_view used four LEFT JOINs then GROUP BY. compliance_documents
-- was joined on org_id only, so one property × tasks × assets × spaces ×
-- org compliance docs exploded and hit the statement timeout. The workbench
-- then rendered "No properties yet" even though rows still existed.
--
-- Rewrite with correlated counts so each aggregate stays O(property rows).
-- Join compliance on property_id (column exists) rather than org_id.

CREATE OR REPLACE VIEW public.properties_view
WITH (security_invoker = true) AS
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
  (
    SELECT COUNT(*)::integer
    FROM public.tasks t
    WHERE t.property_id = p.id
      AND t.org_id = p.org_id
      AND t.status IN ('open', 'in_progress')
  ) AS open_tasks_count,
  (
    SELECT COUNT(*)::integer
    FROM public.assets a
    WHERE a.property_id = p.id
      AND a.org_id = p.org_id
  ) AS assets_count,
  (
    SELECT COUNT(*)::integer
    FROM public.compliance_documents cd
    WHERE cd.property_id = p.id
      AND cd.org_id = p.org_id
      AND cd.expiry_date < CURRENT_DATE
  ) AS expired_compliance_count,
  (
    SELECT COUNT(*)::integer
    FROM public.compliance_documents cd
    WHERE cd.property_id = p.id
      AND cd.org_id = p.org_id
      AND (cd.expiry_date >= CURRENT_DATE OR cd.expiry_date IS NULL)
  ) AS valid_compliance_count,
  (
    SELECT COUNT(*)::integer
    FROM public.spaces s
    WHERE s.property_id = p.id
      AND s.org_id = p.org_id
  ) AS spaces_count
FROM public.properties p;

GRANT SELECT ON public.properties_view TO authenticated;
