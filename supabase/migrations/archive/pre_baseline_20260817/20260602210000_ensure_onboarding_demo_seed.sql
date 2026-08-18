-- Repair part 7: first-visit onboarding demo (sample tasks, assets, compliance, documents).
-- Legacy/partial remotes may lack junction tables, seed RPCs, and column variants (due_at vs due_date).

-- ============================================================================
-- 1. Supporting tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS property_themes (
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  PRIMARY KEY (property_id, theme_id)
);
CREATE INDEX IF NOT EXISTS idx_property_themes_property ON property_themes(property_id);
ALTER TABLE property_themes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "property_themes_select" ON property_themes;
CREATE POLICY "property_themes_select" ON property_themes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN organisation_members om ON om.org_id = p.org_id AND om.user_id = auth.uid()
      WHERE p.id = property_themes.property_id
    )
  );
DROP POLICY IF EXISTS "property_themes_insert" ON property_themes;
CREATE POLICY "property_themes_insert" ON property_themes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN organisation_members om ON om.org_id = p.org_id AND om.user_id = auth.uid()
      WHERE p.id = property_themes.property_id
    )
  );
GRANT SELECT, INSERT, DELETE ON property_themes TO authenticated;

CREATE TABLE IF NOT EXISTS task_spaces (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, space_id)
);
ALTER TABLE task_spaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_spaces_select" ON task_spaces;
CREATE POLICY "task_spaces_select" ON task_spaces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN organisation_members om ON om.org_id = t.org_id AND om.user_id = auth.uid()
      WHERE t.id = task_spaces.task_id
    )
  );
DROP POLICY IF EXISTS "task_spaces_insert" ON task_spaces;
CREATE POLICY "task_spaces_insert" ON task_spaces FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN organisation_members om ON om.org_id = t.org_id AND om.user_id = auth.uid()
      WHERE t.id = task_spaces.task_id
    )
  );
GRANT SELECT, INSERT, DELETE ON task_spaces TO authenticated;

CREATE TABLE IF NOT EXISTS compliance_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  compliance_document_id UUID NOT NULL REFERENCES compliance_documents(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  asset_ids UUID[] DEFAULT '{}',
  space_ids UUID[] DEFAULT '{}',
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  recommended_action TEXT NOT NULL,
  recommended_tasks JSONB DEFAULT '[]',
  hazards TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  UNIQUE (compliance_document_id)
);
ALTER TABLE compliance_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "compliance_recommendations_select" ON compliance_recommendations;
CREATE POLICY "compliance_recommendations_select" ON compliance_recommendations FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "compliance_recommendations_insert" ON compliance_recommendations;
CREATE POLICY "compliance_recommendations_insert" ON compliance_recommendations FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON compliance_recommendations TO authenticated;

ALTER TABLE compliance_documents
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS frequency TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS icon_name TEXT,
  ADD COLUMN IF NOT EXISTS rule_id UUID;

ALTER TABLE assets ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================================
-- 2. seed_property_defaults (legacy-safe spaces: no space_type column required)
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_property_defaults(p_property_id UUID, p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL row_security = off;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'property_details'
  ) THEN
    INSERT INTO property_details (property_id, org_id)
    VALUES (p_property_id, p_org_id)
    ON CONFLICT (property_id) DO NOTHING;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'themes'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'property_themes'
  ) THEN
    INSERT INTO themes (org_id, name, type, color, icon)
    SELECT p_org_id, v.name, v.type, v.color, v.icon
    FROM (VALUES
      ('Compliance', 'group', '#EB6834', 'shield-check'),
      ('Utilities', 'group', '#8EC9CE', 'zap'),
      ('Maintenance', 'group', '#4ECDC4', 'wrench'),
      ('Safety', 'group', '#FF6B6B', 'alert-triangle'),
      ('Assets', 'group', '#96CEB4', 'package')
    ) AS v(name, type, color, icon)
    WHERE NOT EXISTS (
      SELECT 1 FROM themes t
      WHERE t.org_id = p_org_id AND t.name = v.name AND t.type = v.type
    );

    INSERT INTO property_themes (property_id, theme_id)
    SELECT p_property_id, t.id
    FROM themes t
    WHERE t.org_id = p_org_id
      AND t.name IN ('Compliance', 'Utilities', 'Maintenance', 'Safety', 'Assets')
      AND t.type = 'group'
    ON CONFLICT (property_id, theme_id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM spaces WHERE property_id = p_property_id LIMIT 1) THEN
    INSERT INTO spaces (org_id, property_id, name)
    VALUES
      (p_org_id, p_property_id, 'Kitchen'),
      (p_org_id, p_property_id, 'Living Room'),
      (p_org_id, p_property_id, 'Bedroom'),
      (p_org_id, p_property_id, 'Bathroom'),
      (p_org_id, p_property_id, 'Exterior'),
      (p_org_id, p_property_id, 'Basement'),
      (p_org_id, p_property_id, 'Attic');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'seed_property_defaults failed for %: %', p_property_id, SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION seed_property_defaults(UUID, UUID) TO authenticated, service_role;

