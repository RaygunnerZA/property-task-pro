-- Onboarding demo content: runs after seed_property_defaults when a property is created.
-- Idempotent per property (sentinel task title). Tags rows with [onboarding_demo] in text fields.
-- Placeholder images live under /public/onboarding/*.svg (served as static URLs).

CREATE OR REPLACE FUNCTION seed_onboarding_demo_for_property(p_property_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_kitchen_id UUID;
  v_task_tour UUID;
  v_task_try UUID;
  v_task_invite UUID;
  v_task_issue UUID;
  v_rule_id UUID;
  v_doc_gas UUID;
  v_doc_eicr UUID;
  v_doc_fra UUID;
  v_milestones JSONB;
BEGIN
  SET LOCAL row_security = off;

  SELECT org_id INTO v_org_id FROM properties WHERE id = p_property_id;
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM tasks
    WHERE property_id = p_property_id
      AND title = 'Take a quick tour of your workspace'
  ) THEN
    RETURN;
  END IF;

  BEGIN
  UPDATE properties
  SET thumbnail_url = '/onboarding/placeholder-property-hero.svg'
  WHERE id = p_property_id
    AND (thumbnail_url IS NULL OR btrim(thumbnail_url) = '');

  SELECT id INTO v_kitchen_id
  FROM spaces
  WHERE property_id = p_property_id AND lower(name) = 'kitchen'
  LIMIT 1;

  v_milestones := jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'dateTime', to_char((now() + interval '14 days') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'label', 'Sample check-in'
    )
  );

  INSERT INTO tasks (
    org_id, property_id, title, description, status, priority, due_date, icon_name, milestones
  ) VALUES (
    v_org_id,
    p_property_id,
    'Take a quick tour of your workspace',
    'You''re seeing sample tasks, compliance items, and assets so nothing feels empty on day one. Delete or edit anything - this is your space. [onboarding_demo]',
    'open',
    'normal',
    NULL,
    'sparkles',
    v_milestones
  )
  RETURNING id INTO v_task_tour;

  INSERT INTO tasks (
    org_id, property_id, title, description, status, priority, due_date, icon_name, milestones
  ) VALUES (
    v_org_id,
    p_property_id,
    'Mark your first task complete',
    'Try completing this one to see how progress and your calendar update. Small wins build momentum. [onboarding_demo]',
    'open',
    'low',
    NULL,
    'check-circle',
    '[]'::jsonb
  )
  RETURNING id INTO v_task_try;

  INSERT INTO tasks (
    org_id, property_id, title, description, status, priority, due_date, icon_name, milestones
  ) VALUES (
    v_org_id,
    p_property_id,
    'Invite a teammate when you''re ready',
    'Great work happens together. When you want help on site, invite someone from Settings > Team. [onboarding_demo]',
    'open',
    'normal',
    NULL,
    'users',
    '[]'::jsonb
  )
  RETURNING id INTO v_task_invite;

  INSERT INTO tasks (
    org_id, property_id, title, description, status, priority, due_date, icon_name, milestones
  ) VALUES (
    v_org_id,
    p_property_id,
    'Report a real issue on site',
    'Use Report issue to capture photos, priority, and location - your team stays aligned. [onboarding_demo]',
    'in_progress',
    'high',
    now() + interval '7 days',
    'camera',
    '[]'::jsonb
  )
  RETURNING id INTO v_task_issue;

  IF v_kitchen_id IS NOT NULL THEN
    INSERT INTO task_spaces (task_id, space_id) VALUES
      (v_task_tour, v_kitchen_id),
      (v_task_issue, v_kitchen_id)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO assets (
    org_id, property_id, space_id, name, asset_type, icon_name, condition_score, status, notes, metadata
  ) VALUES
    (
      v_org_id,
      p_property_id,
      v_kitchen_id,
      'Sample: boiler unit',
      'HVAC',
      'flame',
      88,
      'active',
      'Example asset - swap for your plant register. Photo hint: /onboarding/placeholder-asset-photo.svg [onboarding_demo]',
      '{"onboarding_demo": true, "placeholder_image_hint": "/onboarding/placeholder-asset-photo.svg"}'::jsonb
    ),
    (
      v_org_id,
      p_property_id,
      v_kitchen_id,
      'Sample: electrical consumer unit',
      'Electrical',
      'zap',
      72,
      'active',
      'Shows how condition and type appear in lists. [onboarding_demo]',
      '{"onboarding_demo": true}'::jsonb
    ),
    (
      v_org_id,
      p_property_id,
      v_kitchen_id,
      'Sample: fire extinguisher',
      'Safety',
      'shield',
      95,
      'active',
      'Link compliance renewals to assets when you go live. [onboarding_demo]',
      '{"onboarding_demo": true}'::jsonb
    );

  INSERT INTO compliance_rules (
    org_id, property_id, name, description, frequency, scope_type, notify_days_before, next_due_date, auto_create
  ) VALUES (
    v_org_id,
    p_property_id,
    'Annual fire safety review (sample)',
    'Example renewal cycle — replace with your building''s real programme. [onboarding_demo]',
    'annual',
    'property',
    30,
    (CURRENT_DATE + interval '90 days')::date,
    false
  )
  RETURNING id INTO v_rule_id;

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name, rule_id
  ) VALUES (
    v_org_id,
    p_property_id,
    'Gas Safety Certificate (sample)',
    'Gas Safety Certificate',
    'valid',
    '/onboarding/placeholder-compliance-doc.svg',
    (CURRENT_DATE + interval '200 days')::date,
    (CURRENT_DATE + interval '200 days')::date,
    'annual',
    'Sample valid record with placeholder certificate preview. [onboarding_demo]',
    'shield-check',
    NULL
  )
  RETURNING id INTO v_doc_gas;

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name, rule_id
  ) VALUES (
    v_org_id,
    p_property_id,
    'EICR (sample - due soon)',
    'EICR',
    'due_soon',
    '/onboarding/placeholder-compliance-doc.svg',
    (CURRENT_DATE + interval '18 days')::date,
    (CURRENT_DATE + interval '18 days')::date,
    '5-year',
    'Shows the "renewal coming up" state. [onboarding_demo]',
    'clipboard-list',
    v_rule_id
  )
  RETURNING id INTO v_doc_eicr;

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name, rule_id
  ) VALUES (
    v_org_id,
    p_property_id,
    'Fire Risk Assessment (sample - add file)',
    'Fire Risk Assessment',
    'missing',
    NULL,
    NULL,
    NULL,
    'annual',
    'No file yet - upload your PDF when you have it. [onboarding_demo]',
    'help-circle',
    NULL
  )
  RETURNING id INTO v_doc_fra;

  INSERT INTO compliance_recommendations (
    org_id, compliance_document_id, property_id, risk_level, recommended_action, status, hazards
  ) VALUES (
    v_org_id,
    v_doc_eicr,
    p_property_id,
    'medium',
    'Sample insight: EICR renewals often slip during busy periods - set a reminder 60 days before expiry. Real AI suggestions will appear once you upload documents. [onboarding_demo]',
    'pending',
    ARRAY['electrical']::text[]
  )
  ON CONFLICT (compliance_document_id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM checklist_templates
    WHERE org_id = v_org_id AND name = 'Sample: new tenant handover'
  ) THEN
    INSERT INTO checklist_templates (org_id, name, category, items)
    VALUES (
      v_org_id,
      'Sample: new tenant handover',
      'operations',
      $ct$[
        {"id":"a1111111-1111-4111-8111-111111111111","title":"Meter readings recorded","is_yes_no":true,"requires_signature":false},
        {"id":"b2222222-2222-4222-8222-222222222222","title":"Smoke alarms tested in each room","is_yes_no":true,"requires_signature":false},
        {"id":"c3333333-3333-4333-8333-333333333333","title":"Keys and access fobs handed over","is_yes_no":false,"requires_signature":true}
      ]$ct$::jsonb
    );
  END IF;

  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'seed_onboarding_demo_for_property failed for %: %', p_property_id, SQLERRM;
  END;
END;
$$;

COMMENT ON FUNCTION seed_onboarding_demo_for_property(UUID) IS
  'Inserts SaaS-style sample tasks, assets, compliance docs, one rule, one AI-style recommendation, and a checklist template. Idempotent per property.';

GRANT EXECUTE ON FUNCTION seed_onboarding_demo_for_property(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION seed_onboarding_demo_for_property(UUID) TO service_role;

CREATE OR REPLACE FUNCTION trigger_seed_property_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM seed_property_defaults(NEW.id, NEW.org_id);
  PERFORM seed_onboarding_demo_for_property(NEW.id);
  RETURN NEW;
END;
$$;
