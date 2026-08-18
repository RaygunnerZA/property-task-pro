-- Repair part 5: Phase 12 icon_name columns missing on partial/legacy remotes.
-- App inserts/selects icon_name on spaces (and tasks, compliance_documents, assets).

ALTER TABLE spaces ADD COLUMN IF NOT EXISTS icon_name TEXT;
COMMENT ON COLUMN spaces.icon_name IS 'Lucide icon name (kebab-case) for space display.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tasks'
  ) THEN
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS icon_name TEXT;
    COMMENT ON COLUMN tasks.icon_name IS 'Lucide icon name (kebab-case) for task display.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'compliance_documents'
  ) THEN
    ALTER TABLE compliance_documents ADD COLUMN IF NOT EXISTS icon_name TEXT;
    COMMENT ON COLUMN compliance_documents.icon_name IS 'Lucide icon name (kebab-case). AI-suggested from document type.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'assets'
  ) THEN
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS icon_name TEXT;
    COMMENT ON COLUMN assets.icon_name IS 'Lucide icon name (kebab-case) for asset display.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
