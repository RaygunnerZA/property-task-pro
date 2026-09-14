-- Seasonal editorial packages over published Knowledge.
-- Knowledge = truth; package = curated presentation + timing.
-- In-app path: Knowledge → tip wording on items → package (SEO optional).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.seasonal_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  introduction text NOT NULL,
  season text NOT NULL,
  hemisphere text NOT NULL DEFAULT 'northern',
  display_from date NOT NULL,
  display_until date NOT NULL,
  urgency_band text NOT NULL DEFAULT 'timely',
  prep_window_label text,
  applicability jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  org_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT seasonal_packages_slug_unique UNIQUE (slug),
  CONSTRAINT seasonal_packages_season_check CHECK (
    season = ANY (ARRAY['spring'::text, 'summer'::text, 'autumn'::text, 'winter'::text])
  ),
  CONSTRAINT seasonal_packages_hemisphere_check CHECK (
    hemisphere = ANY (ARRAY['northern'::text, 'southern'::text, 'either'::text])
  ),
  CONSTRAINT seasonal_packages_urgency_check CHECK (
    urgency_band = ANY (ARRAY['timely'::text, 'evergreen'::text])
  ),
  CONSTRAINT seasonal_packages_status_check CHECK (
    status = ANY (ARRAY['draft'::text, 'approved'::text, 'archived'::text])
  ),
  CONSTRAINT seasonal_packages_window_check CHECK (display_until >= display_from),
  CONSTRAINT seasonal_packages_applicability_object CHECK (jsonb_typeof(applicability) = 'object'),
  CONSTRAINT seasonal_packages_version_positive CHECK (version >= 1)
);

COMMENT ON TABLE public.seasonal_packages IS
  'Thin editorial layer: selects and schedules published Knowledge for in-app seasonal guidance. Does not own independent factual claims.';

CREATE TABLE public.seasonal_package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.seasonal_packages(id) ON DELETE CASCADE,
  knowledge_id uuid NOT NULL REFERENCES public.knowledge(id) ON DELETE RESTRICT,
  tip_output_id uuid REFERENCES public.content_outputs(id) ON DELETE SET NULL,
  tip_text text NOT NULL,
  why_now text,
  cta_type text NOT NULL DEFAULT 'open_knowledge',
  cta_label text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seasonal_package_items_cta_check CHECK (
    cta_type = ANY (
      ARRAY[
        'create_task'::text,
        'upload_document'::text,
        'add_asset'::text,
        'open_knowledge'::text,
        'none'::text
      ]
    )
  ),
  CONSTRAINT seasonal_package_items_package_knowledge_unique UNIQUE (package_id, knowledge_id),
  CONSTRAINT seasonal_package_items_tip_nonempty CHECK (length(btrim(tip_text)) > 0),
  CONSTRAINT seasonal_package_items_cta_label_nonempty CHECK (length(btrim(cta_label)) > 0)
);

COMMENT ON TABLE public.seasonal_package_items IS
  'Ordered package tips. tip_text is presentation only; factual guardrail is the linked published Knowledge row.';

CREATE TABLE public.seasonal_package_user_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.seasonal_packages(id) ON DELETE CASCADE,
  package_version integer NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  dismissed_at timestamptz,
  cta_completions jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seasonal_package_user_state_unique UNIQUE (package_id, package_version, user_id, org_id),
  CONSTRAINT seasonal_package_user_state_cta_object CHECK (jsonb_typeof(cta_completions) = 'object'),
  CONSTRAINT seasonal_package_user_state_version_positive CHECK (package_version >= 1)
);

CREATE INDEX seasonal_packages_active_window_idx
  ON public.seasonal_packages (status, display_from, display_until)
  WHERE status = 'approved';

CREATE INDEX seasonal_package_items_package_order_idx
  ON public.seasonal_package_items (package_id, display_order);

CREATE INDEX seasonal_package_user_state_user_org_idx
  ON public.seasonal_package_user_state (user_id, org_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.seasonal_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_package_user_state ENABLE ROW LEVEL SECURITY;

-- Approved platform packages (org_id NULL) readable by any authenticated user.
-- Org packages readable only by members. Writes: platform admin only.
CREATE POLICY seasonal_packages_select ON public.seasonal_packages
  FOR SELECT TO authenticated
  USING (
    status = 'approved'
    AND (
      org_id IS NULL
      OR public.is_org_member(org_id)
    )
  );

CREATE POLICY seasonal_packages_admin_write ON public.seasonal_packages
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY seasonal_package_items_select ON public.seasonal_package_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.seasonal_packages p
      WHERE p.id = package_id
        AND p.status = 'approved'
        AND (p.org_id IS NULL OR public.is_org_member(p.org_id))
    )
  );

