-- Repair: property compliance schedule layer for remotes where compliance_rules
-- holds legal-extraction obligations (obligation_text, source_id, …).
-- Schedule definitions use compliance_schedule_rules + compliance_occurrences.

-- ============================================================================
-- 1. compliance_schedule_rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_schedule_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  property_id       uuid REFERENCES properties(id) ON DELETE CASCADE,
  name              text,
  description       text,
  frequency         text,
  scope_type        text NOT NULL DEFAULT 'property',
  scope_asset_type  text,
  scope_ids         jsonb,
  auto_create       boolean NOT NULL DEFAULT false,
  template_config   jsonb,
  notify_days_before integer NOT NULL DEFAULT 30,
  is_archived       boolean NOT NULL DEFAULT false,
  last_completed_at timestamptz,
  next_due_date     date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS compliance_schedule_rules_property_id_idx
  ON compliance_schedule_rules (property_id)
  WHERE is_archived = false;

ALTER TABLE compliance_schedule_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compliance_schedule_rules_org_access" ON compliance_schedule_rules;
CREATE POLICY "compliance_schedule_rules_org_access" ON compliance_schedule_rules
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON compliance_schedule_rules TO authenticated;

-- Optional backlink from compliance_documents → schedule rule
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'compliance_documents'
      AND column_name = 'rule_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'compliance_documents_schedule_rule_id_fkey'
      AND table_name = 'compliance_documents'
  ) THEN
    ALTER TABLE compliance_documents
      ADD CONSTRAINT compliance_documents_schedule_rule_id_fkey
      FOREIGN KEY (rule_id) REFERENCES compliance_schedule_rules(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN others THEN
    NULL;
END $$;

-- ============================================================================
-- 2. compliance_occurrences
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_occurrences (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  rule_id      uuid NOT NULL REFERENCES compliance_schedule_rules(id) ON DELETE CASCADE,
  asset_id     uuid,
  due_date     date NOT NULL,
  completed_at timestamptz,
  task_id      uuid REFERENCES tasks(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'complete', 'missed')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'assets'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'compliance_occurrences_asset_id_fkey'
      AND table_name = 'compliance_occurrences'
  ) THEN
    ALTER TABLE compliance_occurrences
      ADD CONSTRAINT compliance_occurrences_asset_id_fkey
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS compliance_occurrences_rule_status_due_idx
  ON compliance_occurrences (rule_id, status, due_date);

CREATE INDEX IF NOT EXISTS compliance_occurrences_org_status_idx
  ON compliance_occurrences (org_id, status, due_date);

ALTER TABLE compliance_occurrences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compliance_occurrences_org_access" ON compliance_occurrences;
CREATE POLICY "compliance_occurrences_org_access" ON compliance_occurrences
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON compliance_occurrences TO authenticated;

-- ============================================================================
-- 3. compliance_schedule_view (schema-safe document leg)
-- ============================================================================
DO $$
DECLARE
  v_has_last_completed boolean;
  v_last_completed_expr text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'compliance_documents'
      AND column_name = 'last_completed_date'
  ) INTO v_has_last_completed;

  IF v_has_last_completed THEN
    v_last_completed_expr := 'cd.last_completed_date::text';
  ELSE
    v_last_completed_expr := 'NULL::text';
  END IF;

  EXECUTE format(
    $sql$
    CREATE OR REPLACE VIEW compliance_schedule_view
    WITH (security_invoker = true)
    AS
      SELECT
        co.id                                                     AS id,
        cr.org_id                                                 AS org_id,
        cr.property_id                                            AS property_id,
        cr.name                                                   AS title,
        cr.name                                                   AS certificate_name,
        cr.name                                                   AS document_type,
        co.due_date::text                                         AS next_due_date,
        NULL::text                                                AS expiry_date,
        co.completed_at::text                                     AS last_completed_date,
        cr.frequency                                              AS frequency,
        co.status                                                 AS status,
        CASE
          WHEN co.due_date < CURRENT_DATE      THEN 'expired'
          WHEN co.due_date < CURRENT_DATE + 30 THEN 'expiring'
          ELSE 'valid'
        END                                                       AS expiry_status,
        (co.due_date - CURRENT_DATE)                              AS days_until_expiry,
        co.task_id                                                AS task_id,
        cr.id                                                     AS rule_id,
        'rule'                                                    AS source_type,
        NULL::text                                                AS file_url
      FROM compliance_occurrences co
      JOIN compliance_schedule_rules cr ON cr.id = co.rule_id
      WHERE co.status = 'pending'
        AND cr.is_archived = false

      UNION ALL

      SELECT
        cd.id                                                     AS id,
        cd.org_id                                                 AS org_id,
        cd.property_id                                            AS property_id,
        cd.title                                                  AS title,
        cd.title                                                  AS certificate_name,
        cd.document_type                                          AS document_type,
        cd.next_due_date::text                                    AS next_due_date,
        cd.expiry_date::text                                      AS expiry_date,
        %s                                                        AS last_completed_date,
        cd.frequency                                              AS frequency,
        cd.status                                                 AS status,
        CASE
          WHEN cd.expiry_date IS NOT NULL
               AND cd.expiry_date::date < CURRENT_DATE      THEN 'expired'
          WHEN cd.expiry_date IS NOT NULL
               AND cd.expiry_date::date < CURRENT_DATE + 30 THEN 'expiring'
          ELSE 'valid'
        END                                                       AS expiry_status,
        CASE
          WHEN cd.expiry_date IS NOT NULL
            THEN (cd.expiry_date::date - CURRENT_DATE)
          ELSE NULL
        END                                                       AS days_until_expiry,
        NULL::uuid                                                AS task_id,
        cd.rule_id                                                AS rule_id,
        'document'                                                AS source_type,
        cd.file_url                                               AS file_url
      FROM compliance_documents cd
      WHERE cd.rule_id IS NULL
         OR (cd.file_url IS NOT NULL)
    $sql$,
    v_last_completed_expr
  );
END $$;

GRANT SELECT ON compliance_schedule_view TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
