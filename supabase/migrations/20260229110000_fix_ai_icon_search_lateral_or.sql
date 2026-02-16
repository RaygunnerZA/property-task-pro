-- Fix ai_icon_search lateral fallback: plainto_tsquery uses AND between words,
-- so "pot pan heat" required ALL terms and returned 0 rows. Use OR via websearch_to_tsquery.

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
    -- Use OR logic: plainto_tsquery uses AND; websearch_to_tsquery('pot or pan or heat') uses OR
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
