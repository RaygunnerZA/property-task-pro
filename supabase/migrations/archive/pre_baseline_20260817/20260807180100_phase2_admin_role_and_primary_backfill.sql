-- Phase 2 follow-up: normalize legacy admin → manager; ensure every org has a Primary Owner.

UPDATE public.organisation_members
SET role = 'manager'
WHERE lower(role) = 'admin';

WITH missing AS (
  SELECT o.id AS org_id
  FROM public.organisations o
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organisation_members om
    WHERE om.org_id = o.id AND om.is_primary_owner
  )
),
pick AS (
  SELECT DISTINCT ON (om.org_id) om.id
  FROM public.organisation_members om
  JOIN missing m ON m.org_id = om.org_id
  ORDER BY om.org_id,
    CASE WHEN lower(om.role) = 'owner' THEN 0 ELSE 1 END,
    om.created_at ASC NULLS LAST
)
UPDATE public.organisation_members om
SET is_primary_owner = true, role = 'owner'
FROM pick p
WHERE om.id = p.id;
