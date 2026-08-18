-- ============================================================================
-- Asset Database V1 — Structured, Scalable, Compliance-Ready
-- ============================================================================
-- Refactors the assets table, adds task_assets junction, inspection history,
-- and file reference tables. Adds missing RLS policies and indexes.
--
-- Reversible: Each section is guarded with IF NOT EXISTS / IF EXISTS checks.
-- ============================================================================


-- ============================================================================
-- 1. REFACTOR assets TABLE
-- ============================================================================

-- 1a. Backfill name for any remaining NULLs (previous migration added column as nullable)
UPDATE assets SET name = serial WHERE name IS NULL AND serial IS NOT NULL;
UPDATE assets SET name = 'Unnamed Asset' WHERE name IS NULL;

-- 1b. Make name NOT NULL
ALTER TABLE assets ALTER COLUMN name SET NOT NULL;

-- 1c. Rename serial → serial_number (spec-aligned naming)
ALTER TABLE assets RENAME COLUMN serial TO serial_number;

-- 1d. Add new columns
ALTER TABLE assets ADD COLUMN IF NOT EXISTS parent_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_type   TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS category     TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS model        TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS install_date DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS warranty_expiry DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS compliance_required BOOLEAN DEFAULT false;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS compliance_type TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'active';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS notes        TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS metadata     JSONB DEFAULT '{}';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS created_by   UUID REFERENCES auth.users(id);

-- 1e. CHECK constraint on condition_score (0–100)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'assets_condition_score_range'
  ) THEN
    ALTER TABLE assets ADD CONSTRAINT assets_condition_score_range
      CHECK (condition_score BETWEEN 0 AND 100);
  END IF;
END $$;


-- ============================================================================
-- 2. task_assets JUNCTION TABLE (many-to-many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_assets (
  task_id    UUID NOT NULL REFERENCES tasks(id)  ON DELETE CASCADE,
  asset_id   UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (task_id, asset_id)
);

ALTER TABLE task_assets ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 3. asset_inspections TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_inspections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,
  inspection_date TIMESTAMPTZ DEFAULT now(),
  condition_score INTEGER,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT asset_inspections_condition_range
    CHECK (condition_score BETWEEN 0 AND 100)
);

ALTER TABLE asset_inspections ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 4. asset_files TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,
  file_type   TEXT,  -- manual | certificate | photo | invoice
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE asset_files ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 5. INDEXES
-- ============================================================================

-- assets
CREATE INDEX IF NOT EXISTS idx_assets_org      ON assets(org_id);
CREATE INDEX IF NOT EXISTS idx_assets_property  ON assets(property_id);
CREATE INDEX IF NOT EXISTS idx_assets_space     ON assets(space_id);
CREATE INDEX IF NOT EXISTS idx_assets_status    ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_parent    ON assets(parent_asset_id) WHERE parent_asset_id IS NOT NULL;

-- task_assets
CREATE INDEX IF NOT EXISTS idx_task_assets_task  ON task_assets(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assets_asset ON task_assets(asset_id);

-- asset_inspections
CREATE INDEX IF NOT EXISTS idx_asset_inspections_asset ON asset_inspections(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_inspections_date  ON asset_inspections(inspection_date);

-- asset_files
CREATE INDEX IF NOT EXISTS idx_asset_files_asset ON asset_files(asset_id);


-- ============================================================================
-- 6. updated_at TRIGGER for assets
-- ============================================================================

CREATE OR REPLACE FUNCTION update_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assets_updated_at ON assets;
CREATE TRIGGER assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW
  EXECUTE FUNCTION update_assets_updated_at();


-- ============================================================================
-- 7. RLS POLICIES
-- ============================================================================

-- 7a. assets — UPDATE policy (was missing)
DROP POLICY IF EXISTS "assets_update" ON assets;
CREATE POLICY "assets_update" ON assets
  FOR UPDATE
  USING (
    org_id = current_org_id()
    AND check_user_org_membership(org_id) = TRUE
  )
  WITH CHECK (
    org_id = current_org_id()
    AND check_user_org_membership(org_id) = TRUE
  );

-- 7b. assets — DELETE policy (was missing)
DROP POLICY IF EXISTS "assets_delete" ON assets;
CREATE POLICY "assets_delete" ON assets
  FOR DELETE
  USING (
    org_id = current_org_id()
    AND check_user_org_membership(org_id) = TRUE
  );

-- 7c. task_assets — follows task_spaces pattern (join through tasks)
DROP POLICY IF EXISTS "task_assets_select" ON task_assets;
CREATE POLICY "task_assets_select" ON task_assets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM tasks
      JOIN organisation_members ON organisation_members.org_id = tasks.org_id
      WHERE tasks.id = task_assets.task_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "task_assets_insert" ON task_assets;
CREATE POLICY "task_assets_insert" ON task_assets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tasks
      JOIN organisation_members ON organisation_members.org_id = tasks.org_id
      WHERE tasks.id = task_assets.task_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "task_assets_delete" ON task_assets;
CREATE POLICY "task_assets_delete" ON task_assets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM tasks
      JOIN organisation_members ON organisation_members.org_id = tasks.org_id
      WHERE tasks.id = task_assets.task_id
        AND organisation_members.user_id = auth.uid()
    )
  );

