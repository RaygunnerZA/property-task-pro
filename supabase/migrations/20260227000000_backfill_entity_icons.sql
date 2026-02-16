-- Backfill icon_name for assets and spaces using ai_icon_search
-- Toilet asset -> toilet icon, Bathroom space -> bathroom icon, etc.

-- ============================================================================
-- Backfill assets: use name + asset_type + category for semantic icon lookup
-- ============================================================================
CREATE OR REPLACE FUNCTION backfill_asset_icons()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_icon_name TEXT;
  v_search TEXT;
  v_updated INTEGER := 0;
BEGIN
  FOR r IN
    SELECT id, name, asset_type, category
    FROM assets
    WHERE icon_name IS NULL OR icon_name = 'package'
  LOOP
    v_search := trim(COALESCE(r.name, '') || ' ' || COALESCE(r.asset_type, '') || ' ' || COALESCE(r.category, ''));
    IF v_search = '' THEN
      v_search := 'asset';
    END IF;

    SELECT name INTO v_icon_name
    FROM ai_icon_search(v_search)
    LIMIT 1;

    IF v_icon_name IS NOT NULL THEN
      UPDATE assets SET icon_name = v_icon_name WHERE id = r.id;
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  RETURN v_updated;
END;
$$;

-- ============================================================================
-- Backfill spaces: use name for semantic icon lookup (space_type column was removed)
-- ============================================================================
CREATE OR REPLACE FUNCTION backfill_space_icons()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_icon_name TEXT;
  v_search TEXT;
  v_updated INTEGER := 0;
BEGIN
  FOR r IN
    SELECT id, name
    FROM spaces
    WHERE icon_name IS NULL OR icon_name = ''
  LOOP
    v_search := trim(COALESCE(r.name, ''));
    IF v_search = '' THEN
      v_search := 'room';
    END IF;

    SELECT name INTO v_icon_name
    FROM ai_icon_search(v_search)
    LIMIT 1;

    IF v_icon_name IS NOT NULL THEN
      UPDATE spaces SET icon_name = v_icon_name WHERE id = r.id;
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  RETURN v_updated;
END;
$$;

-- ============================================================================
-- Combined backfill (call from app or manually)
-- ============================================================================
CREATE OR REPLACE FUNCTION backfill_entity_icons()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assets INTEGER;
  v_spaces INTEGER;
BEGIN
  v_assets := backfill_asset_icons();
  v_spaces := backfill_space_icons();

  RETURN jsonb_build_object(
    'assets_updated', v_assets,
    'spaces_updated', v_spaces
  );
END;
$$;

GRANT EXECUTE ON FUNCTION backfill_asset_icons() TO authenticated;
GRANT EXECUTE ON FUNCTION backfill_asset_icons() TO service_role;
GRANT EXECUTE ON FUNCTION backfill_space_icons() TO authenticated;
GRANT EXECUTE ON FUNCTION backfill_space_icons() TO service_role;
GRANT EXECUTE ON FUNCTION backfill_entity_icons() TO authenticated;
GRANT EXECUTE ON FUNCTION backfill_entity_icons() TO service_role;

COMMENT ON FUNCTION backfill_asset_icons IS 'Updates assets with null/package icon_name using ai_icon_search (e.g. toilet -> toilet icon)';
COMMENT ON FUNCTION backfill_space_icons IS 'Updates spaces with null icon_name using ai_icon_search (e.g. Bathroom -> bathroom icon)';
COMMENT ON FUNCTION backfill_entity_icons IS 'Runs both asset and space icon backfills. Returns {assets_updated, spaces_updated}.';

-- Run backfill once when migration is applied
SELECT backfill_entity_icons();
