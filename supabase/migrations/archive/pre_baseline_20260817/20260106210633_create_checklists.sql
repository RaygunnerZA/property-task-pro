-- Create checklist_templates table
-- Source: Task Creation UI requires checklist templates

-- ============================================================================
-- CHECKLIST TEMPLATES TABLE
-- ============================================================================

CREATE TABLE checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Org members can select checklist templates for their org
CREATE POLICY "checklist_templates_select" ON checklist_templates
  FOR SELECT
  USING (org_id = current_org_id());

-- Org members can insert checklist templates for their org
CREATE POLICY "checklist_templates_insert" ON checklist_templates
  FOR INSERT
  WITH CHECK (org_id = current_org_id());

-- Org members can update checklist templates for their org
CREATE POLICY "checklist_templates_update" ON checklist_templates
  FOR UPDATE
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

-- Org members can delete checklist templates for their org
CREATE POLICY "checklist_templates_delete" ON checklist_templates
  FOR DELETE
  USING (org_id = current_org_id());

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_checklist_templates_org_id ON checklist_templates(org_id);
CREATE INDEX idx_checklist_templates_is_archived ON checklist_templates(is_archived) WHERE is_archived = false;

