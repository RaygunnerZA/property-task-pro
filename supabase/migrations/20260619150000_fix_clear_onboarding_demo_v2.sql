-- Skip compliance_rules cleanup when table is the legal-extraction schema (no description column).

CREATE OR REPLACE FUNCTION clear_onboarding_demo_for_property(p_property_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_rules_has_property_id boolean;
  v_rules_has_description boolean;
BEGIN
  SET LOCAL row_security = off;

  SELECT org_id INTO v_org_id FROM properties WHERE id = p_property_id;
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_rules' AND column_name = 'property_id'
  ) INTO v_rules_has_property_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_rules' AND column_name = 'description'
  ) INTO v_rules_has_description;

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

  IF v_rules_has_description THEN
    IF v_rules_has_property_id THEN
      DELETE FROM compliance_rules
      WHERE property_id = p_property_id
        AND COALESCE(description, '') LIKE '%[onboarding_demo]%';
    ELSE
      DELETE FROM compliance_rules
      WHERE org_id = v_org_id
        AND COALESCE(description, '') LIKE '%[onboarding_demo]%';
    END IF;
  END IF;

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

NOTIFY pgrst, 'reload schema';
