-- Onboarding education v2: feature-teaching demo content with space mini-card art.
-- Staff training tasks seeded per user on invitation accept.
-- Refresh RPC replaces legacy demo rows for existing properties.

-- ============================================================================
-- 1. Clear demo rows (property-scoped)
-- ============================================================================
CREATE OR REPLACE FUNCTION clear_onboarding_demo_for_property(p_property_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SET LOCAL row_security = off;

  SELECT org_id INTO v_org_id FROM properties WHERE id = p_property_id;
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM tasks
  WHERE property_id = p_property_id
    AND description LIKE '%[onboarding_demo]%';

  DELETE FROM assets
  WHERE property_id = p_property_id
    AND (
      name LIKE 'Sample:%'
      OR COALESCE(notes, '') LIKE '%[onboarding_demo]%'
      OR COALESCE(metadata::text, '') LIKE '%onboarding_demo%'
    );

  DELETE FROM compliance_documents
  WHERE property_id = p_property_id
    AND COALESCE(notes, '') LIKE '%[onboarding_demo]%';

  DELETE FROM compliance_rules
  WHERE property_id = p_property_id
    AND COALESCE(description, '') LIKE '%[onboarding_demo]%';

  DELETE FROM compliance_recommendations cr
  USING compliance_documents cd
  WHERE cr.compliance_document_id = cd.id
    AND cd.property_id = p_property_id
    AND COALESCE(cr.recommended_action, '') LIKE '%[onboarding_demo]%';

  DELETE FROM attachments
  WHERE parent_type = 'property'
    AND parent_id = p_property_id
    AND COALESCE(notes, '') LIKE '%[onboarding_demo]%';

  DELETE FROM checklist_templates
  WHERE org_id = v_org_id
    AND name LIKE 'Sample:%';
END;
$$;

GRANT EXECUTE ON FUNCTION clear_onboarding_demo_for_property(UUID) TO authenticated, service_role;

-- ============================================================================
-- 2. seed_onboarding_demo_for_property (education v2)
-- ============================================================================
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
  v_doc_insurance UUID;
  v_doc_lighting UUID;
  v_doc_water UUID;
  v_doc_gas UUID;
  v_attachment_id UUID;
  v_has_due_date boolean;
  v_has_image_url boolean;
  v_has_notes boolean;
  v_has_assigned_user boolean;
  v_task_id UUID;
BEGIN
  SET LOCAL row_security = off;

  SELECT org_id INTO v_org_id FROM properties WHERE id = p_property_id;
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

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
    WHERE property_id = p_property_id
      AND title = 'Take a quick tour of your workspace'
  ) THEN
    PERFORM clear_onboarding_demo_for_property(p_property_id);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_date'
  ) INTO v_has_due_date;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'image_url'
  ) INTO v_has_image_url;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'notes'
  ) INTO v_has_notes;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'assigned_user_id'
  ) INTO v_has_assigned_user;

  BEGIN
  UPDATE properties
  SET thumbnail_url = '/spaces/mini-cards/lobby.png'
  WHERE id = p_property_id
    AND (thumbnail_url IS NULL OR btrim(thumbnail_url) = '' OR thumbnail_url LIKE '/onboarding/%');

  -- Demo spaces (mini-card art resolves from names)
  IF NOT EXISTS (SELECT 1 FROM spaces WHERE property_id = p_property_id AND lower(name) = 'kitchen') THEN
    INSERT INTO spaces (org_id, property_id, name)
    VALUES (v_org_id, p_property_id, 'Kitchen');
  END IF;

  SELECT id INTO v_kitchen_id FROM spaces
  WHERE property_id = p_property_id AND lower(name) = 'kitchen' LIMIT 1;

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

  -- Needs Attention tasks
  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name, due_date)
  VALUES (
    v_org_id, p_property_id,
    'Review Fire Extinguisher Certificate',
    'A certificate was uploaded but needs confirmation. Example — Filla tracks compliance from your documents. [onboarding_demo]',
    'waiting_review', 'urgent', 'shield-check',
    CASE WHEN v_has_due_date THEN v_anchor + interval '1 day' ELSE NULL END
  ) RETURNING id INTO v_task_id;

  IF v_first_aid_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_spaces') THEN
    INSERT INTO task_spaces (task_id, space_id) VALUES (v_task_id, v_first_aid_id) ON CONFLICT DO NOTHING;
  END IF;
  IF v_has_image_url THEN
    UPDATE tasks SET image_url = '/spaces/mini-cards/first-aid.png' WHERE id = v_task_id;
  END IF;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name, due_date)
  VALUES (
    v_org_id, p_property_id,
    'Boiler Service Due Soon',
    'Annual service due in 14 days. Example — Filla schedules maintenance from asset records. [onboarding_demo]',
    'open', 'high', 'flame',
    CASE WHEN v_has_due_date THEN v_anchor + interval '14 days' ELSE NULL END
  ) RETURNING id INTO v_task_id;

  IF v_boiler_room_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_spaces') THEN
    INSERT INTO task_spaces (task_id, space_id) VALUES (v_task_id, v_boiler_room_id) ON CONFLICT DO NOTHING;
  END IF;
  IF v_has_image_url THEN
    UPDATE tasks SET image_url = '/spaces/mini-cards/boiler-room.png' WHERE id = v_task_id;
  END IF;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name, due_date)
  VALUES (
    v_org_id, p_property_id,
    'Unknown Document Uploaded',
    'Filla could not identify a recently uploaded file. Example — review and categorise uploads. [onboarding_demo]',
    'waiting_review', 'medium', 'file-question',
    CASE WHEN v_has_due_date THEN v_anchor + interval '2 days' ELSE NULL END
  ) RETURNING id INTO v_task_id;

  IF v_archive_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_spaces') THEN
    INSERT INTO task_spaces (task_id, space_id) VALUES (v_task_id, v_archive_id) ON CONFLICT DO NOTHING;
  END IF;
  IF v_has_image_url THEN
    UPDATE tasks SET image_url = '/spaces/mini-cards/archive-room.png' WHERE id = v_task_id;
  END IF;

  -- Suggested Tasks (setup education)
  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name, due_date)
  VALUES
    (v_org_id, p_property_id, 'Label Your Spaces',
     'Add names to spaces such as Kitchen, Garage, and Hallway. Why: Helps organise tasks and records. [onboarding_demo]',
     'open', 'low', 'map-pin',
     CASE WHEN v_has_due_date THEN v_anchor + interval '5 days' ELSE NULL END),
    (v_org_id, p_property_id, 'Invite Your Team',
     'Add staff, family members, or contractors. Why: Assign work and share responsibility. [onboarding_demo]',
     'open', 'medium', 'users',
     CASE WHEN v_has_due_date THEN v_anchor + interval '7 days' ELSE NULL END),
    (v_org_id, p_property_id, 'Upload Property Documents',
     'Add warranties, certificates, manuals, and contracts. Why: Filla can organise and monitor them. [onboarding_demo]',
     'open', 'medium', 'file-up',
     CASE WHEN v_has_due_date THEN v_anchor + interval '10 days' ELSE NULL END),
    (v_org_id, p_property_id, 'Add Key Assets',
     'Record important equipment such as boilers, HVAC units, lifts, or vehicles. Why: Enables maintenance tracking. [onboarding_demo]',
     'open', 'low', 'wrench',
     CASE WHEN v_has_due_date THEN v_anchor + interval '14 days' ELSE NULL END);

  -- Quick win tasks (no due date — completable anytime)
  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name, due_date)
  VALUES
    (v_org_id, p_property_id, 'Upload One Document',
     'Drag and drop any PDF or image to see how Filla organises records. [onboarding_demo]',
     'open', 'low', 'upload', NULL),
    (v_org_id, p_property_id, 'Create Your First Task',
     'See how Filla organises work — try creating a task from the Add button. [onboarding_demo]',
     'open', 'low', 'plus-circle', NULL);

  -- Sample assets
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

  -- Compliance / records
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_rules' AND column_name = 'auto_create'
  ) AND NOT EXISTS (
    SELECT 1 FROM compliance_rules WHERE property_id = p_property_id AND name = 'Annual fire safety review (sample)'
  ) THEN
    INSERT INTO compliance_rules (
      org_id, property_id, name, description, frequency, scope_type, notify_days_before, next_due_date, auto_create
    ) VALUES (
      v_org_id, p_property_id,
      'Annual fire safety review (sample)',
      'Example renewal cycle — replace with your building''s real programme. [onboarding_demo]',
      'annual', 'property', 30, (v_anchor::date + interval '90 days')::date, false
    ) RETURNING id INTO v_rule_id;
  END IF;

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name
  ) VALUES (
    v_org_id, p_property_id,
    'Fire Extinguisher Certificate (sample)', 'Fire Safety Certificate', 'due_soon',
    '/spaces/mini-cards/first-aid.png',
    (v_anchor::date + interval '3 days')::date, (v_anchor::date + interval '3 days')::date,
    'annual', 'Example certificate awaiting your confirmation. [onboarding_demo]',
    'shield-check'
  ) RETURNING id INTO v_doc_fire_ext;

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name
  ) VALUES (
    v_org_id, p_property_id,
    'Building Insurance Policy (sample)', 'Insurance', 'valid',
    '/spaces/mini-cards/archive-room.png',
    (v_anchor::date + interval '200 days')::date, NULL,
    NULL, 'Suggested category: Insurance. Example record. [onboarding_demo]',
    'file-text'
  ) RETURNING id INTO v_doc_insurance;

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name
  ) VALUES (
    v_org_id, p_property_id,
    'Emergency Lighting Report (sample)', 'Compliance', 'valid',
    '/spaces/mini-cards/electrical-room.png',
    (v_anchor::date + interval '120 days')::date, (v_anchor::date + interval '120 days')::date,
    'annual', 'Suggested category: Compliance. Example record. [onboarding_demo]',
    'lightbulb'
  ) RETURNING id INTO v_doc_lighting;

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name
  ) VALUES (
    v_org_id, p_property_id,
    'Water System Inspection (sample)', 'Maintenance', 'valid',
    '/spaces/mini-cards/boiler-room.png',
    (v_anchor::date + interval '60 days')::date, (v_anchor::date + interval '60 days')::date,
    'annual', 'Suggested category: Maintenance. Example record. [onboarding_demo]',
    'droplets'
  ) RETURNING id INTO v_doc_water;

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name, rule_id
  ) VALUES (
    v_org_id, p_property_id,
    'Gas Safety Certificate (sample)', 'Gas Safety Certificate', 'valid',
    '/spaces/mini-cards/kitchen.png',
    (v_anchor::date + interval '200 days')::date, (v_anchor::date + interval '200 days')::date,
    'annual', 'Sample valid record with placeholder preview. [onboarding_demo]',
    'shield-check', v_rule_id
  ) RETURNING id INTO v_doc_gas;

  IF v_first_aid_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compliance_spaces') THEN
    IF v_doc_fire_ext IS NOT NULL THEN
      INSERT INTO compliance_spaces (org_id, compliance_document_id, space_id)
      VALUES (v_org_id, v_doc_fire_ext, v_first_aid_id)
      ON CONFLICT DO NOTHING;
    END IF;
    IF v_doc_gas IS NOT NULL THEN
      INSERT INTO compliance_spaces (org_id, compliance_document_id, space_id)
      VALUES (v_org_id, v_doc_gas, v_first_aid_id)
      ON CONFLICT DO NOTHING;
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

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'checklist_templates')
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
      v_org_id,
      '/spaces/mini-cards/archive-room.png',
      'property', p_property_id,
      'Sample: building insurance schedule',
      'Insurance', 'Insurance', 'valid',
      'Example property document — suggested category Insurance. [onboarding_demo]'
    ) RETURNING id INTO v_attachment_id;

    IF v_archive_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attachment_spaces') THEN
      INSERT INTO attachment_spaces (attachment_id, space_id, org_id)
      VALUES (v_attachment_id, v_archive_id, v_org_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'seed_onboarding_demo_for_property failed for %: %', p_property_id, SQLERRM;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION seed_onboarding_demo_for_property(UUID) TO authenticated, service_role;

-- ============================================================================
-- 3. Refresh (existing properties)
-- ============================================================================
CREATE OR REPLACE FUNCTION refresh_onboarding_education_for_property(p_property_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM clear_onboarding_demo_for_property(p_property_id);
  PERFORM seed_onboarding_demo_for_property(p_property_id);
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_onboarding_education_for_property(UUID) TO authenticated, service_role;

-- ============================================================================
-- 4. Staff training tasks (per user)
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_staff_training_tasks(
  p_org_id UUID,
  p_user_id UUID,
  p_property_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anchor TIMESTAMPTZ := now();
  v_property_id UUID := p_property_id;
  v_kitchen_id UUID;
  v_has_due_date boolean;
  v_has_assigned_user boolean;
  v_has_image_url boolean;
  v_role TEXT;
  v_task_id UUID;
BEGIN
  SET LOCAL row_security = off;

  IF EXISTS (
    SELECT 1 FROM tasks
    WHERE org_id = p_org_id
      AND assigned_user_id = p_user_id
      AND description LIKE '%[staff_training]%'
  ) THEN
    RETURN;
  END IF;

  SELECT role INTO v_role
  FROM organisation_members
  WHERE org_id = p_org_id AND user_id = p_user_id;

  IF v_role IN ('owner', 'manager') THEN
    RETURN;
  END IF;

  IF v_property_id IS NULL THEN
    SELECT p.id INTO v_property_id
    FROM properties p
    JOIN organisation_members om ON om.org_id = p.org_id AND om.user_id = p_user_id
    WHERE p.org_id = p_org_id
    ORDER BY p.created_at ASC
    LIMIT 1;

    IF v_property_id IS NULL THEN
      SELECT id INTO v_property_id FROM properties WHERE org_id = p_org_id ORDER BY created_at ASC LIMIT 1;
    END IF;
  END IF;

  IF v_property_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_date'
  ) INTO v_has_due_date;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'assigned_user_id'
  ) INTO v_has_assigned_user;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'image_url'
  ) INTO v_has_image_url;

  SELECT id INTO v_kitchen_id FROM spaces
  WHERE property_id = v_property_id AND lower(name) = 'kitchen' LIMIT 1;

  IF v_kitchen_id IS NULL THEN
    INSERT INTO spaces (org_id, property_id, name)
    VALUES (p_org_id, v_property_id, 'Kitchen')
    RETURNING id INTO v_kitchen_id;
  END IF;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name, due_date, assigned_user_id)
  VALUES (
    p_org_id, v_property_id,
    'Learn Filla: Open your assigned work',
    'Find tasks assigned to you in My Work. This is where you execute day-to-day jobs. [staff_training]',
    'open', 'medium', 'graduation-cap',
    CASE WHEN v_has_due_date THEN v_anchor ELSE NULL END,
    CASE WHEN v_has_assigned_user THEN p_user_id ELSE NULL END
  ) RETURNING id INTO v_task_id;

  IF v_kitchen_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_spaces') THEN
    INSERT INTO task_spaces (task_id, space_id) VALUES (v_task_id, v_kitchen_id) ON CONFLICT DO NOTHING;
  END IF;
  IF v_has_image_url THEN
    UPDATE tasks SET image_url = '/spaces/mini-cards/kitchen.png' WHERE id = v_task_id;
  END IF;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name, due_date, assigned_user_id)
  VALUES (
    p_org_id, v_property_id,
    'Learn Filla: Complete a checklist step',
    'Open a task and tick one checklist item — checklists guide consistent work on site. [staff_training]',
    'open', 'low', 'graduation-cap',
    CASE WHEN v_has_due_date THEN v_anchor + interval '1 day' ELSE NULL END,
    CASE WHEN v_has_assigned_user THEN p_user_id ELSE NULL END
  ) RETURNING id INTO v_task_id;
  IF v_has_image_url THEN UPDATE tasks SET image_url = '/spaces/mini-cards/office.png' WHERE id = v_task_id; END IF;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name, due_date, assigned_user_id)
  VALUES (
    p_org_id, v_property_id,
    'Learn Filla: Add photo evidence',
    'Attach a photo to a task — evidence creates an audit trail for managers. [staff_training]',
    'open', 'medium', 'graduation-cap',
    CASE WHEN v_has_due_date THEN v_anchor + interval '2 days' ELSE NULL END,
    CASE WHEN v_has_assigned_user THEN p_user_id ELSE NULL END
  ) RETURNING id INTO v_task_id;
  IF v_has_image_url THEN UPDATE tasks SET image_url = '/spaces/mini-cards/bathroom.png' WHERE id = v_task_id; END IF;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name, due_date, assigned_user_id)
  VALUES (
    p_org_id, v_property_id,
    'Learn Filla: Mark a task complete',
    'Complete this training task to see how progress updates for your team. [staff_training]',
    'open', 'low', 'graduation-cap',
    CASE WHEN v_has_due_date THEN v_anchor + interval '3 days' ELSE NULL END,
    CASE WHEN v_has_assigned_user THEN p_user_id ELSE NULL END
  ) RETURNING id INTO v_task_id;
  IF v_has_image_url THEN UPDATE tasks SET image_url = '/spaces/mini-cards/garden.png' WHERE id = v_task_id; END IF;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name, due_date, assigned_user_id)
  VALUES (
    p_org_id, v_property_id,
    'Learn Filla: Report something on site',
    'Use Report issue to capture photos, location, and priority when something needs attention. [staff_training]',
    'open', 'medium', 'graduation-cap',
    CASE WHEN v_has_due_date THEN v_anchor + interval '5 days' ELSE NULL END,
    CASE WHEN v_has_assigned_user THEN p_user_id ELSE NULL END
  ) RETURNING id INTO v_task_id;
  IF v_has_image_url THEN UPDATE tasks SET image_url = '/spaces/mini-cards/workshop.png' WHERE id = v_task_id; END IF;

