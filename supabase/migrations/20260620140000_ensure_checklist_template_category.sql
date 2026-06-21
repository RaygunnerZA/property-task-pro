-- Ensure checklist_templates.category exists and refresh PostgREST schema cache.
-- Fixes PGRST204: "Could not find the 'category' column ... in the schema cache"

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'checklist_templates'
      AND column_name = 'category'
  ) THEN
    ALTER TABLE checklist_templates
      ADD COLUMN category TEXT NOT NULL DEFAULT 'operations';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'checklist_templates_category_check'
  ) THEN
    ALTER TABLE checklist_templates
      ADD CONSTRAINT checklist_templates_category_check
      CHECK (category IN ('compliance', 'maintenance', 'security', 'operations'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_checklist_templates_category
  ON checklist_templates(category)
  WHERE is_archived = false;

NOTIFY pgrst, 'reload schema';