-- ============================================================================
-- 3. seed_onboarding_demo_for_property (idempotent; legacy column aware)
-- ============================================================================
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
  v_task_issue UUID;
  v_rule_id UUID;
  v_doc_gas UUID;
  v_doc_eicr UUID;
  v_doc_fra UUID;
  v_attachment_id UUID;
  v_milestones JSONB;
  v_has_due_at boolean;
  v_has_notes boolean;
  v_tasks_exist boolean;
BEGIN
  SET LOCAL row_security = off;

  SELECT org_id INTO v_org_id FROM properties WHERE id = p_property_id;
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM seed_property_defaults(p_property_id, v_org_id);

  SELECT EXISTS (
    SELECT 1 FROM tasks
    WHERE property_id = p_property_id
      AND title = 'Take a quick tour of your workspace'
  ) INTO v_tasks_exist;

  IF v_tasks_exist AND (
    SELECT COUNT(*)::int FROM assets
    WHERE property_id = p_property_id AND name LIKE 'Sample:%'
  ) >= 3 THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_at'
  ) INTO v_has_due_at;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'notes'
  ) INTO v_has_notes;

  BEGIN
  UPDATE properties
  SET thumbnail_url = '/onboarding/placeholder-property-hero.svg'
  WHERE id = p_property_id
    AND (thumbnail_url IS NULL OR btrim(thumbnail_url) = '');

  SELECT id INTO v_kitchen_id
  FROM spaces
  WHERE property_id = p_property_id AND lower(name) = 'kitchen'
  LIMIT 1;

  IF v_kitchen_id IS NULL THEN
    INSERT INTO spaces (org_id, property_id, name)
    VALUES (v_org_id, p_property_id, 'Kitchen')
    RETURNING id INTO v_kitchen_id;
  END IF;

  IF NOT v_tasks_exist THEN
  v_milestones := jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'dateTime', to_char((now() + interval '14 days') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'label', 'Sample check-in'
    )
  );

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name, milestones)
  VALUES (
    v_org_id, p_property_id,
    'Take a quick tour of your workspace',
    'You''re seeing sample tasks, compliance items, and assets so nothing feels empty on day one. Delete or edit anything - this is your space. [onboarding_demo]',
    'open', 'medium', 'sparkles', v_milestones
  ) RETURNING id INTO v_task_tour;

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name, milestones)
  VALUES (
    v_org_id, p_property_id,
    'Mark your first task complete',
    'Try completing this one to see how progress and your calendar update. Small wins build momentum. [onboarding_demo]',
    'open', 'low', 'check-circle', '[]'::jsonb
  );

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name, milestones)
  VALUES (
    v_org_id, p_property_id,
    'Invite a teammate when you''re ready',
    'Great work happens together. When you want help on site, invite someone from Settings > Team. [onboarding_demo]',
    'open', 'medium', 'users', '[]'::jsonb
  );

  INSERT INTO tasks (org_id, property_id, title, description, status, priority, icon_name, milestones)
  VALUES (
    v_org_id, p_property_id,
    'Report a real issue on site',
    'Use Report issue to capture photos, priority, and location - your team stays aligned. [onboarding_demo]',
    'in_progress', 'high', 'camera', '[]'::jsonb
  ) RETURNING id INTO v_task_issue;

  IF v_has_due_at AND v_task_issue IS NOT NULL THEN
    UPDATE tasks SET due_at = now() + interval '7 days' WHERE id = v_task_issue;
  END IF;

  IF v_kitchen_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_spaces'
  ) THEN
    INSERT INTO task_spaces (task_id, space_id) VALUES
      (v_task_tour, v_kitchen_id),
      (v_task_issue, v_kitchen_id)
    ON CONFLICT DO NOTHING;
  END IF;
  END IF;

  IF (
    SELECT COUNT(*)::int FROM assets
    WHERE property_id = p_property_id AND name LIKE 'Sample:%'
  ) < 3 THEN
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM assets WHERE property_id = p_property_id AND name = 'Sample: boiler unit') THEN
      IF v_has_notes THEN
        INSERT INTO assets (org_id, property_id, space_id, name, asset_type, icon_name, condition_score, status, notes, metadata)
        VALUES (v_org_id, p_property_id, v_kitchen_id, 'Sample: boiler unit', 'HVAC', 'flame', 88, 'active',
          'Example asset - swap for your plant register. [onboarding_demo]',
          '{"onboarding_demo": true, "placeholder_image_hint": "/onboarding/placeholder-asset-photo.svg"}'::jsonb);
      ELSE
        INSERT INTO assets (org_id, property_id, space_id, name, asset_type, icon_name, condition_score, status, metadata)
        VALUES (v_org_id, p_property_id, v_kitchen_id, 'Sample: boiler unit', 'HVAC', 'flame', 88, 'active',
          '{"onboarding_demo": true, "placeholder_image_hint": "/onboarding/placeholder-asset-photo.svg"}'::jsonb);
      END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM assets WHERE property_id = p_property_id AND name = 'Sample: electrical consumer unit') THEN
      IF v_has_notes THEN
        INSERT INTO assets (org_id, property_id, space_id, name, asset_type, icon_name, condition_score, status, notes, metadata)
        VALUES (v_org_id, p_property_id, v_kitchen_id, 'Sample: electrical consumer unit', 'Electrical', 'zap', 72, 'active',
          'Shows how condition and type appear in lists. [onboarding_demo]', '{"onboarding_demo": true}'::jsonb);
      ELSE
        INSERT INTO assets (org_id, property_id, space_id, name, asset_type, icon_name, condition_score, status, metadata)
        VALUES (v_org_id, p_property_id, v_kitchen_id, 'Sample: electrical consumer unit', 'Electrical', 'zap', 72, 'active',
          '{"onboarding_demo": true}'::jsonb);
      END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM assets WHERE property_id = p_property_id AND name = 'Sample: fire extinguisher') THEN
      IF v_has_notes THEN
        INSERT INTO assets (org_id, property_id, space_id, name, asset_type, icon_name, condition_score, status, notes, metadata)
        VALUES (v_org_id, p_property_id, v_kitchen_id, 'Sample: fire extinguisher', 'Safety', 'shield', 95, 'active',
          'Link compliance renewals to assets when you go live. [onboarding_demo]', '{"onboarding_demo": true}'::jsonb);
      ELSE
        INSERT INTO assets (org_id, property_id, space_id, name, asset_type, icon_name, condition_score, status, metadata)
        VALUES (v_org_id, p_property_id, v_kitchen_id, 'Sample: fire extinguisher', 'Safety', 'shield', 95, 'active',
          '{"onboarding_demo": true}'::jsonb);
      END IF;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'onboarding demo assets skipped for %: %', p_property_id, SQLERRM;
  END;
  END IF;

  IF v_tasks_exist THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_rules' AND column_name = 'auto_create'
  ) THEN
    INSERT INTO compliance_rules (
      org_id, property_id, name, description, frequency, scope_type, notify_days_before, next_due_date, auto_create
    ) VALUES (
      v_org_id, p_property_id,
      'Annual fire safety review (sample)',
      'Example renewal cycle — replace with your building''s real programme. [onboarding_demo]',
      'annual', 'property', 30, (CURRENT_DATE + interval '90 days')::date, false
    ) RETURNING id INTO v_rule_id;
  END IF;

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name, rule_id
  ) VALUES (
    v_org_id, p_property_id,
    'Gas Safety Certificate (sample)', 'Gas Safety Certificate', 'valid',
    '/onboarding/placeholder-compliance-doc.svg',
    (CURRENT_DATE + interval '200 days')::date, (CURRENT_DATE + interval '200 days')::date,
    'annual', 'Sample valid record with placeholder certificate preview. [onboarding_demo]',
    'shield-check', NULL
  ) RETURNING id INTO v_doc_gas;

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name, rule_id
  ) VALUES (
    v_org_id, p_property_id,
    'EICR (sample - due soon)', 'EICR', 'due_soon',
    '/onboarding/placeholder-compliance-doc.svg',
    (CURRENT_DATE + interval '18 days')::date, (CURRENT_DATE + interval '18 days')::date,
    '5-year', 'Shows the "renewal coming up" state. [onboarding_demo]',
    'clipboard-list', v_rule_id
  ) RETURNING id INTO v_doc_eicr;

  INSERT INTO compliance_documents (
    org_id, property_id, title, document_type, status, file_url, expiry_date, next_due_date, frequency, notes, icon_name, rule_id
  ) VALUES (
    v_org_id, p_property_id,
    'Fire Risk Assessment (sample - add file)', 'Fire Risk Assessment', 'missing',
    NULL, NULL, NULL, 'annual',
    'No file yet - upload your PDF when you have it. [onboarding_demo]',
    'help-circle', NULL
  ) RETURNING id INTO v_doc_fra;

  IF v_kitchen_id IS NOT NULL AND v_doc_gas IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'compliance_spaces'
  ) THEN
    INSERT INTO compliance_spaces (org_id, compliance_document_id, space_id)
    VALUES (v_org_id, v_doc_gas, v_kitchen_id), (v_org_id, v_doc_eicr, v_kitchen_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_doc_eicr IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'compliance_recommendations'
  ) THEN
    INSERT INTO compliance_recommendations (
      org_id, compliance_document_id, property_id, risk_level, recommended_action, status, hazards
    ) VALUES (
      v_org_id, v_doc_eicr, p_property_id, 'medium',
      'Sample insight: EICR renewals often slip during busy periods - set a reminder 60 days before expiry. Real AI suggestions will appear once you upload documents. [onboarding_demo]',
      'pending', ARRAY['electrical']::text[]
    ) ON CONFLICT (compliance_document_id) DO NOTHING;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'checklist_templates'
  ) AND NOT EXISTS (
    SELECT 1 FROM checklist_templates WHERE org_id = v_org_id AND name = 'Sample: new tenant handover'
  ) THEN
    INSERT INTO checklist_templates (org_id, name, category, items)
    VALUES (
      v_org_id, 'Sample: new tenant handover', 'operations',
      $ct$[
        {"id":"a1111111-1111-4111-8111-111111111111","title":"Meter readings recorded","is_yes_no":true,"requires_signature":false},
        {"id":"b2222222-2222-4222-8222-222222222222","title":"Smoke alarms tested in each room","is_yes_no":true,"requires_signature":false},
        {"id":"c3333333-3333-4333-8333-333333333333","title":"Keys and access fobs handed over","is_yes_no":false,"requires_signature":true}
      ]$ct$::jsonb
    );
  END IF;

  IF v_kitchen_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attachments'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attachment_spaces'
  ) AND NOT EXISTS (
    SELECT 1 FROM attachments
    WHERE org_id = v_org_id AND parent_id = p_property_id AND title = 'Sample: building insurance schedule'
  ) THEN
    INSERT INTO attachments (
      org_id, file_url, parent_type, parent_id, title, category, document_type, status, notes
    ) VALUES (
      v_org_id,
      '/onboarding/placeholder-compliance-doc.svg',
      'property',
      p_property_id,
      'Sample: building insurance schedule',
      'Legal',
      'Insurance',
      'valid',
      'Example property document linked to Kitchen space. [onboarding_demo]'
    ) RETURNING id INTO v_attachment_id;

    INSERT INTO attachment_spaces (attachment_id, space_id, org_id)
    VALUES (v_attachment_id, v_kitchen_id, v_org_id)
    ON CONFLICT DO NOTHING;
  END IF;

  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'seed_onboarding_demo_for_property failed for %: %', p_property_id, SQLERRM;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION seed_onboarding_demo_for_property(UUID) TO authenticated, service_role;

