-- Phase 13A: FILLA Graph Backbone
-- Unified, queryable, org-scoped Property Graph Layer linking core entities.
-- Metadata describing links—not a new relational system. Does not change existing features.

-- ============================================================================
-- 1. property_graph_edges
-- ============================================================================
CREATE TABLE IF NOT EXISTS property_graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  relationship TEXT NOT NULL,
  weight FLOAT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, source_type, source_id, target_type, target_id, relationship)
);

CREATE INDEX IF NOT EXISTS idx_property_graph_edges_org ON property_graph_edges(org_id);
CREATE INDEX IF NOT EXISTS idx_property_graph_edges_source ON property_graph_edges(org_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_property_graph_edges_target ON property_graph_edges(org_id, target_type, target_id);

ALTER TABLE property_graph_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_graph_edges_select" ON property_graph_edges FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "property_graph_edges_insert" ON property_graph_edges FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "property_graph_edges_update" ON property_graph_edges FOR UPDATE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "property_graph_edges_delete" ON property_graph_edges FOR DELETE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

COMMENT ON TABLE property_graph_edges IS 'Phase 13A: Directed edges between entities. Synced by graph-sync. Queried by graph-query.';

-- ============================================================================
-- 2. property_graph_nodes (view)
-- Union of ID + type + minimal fields for graph traversal
-- ============================================================================
CREATE OR REPLACE VIEW property_graph_nodes
WITH (security_invoker = true)
AS
-- Properties
SELECT p.id, 'property'::TEXT AS node_type, COALESCE(p.nickname, p.address) AS name, NULL::UUID AS ref_id, NULL::TEXT AS extra, NULL::DATE AS expiry_date
FROM properties p
WHERE p.org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid())

UNION ALL
-- Spaces
SELECT s.id, 'space'::TEXT, s.name, s.property_id, NULL::TEXT, NULL::DATE
FROM spaces s
WHERE s.org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid())

UNION ALL
-- Assets
SELECT a.id, 'asset'::TEXT, COALESCE(a.name, a.serial_number, 'Asset'), a.space_id, a.asset_type, NULL::DATE
FROM assets a
WHERE a.org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid())

UNION ALL
-- Tasks
SELECT t.id, 'task'::TEXT, t.title, NULL::UUID, t.status::TEXT, t.due_date::DATE
FROM tasks t
WHERE t.org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid())

UNION ALL
-- Attachments
SELECT att.id, 'attachment'::TEXT, COALESCE(att.file_name, att.file_type, 'Attachment'), NULL::UUID, att.file_type, NULL::DATE
FROM attachments att
WHERE att.org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid())

UNION ALL
-- Compliance documents
SELECT cd.id, 'compliance'::TEXT, cd.title, cd.property_id, cd.document_type,
  COALESCE(cd.next_due_date, cd.expiry_date)
FROM compliance_documents cd
WHERE cd.org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid())

UNION ALL
-- Contractors (organisations with org_type=contractor, linked via compliance in user's org)
SELECT DISTINCT o.id, 'contractor'::TEXT, o.name, NULL::UUID, NULL::TEXT, NULL::DATE
FROM organisations o
JOIN compliance_contractors cc ON cc.contractor_org_id = o.id
WHERE cc.org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid());

COMMENT ON VIEW property_graph_nodes IS 'Phase 13A: Union of entity nodes for graph traversal. Hazard nodes are synthetic (from edges metadata), not in view.';