-- 7d. asset_inspections — join through assets
DROP POLICY IF EXISTS "asset_inspections_select" ON asset_inspections;
CREATE POLICY "asset_inspections_select" ON asset_inspections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_inspections.asset_id
        AND a.org_id = current_org_id()
    )
  );

DROP POLICY IF EXISTS "asset_inspections_insert" ON asset_inspections;
CREATE POLICY "asset_inspections_insert" ON asset_inspections
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_inspections.asset_id
        AND check_user_org_membership(a.org_id) = TRUE
    )
  );

DROP POLICY IF EXISTS "asset_inspections_delete" ON asset_inspections;
CREATE POLICY "asset_inspections_delete" ON asset_inspections
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_inspections.asset_id
        AND a.org_id = current_org_id()
    )
  );

-- 7e. asset_files — join through assets
DROP POLICY IF EXISTS "asset_files_select" ON asset_files;
CREATE POLICY "asset_files_select" ON asset_files
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_files.asset_id
        AND a.org_id = current_org_id()
    )
  );

DROP POLICY IF EXISTS "asset_files_insert" ON asset_files;
CREATE POLICY "asset_files_insert" ON asset_files
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_files.asset_id
        AND check_user_org_membership(a.org_id) = TRUE
    )
  );

DROP POLICY IF EXISTS "asset_files_delete" ON asset_files;
CREATE POLICY "asset_files_delete" ON asset_files
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_files.asset_id
        AND a.org_id = current_org_id()
    )
  );


-- ============================================================================
-- 8. RECREATE assets_view (includes new columns, renamed serial_number)
-- ============================================================================

-- Must DROP first because CREATE OR REPLACE cannot change column names/order
DROP VIEW IF EXISTS assets_view;

CREATE VIEW assets_view
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.org_id,
  a.property_id,
  a.space_id,
  a.parent_asset_id,
  a.name,
  a.asset_type,
  a.category,
  a.serial_number,
  a.manufacturer,
  a.model,
  a.install_date,
  a.warranty_expiry,
  a.compliance_required,
  a.compliance_type,
  a.condition_score,
  a.status,
  a.notes,
  a.metadata,
  a.created_by,
  a.created_at,
  a.updated_at,
  -- Joined data
  p.nickname  AS property_name,
  p.address   AS property_address,
  s.name      AS space_name,
  -- Aggregated counts
  COALESCE(COUNT(DISTINCT ta.task_id) FILTER (
    WHERE t.status IN ('open', 'in_progress')
  ), 0)::integer AS open_tasks_count
FROM assets a
LEFT JOIN properties p  ON p.id = a.property_id AND p.org_id = a.org_id
LEFT JOIN spaces s      ON s.id = a.space_id    AND s.org_id = a.org_id
LEFT JOIN task_assets ta ON ta.asset_id = a.id
LEFT JOIN tasks t       ON t.id = ta.task_id    AND t.org_id = a.org_id
GROUP BY
  a.id, a.org_id, a.property_id, a.space_id, a.parent_asset_id,
  a.name, a.asset_type, a.category, a.serial_number,
  a.manufacturer, a.model, a.install_date, a.warranty_expiry,
  a.compliance_required, a.compliance_type,
  a.condition_score, a.status, a.notes, a.metadata,
  a.created_by, a.created_at, a.updated_at,
  p.nickname, p.address, s.name;


-- ============================================================================
-- 9. COMMENTS
-- ============================================================================

COMMENT ON TABLE  task_assets        IS 'Many-to-many: tasks ↔ assets. A task can reference multiple assets.';
COMMENT ON TABLE  asset_inspections  IS 'Inspection history per asset. Enables condition trending and compliance proof.';
COMMENT ON TABLE  asset_files        IS 'File references for assets (manuals, certificates, photos). Storage is external.';
COMMENT ON COLUMN assets.status      IS 'Lifecycle: active | inactive | retired';
COMMENT ON COLUMN assets.compliance_required IS 'True if this asset requires periodic compliance checks';
COMMENT ON COLUMN assets.parent_asset_id    IS 'Optional hierarchy: a radiator belongs to a boiler system';
