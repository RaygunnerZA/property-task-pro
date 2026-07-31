-- Space identity art: optional override of auto-matched mini-card illustration.
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
COMMENT ON COLUMN spaces.thumbnail_url IS
  'Public path or URL for space identity thumbnail (typically /spaces/mini-cards/*.png).';

NOTIFY pgrst, 'reload schema';
