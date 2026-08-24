-- Knowledge attributes + ensure applicability/intake path for spreadsheet import.
-- Idempotent for environments missing the earlier applicability/intake migration.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.knowledge
  ADD COLUMN IF NOT EXISTS applicability jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.knowledge
  ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_attributes_is_object'
  ) THEN
    ALTER TABLE public.knowledge
      ADD CONSTRAINT knowledge_attributes_is_object
      CHECK (jsonb_typeof(attributes) = 'object');
  END IF;
END $$;

COMMENT ON COLUMN public.knowledge.applicability IS
  '{ jurisdictions, regions, languages, audiences, unscoped? }. Empty jurisdictions only when unscoped=true.';

COMMENT ON COLUMN public.knowledge.attributes IS
  'Type-specific structured facts (freeform object). Intake maps spreadsheet columns here; not fixed columns.';

CREATE INDEX IF NOT EXISTS knowledge_attributes_gin_idx
  ON public.knowledge USING gin (attributes);

-- ---------------------------------------------------------------------------
-- Normaliser
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_knowledge_applicability(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v jsonb := COALESCE(p, '{}'::jsonb);
  v_audiences text[];
BEGIN
  IF jsonb_typeof(v) <> 'object' THEN
    RAISE EXCEPTION 'applicability_must_be_object';
  END IF;

  v_audiences := ARRAY(
    SELECT DISTINCT lower(trim(x))
    FROM jsonb_array_elements_text(COALESCE(v->'audiences', '[]'::jsonb)) AS t(x)
    WHERE length(trim(x)) > 0
  );

  IF EXISTS (
    SELECT 1 FROM unnest(v_audiences) a
    WHERE a NOT IN ('owner', 'manager', 'field', 'tenant', 'public')
  ) THEN
    RAISE EXCEPTION 'invalid_applicability_audience';
  END IF;

  RETURN jsonb_build_object(
    'jurisdictions', COALESCE(
      (SELECT jsonb_agg(to_jsonb(trim(x)) ORDER BY trim(x))
       FROM jsonb_array_elements_text(COALESCE(v->'jurisdictions', '[]'::jsonb)) AS t(x)
       WHERE length(trim(x)) > 0),
      '[]'::jsonb
    ),
    'regions', COALESCE(
      (SELECT jsonb_agg(to_jsonb(trim(x)) ORDER BY trim(x))
       FROM jsonb_array_elements_text(COALESCE(v->'regions', '[]'::jsonb)) AS t(x)
       WHERE length(trim(x)) > 0),
      '[]'::jsonb
    ),
    'languages', COALESCE(
      (SELECT jsonb_agg(to_jsonb(trim(x)) ORDER BY trim(x))
       FROM jsonb_array_elements_text(COALESCE(v->'languages', '[]'::jsonb)) AS t(x)
       WHERE length(trim(x)) > 0),
      '[]'::jsonb
    ),
    'audiences', COALESCE(
      (SELECT jsonb_agg(to_jsonb(a) ORDER BY a) FROM unnest(v_audiences) AS a),
      '[]'::jsonb
    ),
    'unscoped', COALESCE((v->>'unscoped')::boolean, false)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_knowledge_attributes(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF p IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;
  IF jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'attributes_must_be_object';
  END IF;
  RETURN p;
END;
$$;

-- ---------------------------------------------------------------------------
-- Intake batches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_intake_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source_filename text,
  source_mime text,
  storage_bucket text,
  storage_path text,
  row_count integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'previewed'
    CHECK (status = ANY (ARRAY['previewed'::text, 'created'::text, 'failed'::text, 'archived'::text])),
  column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_intake_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_intake_batches_admin_all ON public.knowledge_intake_batches;
CREATE POLICY knowledge_intake_batches_admin_all ON public.knowledge_intake_batches
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

GRANT SELECT, INSERT, UPDATE ON public.knowledge_intake_batches TO authenticated;
GRANT ALL ON public.knowledge_intake_batches TO service_role;

-- ---------------------------------------------------------------------------
-- Intake batch create
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_knowledge_intake_batch(
  p_source_filename text,
  p_source_mime text DEFAULT NULL,
  p_storage_bucket text DEFAULT NULL,
  p_storage_path text DEFAULT NULL,
  p_row_count integer DEFAULT 0,
  p_column_mapping jsonb DEFAULT '{}'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.knowledge_intake_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.knowledge_intake_batches;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  INSERT INTO public.knowledge_intake_batches (
    created_by, source_filename, source_mime, storage_bucket, storage_path,
    row_count, column_mapping, metadata, status
  ) VALUES (
    auth.uid(), p_source_filename, p_source_mime, p_storage_bucket, p_storage_path,
    COALESCE(p_row_count, 0), COALESCE(p_column_mapping, '{}'::jsonb),
    COALESCE(p_metadata, '{}'::jsonb), 'previewed'
  )
  RETURNING * INTO v_row;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'knowledge_intake_batch',
    v_row.id,
    'admin.knowledge.intake_batch_created',
    jsonb_build_object('filename', p_source_filename, 'row_count', p_row_count)
  );

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Bulk candidates (stores attributes + sheet/row provenance)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_bulk_create_platform_knowledge_candidates(
  p_batch_id uuid,
  p_candidates jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_batch public.knowledge_intake_batches;
  v_item jsonb;
  v_row public.knowledge;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_count integer := 0;
  v_title text;
  v_applicability jsonb;
  v_attributes jsonb;
  v_max integer := 200;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  SELECT * INTO v_batch FROM public.knowledge_intake_batches WHERE id = p_batch_id;
  IF v_batch.id IS NULL THEN
    RAISE EXCEPTION 'intake_batch_not_found';
  END IF;

  IF jsonb_typeof(p_candidates) <> 'array' THEN
    RAISE EXCEPTION 'candidates_must_be_array';
  END IF;

  IF jsonb_array_length(p_candidates) = 0 THEN
    RAISE EXCEPTION 'candidates_empty';
  END IF;

  IF jsonb_array_length(p_candidates) > v_max THEN
    RAISE EXCEPTION 'candidates_exceed_max';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_candidates)
  LOOP
    v_title := nullif(trim(COALESCE(v_item->>'title', '')), '');
    IF v_title IS NULL THEN
      CONTINUE;
    END IF;

    v_applicability := public.normalize_knowledge_applicability(
      COALESCE(v_item->'applicability', '{}'::jsonb)
    );
    v_attributes := public.normalize_knowledge_attributes(
      COALESCE(v_item->'attributes', '{}'::jsonb)
    );

    IF (
      COALESCE(jsonb_array_length(v_applicability->'jurisdictions'), 0) = 0
      AND COALESCE((v_applicability->>'unscoped')::boolean, false) IS NOT TRUE
    ) THEN
      RAISE EXCEPTION 'applicability_required_for_candidate';
    END IF;

    INSERT INTO public.knowledge (
      scope, status, org_id, title, summary, body, content, attributes, source_kind,
      provenance, created_by, applicability
    ) VALUES (
      'platform',
      'candidate',
      NULL,
      v_title,
      nullif(trim(COALESCE(v_item->>'summary', '')), ''),
      nullif(trim(COALESCE(v_item->>'body', '')), ''),
      COALESCE(v_item->'content', '{}'::jsonb),
      v_attributes,
      'filla_curated',
      jsonb_build_object(
        'intake_batch_id', p_batch_id,
        'source_row', v_item->'source_row',
        'sheet_name', v_item->'sheet_name',
        'intake_provenance', COALESCE(v_item->'provenance', '{}'::jsonb),
        'via', 'admin_bulk_create_platform_knowledge_candidates'
      ),
      auth.uid(),
      v_applicability
    )
    RETURNING * INTO v_row;

    INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
    VALUES (
      v_row.id, NULL, 'candidate_created', auth.uid(),
      jsonb_build_object('source_kind', 'filla_curated', 'intake_batch_id', p_batch_id)
    );

    INSERT INTO public.knowledge_sources (
      knowledge_id, source_type, label, url, external_ref, metadata
    ) VALUES (
      v_row.id,
      CASE WHEN v_batch.storage_path IS NOT NULL THEN 'attachment' ELSE 'other' END,
      COALESCE(v_batch.source_filename, 'Intake upload'),
      nullif(trim(COALESCE(v_item #>> '{provenance,source_url}', '')), ''),
      p_batch_id::text,
      jsonb_build_object(
        'intake_batch_id', p_batch_id,
        'storage_bucket', v_batch.storage_bucket,
        'storage_path', v_batch.storage_path,
        'source_row', v_item->'source_row',
        'sheet_name', v_item->'sheet_name',
        'source_mime', v_batch.source_mime,
        'citation', v_item #>> '{provenance,citation}',
        'source_document', v_item #>> '{provenance,source_document}',
        'reviewed_date', v_item #>> '{provenance,reviewed_date}',
        'verification_status', v_item #>> '{provenance,verification_status}'
      )
    );

    v_ids := array_append(v_ids, v_row.id);
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'no_valid_candidates';
  END IF;

  UPDATE public.knowledge_intake_batches
  SET created_count = v_count, status = 'created', updated_at = now()
  WHERE id = p_batch_id;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'knowledge_intake_batch',
    p_batch_id,
    'admin.knowledge.intake_candidates_created',
    jsonb_build_object('created_count', v_count)
  );

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'created_count', v_count,
    'knowledge_ids', to_jsonb(v_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_knowledge_applicability(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_knowledge_attributes(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_create_knowledge_intake_batch(text, text, text, text, integer, jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_bulk_create_platform_knowledge_candidates(uuid, jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
