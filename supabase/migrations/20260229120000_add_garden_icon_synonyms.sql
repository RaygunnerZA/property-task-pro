-- Add garden, yard, patio, balcony to lateral synonyms (no direct icon match)

INSERT INTO icon_search_synonyms (word, expansion) VALUES
  ('garden', ARRAY['tree', 'flower', 'leaf', 'plant', 'trees']),
  ('yard', ARRAY['tree', 'flower', 'leaf', 'plant', 'trees']),
  ('patio', ARRAY['tree', 'flower', 'sun', 'trees']),
  ('balcony', ARRAY['tree', 'flower', 'sun', 'trees'])
ON CONFLICT (word) DO UPDATE SET expansion = EXCLUDED.expansion;
