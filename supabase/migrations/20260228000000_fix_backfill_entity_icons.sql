-- Fix icon backfill: plainto_tsquery requires ALL words to match.
-- "Main Toilet" fails because "main" isn't in icon search vectors.
-- Fallback: try first word if full search returns nothing.

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
  v_fallback TEXT;
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

    -- Try full search first
    SELECT name INTO v_icon_name
    FROM ai_icon_search(v_search)
    LIMIT 1;

    -- Fallback: try first word only (e.g. "Main Toilet" -> "Main", then "Toilet" via next word)
    IF v_icon_name IS NULL AND position(' ' in v_search) > 0 THEN
      v_fallback := split_part(v_search, ' ', 1);
      SELECT name INTO v_icon_name FROM ai_icon_search(v_fallback) LIMIT 1;
    END IF;
    IF v_icon_name IS NULL AND position(' ' in v_search) > 0 THEN
      v_fallback := split_part(v_search, ' ', 2);
      IF v_fallback != '' THEN
        SELECT name INTO v_icon_name FROM ai_icon_search(v_fallback) LIMIT 1;
      END IF;
    END IF;

    IF v_icon_name IS NOT NULL THEN
      UPDATE assets SET icon_name = v_icon_name WHERE id = r.id;
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  RETURN v_updated;
END;
$$;

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
  v_fallback TEXT;
  v_updated INTEGER := 0;
BEGIN
  -- Include icon_name = 'home' (generic default from AddSpaceDialog)
  FOR r IN
    SELECT id, name
    FROM spaces
    WHERE icon_name IS NULL OR icon_name = '' OR icon_name = 'home'
  LOOP
    v_search := trim(COALESCE(r.name, ''));
    IF v_search = '' THEN
      v_search := 'room';
    END IF;

    SELECT name INTO v_icon_name
    FROM ai_icon_search(v_search)
    LIMIT 1;

    -- Fallback: first word
    IF v_icon_name IS NULL AND position(' ' in v_search) > 0 THEN
      v_fallback := split_part(v_search, ' ', 1);
      SELECT name INTO v_icon_name FROM ai_icon_search(v_fallback) LIMIT 1;
    END IF;
    IF v_icon_name IS NULL AND position(' ' in v_search) > 0 THEN
      v_fallback := split_part(v_search, ' ', 2);
      IF v_fallback != '' THEN
        SELECT name INTO v_icon_name FROM ai_icon_search(v_fallback) LIMIT 1;
      END IF;
    END IF;

    IF v_icon_name IS NOT NULL THEN
      UPDATE spaces SET icon_name = v_icon_name WHERE id = r.id;
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  RETURN v_updated;
END;
$$;

-- Improve icon_library search: add common aliases (bathroom->bath, etc.)
UPDATE icon_library
SET search_vector = to_tsvector('english', name || ' ' || COALESCE(array_to_string(tags, ' '), '') || ' bathroom restroom')
WHERE name = 'bath';

UPDATE icon_library
SET search_vector = to_tsvector('english', name || ' ' || COALESCE(array_to_string(tags, ' '), '') || ' wc lavatory')
WHERE name = 'toilet';

-- Re-run backfill
SELECT backfill_entity_icons();
