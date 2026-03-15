-- Building Plan Intelligence MVP
-- Upload -> processing -> extraction review -> import

-- ============================================================================
-- 1) Enums
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_file_status') THEN
    CREATE TYPE plan_file_status AS ENUM (
      'uploaded',
      'converting',
      'extracting',
      'ready_for_review',
      'partially_reviewed',
      'imported',
      'failed'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_page_processing_status') THEN
    CREATE TYPE plan_page_processing_status AS ENUM (
      'queued',
      'converted',
      'extracted',
      'failed'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_run_status') THEN
    CREATE TYPE plan_run_status AS ENUM (
      'queued',
      'running',
      'completed',
      'failed'
    );
  END IF;
END $$;

-- ============================================================================
-- 2) Core plan tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS property_plan_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  uploaded_by UUID,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  page_count INTEGER,
  status plan_file_status NOT NULL DEFAULT 'uploaded',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_plan_files_org_property
  ON property_plan_files (org_id, property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_plan_files_status
  ON property_plan_files (status);

CREATE TABLE IF NOT EXISTS property_plan_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  plan_file_id UUID NOT NULL REFERENCES property_plan_files(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  image_storage_path TEXT,
  thumbnail_storage_path TEXT,
  width INTEGER,
  height INTEGER,
  processing_status plan_page_processing_status NOT NULL DEFAULT 'queued',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT property_plan_pages_unique_page UNIQUE (plan_file_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_property_plan_pages_file
  ON property_plan_pages (plan_file_id, page_number);

CREATE TABLE IF NOT EXISTS plan_extraction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  plan_file_id UUID NOT NULL REFERENCES property_plan_files(id) ON DELETE CASCADE,
  model_name TEXT,
  run_type TEXT NOT NULL DEFAULT 'initial',
  status plan_run_status NOT NULL DEFAULT 'queued',
  raw_output JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalised_output JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_plan_extraction_runs_file
  ON plan_extraction_runs (plan_file_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_extraction_runs_status
  ON plan_extraction_runs (status);

-- ============================================================================
-- 3) Extracted entities (reviewable suggestions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS extracted_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  extraction_run_id UUID NOT NULL REFERENCES plan_extraction_runs(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  source_page_id UUID REFERENCES property_plan_pages(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  space_type TEXT,
  confidence NUMERIC NOT NULL DEFAULT 0,
  raw_reference JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_accepted BOOLEAN NOT NULL DEFAULT TRUE,
  edited_name TEXT,
  edited_space_type TEXT,
  imported_space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extracted_spaces_run
  ON extracted_spaces (extraction_run_id);

CREATE TABLE IF NOT EXISTS extracted_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  extraction_run_id UUID NOT NULL REFERENCES plan_extraction_runs(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  source_page_id UUID REFERENCES property_plan_pages(id) ON DELETE SET NULL,
  asset_type TEXT,
  name TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0,
  raw_reference JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_accepted BOOLEAN NOT NULL DEFAULT TRUE,
  edited_name TEXT,
  edited_asset_type TEXT,
  imported_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extracted_assets_run
  ON extracted_assets (extraction_run_id);

CREATE TABLE IF NOT EXISTS extracted_compliance_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  extraction_run_id UUID NOT NULL REFERENCES plan_extraction_runs(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  source_page_id UUID REFERENCES property_plan_pages(id) ON DELETE SET NULL,
  element_type TEXT,
  name TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0,
  raw_reference JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_accepted BOOLEAN NOT NULL DEFAULT TRUE,
  edited_name TEXT,
  edited_element_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extracted_compliance_run
  ON extracted_compliance_elements (extraction_run_id);

CREATE TABLE IF NOT EXISTS extracted_task_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  extraction_run_id UUID NOT NULL REFERENCES plan_extraction_runs(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  source_page_id UUID REFERENCES property_plan_pages(id) ON DELETE SET NULL,
  suggestion_type TEXT,
  title TEXT NOT NULL,
  rationale TEXT,
  confidence NUMERIC NOT NULL DEFAULT 0,
  is_accepted BOOLEAN NOT NULL DEFAULT TRUE,
  imported_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extracted_tasks_run
  ON extracted_task_suggestions (extraction_run_id);

-- ============================================================================
-- 4) RLS
-- ============================================================================
ALTER TABLE property_plan_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_plan_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_extraction_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_compliance_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_task_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "property_plan_files_select" ON property_plan_files;
DROP POLICY IF EXISTS "property_plan_files_insert" ON property_plan_files;
DROP POLICY IF EXISTS "property_plan_files_update" ON property_plan_files;
CREATE POLICY "property_plan_files_select" ON property_plan_files FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "property_plan_files_insert" ON property_plan_files FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "property_plan_files_update" ON property_plan_files FOR UPDATE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "property_plan_pages_select" ON property_plan_pages;
DROP POLICY IF EXISTS "property_plan_pages_insert" ON property_plan_pages;
DROP POLICY IF EXISTS "property_plan_pages_update" ON property_plan_pages;
CREATE POLICY "property_plan_pages_select" ON property_plan_pages FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "property_plan_pages_insert" ON property_plan_pages FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "property_plan_pages_update" ON property_plan_pages FOR UPDATE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "plan_extraction_runs_select" ON plan_extraction_runs;
DROP POLICY IF EXISTS "plan_extraction_runs_insert" ON plan_extraction_runs;
DROP POLICY IF EXISTS "plan_extraction_runs_update" ON plan_extraction_runs;
CREATE POLICY "plan_extraction_runs_select" ON plan_extraction_runs FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "plan_extraction_runs_insert" ON plan_extraction_runs FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "plan_extraction_runs_update" ON plan_extraction_runs FOR UPDATE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "extracted_spaces_select" ON extracted_spaces;
DROP POLICY IF EXISTS "extracted_spaces_insert" ON extracted_spaces;
DROP POLICY IF EXISTS "extracted_spaces_update" ON extracted_spaces;
CREATE POLICY "extracted_spaces_select" ON extracted_spaces FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "extracted_spaces_insert" ON extracted_spaces FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "extracted_spaces_update" ON extracted_spaces FOR UPDATE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "extracted_assets_select" ON extracted_assets;
DROP POLICY IF EXISTS "extracted_assets_insert" ON extracted_assets;
DROP POLICY IF EXISTS "extracted_assets_update" ON extracted_assets;
CREATE POLICY "extracted_assets_select" ON extracted_assets FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "extracted_assets_insert" ON extracted_assets FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "extracted_assets_update" ON extracted_assets FOR UPDATE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "extracted_compliance_select" ON extracted_compliance_elements;
DROP POLICY IF EXISTS "extracted_compliance_insert" ON extracted_compliance_elements;
DROP POLICY IF EXISTS "extracted_compliance_update" ON extracted_compliance_elements;
CREATE POLICY "extracted_compliance_select" ON extracted_compliance_elements FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "extracted_compliance_insert" ON extracted_compliance_elements FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "extracted_compliance_update" ON extracted_compliance_elements FOR UPDATE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "extracted_tasks_select" ON extracted_task_suggestions;
DROP POLICY IF EXISTS "extracted_tasks_insert" ON extracted_task_suggestions;
DROP POLICY IF EXISTS "extracted_tasks_update" ON extracted_task_suggestions;
CREATE POLICY "extracted_tasks_select" ON extracted_task_suggestions FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "extracted_tasks_insert" ON extracted_task_suggestions FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "extracted_tasks_update" ON extracted_task_suggestions FOR UPDATE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

-- ============================================================================
-- 5) Storage buckets + policies (assumes check_user_org_membership exists)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-plans', 'property-plans', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('property-plan-pages', 'property-plan-pages', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload property plan files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read property plan files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete property plan files" ON storage.objects;
CREATE POLICY "Users can upload property plan files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'property-plans'
  AND split_part(name, '/', 1) = 'orgs'
  AND split_part(name, '/', 2) ~* '^[0-9a-f-]{36}$'
  AND check_user_org_membership(split_part(name, '/', 2)::uuid) = TRUE
);
CREATE POLICY "Users can read property plan files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'property-plans'
  AND split_part(name, '/', 1) = 'orgs'
  AND split_part(name, '/', 2) ~* '^[0-9a-f-]{36}$'
  AND check_user_org_membership(split_part(name, '/', 2)::uuid) = TRUE
);
CREATE POLICY "Users can delete property plan files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'property-plans'
  AND split_part(name, '/', 1) = 'orgs'
  AND split_part(name, '/', 2) ~* '^[0-9a-f-]{36}$'
  AND check_user_org_membership(split_part(name, '/', 2)::uuid) = TRUE
);

DROP POLICY IF EXISTS "Users can upload property plan pages" ON storage.objects;
DROP POLICY IF EXISTS "Users can read property plan pages" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete property plan pages" ON storage.objects;
CREATE POLICY "Users can upload property plan pages"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'property-plan-pages'
  AND split_part(name, '/', 1) = 'orgs'
  AND split_part(name, '/', 2) ~* '^[0-9a-f-]{36}$'
  AND check_user_org_membership(split_part(name, '/', 2)::uuid) = TRUE
);
CREATE POLICY "Users can read property plan pages"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'property-plan-pages'
  AND split_part(name, '/', 1) = 'orgs'
  AND split_part(name, '/', 2) ~* '^[0-9a-f-]{36}$'
  AND check_user_org_membership(split_part(name, '/', 2)::uuid) = TRUE
);
CREATE POLICY "Users can delete property plan pages"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'property-plan-pages'
  AND split_part(name, '/', 1) = 'orgs'
  AND split_part(name, '/', 2) ~* '^[0-9a-f-]{36}$'
  AND check_user_org_membership(split_part(name, '/', 2)::uuid) = TRUE
);

-- ============================================================================
-- 6) Utility trigger for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION set_row_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_property_plan_files_updated_at ON property_plan_files;
CREATE TRIGGER trg_property_plan_files_updated_at
BEFORE UPDATE ON property_plan_files
FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS trg_property_plan_pages_updated_at ON property_plan_pages;
CREATE TRIGGER trg_property_plan_pages_updated_at
BEFORE UPDATE ON property_plan_pages
FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS trg_extracted_spaces_updated_at ON extracted_spaces;
CREATE TRIGGER trg_extracted_spaces_updated_at
BEFORE UPDATE ON extracted_spaces
FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS trg_extracted_assets_updated_at ON extracted_assets;
CREATE TRIGGER trg_extracted_assets_updated_at
BEFORE UPDATE ON extracted_assets
FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS trg_extracted_compliance_updated_at ON extracted_compliance_elements;
CREATE TRIGGER trg_extracted_compliance_updated_at
BEFORE UPDATE ON extracted_compliance_elements
FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS trg_extracted_tasks_updated_at ON extracted_task_suggestions;
CREATE TRIGGER trg_extracted_tasks_updated_at
BEFORE UPDATE ON extracted_task_suggestions
FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- ============================================================================
-- 7) Import RPC: accepted extracted records -> core entities
-- ============================================================================
CREATE OR REPLACE FUNCTION import_plan_extraction_run(
  p_extraction_run_id UUID
)
RETURNS TABLE(
  created_spaces INTEGER,
  created_assets INTEGER,
  created_tasks INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run RECORD;
  v_created_spaces INTEGER := 0;
  v_created_assets INTEGER := 0;
  v_created_tasks INTEGER := 0;
  v_space_id UUID;
  v_asset_id UUID;
  v_task_id UUID;
  rec RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_run
  FROM plan_extraction_runs r
  WHERE r.id = p_extraction_run_id
    AND r.org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Extraction run not found or no access';
  END IF;

  FOR rec IN
    SELECT *
    FROM extracted_spaces s
    WHERE s.extraction_run_id = p_extraction_run_id
      AND s.org_id = v_run.org_id
      AND s.is_accepted = TRUE
      AND s.imported_space_id IS NULL
  LOOP
    INSERT INTO spaces (org_id, property_id, name)
    VALUES (
      rec.org_id,
      rec.property_id,
      COALESCE(NULLIF(rec.edited_name, ''), rec.name)
    )
    RETURNING id INTO v_space_id;

    UPDATE extracted_spaces
    SET imported_space_id = v_space_id
    WHERE id = rec.id;

    v_created_spaces := v_created_spaces + 1;
  END LOOP;

  FOR rec IN
    SELECT *
    FROM extracted_assets a
    WHERE a.extraction_run_id = p_extraction_run_id
      AND a.org_id = v_run.org_id
      AND a.is_accepted = TRUE
      AND a.imported_asset_id IS NULL
  LOOP
    INSERT INTO assets (
      org_id,
      property_id,
      name,
      asset_type,
      status,
      condition_score
    )
    VALUES (
      rec.org_id,
      rec.property_id,
      COALESCE(NULLIF(rec.edited_name, ''), rec.name),
      COALESCE(NULLIF(rec.edited_asset_type, ''), rec.asset_type),
      'active',
      100
    )
    RETURNING id INTO v_asset_id;

    UPDATE extracted_assets
    SET imported_asset_id = v_asset_id
    WHERE id = rec.id;

    v_created_assets := v_created_assets + 1;
  END LOOP;

  FOR rec IN
    SELECT *
    FROM extracted_task_suggestions t
    WHERE t.extraction_run_id = p_extraction_run_id
      AND t.org_id = v_run.org_id
      AND t.is_accepted = TRUE
      AND t.imported_task_id IS NULL
  LOOP
    INSERT INTO tasks (
      org_id,
      property_id,
      title,
      description,
      priority,
      status
    )
    VALUES (
      rec.org_id,
      rec.property_id,
      rec.title,
      COALESCE(rec.rationale, 'Imported from building plan extraction'),
      'medium',
      'open'
    )
    RETURNING id INTO v_task_id;

    UPDATE extracted_task_suggestions
    SET imported_task_id = v_task_id
    WHERE id = rec.id;

    v_created_tasks := v_created_tasks + 1;
  END LOOP;

  UPDATE property_plan_files
  SET status = 'imported'
  WHERE id = v_run.plan_file_id;

  UPDATE plan_extraction_runs
  SET status = 'completed'
  WHERE id = p_extraction_run_id;

  RETURN QUERY SELECT v_created_spaces, v_created_assets, v_created_tasks;
END;
$$;

REVOKE ALL ON FUNCTION import_plan_extraction_run(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION import_plan_extraction_run(UUID) TO authenticated;

-- ============================================================================
-- 8) Optional dev fixture helper
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_property_plan_fixture(
  p_property_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_file_id UUID;
  v_run_id UUID;
  v_page_id UUID;
BEGIN
  SELECT p.org_id INTO v_org_id
  FROM properties p
  WHERE p.id = p_property_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  INSERT INTO property_plan_files (
    org_id, property_id, file_name, mime_type, storage_path, status, page_count
  )
  VALUES (
    v_org_id, p_property_id, 'sample-plan-ground-floor.pdf', 'application/pdf',
    format('orgs/%s/properties/%s/plans/sample-plan-ground-floor.pdf', v_org_id::text, p_property_id::text),
    'ready_for_review',
    1
  )
  RETURNING id INTO v_file_id;

  INSERT INTO property_plan_pages (
    org_id, plan_file_id, page_number, processing_status
  )
  VALUES (
    v_org_id, v_file_id, 1, 'extracted'
  )
  RETURNING id INTO v_page_id;

  INSERT INTO plan_extraction_runs (
    org_id, property_id, plan_file_id, model_name, run_type, status, raw_output, normalised_output
  )
  VALUES (
    v_org_id,
    p_property_id,
    v_file_id,
    'fixture-v1',
    'fixture',
    'completed',
    '{"note":"fixture"}'::jsonb,
    '{"note":"fixture"}'::jsonb
  )
  RETURNING id INTO v_run_id;

  INSERT INTO extracted_spaces (
    org_id, extraction_run_id, property_id, source_page_id, name, space_type, confidence
  ) VALUES
    (v_org_id, v_run_id, p_property_id, v_page_id, 'Main Stair', 'stairwell', 0.92),
    (v_org_id, v_run_id, p_property_id, v_page_id, 'Electrical Room', 'electrical_room', 0.88),
    (v_org_id, v_run_id, p_property_id, v_page_id, 'Boiler Room', 'plant_room', 0.87);

  INSERT INTO extracted_assets (
    org_id, extraction_run_id, property_id, source_page_id, name, asset_type, confidence
  ) VALUES
    (v_org_id, v_run_id, p_property_id, v_page_id, 'Main Electrical Panel', 'electrical_panel', 0.83),
    (v_org_id, v_run_id, p_property_id, v_page_id, 'Boiler Unit', 'boiler', 0.81);

  INSERT INTO extracted_compliance_elements (
    org_id, extraction_run_id, property_id, source_page_id, name, element_type, confidence
  ) VALUES
    (v_org_id, v_run_id, p_property_id, v_page_id, 'Fire Exit', 'exit', 0.9),
    (v_org_id, v_run_id, p_property_id, v_page_id, 'Emergency Signage', 'emergency_signage', 0.77);

  INSERT INTO extracted_task_suggestions (
    org_id, extraction_run_id, property_id, source_page_id, suggestion_type, title, rationale, confidence
  ) VALUES
    (v_org_id, v_run_id, p_property_id, v_page_id, 'fire_safety', 'Schedule fire safety inspection', 'Detected fire exit and safety elements.', 0.84),
    (v_org_id, v_run_id, p_property_id, v_page_id, 'electrical', 'Schedule electrical inspection', 'Detected electrical room and panel.', 0.82);

  RETURN v_run_id;
END;
$$;

REVOKE ALL ON FUNCTION seed_property_plan_fixture(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION seed_property_plan_fixture(UUID) TO authenticated;
