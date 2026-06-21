-- Upgrade legacy checklist_templates (normalized items table) to JSONB items + category
-- expected by the template manager UI and PostgREST schema cache.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'checklist_templates'
      AND column_name = 'items'
  ) THEN
    ALTER TABLE checklist_templates
      ADD COLUMN items JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

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

-- Backfill JSONB items from checklist_template_items when that legacy table exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'checklist_template_items'
  ) THEN
    UPDATE checklist_templates t
    SET items = COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'title', i.title,
            'is_yes_no', COALESCE(i.is_yes_no, false),
            'requires_signature', COALESCE(i.requires_signature, false)
          )
          ORDER BY COALESCE(i.order_index, 0), i.created_at NULLS LAST, i.id
        )
        FROM checklist_template_items i
        WHERE i.template_id = t.id
          AND COALESCE(i.is_archived, false) = false
      ),
      '[]'::jsonb
    )
    WHERE t.items = '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checklist_templates_category_check'
  ) THEN
    ALTER TABLE checklist_templates
      ADD CONSTRAINT checklist_templates_category_check
      CHECK (category IN ('compliance', 'maintenance', 'security', 'operations'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_checklist_templates_category
  ON checklist_templates(category)
  WHERE COALESCE(is_archived, false) = false;

NOTIFY pgrst, 'reload schema';