END;
$$;

GRANT EXECUTE ON FUNCTION seed_staff_training_tasks(UUID, UUID, UUID) TO authenticated, service_role;

-- ============================================================================
-- 5. accept_invitation → staff training seed
-- ============================================================================
CREATE OR REPLACE FUNCTION accept_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation invitations%ROWTYPE;
  v_user_id uuid;
  v_member_id uuid;
  v_property_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT * INTO v_invitation
  FROM invitations
  WHERE token = p_token
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invitation_not_found');
  END IF;

  IF v_invitation.expires_at < now() THEN
    UPDATE invitations SET status = 'expired', updated_at = now()
    WHERE id = v_invitation.id;
    RETURN jsonb_build_object('error', 'invitation_expired');
  END IF;

  IF lower((SELECT email FROM auth.users WHERE id = v_user_id)) != lower(v_invitation.email) THEN
    RETURN jsonb_build_object('error', 'email_mismatch');
  END IF;

  IF EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = v_invitation.org_id
      AND user_id = v_user_id
  ) THEN
    UPDATE invitations
    SET status = 'accepted', accepted_at = now(), updated_at = now()
    WHERE id = v_invitation.id;
    PERFORM seed_staff_training_tasks(
      v_invitation.org_id,
      v_user_id,
      CASE WHEN v_invitation.property_ids IS NOT NULL AND array_length(v_invitation.property_ids, 1) > 0
        THEN v_invitation.property_ids[1] ELSE NULL END
    );
    RETURN jsonb_build_object('org_id', v_invitation.org_id, 'already_member', true);
  END IF;

  INSERT INTO organisation_members (org_id, user_id, role, assigned_properties)
  VALUES (
    v_invitation.org_id,
    v_user_id,
    COALESCE(v_invitation.role, 'member'),
    v_invitation.property_ids
  )
  RETURNING id INTO v_member_id;

  UPDATE invitations
  SET status = 'accepted', accepted_at = now(), updated_at = now()
  WHERE id = v_invitation.id;

  v_property_id := CASE
    WHEN v_invitation.property_ids IS NOT NULL AND array_length(v_invitation.property_ids, 1) > 0
    THEN v_invitation.property_ids[1]
    ELSE NULL
  END;

  PERFORM seed_staff_training_tasks(v_invitation.org_id, v_user_id, v_property_id);

  RETURN jsonb_build_object(
    'org_id', v_invitation.org_id,
    'member_id', v_member_id,
    'role', v_invitation.role,
    'property_ids', v_invitation.property_ids
  );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_invitation(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
