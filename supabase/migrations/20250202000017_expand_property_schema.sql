-- Expand Property Schema to Support Full Taxonomy Brief
-- Creates extension tables for property details, legal/lease info, and utilities
-- Source: @Docs/03_Data_Model.md

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Site type enum for property classification
CREATE TYPE site_type AS ENUM (
  'residential',
  'commercial',
  'mixed_use',
  'industrial',
  'land',
  'other'
);

-- Ownership type enum for property ownership status
CREATE TYPE ownership_type AS ENUM (
  'owned',
  'leased',
  'rented',
  'managed',
  'other'
);

-- ============================================================================
-- PROPERTY DETAILS EXTENSION
-- ============================================================================

CREATE TABLE property_details (
  property_id UUID PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  site_type site_type,
  ownership_type ownership_type,
  total_area_sqft INTEGER,
  floor_count INTEGER,
  listing_grade TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE property_details ENABLE ROW LEVEL SECURITY;

-- Index for org_id lookups
CREATE INDEX idx_property_details_org_id ON property_details(org_id);

-- ============================================================================
-- PROPERTY LEGAL & LEASE EXTENSION
-- ============================================================================

CREATE TABLE property_legal (
  property_id UUID PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  purchase_date DATE,
  lease_start DATE,
  lease_end DATE,
  landlord_name TEXT,
  agent_contact JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE property_legal ENABLE ROW LEVEL SECURITY;

-- Index for org_id lookups
CREATE INDEX idx_property_legal_org_id ON property_legal(org_id);

-- ============================================================================
-- PROPERTY UTILITIES EXTENSION
-- ============================================================================

CREATE TABLE property_utilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('elec', 'gas', 'water')),
  supplier TEXT,
  meter_serial TEXT,
  account_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE property_utilities ENABLE ROW LEVEL SECURITY;

-- Indexes for lookups
CREATE INDEX idx_property_utilities_property_id ON property_utilities(property_id);
CREATE INDEX idx_property_utilities_org_id ON property_utilities(org_id);
CREATE INDEX idx_property_utilities_type ON property_utilities(type);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Property Details: Standard Org Member logic with Staff restrictions
CREATE POLICY "property_details_select" ON property_details
  FOR SELECT
  USING (
    org_id = current_org_id()
    AND (
      -- Non-staff users see all property details in their org
      (auth.jwt() ->> 'role') != 'staff'
      OR
      -- Staff users only see details for assigned properties
      (
        (auth.jwt() ->> 'role') = 'staff'
        AND property_id = ANY(assigned_properties())
      )
    )
  );

CREATE POLICY "property_details_insert" ON property_details
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "property_details_update" ON property_details
  FOR UPDATE
  USING (
    org_id = current_org_id()
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "property_details_delete" ON property_details
  FOR DELETE
  USING (
    org_id = current_org_id()
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

-- Property Legal: Standard Org Member logic with Staff restrictions
CREATE POLICY "property_legal_select" ON property_legal
  FOR SELECT
  USING (
    org_id = current_org_id()
    AND (
      -- Non-staff users see all property legal info in their org
      (auth.jwt() ->> 'role') != 'staff'
      OR
      -- Staff users only see legal info for assigned properties
      (
        (auth.jwt() ->> 'role') = 'staff'
        AND property_id = ANY(assigned_properties())
      )
    )
  );

CREATE POLICY "property_legal_insert" ON property_legal
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "property_legal_update" ON property_legal
  FOR UPDATE
  USING (
    org_id = current_org_id()
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "property_legal_delete" ON property_legal
  FOR DELETE
  USING (
    org_id = current_org_id()
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

-- Property Utilities: Standard Org Member logic with Staff restrictions
CREATE POLICY "property_utilities_select" ON property_utilities
  FOR SELECT
  USING (
    org_id = current_org_id()
    AND (
      -- Non-staff users see all utilities in their org
      (auth.jwt() ->> 'role') != 'staff'
      OR
      -- Staff users only see utilities for assigned properties
      (
        (auth.jwt() ->> 'role') = 'staff'
        AND property_id = ANY(assigned_properties())
      )
    )
  );

CREATE POLICY "property_utilities_insert" ON property_utilities
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "property_utilities_update" ON property_utilities
  FOR UPDATE
  USING (
    org_id = current_org_id()
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "property_utilities_delete" ON property_utilities
  FOR DELETE
  USING (
    org_id = current_org_id()
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

-- Generic function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Property Details trigger
CREATE TRIGGER property_details_updated_at
  BEFORE UPDATE ON property_details
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Property Legal trigger
CREATE TRIGGER property_legal_updated_at
  BEFORE UPDATE ON property_legal
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Property Utilities trigger
CREATE TRIGGER property_utilities_updated_at
  BEFORE UPDATE ON property_utilities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

