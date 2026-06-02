-- Repair part 3: assets table + compliance_portfolio_view for partial/legacy remotes.
-- PostgREST returns 404 when these relations are missing from the API schema.

-- ============================================================================
-- 1. assets (minimal app-compatible shape)
-- ============================================================================
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  space_id UUID,
  name TEXT NOT NULL DEFAULT 'Unnamed Asset',
  serial_number TEXT,
  condition_score INTEGER DEFAULT 100,
  asset_type TEXT,
  category TEXT,
  status TEXT DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spaces'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'assets_space_id_fkey'
      AND table_name = 'assets'
  ) THEN
    ALTER TABLE assets
      ADD CONSTRAINT assets_space_id_fkey
      FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assets_select" ON assets;
CREATE POLICY "assets_select" ON assets
  FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "assets_insert" ON assets;
CREATE POLICY "assets_insert" ON assets
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "assets_update" ON assets;
CREATE POLICY "assets_update" ON assets
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "assets_delete" ON assets;
CREATE POLICY "assets_delete" ON assets
  FOR DELETE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON assets TO authenticated;

-- ============================================================================
-- 2. compliance_documents (if missing) + compliance_portfolio_view
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  expiry_date DATE,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE compliance_documents
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS next_due_date DATE,
  ADD COLUMN IF NOT EXISTS linked_asset_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS document_type TEXT,
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS hazards TEXT[] DEFAULT '{}';

ALTER TABLE compliance_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compliance_documents_select" ON compliance_documents;
CREATE POLICY "compliance_documents_select" ON compliance_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.org_id = compliance_documents.org_id AND om.user_id = auth.uid()
    )
  );

DO $$
DECLARE
  v_has_hazards boolean;
  v_has_compliance_spaces boolean;
  v_hazards_expr text;
  v_space_ids_expr text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'compliance_documents'
      AND column_name = 'hazards'
  ) INTO v_has_hazards;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'compliance_spaces'
  ) INTO v_has_compliance_spaces;

  IF v_has_hazards THEN
    v_hazards_expr := 'cd.hazards';
  ELSE
    v_hazards_expr := 'ARRAY[]::text[]';
  END IF;

  IF v_has_compliance_spaces THEN
    v_space_ids_expr := $expr$
      (SELECT COALESCE(array_agg(cs.space_id), ARRAY[]::uuid[])
       FROM compliance_spaces cs
       WHERE cs.compliance_document_id = cd.id)
    $expr$;
  ELSE
    v_space_ids_expr := 'ARRAY[]::uuid[]';
  END IF;

  EXECUTE format(
    $sql$
    DROP VIEW IF EXISTS compliance_portfolio_view CASCADE;
    CREATE VIEW compliance_portfolio_view
    WITH (security_invoker = true)
    AS
    SELECT
      cd.id,
      cd.org_id,
      cd.property_id,
      p.nickname AS property_name,
      cd.title,
      cd.document_type,
      cd.expiry_date,
      cd.status,
      cd.next_due_date,
      cd.ai_confidence,
      cd.linked_asset_ids,
      %s AS hazards,
      %s AS space_ids,
      CASE
        WHEN COALESCE(cd.next_due_date, cd.expiry_date) IS NULL THEN 'none'
        WHEN COALESCE(cd.next_due_date, cd.expiry_date) < CURRENT_DATE THEN 'expired'
        WHEN COALESCE(cd.next_due_date, cd.expiry_date) <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring'
        ELSE 'valid'
      END AS expiry_state
    FROM compliance_documents cd
    LEFT JOIN properties p ON cd.property_id = p.id
    $sql$,
    v_hazards_expr,
    v_space_ids_expr
  );
END $$;

GRANT SELECT ON compliance_documents TO anon, authenticated;
GRANT SELECT ON compliance_portfolio_view TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