CREATE POLICY seasonal_package_items_admin_write ON public.seasonal_package_items
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY seasonal_package_user_state_select ON public.seasonal_package_user_state
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND public.is_org_member(org_id)
  );

CREATE POLICY seasonal_package_user_state_insert ON public.seasonal_package_user_state
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_org_member(org_id)
  );

CREATE POLICY seasonal_package_user_state_update ON public.seasonal_package_user_state
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND public.is_org_member(org_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_org_member(org_id)
  );

GRANT SELECT ON public.seasonal_packages TO authenticated;
GRANT SELECT ON public.seasonal_package_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.seasonal_package_user_state TO authenticated;
GRANT ALL ON public.seasonal_packages TO service_role;
GRANT ALL ON public.seasonal_package_items TO service_role;
GRANT ALL ON public.seasonal_package_user_state TO service_role;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_active_seasonal_packages(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_org_id IS NULL OR NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_org_member';
  END IF;

  SELECT COALESCE(jsonb_agg(pkg ORDER BY pkg ->> 'display_from' DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', p.id,
      'slug', p.slug,
      'title', p.title,
      'introduction', p.introduction,
      'season', p.season,
      'hemisphere', p.hemisphere,
      'display_from', p.display_from,
      'display_until', p.display_until,
      'urgency_band', p.urgency_band,
      'prep_window_label', p.prep_window_label,
      'applicability', p.applicability,
      'status', p.status,
      'version', p.version,
      'org_id', p.org_id,
      'items', COALESCE((
        SELECT jsonb_agg(
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
            'knowledge_summary', k.summary
          )
          ORDER BY i.display_order ASC, i.created_at ASC
        )
        FROM public.seasonal_package_items i
        INNER JOIN public.knowledge k ON k.id = i.knowledge_id
        WHERE i.package_id = p.id
          AND k.status = 'published'
          AND (
            (k.scope = 'platform')
            OR (k.scope = 'organisation' AND k.org_id = p_org_id)
          )
      ), '[]'::jsonb)
    ) AS pkg
    FROM public.seasonal_packages p
    WHERE p.status = 'approved'
      AND CURRENT_DATE BETWEEN p.display_from AND p.display_until
      AND (p.org_id IS NULL OR p.org_id = p_org_id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.seasonal_package_user_state s
        WHERE s.package_id = p.id
          AND s.package_version = p.version
          AND s.user_id = v_uid
          AND s.org_id = p_org_id
          AND s.dismissed_at IS NOT NULL
      )
  ) ranked;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.list_active_seasonal_packages(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_active_seasonal_packages(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.dismiss_seasonal_package(p_org_id uuid, p_package_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_version integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_org_id IS NULL OR NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_org_member';
  END IF;

  SELECT version INTO v_version
  FROM public.seasonal_packages
  WHERE id = p_package_id
    AND status = 'approved'
    AND (org_id IS NULL OR org_id = p_org_id);

  IF v_version IS NULL THEN
    RAISE EXCEPTION 'package_not_found';
  END IF;

  INSERT INTO public.seasonal_package_user_state (
    package_id, package_version, user_id, org_id, dismissed_at, updated_at
  )
  VALUES (p_package_id, v_version, v_uid, p_org_id, now(), now())
  ON CONFLICT (package_id, package_version, user_id, org_id)
  DO UPDATE SET
    dismissed_at = now(),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.dismiss_seasonal_package(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dismiss_seasonal_package(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_seasonal_package_cta(
  p_org_id uuid,
  p_package_id uuid,
  p_item_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_version integer;
  v_item_ok boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_org_id IS NULL OR NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_org_member';
  END IF;

  SELECT p.version INTO v_version
  FROM public.seasonal_packages p
  WHERE p.id = p_package_id
    AND p.status = 'approved'
    AND (p.org_id IS NULL OR p.org_id = p_org_id);

  IF v_version IS NULL THEN
    RAISE EXCEPTION 'package_not_found';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.seasonal_package_items i
    WHERE i.id = p_item_id
      AND i.package_id = p_package_id
  ) INTO v_item_ok;

  IF NOT v_item_ok THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  INSERT INTO public.seasonal_package_user_state (
    package_id, package_version, user_id, org_id, cta_completions, updated_at
  )
  VALUES (
    p_package_id,
    v_version,
    v_uid,
    p_org_id,
    jsonb_build_object(p_item_id::text, now()),
    now()
  )
  ON CONFLICT (package_id, package_version, user_id, org_id)
  DO UPDATE SET
    cta_completions = COALESCE(public.seasonal_package_user_state.cta_completions, '{}'::jsonb)
      || jsonb_build_object(p_item_id::text, now()),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.mark_seasonal_package_cta(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_seasonal_package_cta(uuid, uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Seed: autumn heating-season package + platform Knowledge (filla_curated)
-- Display window covers late summer → mid autumn (northern hemisphere).
-- ---------------------------------------------------------------------------

INSERT INTO public.knowledge (
  id, scope, status, org_id, title, summary, body, content, attributes, source_kind,
  trust_score, provenance, version, published_at, applicability
) VALUES
(
  'a1000000-0000-4000-8000-000000000001'::uuid,
  'platform',
  'published',
  NULL,
  'Service heating systems before the heating season',
  'Arrange a competent service for boilers and heating plant before cold weather arrives.',
  'Heating plant that sits idle over summer should be checked before the heating season. A service helps catch faults early and reduces mid-winter breakdowns.',
  '{}'::jsonb,
  jsonb_build_object(
    'category', 'maintenance',
    'action', 'Arrange a boiler or heating-system service',
    'timing', 'Before the heating season',
    'season', 'autumn',
    'applies_when', 'Property has a boiler or central heating'
  ),
  'filla_curated',
  0.9,
  jsonb_build_object('via', 'seasonal_package_seed', 'seed', 'autumn_2026'),
  1,
  now(),
  jsonb_build_object(
    'jurisdictions', '[]'::jsonb,
    'regions', '[]'::jsonb,
    'languages', jsonb_build_array('en'),
    'audiences', jsonb_build_array('owner', 'manager'),
    'unscoped', true
  )
),
(
  'a1000000-0000-4000-8000-000000000002'::uuid,
  'platform',
  'published',
  NULL,
  'Clear gutters where leaves accumulate',
  'Inspect and clear gutters and downpipes before autumn leaf fall blocks drainage.',
  'Blocked gutters can send water into walls, eaves and foundations. Clearing them before peak leaf fall reduces damp and access emergencies.',
  '{}'::jsonb,
  jsonb_build_object(
    'category', 'maintenance',
    'action', 'Inspect and clear gutters and downpipes',
    'timing', 'Late summer to early autumn',
    'season', 'autumn'
  ),
  'filla_curated',
  0.9,
  jsonb_build_object('via', 'seasonal_package_seed', 'seed', 'autumn_2026'),
  1,
  now(),
  jsonb_build_object(
    'jurisdictions', '[]'::jsonb,
    'regions', '[]'::jsonb,
    'languages', jsonb_build_array('en'),
    'audiences', jsonb_build_array('owner', 'manager', 'field'),
    'unscoped', true
  )
),
(
  'a1000000-0000-4000-8000-000000000003'::uuid,
  'platform',
  'published',
  NULL,
  'Test smoke and carbon monoxide alarms',
  'Test smoke and CO alarms and replace batteries or units that fail.',
  'Alarms should be tested regularly. Before the heating season is a practical reminder when heating and combustion appliances come back into heavier use.',
  '{}'::jsonb,
  jsonb_build_object(
    'category', 'safety',
    'action', 'Test smoke and carbon monoxide alarms',
    'timing', 'Before the heating season and at least annually',
    'season', 'autumn',
    'evidence', 'Record the test date'
  ),
  'filla_curated',
  0.9,
  jsonb_build_object('via', 'seasonal_package_seed', 'seed', 'autumn_2026'),
  1,
  now(),
  jsonb_build_object(
    'jurisdictions', '[]'::jsonb,
    'regions', '[]'::jsonb,
    'languages', jsonb_build_array('en'),
    'audiences', jsonb_build_array('owner', 'manager', 'field'),
    'unscoped', true
  )
),
(
  'a1000000-0000-4000-8000-000000000004'::uuid,
  'platform',
  'published',
  NULL,
  'Protect exposed pipework against freezing',
  'Insulate or protect exposed pipes and know where the stopcock is before freezing weather.',
  'Exposed pipework and poorly heated areas are vulnerable when temperatures drop. Knowing the stopcock location limits damage if a pipe fails.',
  '{}'::jsonb,
  jsonb_build_object(
    'category', 'resilience',
    'action', 'Insulate exposed pipes and confirm stopcock location',
    'timing', 'Before freezing weather',
    'season', 'autumn'
  ),
  'filla_curated',
  0.9,
  jsonb_build_object('via', 'seasonal_package_seed', 'seed', 'autumn_2026'),
  1,
  now(),
  jsonb_build_object(
    'jurisdictions', '[]'::jsonb,
    'regions', '[]'::jsonb,
    'languages', jsonb_build_array('en'),
    'audiences', jsonb_build_array('owner', 'manager', 'field'),
    'unscoped', true
  )
),
(
  'a1000000-0000-4000-8000-000000000005'::uuid,
  'platform',
  'published',
  NULL,
  'Keep heating certificates and service records filed',
  'File current heating and safety certificates so renewals are visible before they lapse.',
  'Certificates and service records belong in the property record store. Filing them early makes expiry and renewal planning possible.',
  '{}'::jsonb,
  jsonb_build_object(
    'category', 'records',
    'action', 'Upload current heating or safety certificates',
    'timing', 'When certificates are issued or before the heating season',
    'season', 'autumn'
  ),
  'filla_curated',
  0.9,
  jsonb_build_object('via', 'seasonal_package_seed', 'seed', 'autumn_2026'),
  1,
  now(),
  jsonb_build_object(
    'jurisdictions', '[]'::jsonb,
    'regions', '[]'::jsonb,
    'languages', jsonb_build_array('en'),
    'audiences', jsonb_build_array('owner', 'manager'),
    'unscoped', true
  )
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.knowledge_sources (knowledge_id, source_type, label, url, metadata)
VALUES
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'manual', 'Filla curated seasonal guidance', NULL, jsonb_build_object('seed', 'autumn_2026')),
  ('a1000000-0000-4000-8000-000000000002'::uuid, 'manual', 'Filla curated seasonal guidance', NULL, jsonb_build_object('seed', 'autumn_2026')),
  ('a1000000-0000-4000-8000-000000000003'::uuid, 'manual', 'Filla curated seasonal guidance', NULL, jsonb_build_object('seed', 'autumn_2026')),
  ('a1000000-0000-4000-8000-000000000004'::uuid, 'manual', 'Filla curated seasonal guidance', NULL, jsonb_build_object('seed', 'autumn_2026')),
  ('a1000000-0000-4000-8000-000000000005'::uuid, 'manual', 'Filla curated seasonal guidance', NULL, jsonb_build_object('seed', 'autumn_2026'));

INSERT INTO public.seasonal_packages (
  id, slug, title, introduction, season, hemisphere,
  display_from, display_until, urgency_band, prep_window_label,
  applicability, status, version, org_id, approved_at
) VALUES (
  'b1000000-0000-4000-8000-000000000001'::uuid,
  'before-autumn-heating-2026',
  '5 things to get done before Autumn',
  'Heating season is approaching. These steps help you prepare the property — they are guidance, not a claim about what is already missing.',
  'autumn',
  'northern',
  '2026-08-15'::date,
  '2026-10-31'::date,
  'timely',
  'Aug–Oct',
  jsonb_build_object(
    'jurisdictions', '[]'::jsonb,
    'regions', '[]'::jsonb,
    'languages', jsonb_build_array('en'),
    'audiences', jsonb_build_array('owner', 'manager'),
    'unscoped', true
  ),
  'approved',
  1,
  NULL,
  now()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.seasonal_package_items (
  id, package_id, knowledge_id, tip_text, why_now, cta_type, cta_label, display_order
) VALUES
(
  'c1000000-0000-4000-8000-000000000001'::uuid,
  'b1000000-0000-4000-8000-000000000001'::uuid,
  'a1000000-0000-4000-8000-000000000001'::uuid,
  'Book a heating-system service before cold weather.',
  'Plant that sat idle over summer is more likely to fail when first turned up.',
  'create_task',
  'Create service task',
  1
),
(
  'c1000000-0000-4000-8000-000000000002'::uuid,
  'b1000000-0000-4000-8000-000000000001'::uuid,
  'a1000000-0000-4000-8000-000000000002'::uuid,
  'Inspect and clear gutters where leaves collect.',
  'Early autumn is the last easy window before peak leaf fall.',
  'create_task',
  'Create gutter check',
  2
),
(
  'c1000000-0000-4000-8000-000000000003'::uuid,
  'b1000000-0000-4000-8000-000000000001'::uuid,
  'a1000000-0000-4000-8000-000000000003'::uuid,
  'Test smoke and carbon monoxide alarms.',
  'A useful reminder as heating and combustion appliances return to heavier use.',
  'create_task',
  'Log an alarm test',
  3
),
(
  'c1000000-0000-4000-8000-000000000004'::uuid,
  'b1000000-0000-4000-8000-000000000001'::uuid,
  'a1000000-0000-4000-8000-000000000004'::uuid,
  'Protect exposed pipes and confirm the stopcock location.',
  'Preparation is cheaper than freeze damage.',
  'add_asset',
  'Add heating or pipework asset',
  4
),
(
  'c1000000-0000-4000-8000-000000000005'::uuid,
  'b1000000-0000-4000-8000-000000000001'::uuid,
  'a1000000-0000-4000-8000-000000000005'::uuid,
  'File current heating and safety certificates in Records.',
  'Filing them now makes renewals visible later — absence of a file is not proof a certificate is missing.',
  'upload_document',
  'Upload a certificate',
  5
)
ON CONFLICT (package_id, knowledge_id) DO NOTHING;
