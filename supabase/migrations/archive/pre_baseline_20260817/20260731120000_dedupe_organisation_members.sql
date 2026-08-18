-- Repair duplicate organisation_members rows (same org_id + user_id) and
-- enforce uniqueness. An earlier migration recorded the unique index as applied
-- but the index is missing on remote because duplicates blocked creation.

-- Keep the earliest membership per (org_id, user_id).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY org_id, user_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM organisation_members
)
DELETE FROM organisation_members
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Drop the non-unique helper index if it would collide on name patterns; keep it
-- only if still useful alongside the unique index.
DROP INDEX IF EXISTS organisation_members_org_user_unique;

CREATE UNIQUE INDEX organisation_members_org_user_unique
  ON organisation_members (org_id, user_id);
