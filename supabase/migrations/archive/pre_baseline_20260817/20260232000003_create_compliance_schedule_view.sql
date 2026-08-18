-- Sprint 4: compliance_schedule_view
-- Unifies rule-based occurrences and standalone compliance documents into a
-- single consistent shape. This view replaces direct queries against
-- compliance_view for the Schedule tab.
--
-- source_type = 'rule'     → from compliance_occurrences + compliance_rules
-- source_type = 'document' → from compliance_documents with no rule backing
--   (AI-extracted certs, manually uploaded docs)
--
-- Downstream: useComplianceQuery reads from this view in Sprint 4.

CREATE OR REPLACE VIEW compliance_schedule_view AS

  -- Rule-based occurrences (schedule-driven)
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
  JOIN compliance_rules cr ON cr.id = co.rule_id
  WHERE co.status = 'pending'
    AND cr.is_archived = false

  UNION ALL

  -- Standalone compliance documents (AI-extracted or uploaded; no rule backing)
  SELECT
    cd.id                                                     AS id,
    cd.org_id                                                 AS org_id,
    cd.property_id                                            AS property_id,
    cd.title                                                  AS title,
    cd.title                                                  AS certificate_name,
    cd.document_type                                          AS document_type,
    cd.next_due_date::text                                    AS next_due_date,
    cd.expiry_date::text                                      AS expiry_date,
    cd.last_completed_date::text                              AS last_completed_date,
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
     OR (cd.file_url IS NOT NULL);
