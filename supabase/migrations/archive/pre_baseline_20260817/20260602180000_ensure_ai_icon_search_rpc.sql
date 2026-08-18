-- Repair part 4: icon_library + icon_search_synonyms + ai_icon_search RPC (partial remotes).

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

CREATE TABLE IF NOT EXISTS icon_search_synonyms (
  word TEXT PRIMARY KEY,
  expansion TEXT[] NOT NULL
);

INSERT INTO icon_search_synonyms (word, expansion) VALUES
  ('stove', ARRAY['pot', 'pan', 'heat', 'cooking', 'flame']),
  ('bathroom', ARRAY['bath', 'shower', 'droplet', 'home']),
  ('kitchen', ARRAY['cooking', 'pot', 'utensils', 'home']),
  ('garden', ARRAY['tree', 'flower', 'leaf', 'home'])
ON CONFLICT (word) DO NOTHING;

-- Minimal icon set so RPC returns useful results without full seed migration
INSERT INTO icon_library (name, tags, search_vector) VALUES
  ('package', ARRAY['package', 'box'], to_tsvector('english', 'package box')),
  ('building', ARRAY['building', 'property'], to_tsvector('english', 'building property')),
  ('home', ARRAY['home', 'house'], to_tsvector('english', 'home house')),
  ('bath', ARRAY['bathroom', 'bath'], to_tsvector('english', 'bath bathroom')),
  ('bed', ARRAY['bedroom', 'bed'], to_tsvector('english', 'bed bedroom')),
  ('cooking-pot', ARRAY['kitchen', 'cooking'], to_tsvector('english', 'cooking-pot kitchen cooking stove oven pan heat')),
  ('flame', ARRAY['heat', 'fire'], to_tsvector('english', 'flame heat fire')),
  ('wrench', ARRAY['maintenance', 'tool'], to_tsvector('english', 'wrench maintenance tool')),
  ('shield', ARRAY['compliance', 'safety'], to_tsvector('english', 'shield compliance safety')),
  ('tree', ARRAY['garden', 'outdoor'], to_tsvector('english', 'tree garden outdoor'))
ON CONFLICT (name) DO NOTHING;

ALTER TABLE icon_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE icon_search_synonyms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "icon_library_select_authenticated" ON icon_library;
CREATE POLICY "icon_library_select_authenticated"
  ON icon_library FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "icon_search_synonyms_select_authenticated" ON icon_search_synonyms;
CREATE POLICY "icon_search_synonyms_select_authenticated"
  ON icon_search_synonyms FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION ai_icon_search(query_text TEXT DEFAULT '')
RETURNS SETOF icon_library
LANGUAGE plpgsql
STABLE
SET search_path = public
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

  RETURN QUERY
  SELECT *
  FROM icon_library
  WHERE search_vector @@ plainto_tsquery('english', v_query)
  ORDER BY ts_rank(search_vector, plainto_tsquery('english', v_query)) DESC, name ASC
  LIMIT 5;

  IF FOUND THEN
    RETURN;
  END IF;

  v_expansion := (
    SELECT array_to_string(expansion, ' ')
    FROM icon_search_synonyms
    WHERE word = v_first_word
    LIMIT 1
  );

  IF v_expansion IS NOT NULL AND v_expansion != '' THEN
    v_tsq := websearch_to_tsquery('english', replace(v_expansion, ' ', ' or '));
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

GRANT EXECUTE ON FUNCTION ai_icon_search(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION ai_icon_search(TEXT) TO service_role;
GRANT SELECT ON icon_library TO authenticated, anon;
GRANT SELECT ON icon_search_synonyms TO authenticated, anon;

COMMENT ON FUNCTION ai_icon_search IS 'AI icon lookup: 5 results, lateral synonym fallback.';

NOTIFY pgrst, 'reload schema';
