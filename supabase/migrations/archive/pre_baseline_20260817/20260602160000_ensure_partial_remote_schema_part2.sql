-- Repair part 2: idempotent schema for partial/legacy remotes (gbtexoyvfpnduykmxunc).
-- Adds RPCs, property_details, attachments, space_types, compliance_portfolio_view.

-- ============================================================================
-- 1. get_users_info RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION get_users_info(user_ids UUID[])
RETURNS TABLE (
  id UUID,
  email TEXT,
  nickname TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    COALESCE(u.raw_user_meta_data->>'nickname', NULL)::TEXT AS nickname,
    COALESCE(u.raw_user_meta_data->>'avatar_url', NULL)::TEXT AS avatar_url
  FROM auth.users u
  WHERE u.id = ANY(user_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION get_users_info(UUID[]) TO authenticated, anon;

-- ============================================================================
-- 2. property_details (+ enums when missing)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'site_type') THEN
    CREATE TYPE site_type AS ENUM (
      'residential', 'commercial', 'mixed_use', 'industrial', 'land', 'other'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ownership_type') THEN
    CREATE TYPE ownership_type AS ENUM (
      'owned', 'leased', 'rented', 'managed', 'other'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS property_details (
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

CREATE INDEX IF NOT EXISTS idx_property_details_org_id ON property_details(org_id);
ALTER TABLE property_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "property_details_select" ON property_details;
CREATE POLICY "property_details_select" ON property_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.org_id = property_details.org_id AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "property_details_insert" ON property_details;
CREATE POLICY "property_details_insert" ON property_details
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.org_id = property_details.org_id AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "property_details_update" ON property_details;
CREATE POLICY "property_details_update" ON property_details
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.org_id = property_details.org_id AND om.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. attachments (base table + metadata columns)
-- ============================================================================
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  parent_type TEXT NOT NULL,
  parent_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS ocr_text TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS document_type TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS renewal_frequency TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_attachments_parent ON attachments (parent_type, parent_id);
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attachments_select" ON attachments;
CREATE POLICY "attachments_select" ON attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.org_id = attachments.org_id AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "attachments_insert" ON attachments;
CREATE POLICY "attachments_insert" ON attachments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.org_id = attachments.org_id AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "attachments_update" ON attachments;
CREATE POLICY "attachments_update" ON attachments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.org_id = attachments.org_id AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "attachments_delete" ON attachments;
CREATE POLICY "attachments_delete" ON attachments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.org_id = attachments.org_id AND om.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. space_types + spaces.space_type_id (for PostgREST embed)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'functional_class') THEN
    CREATE TYPE functional_class AS ENUM (
      'circulation', 'habitable', 'service', 'sanitary', 'storage',
      'mechanical_plant', 'it_infrastructure', 'electrical', 'power_backup',
      'building_services', 'vertical_transport', 'external_area', 'external_logistics'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS space_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  functional_class functional_class NOT NULL DEFAULT 'habitable',
  default_ui_group TEXT NOT NULL DEFAULT 'General',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT space_types_name_unique UNIQUE (name)
);

ALTER TABLE space_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "space_types_select" ON space_types;
CREATE POLICY "space_types_select" ON space_types
  FOR SELECT USING (true);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spaces'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'spaces' AND column_name = 'space_type_id'
  ) THEN
    ALTER TABLE spaces
      ADD COLUMN space_type_id UUID REFERENCES space_types(id) ON DELETE SET NULL;
  END IF;
END $$;

GRANT SELECT ON space_types TO anon, authenticated;

-- ============================================================================
-- 5. compliance_documents (+ columns) + compliance_portfolio_view
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

DROP POLICY IF EXISTS "compliance_documents_insert" ON compliance_documents;
CREATE POLICY "compliance_documents_insert" ON compliance_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.org_id = compliance_documents.org_id AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "compliance_documents_update" ON compliance_documents;
CREATE POLICY "compliance_documents_update" ON compliance_documents
  FOR UPDATE USING (
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

-- ============================================================================
-- 6. Security Advisor: legacy compliance views → security invoker
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'compliance_upcoming'
  ) THEN
    ALTER VIEW public.compliance_upcoming SET (security_invoker = true);
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'compliance_property_summary'
  ) THEN
    ALTER VIEW public.compliance_property_summary SET (security_invoker = true);
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'compliance_org_health'
  ) THEN
    ALTER VIEW public.compliance_org_health SET (security_invoker = true);
  END IF;
END $$;

-- ============================================================================
-- 7. Grants + PostgREST schema reload
-- ============================================================================
GRANT SELECT ON property_details TO anon, authenticated;
GRANT SELECT ON attachments TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
