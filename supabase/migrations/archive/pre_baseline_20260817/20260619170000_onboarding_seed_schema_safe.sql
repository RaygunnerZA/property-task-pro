-- Skip checklist_templates when legacy schema (no items column)
CREATE OR REPLACE FUNCTION seed_onboarding_demo_for_property(p_property_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_anchor TIMESTAMPTZ := now();
  v_kitchen_id UUID;
  v_boiler_room_id UUID;
  v_plant_room_id UUID;
  v_archive_id UUID;
  v_first_aid_id UUID;
  v_electrical_id UUID;
  v_rule_id UUID;
  v_doc_fire_ext UUID;
  v_doc_gas UUID;
  v_attachment_id UUID;
  v_has_due_date boolean;
  v_has_due_at boolean;
  v_has_image_url boolean;
  v_has_notes boolean;
  v_task_id UUID;
BEGIN
  SET LOCAL row_security = off;

  SELECT org_id INTO v_org_id FROM properties WHERE id = p_property_id;
  IF v_org_id IS NULL THEN RETURN; END IF;

  PERFORM seed_property_defaults(p_property_id, v_org_id);

  IF EXISTS (
    SELECT 1 FROM tasks
    WHERE property_id = p_property_id
      AND title = 'Review Fire Extinguisher Certificate'
      AND description LIKE '%[onboarding_demo]%'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM tasks
    WHERE property_id = p_property_id AND title = 'Take a quick tour of your workspace'
  ) THEN
    PERFORM clear_onboarding_demo_for_property(p_property_id);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_date'
  ) INTO v_has_due_date;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_at'
  ) INTO v_has_due_at;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'image_url'
  ) INTO v_has_image_url;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'notes'
  ) INTO v_has_notes;

  BEGIN
  UPDATE properties
  SET thumbnail_url = '/spaces/mini-cards/lobby.png'
  WHERE id = p_property_id
    AND (thumbnail_url IS NULL OR btrim(thumbnail_url) = '' OR thumbnail_url LIKE '/onboarding/%');

  IF NOT EXISTS (SELECT 1 FROM spaces WHERE property_id = p_property_id AND lower(name) = 'kitchen') THEN
    INSERT INTO spaces (org_id, property_id, name) VALUES (v_org_id, p_property_id, 'Kitchen');
  END IF;

  SELECT id INTO v_kitchen_id FROM spaces WHERE property_id = p_property_id AND lower(name) = 'kitchen' LIMIT 1;

  INSERT INTO spaces (org_id, property_id, name)
  SELECT v_org_id, p_property_id, n FROM (VALUES
    ('Boiler Room'), ('Plant Room'), ('Archive Room'), ('First Aid Station'), ('Electrical Room')
  ) AS t(n)
  WHERE NOT EXISTS (
    SELECT 1 FROM spaces s WHERE s.property_id = p_property_id AND lower(s.name) = lower(t.n)
  );

  SELECT id INTO v_boiler_room_id FROM spaces WHERE property_id = p_property_id AND lower(name) = 'boiler room' LIMIT 1;
  SELECT id INTO v_plant_room_id FROM spaces WHERE property_id = p_property_id AND lower(name) = 'plant room' LIMIT 1;
  SELECT id INTO v_archive_id FROM spaces WHERE property_id = p_property_id AND lower(name) = 'archive room' LIMIT 1;
  SELECT id INTO v_first_aid_id FROM spaces WHERE property_id = p_property_id AND lower(name) = 'first aid station' LIMIT 1;
  SELECT id INTO v_electrical_id FROM spaces WHERE property_id = p_property_id AND lower(name) = 'electrical room' LIMIT 1;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name)
  VALUES (
    v_org_id, p_property_id,
    'Review Fire Extinguisher Certificate',
    'A certificate was uploaded but needs confirmation. Example — Filla tracks compliance from your documents. [onboarding_demo]',
    'waiting_external', 'urgent', 'shield-check'
  ) RETURNING id INTO v_task_id;
  IF v_has_due_at THEN UPDATE tasks SET due_at = v_anchor + interval '1 day' WHERE id = v_task_id;
  ELSIF v_has_due_date THEN UPDATE tasks SET due_date = v_anchor + interval '1 day' WHERE id = v_task_id;
  END IF;
  IF v_first_aid_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_spaces') THEN
    INSERT INTO task_spaces (task_id, space_id) VALUES (v_task_id, v_first_aid_id) ON CONFLICT DO NOTHING;
  END IF;
  IF v_has_image_url THEN UPDATE tasks SET image_url = '/spaces/mini-cards/first-aid.png' WHERE id = v_task_id; END IF;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name)
  VALUES (
    v_org_id, p_property_id, 'Boiler Service Due Soon',
    'Annual service due in 14 days. Example — Filla schedules maintenance from asset records. [onboarding_demo]',
    'open', 'high', 'flame'
  ) RETURNING id INTO v_task_id;
  IF v_has_due_at THEN UPDATE tasks SET due_at = v_anchor + interval '14 days' WHERE id = v_task_id;
  ELSIF v_has_due_date THEN UPDATE tasks SET due_date = v_anchor + interval '14 days' WHERE id = v_task_id;
  END IF;
  IF v_boiler_room_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_spaces') THEN
    INSERT INTO task_spaces (task_id, space_id) VALUES (v_task_id, v_boiler_room_id) ON CONFLICT DO NOTHING;
  END IF;
  IF v_has_image_url THEN UPDATE tasks SET image_url = '/spaces/mini-cards/boiler-room.png' WHERE id = v_task_id; END IF;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name)
  VALUES (
    v_org_id, p_property_id, 'Unknown Document Uploaded',
    'Filla could not identify a recently uploaded file. Example — review and categorise uploads. [onboarding_demo]',
    'waiting_external', 'medium', 'file-question'
  ) RETURNING id INTO v_task_id;
  IF v_has_due_at THEN UPDATE tasks SET due_at = v_anchor + interval '2 days' WHERE id = v_task_id;
  ELSIF v_has_due_date THEN UPDATE tasks SET due_date = v_anchor + interval '2 days' WHERE id = v_task_id;
  END IF;
  IF v_archive_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_spaces') THEN
    INSERT INTO task_spaces (task_id, space_id) VALUES (v_task_id, v_archive_id) ON CONFLICT DO NOTHING;
  END IF;
  IF v_has_image_url THEN UPDATE tasks SET image_url = '/spaces/mini-cards/archive-room.png' WHERE id = v_task_id; END IF;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name)
  VALUES
    (v_org_id, p_property_id, 'Label Your Spaces',
     'Add names to spaces such as Kitchen, Garage, and Hallway. Why: Helps organise tasks and records. [onboarding_demo]',
     'open', 'low', 'map-pin'),
    (v_org_id, p_property_id, 'Invite Your Team',
     'Add staff, family members, or contractors. Why: Assign work and share responsibility. [onboarding_demo]',
     'open', 'medium', 'users'),
    (v_org_id, p_property_id, 'Upload Property Documents',
     'Add warranties, certificates, manuals, and contracts. Why: Filla can organise and monitor them. [onboarding_demo]',
     'open', 'medium', 'file-up'),
    (v_org_id, p_property_id, 'Add Key Assets',
     'Record important equipment such as boilers, HVAC units, lifts, or vehicles. Why: Enables maintenance tracking. [onboarding_demo]',
     'open', 'low', 'wrench'),
    (v_org_id, p_property_id, 'Upload One Document',
     'Drag and drop any PDF or image to see how Filla organises records. [onboarding_demo]',
     'open', 'low', 'upload'),
    (v_org_id, p_property_id, 'Create Your First Task',
     'See how Filla organises work — try creating a task from the Add button. [onboarding_demo]',
     'open', 'low', 'plus-circle');

  IF v_has_due_at OR v_has_due_date THEN
    IF v_has_due_at THEN
      UPDATE tasks SET due_at = v_anchor + interval '5 days'
      WHERE property_id = p_property_id AND title = 'Label Your Spaces' AND description LIKE '%[onboarding_demo]%';
      UPDATE tasks SET due_at = v_anchor + interval '7 days'
      WHERE property_id = p_property_id AND title = 'Invite Your Team' AND description LIKE '%[onboarding_demo]%';
      UPDATE tasks SET due_at = v_anchor + interval '10 days'
      WHERE property_id = p_property_id AND title = 'Upload Property Documents' AND description LIKE '%[onboarding_demo]%';
      UPDATE tasks SET due_at = v_anchor + interval '14 days'
      WHERE property_id = p_property_id AND title = 'Add Key Assets' AND description LIKE '%[onboarding_demo]%';
    ELSE
      UPDATE tasks SET due_date = v_anchor + interval '5 days'
      WHERE property_id = p_property_id AND title = 'Label Your Spaces' AND description LIKE '%[onboarding_demo]%';
      UPDATE tasks SET due_date = v_anchor + interval '7 days'
      WHERE property_id = p_property_id AND title = 'Invite Your Team' AND description LIKE '%[onboarding_demo]%';
      UPDATE tasks SET due_date = v_anchor + interval '10 days'
      WHERE property_id = p_property_id AND title = 'Upload Property Documents' AND description LIKE '%[onboarding_demo]%';
      UPDATE tasks SET due_date = v_anchor + interval '14 days'
      WHERE property_id = p_property_id AND title = 'Add Key Assets' AND description LIKE '%[onboarding_demo]%';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM assets WHERE property_id = p_property_id AND name = 'Sample: boiler unit') THEN
    IF v_has_notes THEN
      INSERT INTO assets (org_id, property_id, space_id, name, asset_type, icon_name, condition_score, status, notes, metadata)
      VALUES (v_org_id, p_property_id, v_boiler_room_id, 'Sample: boiler unit', 'HVAC', 'flame', 88, 'active',
        'Example asset — swap for your plant register. [onboarding_demo]',
        '{"onboarding_demo": true, "placeholder_image_hint": "/spaces/mini-cards/boiler-room.png"}'::jsonb);
    ELSE
      INSERT INTO assets (org_id, property_id, space_id, name, asset_type, icon_name, condition_score, status, metadata)
      VALUES (v_org_id, p_property_id, v_boiler_room_id, 'Sample: boiler unit', 'HVAC', 'flame', 88, 'active',
        '{"onboarding_demo": true, "placeholder_image_hint": "/spaces/mini-cards/boiler-room.png"}'::jsonb);
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM assets WHERE property_id = p_property_id AND name = 'Sample: fire extinguisher') THEN
    IF v_has_notes THEN
      INSERT INTO assets (org_id, property_id, space_id, name, asset_type, icon_name, condition_score, status, notes, metadata)
      VALUES (v_org_id, p_property_id, v_first_aid_id, 'Sample: fire extinguisher', 'Safety', 'shield', 95, 'active',
        'Link compliance renewals to assets when you go live. [onboarding_demo]',
        '{"onboarding_demo": true, "placeholder_image_hint": "/spaces/mini-cards/first-aid.png"}'::jsonb);
    ELSE
      INSERT INTO assets (org_id, property_id, space_id, name, asset_type, icon_name, condition_score, status, metadata)
      VALUES (v_org_id, p_property_id, v_first_aid_id, 'Sample: fire extinguisher', 'Safety', 'shield', 95, 'active',
        '{"onboarding_demo": true, "placeholder_image_hint": "/spaces/mini-cards/first-aid.png"}'::jsonb);
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM assets WHERE property_id = p_property_id AND name = 'Sample: lift unit') THEN
    IF v_has_notes THEN
      INSERT INTO assets (org_id, property_id, space_id, name, asset_type, icon_name, condition_score, status, notes, metadata)
      VALUES (v_org_id, p_property_id, v_plant_room_id, 'Sample: lift unit', 'Lift', 'arrow-up-down', 90, 'active',
        'Example maintainable asset with service history. [onboarding_demo]',
        '{"onboarding_demo": true, "placeholder_image_hint": "/spaces/mini-cards/lift.png"}'::jsonb);
    ELSE
      INSERT INTO assets (org_id, property_id, space_id, name, asset_type, icon_name, condition_score, status, metadata)
      VALUES (v_org_id, p_property_id, v_plant_room_id, 'Sample: lift unit', 'Lift', 'arrow-up-down', 90, 'active',
        '{"onboarding_demo": true, "placeholder_image_hint": "/spaces/mini-cards/lift.png"}'::jsonb);
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_rules' AND column_name = 'auto_create'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'compliance_rules' AND column_name = 'property_id'
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM compliance_rules WHERE property_id = p_property_id AND name = 'Annual fire safety review (sample)'
      ) THEN
        INSERT INTO compliance_rules (
          org_id, property_id, name, description, frequency, scope_type, notify_days_before, next_due_date, auto_create
        ) VALUES (
          v_org_id, p_property_id, 'Annual fire safety review (sample)',
          'Example renewal cycle — replace with your building''s real programme. [onboarding_demo]',
          'annual', 'property', 30, (v_anchor::date + interval '90 days')::date, false
        ) RETURNING id INTO v_rule_id;
      END IF;
    END IF;
  END IF;

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name
  ) VALUES (
    v_org_id, p_property_id, 'Fire Extinguisher Certificate (sample)', 'Fire Safety Certificate', 'due_soon',
    '/spaces/mini-cards/first-aid.png',
    (v_anchor::date + interval '3 days')::date, (v_anchor::date + interval '3 days')::date,
    'annual', 'Example certificate awaiting your confirmation. [onboarding_demo]', 'shield-check'
  ) RETURNING id INTO v_doc_fire_ext;

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name
  ) VALUES (
    v_org_id, p_property_id, 'Building Insurance Policy (sample)', 'Insurance', 'valid',
    '/spaces/mini-cards/archive-room.png',
    (v_anchor::date + interval '200 days')::date, NULL,
    NULL, 'Suggested category: Insurance. Example record. [onboarding_demo]', 'file-text'
  );

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name
  ) VALUES (
    v_org_id, p_property_id, 'Emergency Lighting Report (sample)', 'Compliance', 'valid',
    '/spaces/mini-cards/electrical-room.png',
    (v_anchor::date + interval '120 days')::date, (v_anchor::date + interval '120 days')::date,
    'annual', 'Suggested category: Compliance. Example record. [onboarding_demo]', 'lightbulb'
  );

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name
  ) VALUES (
    v_org_id, p_property_id, 'Water System Inspection (sample)', 'Maintenance', 'valid',
    '/spaces/mini-cards/boiler-room.png',
    (v_anchor::date + interval '60 days')::date, (v_anchor::date + interval '60 days')::date,
    'annual', 'Suggested category: Maintenance. Example record. [onboarding_demo]', 'droplets'
  );

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name, rule_id
  ) VALUES (
    v_org_id, p_property_id, 'Gas Safety Certificate (sample)', 'Gas Safety Certificate', 'valid',
    '/spaces/mini-cards/kitchen.png',
    (v_anchor::date + interval '200 days')::date, (v_anchor::date + interval '200 days')::date,
    'annual', 'Sample valid record with placeholder preview. [onboarding_demo]', 'shield-check', v_rule_id
  ) RETURNING id INTO v_doc_gas;

  IF v_first_aid_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compliance_spaces') THEN
    IF v_doc_fire_ext IS NOT NULL THEN
      INSERT INTO compliance_spaces (org_id, compliance_document_id, space_id)
      VALUES (v_org_id, v_doc_fire_ext, v_first_aid_id) ON CONFLICT DO NOTHING;
    END IF;
    IF v_doc_gas IS NOT NULL THEN
      INSERT INTO compliance_spaces (org_id, compliance_document_id, space_id)
      VALUES (v_org_id, v_doc_gas, v_first_aid_id) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  IF v_doc_fire_ext IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compliance_recommendations') THEN
    INSERT INTO compliance_recommendations (
      org_id, compliance_document_id, property_id, risk_level, recommended_action, status, hazards
    ) VALUES (
      v_org_id, v_doc_fire_ext, p_property_id, 'medium',
      'Example: Fire safety certificate expires soon — confirm expiry date after upload. [onboarding_demo]',
      'pending', ARRAY['fire']::text[]
    ) ON CONFLICT (compliance_document_id) DO NOTHING;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'checklist_templates' AND column_name = 'items')
    AND NOT EXISTS (SELECT 1 FROM checklist_templates WHERE org_id = v_org_id AND name = 'Sample: property walkthrough')
  THEN
    INSERT INTO checklist_templates (org_id, name, category, items)
    VALUES (
      v_org_id, 'Sample: property walkthrough', 'operations',
      $ct$[
        {"id":"d1111111-1111-4111-8111-111111111111","title":"Check fire exits are clear","is_yes_no":true,"requires_signature":false},
        {"id":"d2222222-2222-4222-8222-222222222222","title":"Note any visible maintenance issues","is_yes_no":false,"requires_signature":false},
        {"id":"d3333333-3333-4333-8333-333333333333","title":"Photo of meter readings","is_yes_no":false,"requires_signature":false}
      ]$ct$::jsonb
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attachments')
    AND NOT EXISTS (
      SELECT 1 FROM attachments
      WHERE org_id = v_org_id AND parent_id = p_property_id AND title = 'Sample: building insurance schedule'
    )
  THEN
    INSERT INTO attachments (
      org_id, file_url, parent_type, parent_id, title, category, document_type, status, notes
    ) VALUES (
      v_org_id, '/spaces/mini-cards/archive-room.png', 'property', p_property_id,
      'Sample: building insurance schedule', 'Insurance', 'Insurance', 'valid',
      'Example property document — suggested category Insurance. [onboarding_demo]'
    ) RETURNING id INTO v_attachment_id;

    IF v_archive_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attachment_spaces') THEN
      INSERT INTO attachment_spaces (attachment_id, space_id, org_id)
      VALUES (v_attachment_id, v_archive_id, v_org_id) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'seed_onboarding_demo_for_property failed for %: %', p_property_id, SQLERRM;
  END;
END;
$$;
NOTIFY pgrst, 'reload schema';
