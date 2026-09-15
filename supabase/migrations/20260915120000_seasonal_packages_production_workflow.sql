-- Seasonal packages production workflow:
-- 1) Demote seeded Autumn package to draft (customer gate = approved + window).
-- 2) Add surfaces + creative jsonb for distribution / image readiness.
-- 3) Allow package assets under knowledge-content-images/packages/...
-- 4) Platform-admin SECURITY DEFINER RPCs for list/get/upsert/approve/archive.

-- ---------------------------------------------------------------------------
-- Schema: surfaces + creative (presentation only; Knowledge remains truth)
-- ---------------------------------------------------------------------------

ALTER TABLE public.seasonal_packages
  ADD COLUMN IF NOT EXISTS surfaces jsonb NOT NULL DEFAULT '["home_inflow","property_rail"]'::jsonb,
  ADD COLUMN IF NOT EXISTS creative jsonb NOT NULL DEFAULT jsonb_build_object(
    'status', 'missing',
    'thumbnail_path', null,
    'square_path', null,
    'vertical_path', null,
    'horizontal_path', null,
    'alt_text', '',
    'focal_point', null
  );

ALTER TABLE public.seasonal_packages
  DROP CONSTRAINT IF EXISTS seasonal_packages_surfaces_array;
ALTER TABLE public.seasonal_packages
  ADD CONSTRAINT seasonal_packages_surfaces_array
  CHECK (jsonb_typeof(surfaces) = 'array');

ALTER TABLE public.seasonal_packages
  DROP CONSTRAINT IF EXISTS seasonal_packages_creative_object;
ALTER TABLE public.seasonal_packages
  ADD CONSTRAINT seasonal_packages_creative_object
  CHECK (jsonb_typeof(creative) = 'object');

COMMENT ON COLUMN public.seasonal_packages.surfaces IS
  'Intended in-app surfaces (home_inflow, property_rail, knowledge_library). Future channels may appear disabled in UI only.';
COMMENT ON COLUMN public.seasonal_packages.creative IS
  'Package image paths (knowledge-content-images) + alt/focal + status missing|draft|approved. Not factual Knowledge.';

-- ---------------------------------------------------------------------------
-- Immediate correction: Autumn seed must not be customer-visible
-- ---------------------------------------------------------------------------

UPDATE public.seasonal_packages
SET
  status = 'draft',
  approved_at = NULL,
  approved_by = NULL,
  updated_at = now(),
  surfaces = COALESCE(surfaces, '["home_inflow","property_rail"]'::jsonb),
  creative = COALESCE(
    creative,
    jsonb_build_object(
      'status', 'missing',
      'thumbnail_path', null,
      'square_path', null,
      'vertical_path', null,
      'horizontal_path', null,
      'alt_text', '',
      'focal_point', null
    )
  )
WHERE slug = 'before-autumn-heating-2026'
  AND status IS DISTINCT FROM 'draft';

-- ---------------------------------------------------------------------------
-- Storage: packages/{slug}/… under existing knowledge-content-images bucket
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Platform admins upload knowledge content images" ON storage.objects;
CREATE POLICY "Platform admins upload knowledge content images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'knowledge-content-images'
    AND public.is_platform_admin()
    AND split_part(name, '/', 1) IN ('content', 'packages')
  );

DROP POLICY IF EXISTS "Platform admins update knowledge content images" ON storage.objects;
CREATE POLICY "Platform admins update knowledge content images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'knowledge-content-images'
    AND public.is_platform_admin()
    AND split_part(name, '/', 1) IN ('content', 'packages')
  )
  WITH CHECK (
    bucket_id = 'knowledge-content-images'
    AND public.is_platform_admin()
    AND split_part(name, '/', 1) IN ('content', 'packages')
  );

DROP POLICY IF EXISTS "Platform admins delete knowledge content images" ON storage.objects;
CREATE POLICY "Platform admins delete knowledge content images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'knowledge-content-images'
    AND public.is_platform_admin()
    AND split_part(name, '/', 1) IN ('content', 'packages')
  );

