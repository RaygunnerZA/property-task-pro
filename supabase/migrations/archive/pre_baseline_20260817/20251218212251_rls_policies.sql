-- Filla V2 RLS Policies
-- Source of Truth: @Docs/02_Identity.md, @Docs/03_Data_Model.md

-- ============================================================================
-- SCHEMA UPDATES
-- ============================================================================

-- Add property_id to tasks table for staff RLS logic
ALTER TABLE tasks ADD COLUMN property_id UUID REFERENCES properties(id) ON DELETE CASCADE;

-- ============================================================================
-- HELPER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION current_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN (auth.jwt() ->> 'active_org_id')::UUID;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Helper function to get assigned_properties as UUID array
CREATE OR REPLACE FUNCTION assigned_properties()
RETURNS UUID[] AS $$
DECLARE
  props JSONB;
BEGIN
  props := auth.jwt() -> 'assigned_properties';
  IF props IS NULL THEN
    RETURN ARRAY[]::UUID[];
  END IF;
  RETURN (
    SELECT ARRAY(
      SELECT jsonb_array_elements_text(props)::UUID
    )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- ORGANISATIONS
-- ============================================================================

-- Organisations: Users can read their own orgs (check membership)
CREATE POLICY "organisations_select" ON organisations
  FOR SELECT
  USING (
    id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- ORGANISATION MEMBERS
-- ============================================================================

CREATE POLICY "organisation_members_select" ON organisation_members
  FOR SELECT
  USING (org_id = current_org_id());

-- ============================================================================
-- PROPERTIES (with Staff Logic)
-- ============================================================================

CREATE POLICY "properties_select" ON properties
  FOR SELECT
  USING (
    org_id = current_org_id()
    AND (
      -- Non-staff users see all properties in their org
      (auth.jwt() ->> 'role') != 'staff'
      OR
      -- Staff users only see assigned properties
      (
        (auth.jwt() ->> 'role') = 'staff'
        AND id = ANY(assigned_properties())
      )
    )
  );

-- ============================================================================
-- SPACES
-- ============================================================================

CREATE POLICY "spaces_select" ON spaces
  FOR SELECT
  USING (org_id = current_org_id());

-- ============================================================================
-- ASSETS (with Staff Logic)
-- ============================================================================

CREATE POLICY "assets_select" ON assets
  FOR SELECT
  USING (
    org_id = current_org_id()
    AND (
      -- Non-staff users see all assets in their org
      (auth.jwt() ->> 'role') != 'staff'
      OR
      -- Staff users only see assets in assigned properties
      (
        (auth.jwt() ->> 'role') = 'staff'
        AND property_id = ANY(assigned_properties())
      )
    )
  );

-- ============================================================================
-- TASKS (with Staff Logic)
-- ============================================================================

CREATE POLICY "tasks_select" ON tasks
  FOR SELECT
  USING (
    org_id = current_org_id()
    AND (
      -- Non-staff users see all tasks in their org
      (auth.jwt() ->> 'role') != 'staff'
      OR
      -- Staff users only see tasks in assigned properties
      (
        (auth.jwt() ->> 'role') = 'staff'
        AND (
          -- If property_id is NULL, staff can see it (or change to FALSE to hide)
          property_id IS NULL
          OR property_id = ANY(assigned_properties())
        )
      )
    )
  );

-- ============================================================================
-- SCHEDULE ITEMS
-- ============================================================================

CREATE POLICY "schedule_items_select" ON schedule_items
  FOR SELECT
  USING (org_id = current_org_id());

-- ============================================================================
-- TASK INSTANCES
-- ============================================================================

CREATE POLICY "task_instances_select" ON task_instances
  FOR SELECT
  USING (org_id = current_org_id());

-- ============================================================================
-- ISSUES
-- ============================================================================

CREATE POLICY "issues_select" ON issues
  FOR SELECT
  USING (org_id = current_org_id());

-- ============================================================================
-- COMPLIANCE SOURCES
-- ============================================================================

CREATE POLICY "compliance_sources_select" ON compliance_sources
  FOR SELECT
  USING (org_id = current_org_id());

-- ============================================================================
-- COMPLIANCE DOCUMENTS
-- ============================================================================

CREATE POLICY "compliance_documents_select" ON compliance_documents
  FOR SELECT
  USING (org_id = current_org_id());

-- ============================================================================
-- COMPLIANCE RULES
-- ============================================================================

CREATE POLICY "compliance_rules_select" ON compliance_rules
  FOR SELECT
  USING (org_id = current_org_id());

-- ============================================================================
-- ATTACHMENTS
-- ============================================================================

CREATE POLICY "attachments_select" ON attachments
  FOR SELECT
  USING (org_id = current_org_id());

-- ============================================================================
-- EVIDENCE
-- ============================================================================

CREATE POLICY "evidence_select" ON evidence
  FOR SELECT
  USING (org_id = current_org_id());

-- ============================================================================
-- CONTRACTOR TOKENS (Special Logic)
-- ============================================================================

CREATE POLICY "contractor_tokens_select" ON contractor_tokens
  FOR SELECT
  USING (
    -- Contractor token access: JWT contractor_token claim matches token column
    (auth.jwt() ->> 'contractor_token') = token
  );

-- ============================================================================
-- SUBSCRIPTION TIERS
-- ============================================================================

-- Subscription tiers: Public read access (no org_id)
CREATE POLICY "subscription_tiers_select" ON subscription_tiers
  FOR SELECT
  USING (is_active = true);

-- ============================================================================
-- ORG SUBSCRIPTIONS
-- ============================================================================

CREATE POLICY "org_subscriptions_select" ON org_subscriptions
  FOR SELECT
  USING (org_id = current_org_id());

-- ============================================================================
-- ORG USAGE
-- ============================================================================

CREATE POLICY "org_usage_select" ON org_usage
  FOR SELECT
  USING (org_id = current_org_id());

