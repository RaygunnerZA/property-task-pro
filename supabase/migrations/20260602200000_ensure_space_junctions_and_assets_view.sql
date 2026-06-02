-- Repair part 6: junction tables + assets_view for partial/legacy remotes.
-- PostgREST 404 when compliance_spaces, attachment_spaces, or assets_view are missing.

-- ============================================================================
-- 1. compliance_spaces
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'compliance_documents'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spaces'
  ) THEN
    CREATE TABLE IF NOT EXISTS compliance_spaces (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
      compliance_document_id UUID NOT NULL REFERENCES compliance_documents(id) ON DELETE CASCADE,
      space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (compliance_document_id, space_id)
    );

    ALTER TABLE compliance_spaces ENABLE ROW LEVEL SECURITY;

    CREATE INDEX IF NOT EXISTS idx_compliance_spaces_compliance
      ON compliance_spaces(compliance_document_id);
    CREATE INDEX IF NOT EXISTS idx_compliance_spaces_space
      ON compliance_spaces(space_id);

    DROP POLICY IF EXISTS "compliance_spaces_select" ON compliance_spaces;
    CREATE POLICY "compliance_spaces_select" ON compliance_spaces FOR SELECT
      USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

    DROP POLICY IF EXISTS "compliance_spaces_insert" ON compliance_spaces;
    CREATE POLICY "compliance_spaces_insert" ON compliance_spaces FOR INSERT
      WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

    DROP POLICY IF EXISTS "compliance_spaces_update" ON compliance_spaces;
    CREATE POLICY "compliance_spaces_update" ON compliance_spaces FOR UPDATE
      USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

    DROP POLICY IF EXISTS "compliance_spaces_delete" ON compliance_spaces;
    CREATE POLICY "compliance_spaces_delete" ON compliance_spaces FOR DELETE
      USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

    GRANT SELECT, INSERT, UPDATE, DELETE ON compliance_spaces TO authenticated;
  END IF;
END $$;

-- ============================================================================
-- 2. attachment_spaces
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'attachments'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spaces'
  ) THEN
    CREATE TABLE IF NOT EXISTS attachment_spaces (
      attachment_id UUID NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
      space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (attachment_id, space_id)
    );

    ALTER TABLE attachment_spaces ENABLE ROW LEVEL SECURITY;

    CREATE INDEX IF NOT EXISTS idx_attachment_spaces_attachment
      ON attachment_spaces(attachment_id);
    CREATE INDEX IF NOT EXISTS idx_attachment_spaces_space
      ON attachment_spaces(space_id);

    DROP POLICY IF EXISTS "attachment_spaces_select" ON attachment_spaces;
    CREATE POLICY "attachment_spaces_select" ON attachment_spaces FOR SELECT
      USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

    DROP POLICY IF EXISTS "attachment_spaces_insert" ON attachment_spaces;
    CREATE POLICY "attachment_spaces_insert" ON attachment_spaces FOR INSERT
      WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

    DROP POLICY IF EXISTS "attachment_spaces_delete" ON attachment_spaces;
    CREATE POLICY "attachment_spaces_delete" ON attachment_spaces FOR DELETE
      USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

    GRANT SELECT, INSERT, DELETE ON attachment_spaces TO authenticated;
  END IF;
END $$;

-- ============================================================================
-- 3. assets_view (minimal — matches repair assets table shape)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'assets'
  ) THEN
    DROP VIEW IF EXISTS assets_view;

    CREATE VIEW assets_view
    WITH (security_invoker = true)
    AS
    SELECT
      a.id,
      a.org_id,
      a.property_id,
      a.space_id,
      a.name,
      a.asset_type,
      a.category,
      a.serial_number,
      a.condition_score,
      a.status,
      a.metadata,
      a.created_at,
      a.updated_at,
      a.icon_name,
      p.nickname AS property_name,
      p.address AS property_address,
      s.name AS space_name,
      0::integer AS open_tasks_count
    FROM assets a
    LEFT JOIN properties p ON p.id = a.property_id AND p.org_id = a.org_id
    LEFT JOIN spaces s ON s.id = a.space_id AND s.org_id = a.org_id;

    GRANT SELECT ON assets_view TO authenticated, anon, service_role;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
