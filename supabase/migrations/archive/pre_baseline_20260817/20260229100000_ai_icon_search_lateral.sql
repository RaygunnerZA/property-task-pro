-- AI icon search: return 5 results, lateral thinking (stove -> pot, pan, heat)
-- When direct match fails, expand query with related terms.

-- 1. Add lateral synonyms to icon_library (stove->pot/pan/heat, etc.)
UPDATE icon_library
SET search_vector = to_tsvector('english', name || ' ' || COALESCE(array_to_string(tags, ' '), '') || ' stove oven cooker range pan frying skillet')
WHERE name = 'cooking-pot';

UPDATE icon_library
SET search_vector = to_tsvector('english', name || ' ' || COALESCE(array_to_string(tags, ' '), '') || ' stove oven cooker range burner')
WHERE name = 'flame';

-- 2. Lateral synonym table for when direct search returns nothing
CREATE TABLE IF NOT EXISTS icon_search_synonyms (
  word TEXT PRIMARY KEY,
  expansion TEXT[] NOT NULL
);

-- Common lateral expansions: query word -> related search terms
INSERT INTO icon_search_synonyms (word, expansion) VALUES
  ('stove', ARRAY['pot', 'pan', 'heat', 'cooking', 'flame']),
  ('oven', ARRAY['heat', 'flame', 'cooking', 'pot']),
  ('fridge', ARRAY['refrigerator', 'cold', 'snowflake', 'box']),
  ('refrigerator', ARRAY['fridge', 'cold', 'snowflake', 'box']),
  ('washer', ARRAY['washing', 'water', 'droplet', 'circle']),
  ('dryer', ARRAY['flame', 'heat', 'wind', 'circle']),
  ('dishwasher', ARRAY['dish', 'water', 'droplet', 'sparkles']),
  ('microwave', ARRAY['flame', 'heat', 'box', 'zap']),
  ('toaster', ARRAY['flame', 'heat', 'cooking', 'zap']),
  ('boiler', ARRAY['flame', 'heat', 'fuel', 'thermometer']),
  ('furnace', ARRAY['flame', 'heat', 'fuel', 'thermometer']),
  ('radiator', ARRAY['heat', 'thermometer', 'flame']),
  ('ac', ARRAY['air', 'vent', 'thermometer', 'snowflake']),
  ('aircon', ARRAY['air', 'vent', 'thermometer', 'snowflake']),
  ('hvac', ARRAY['thermometer', 'air', 'vent', 'flame', 'snowflake'])
ON CONFLICT (word) DO UPDATE SET expansion = EXCLUDED.expansion;

-- 3. Update ai_icon_search: return 5 results, lateral fallback when 0
CREATE OR REPLACE FUNCTION ai_icon_search(query_text TEXT DEFAULT '')
RETURNS SETOF icon_library
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_query TEXT;
  v_first_word TEXT;
  v_expansion TEXT;
  v_tsq TSQUERY;
BEGIN
  IF query_text IS NULL OR trim(query_text) = '' THEN
    RETURN QUERY SELECT * FROM icon_library ORDER BY name ASC LIMIT 5;
    RETURN;
  END IF;

  v_query := trim(lower(query_text));
  v_first_word := split_part(v_query, ' ', 1);

  -- 1. Direct search first (plainto_tsquery: all words must match)
  RETURN QUERY
  SELECT *
  FROM icon_library
  WHERE search_vector @@ plainto_tsquery('english', v_query)
  ORDER BY ts_rank(search_vector, plainto_tsquery('english', v_query)) DESC, name ASC
  LIMIT 5;

  IF FOUND THEN
    RETURN;
  END IF;

  -- 2. Lateral fallback: try first word's synonyms (stove -> pot, pan, heat)
  v_expansion := (
    SELECT array_to_string(expansion, ' ')
    FROM icon_search_synonyms
    WHERE word = v_first_word
    LIMIT 1
  );

  IF v_expansion IS NOT NULL AND v_expansion != '' THEN
    v_tsq := plainto_tsquery('english', v_expansion);
    RETURN QUERY
    SELECT *
    FROM icon_library
    WHERE search_vector @@ v_tsq
    ORDER BY ts_rank(search_vector, v_tsq) DESC, name ASC
    LIMIT 5;
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- 3. Fallback: try first word only (e.g. "Main Bathroom" -> "bathroom")
  IF v_first_word != '' AND (position(' ' in v_query) > 0 OR v_expansion IS NULL) THEN
    RETURN QUERY
    SELECT *
    FROM icon_library
    WHERE search_vector @@ plainto_tsquery('english', v_first_word)
    ORDER BY ts_rank(search_vector, plainto_tsquery('english', v_first_word)) DESC, name ASC
    LIMIT 5;
  END IF;
END;
$$;

COMMENT ON FUNCTION ai_icon_search IS 'AI icon lookup: 5 results, lateral thinking (e.g. stove -> pot, pan, heat).';
