-- Promote external-email signals (unknown sender) into intake_items for Add to Filla review.
-- Canon: @Docs/15_External_Ingestion.md, @Docs/19_Platform_Arch.md

CREATE OR REPLACE FUNCTION promote_external_email_signal(p_signal_id UUID)
RETURNS SETOF intake_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_signal signals%ROWTYPE;
  v_paths TEXT[];
  v_path TEXT;
  v_preview TEXT;
  v_subject TEXT;
  v_intake_id UUID;
  v_file_name TEXT;
  v_first_id UUID;
  v_row intake_items;
  v_idx INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_signal_id IS NULL THEN
    RAISE EXCEPTION 'signal_id is required';
  END IF;

  SELECT * INTO v_signal
  FROM signals
  WHERE id = p_signal_id;

  IF v_signal.id IS NULL THEN
    RAISE EXCEPTION 'Signal not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = v_signal.org_id
      AND user_id = v_uid
      AND role IN ('owner', 'manager')
  ) THEN
    RAISE EXCEPTION 'Only owners and managers can promote external email signals';
  END IF;

  IF v_signal.subtype <> 'ingestion.external_email' THEN
    RAISE EXCEPTION 'Signal is not an external email';
  END IF;

  -- Idempotent: already converted → return linked intake rows
  IF v_signal.disposition = 'converted_to_record'
     AND v_signal.converted_entity_type = 'intake_item'
     AND v_signal.converted_entity_id IS NOT NULL THEN
    RETURN QUERY
    SELECT i.*
    FROM intake_items i
    WHERE i.org_id = v_signal.org_id
      AND (
        i.id = v_signal.converted_entity_id
        OR (
          jsonb_typeof(v_signal.payload->'attachment_paths') = 'array'
          AND i.storage_path IS NOT NULL
          AND i.storage_path IN (
            SELECT jsonb_array_elements_text(v_signal.payload->'attachment_paths')
          )
        )
      )
    ORDER BY i.created_at ASC;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Signal already converted but intake items were not found';
    END IF;
    RETURN;
  END IF;

  IF v_signal.disposition IN ('dismissed', 'converted_to_issue', 'converted_to_record')
     OR v_signal.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Signal already resolved';
  END IF;

  v_preview := NULLIF(left(COALESCE(v_signal.payload->>'preview', v_signal.body, ''), 4000), '');
  v_subject := NULLIF(trim(COALESCE(v_signal.payload->>'subject', v_signal.title, 'External email')), '');

  IF jsonb_typeof(v_signal.payload->'attachment_paths') = 'array' THEN
    SELECT COALESCE(array_agg(elem), ARRAY[]::TEXT[])
    INTO v_paths
    FROM jsonb_array_elements_text(v_signal.payload->'attachment_paths') AS elem
    WHERE NULLIF(trim(elem), '') IS NOT NULL;
  ELSE
    v_paths := ARRAY[]::TEXT[];
  END IF;

  IF coalesce(array_length(v_paths, 1), 0) = 0 THEN
    -- Text-only email
    INSERT INTO intake_items (
      org_id,
      created_by,
      source_type,
      status,
      storage_path,
      file_name,
      mime_type,
      file_size,
      raw_text
    )
    VALUES (
      v_signal.org_id,
      v_uid,
      'forwarded_email',
      'pending',
      NULL,
      COALESCE(left(v_subject, 120), 'External email'),
      'text/plain',
      NULL,
      COALESCE(v_preview, v_subject)
    )
    RETURNING * INTO v_row;

    v_first_id := v_row.id;

    UPDATE signals
    SET disposition = 'converted_to_record',
        review_state = 'none',
        resolved_at = now(),
        converted_entity_type = 'intake_item',
        converted_entity_id = v_first_id,
        updated_at = now()
    WHERE id = p_signal_id;

    INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
    VALUES (
      v_signal.org_id,
      v_uid,
      'signal',
      p_signal_id,
      'promoted_to_intake',
      jsonb_build_object('intake_item_id', v_first_id, 'attachment_count', 0)
    );

    RETURN NEXT v_row;
    RETURN;
  END IF;

  FOREACH v_path IN ARRAY v_paths
  LOOP
    v_idx := v_idx + 1;

    IF split_part(v_path, '/', 1) <> 'orgs'
       OR split_part(v_path, '/', 3) <> 'inbox'
       OR split_part(v_path, '/', 2)::uuid <> v_signal.org_id THEN
      RAISE EXCEPTION 'Invalid inbox storage path for org: %', v_path;
    END IF;

    BEGIN
      v_intake_id := NULLIF(split_part(v_path, '/', 4), '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_intake_id := NULL;
    END;

    v_file_name := NULLIF(substring(v_path from '[^/]+$'), '');
    IF v_file_name IS NULL OR v_file_name = '' THEN
      v_file_name := 'attachment';
    END IF;
    -- Strip timestamp prefix if present (123-name.ext)
    IF v_file_name ~ '^[0-9]+-' THEN
      v_file_name := regexp_replace(v_file_name, '^[0-9]+-', '');
    END IF;

    INSERT INTO intake_items (
      id,
      org_id,
      created_by,
      source_type,
      status,
      storage_path,
      file_name,
      mime_type,
      file_size,
      raw_text
    )
    VALUES (
      COALESCE(v_intake_id, gen_random_uuid()),
      v_signal.org_id,
      v_uid,
      'forwarded_email',
      'pending',
      v_path,
      v_file_name,
      NULL,
      NULL,
      CASE WHEN v_idx = 1 THEN v_preview ELSE NULL END
    )
    RETURNING * INTO v_row;

    IF v_first_id IS NULL THEN
      v_first_id := v_row.id;
    END IF;

    RETURN NEXT v_row;
  END LOOP;

  UPDATE signals
  SET disposition = 'converted_to_record',
      review_state = 'none',
      resolved_at = now(),
      converted_entity_type = 'intake_item',
      converted_entity_id = v_first_id,
      updated_at = now()
  WHERE id = p_signal_id;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_signal.org_id,
    v_uid,
    'signal',
    p_signal_id,
    'promoted_to_intake',
    jsonb_build_object(
      'intake_item_id', v_first_id,
      'attachment_count', coalesce(array_length(v_paths, 1), 0)
    )
  );

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION promote_external_email_signal(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION promote_external_email_signal(UUID) TO authenticated;
