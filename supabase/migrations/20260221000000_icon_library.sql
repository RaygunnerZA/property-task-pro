-- ============================================================================
-- Icon Library — Lucide icon index for AI-powered icon selection
-- ============================================================================
-- Enables AI to search icons by semantic query (e.g. "fire extinguisher")
-- without external API calls. MIT licensed, no customer data.
-- ============================================================================

-- 1. icon_library table
CREATE TABLE IF NOT EXISTS icon_library (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  description TEXT,
  svg_path TEXT,
  stroke_width INT DEFAULT 2,
  aliases TEXT[] DEFAULT '{}',
  search_vector TSVECTOR
);

CREATE INDEX IF NOT EXISTS idx_icon_library_name ON icon_library(name);
CREATE INDEX IF NOT EXISTS idx_icon_library_search ON icon_library USING GIN(search_vector);

COMMENT ON TABLE icon_library IS 'Lucide icon index for AI icon search. MIT licensed.';

-- 2. Add icon_name to assets (nullable, default package)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS icon_name TEXT DEFAULT 'package';

COMMENT ON COLUMN assets.icon_name IS 'Lucide icon name (kebab-case) for asset display. AI-suggested via ai_icon_search.';

-- 3. Update assets_view to include icon_name (recreate view)
-- assets_view is defined in 20260211000001 - we need to add icon_name to the SELECT
-- Check if assets_view exists and has the column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'assets_view') THEN
    -- Drop and recreate to add icon_name
    DROP VIEW IF EXISTS assets_view;
    CREATE VIEW assets_view WITH (security_invoker = true) AS
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
      COALESCE(COUNT(DISTINCT ta.task_id) FILTER (WHERE t.status IN ('open', 'in_progress')), 0)::integer AS open_tasks_count
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
  END IF;
END $$;

-- 4. ai_icon_search RPC
CREATE OR REPLACE FUNCTION ai_icon_search(query_text TEXT DEFAULT '')
RETURNS SETOF icon_library
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF query_text IS NULL OR trim(query_text) = '' THEN
    RETURN QUERY SELECT * FROM icon_library ORDER BY name ASC LIMIT 10;
  ELSE
    RETURN QUERY
    SELECT *
    FROM icon_library
    WHERE search_vector @@ plainto_tsquery('english', query_text)
    ORDER BY ts_rank(search_vector, plainto_tsquery('english', query_text)) DESC, name ASC
    LIMIT 10;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION ai_icon_search(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION ai_icon_search(TEXT) TO service_role;

COMMENT ON FUNCTION ai_icon_search IS 'AI icon lookup by semantic query. Returns Lucide icon names for asset/property badges.';