-- ============================================================================
-- 4. Property insert trigger + create_property_v2 hook
-- ============================================================================
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

DROP TRIGGER IF EXISTS seed_property_defaults_trigger ON properties;
CREATE TRIGGER seed_property_defaults_trigger
  AFTER INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_property_defaults();

CREATE OR REPLACE FUNCTION create_property_v2(
  p_org_id UUID,
  p_address TEXT,
  p_nickname TEXT DEFAULT NULL,
  p_icon_name TEXT DEFAULT NULL,
  p_icon_color_hex TEXT DEFAULT NULL,
  p_thumbnail_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_membership_count INTEGER;
  v_new_property JSON;
  v_property_id UUID;
  has_duplicate BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: User must be authenticated';
  END IF;

  SELECT COUNT(*) INTO v_membership_count
  FROM organisation_members
  WHERE org_id = p_org_id AND user_id = v_user_id;

  IF v_membership_count = 0 THEN
    RAISE EXCEPTION 'Access Denied: User is not a member of this organisation';
  END IF;

  has_duplicate := check_duplicate_property_address(p_org_id, p_address);

  IF has_duplicate THEN
    RAISE EXCEPTION 'A property with this address already exists in your organisation. Please use a different address.';
  END IF;

  INSERT INTO properties (
    org_id, address, nickname, icon_name, icon_color_hex, thumbnail_url
  )
  VALUES (
    p_org_id, p_address, p_nickname, p_icon_name, p_icon_color_hex, p_thumbnail_url
  )
  RETURNING json_build_object(
    'id', id,
    'org_id', org_id,
    'address', address,
    'nickname', nickname,
    'icon_name', icon_name,
    'icon_color_hex', icon_color_hex,
    'thumbnail_url', thumbnail_url,
    'created_at', created_at,
    'updated_at', updated_at
  ), id INTO v_new_property, v_property_id;

  PERFORM seed_property_defaults(v_property_id, p_org_id);
  PERFORM seed_onboarding_demo_for_property(v_property_id);

  RETURN v_new_property;
END;
$$;

NOTIFY pgrst, 'reload schema';
