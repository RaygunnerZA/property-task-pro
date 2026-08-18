-- Property Documents: Extend attachments with metadata + junction tables
-- Uses parent_type='property', parent_id=propertyId (no property_id column)

-- ============================================================================
-- 1. Extend attachments table with document metadata
-- ============================================================================
ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS document_type TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS renewal_frequency TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN attachments.title IS 'Display title for property documents';
COMMENT ON COLUMN attachments.category IS 'Category: Plans, Legal, Fire Safety, etc.';
COMMENT ON COLUMN attachments.document_type IS 'Document type classification';
COMMENT ON COLUMN attachments.expiry_date IS 'Expiry date for compliance-related docs';
COMMENT ON COLUMN attachments.renewal_frequency IS '6mo, 1yr, 5yr, custom';
COMMENT ON COLUMN attachments.status IS 'green/amber/red/unknown - computed or stored';

-- ============================================================================
-- 2. Junction table: attachment_spaces
-- ============================================================================
CREATE TABLE IF NOT EXISTS attachment_spaces (
  attachment_id UUID NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (attachment_id, space_id)
);
ALTER TABLE attachment_spaces ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_attachment_spaces_attachment ON attachment_spaces(attachment_id);
CREATE INDEX IF NOT EXISTS idx_attachment_spaces_space ON attachment_spaces(space_id);

-- RLS: org-scoped, user must be org member
CREATE POLICY "attachment_spaces_select" ON attachment_spaces FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "attachment_spaces_insert" ON attachment_spaces FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "attachment_spaces_delete" ON attachment_spaces FOR DELETE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

-- ============================================================================
-- 3. Junction table: attachment_assets
-- ============================================================================
CREATE TABLE IF NOT EXISTS attachment_assets (
  attachment_id UUID NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (attachment_id, asset_id)
);
ALTER TABLE attachment_assets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_attachment_assets_attachment ON attachment_assets(attachment_id);
CREATE INDEX IF NOT EXISTS idx_attachment_assets_asset ON attachment_assets(asset_id);

CREATE POLICY "attachment_assets_select" ON attachment_assets FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "attachment_assets_insert" ON attachment_assets FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "attachment_assets_delete" ON attachment_assets FOR DELETE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

-- ============================================================================
-- 4. Junction table: attachment_contractors (links to organisations with org_type=contractor)
-- ============================================================================
CREATE TABLE IF NOT EXISTS attachment_contractors (
  attachment_id UUID NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  contractor_org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (attachment_id, contractor_org_id)
);
ALTER TABLE attachment_contractors ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_attachment_contractors_attachment ON attachment_contractors(attachment_id);

CREATE POLICY "attachment_contractors_select" ON attachment_contractors FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "attachment_contractors_insert" ON attachment_contractors FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "attachment_contractors_delete" ON attachment_contractors FOR DELETE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

-- ============================================================================
-- 5. Junction table: attachment_compliance (links to compliance_documents)
-- ============================================================================
CREATE TABLE IF NOT EXISTS attachment_compliance (
  attachment_id UUID NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  compliance_document_id UUID NOT NULL REFERENCES compliance_documents(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (attachment_id, compliance_document_id)
);
ALTER TABLE attachment_compliance ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_attachment_compliance_attachment ON attachment_compliance(attachment_id);

CREATE POLICY "attachment_compliance_select" ON attachment_compliance FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "attachment_compliance_insert" ON attachment_compliance FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "attachment_compliance_delete" ON attachment_compliance FOR DELETE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