-- ---------------------------------------------------------------------------
-- Helpers (approve gates)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.seasonal_package_assert_approvable(p_package_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pkg public.seasonal_packages;
  v_item public.seasonal_package_items;
  v_k public.knowledge;
  v_item_count int := 0;
  v_surfaces text[];
  v_need_library_image boolean := false;
  v_creative jsonb;
  v_status text;
  v_alt text;
  v_has_square boolean;
  v_has_horizontal boolean;
BEGIN
  SELECT * INTO v_pkg FROM public.seasonal_packages WHERE id = p_package_id;
  IF v_pkg.id IS NULL THEN
    RAISE EXCEPTION 'package_not_found';
  END IF;

  IF v_pkg.display_until < v_pkg.display_from THEN
    RAISE EXCEPTION 'invalid_display_window';
  END IF;

  IF length(btrim(v_pkg.title)) < 3 OR length(btrim(v_pkg.introduction)) < 12 THEN
    RAISE EXCEPTION 'foundation_incomplete';
  END IF;

  FOR v_item IN
    SELECT * FROM public.seasonal_package_items
    WHERE package_id = p_package_id
    ORDER BY display_order ASC
  LOOP
    v_item_count := v_item_count + 1;
    SELECT * INTO v_k FROM public.knowledge WHERE id = v_item.knowledge_id;
    IF v_k.id IS NULL OR v_k.status <> 'published' THEN
      RAISE EXCEPTION 'unpublished_knowledge';
    END IF;
    IF length(btrim(v_item.tip_text)) < 8 THEN
      RAISE EXCEPTION 'tip_incomplete';
    END IF;
    IF length(btrim(v_item.cta_label)) < 1 THEN
      RAISE EXCEPTION 'cta_incomplete';
    END IF;
    IF v_item.cta_type NOT IN (
      'create_task', 'upload_document', 'add_asset', 'open_knowledge', 'none'
    ) THEN
      RAISE EXCEPTION 'cta_invalid';
    END IF;
  END LOOP;

  IF v_item_count < 1 THEN
    RAISE EXCEPTION 'no_knowledge_items';
  END IF;

  SELECT COALESCE(array_agg(value #>> '{}'), ARRAY[]::text[])
  INTO v_surfaces
  FROM jsonb_array_elements(v_pkg.surfaces);

  v_need_library_image := 'knowledge_library' = ANY (v_surfaces);
  v_creative := COALESCE(v_pkg.creative, '{}'::jsonb);
  v_status := COALESCE(v_creative ->> 'status', 'missing');
  v_alt := COALESCE(btrim(v_creative ->> 'alt_text'), '');
  v_has_square := COALESCE(nullif(btrim(v_creative ->> 'square_path'), ''), NULL) IS NOT NULL;
  v_has_horizontal := COALESCE(nullif(btrim(v_creative ->> 'horizontal_path'), ''), NULL) IS NOT NULL;

  IF v_need_library_image THEN
    IF v_status <> 'approved' THEN
      RAISE EXCEPTION 'creative_required';
    END IF;
    IF NOT (v_has_square OR v_has_horizontal) THEN
      RAISE EXCEPTION 'creative_image_required';
    END IF;
    IF length(v_alt) < 3 THEN
      RAISE EXCEPTION 'creative_alt_required';
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.seasonal_package_assert_approvable(uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_list_seasonal_packages()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q.updated_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      p.id,
      p.slug,
      p.title,
      p.introduction,
      p.season,
      p.hemisphere,
      p.display_from,
      p.display_until,
      p.urgency_band,
      p.prep_window_label,
      p.applicability,
      p.status,
      p.version,
      p.org_id,
      p.surfaces,
      p.creative,
      p.approved_at,
      p.created_at,
      p.updated_at,
      (
        SELECT count(*)::int
        FROM public.seasonal_package_items i
        WHERE i.package_id = p.id
      ) AS item_count,
      (
        SELECT count(*)::int
        FROM public.seasonal_package_items i
        INNER JOIN public.knowledge k ON k.id = i.knowledge_id
        WHERE i.package_id = p.id
          AND k.status = 'published'
          AND length(btrim(i.tip_text)) >= 8
          AND length(btrim(i.cta_label)) >= 1
      ) AS items_ready_count
    FROM public.seasonal_packages p
  ) q;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_seasonal_package(p_package_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pkg public.seasonal_packages;
  v_items jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_pkg FROM public.seasonal_packages WHERE id = p_package_id;
  IF v_pkg.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'knowledge_id', i.knowledge_id,
      'tip_output_id', i.tip_output_id,
      'tip_text', i.tip_text,
      'why_now', i.why_now,
      'cta_type', i.cta_type,
      'cta_label', i.cta_label,
      'display_order', i.display_order,
      'knowledge_title', k.title,
      'knowledge_summary', k.summary,
      'knowledge_status', k.status,
      'knowledge_applicability', k.applicability
    )
    ORDER BY i.display_order ASC, i.created_at ASC
  ), '[]'::jsonb)
  INTO v_items
  FROM public.seasonal_package_items i
  LEFT JOIN public.knowledge k ON k.id = i.knowledge_id
  WHERE i.package_id = p_package_id;

  RETURN jsonb_build_object(
    'package', to_jsonb(v_pkg),
    'items', v_items
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_seasonal_package(
  p_package jsonb,
  p_items jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_slug text;
  v_row public.seasonal_packages;
  v_item jsonb;
  v_k public.knowledge;
  v_order int := 0;
  v_item_id uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  IF jsonb_typeof(p_package) <> 'object' THEN
    RAISE EXCEPTION 'invalid_package';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  v_id := NULLIF(p_package ->> 'id', '')::uuid;
  v_slug := lower(btrim(COALESCE(p_package ->> 'slug', '')));
  IF v_slug IS NULL OR length(v_slug) < 3 THEN
    RAISE EXCEPTION 'slug_required';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.seasonal_packages (
      slug, title, introduction, season, hemisphere,
      display_from, display_until, urgency_band, prep_window_label,
      applicability, surfaces, creative, status, version, org_id
    ) VALUES (
      v_slug,
      btrim(COALESCE(p_package ->> 'title', '')),
      btrim(COALESCE(p_package ->> 'introduction', '')),
      COALESCE(p_package ->> 'season', 'autumn'),
      COALESCE(p_package ->> 'hemisphere', 'northern'),
      COALESCE((p_package ->> 'display_from')::date, CURRENT_DATE),
      COALESCE((p_package ->> 'display_until')::date, CURRENT_DATE + 60),
      COALESCE(p_package ->> 'urgency_band', 'timely'),
      NULLIF(btrim(COALESCE(p_package ->> 'prep_window_label', '')), ''),
      COALESCE(p_package -> 'applicability', '{}'::jsonb),
      COALESCE(p_package -> 'surfaces', '["home_inflow","property_rail"]'::jsonb),
      COALESCE(
        p_package -> 'creative',
        jsonb_build_object(
          'status', 'missing',
          'thumbnail_path', null,
          'square_path', null,
          'vertical_path', null,
          'horizontal_path', null,
          'alt_text', '',
          'focal_point', null
        )
      ),
      'draft',
      1,
      NULLIF(p_package ->> 'org_id', '')::uuid
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.seasonal_packages
    SET
      slug = v_slug,
      title = btrim(COALESCE(p_package ->> 'title', title)),
      introduction = btrim(COALESCE(p_package ->> 'introduction', introduction)),
      season = COALESCE(p_package ->> 'season', season),
      hemisphere = COALESCE(p_package ->> 'hemisphere', hemisphere),
      display_from = COALESCE((p_package ->> 'display_from')::date, display_from),
      display_until = COALESCE((p_package ->> 'display_until')::date, display_until),
      urgency_band = COALESCE(p_package ->> 'urgency_band', urgency_band),
      prep_window_label = CASE
        WHEN p_package ? 'prep_window_label'
          THEN NULLIF(btrim(COALESCE(p_package ->> 'prep_window_label', '')), '')
        ELSE prep_window_label
      END,
      applicability = COALESCE(p_package -> 'applicability', applicability),
      surfaces = COALESCE(p_package -> 'surfaces', surfaces),
      creative = COALESCE(p_package -> 'creative', creative),
      updated_at = now()
    WHERE id = v_id
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
      RAISE EXCEPTION 'package_not_found';
    END IF;

    -- Editing an approved package returns it to draft for re-approval.
    IF v_row.status = 'approved' THEN
      UPDATE public.seasonal_packages
      SET status = 'draft', approved_at = NULL, approved_by = NULL, updated_at = now()
      WHERE id = v_row.id
      RETURNING * INTO v_row;
    END IF;
  END IF;

  DELETE FROM public.seasonal_package_items WHERE package_id = v_row.id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_order := v_order + 1;
    SELECT * INTO v_k
    FROM public.knowledge
    WHERE id = NULLIF(v_item ->> 'knowledge_id', '')::uuid;

    IF v_k.id IS NULL THEN
      RAISE EXCEPTION 'knowledge_not_found';
    END IF;
    IF v_k.status <> 'published' THEN
      RAISE EXCEPTION 'unpublished_knowledge';
    END IF;

    v_item_id := COALESCE(NULLIF(v_item ->> 'id', '')::uuid, gen_random_uuid());

    INSERT INTO public.seasonal_package_items (
      id, package_id, knowledge_id, tip_output_id, tip_text, why_now,
      cta_type, cta_label, display_order
    ) VALUES (
      v_item_id,
      v_row.id,
      v_k.id,
      NULLIF(v_item ->> 'tip_output_id', '')::uuid,
      btrim(COALESCE(v_item ->> 'tip_text', v_k.summary, v_k.title)),
      NULLIF(btrim(COALESCE(v_item ->> 'why_now', '')), ''),
      COALESCE(v_item ->> 'cta_type', 'open_knowledge'),
      btrim(COALESCE(v_item ->> 'cta_label', 'Open Knowledge')),
      COALESCE((v_item ->> 'display_order')::int, v_order)
    );
  END LOOP;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'seasonal_package',
    v_row.id,
    'admin.seasonal_package.upsert',
    jsonb_build_object('slug', v_row.slug, 'status', v_row.status)
  );

  RETURN public.admin_get_seasonal_package(v_row.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_seasonal_package(p_package_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.seasonal_packages;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  PERFORM public.seasonal_package_assert_approvable(p_package_id);

  UPDATE public.seasonal_packages
  SET
    status = 'approved',
    approved_at = now(),
    approved_by = auth.uid(),
    updated_at = now(),
    -- Re-approval from draft bumps version so prior dismissals do not stick.
    version = CASE
      WHEN status = 'draft' THEN version + 1
      ELSE version
    END
  WHERE id = p_package_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'package_not_found';
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'seasonal_package',
    v_row.id,
    'admin.seasonal_package.approve',
    jsonb_build_object(
      'slug', v_row.slug,
      'display_from', v_row.display_from,
      'display_until', v_row.display_until,
      'surfaces', v_row.surfaces
    )
  );

  RETURN public.admin_get_seasonal_package(v_row.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_archive_seasonal_package(p_package_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.seasonal_packages;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  UPDATE public.seasonal_packages
  SET status = 'archived', updated_at = now()
  WHERE id = p_package_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'package_not_found';
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'seasonal_package',
    v_row.id,
    'admin.seasonal_package.archive',
    jsonb_build_object('slug', v_row.slug)
  );

  RETURN public.admin_get_seasonal_package(v_row.id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_seasonal_packages() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_seasonal_package(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_upsert_seasonal_package(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_approve_seasonal_package(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_archive_seasonal_package(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_list_seasonal_packages() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_seasonal_package(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_upsert_seasonal_package(jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_approve_seasonal_package(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_archive_seasonal_package(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
