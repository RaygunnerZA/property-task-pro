-- Repair: idempotent schema for partial/legacy Filla-v2 remotes (gbtexoyvfpnduykmxunc).
-- Creates themes (+ migrate from groups), views, and organisation_members.assigned_properties.

-- ============================================================================
-- 1. organisation_members.assigned_properties
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organisation_members'
      AND column_name = 'assigned_properties'
  ) THEN
    ALTER TABLE organisation_members
      ADD COLUMN assigned_properties UUID[] DEFAULT ARRAY[]::UUID[];
  END IF;
END $$;

-- JWT helper used by RLS (no-op if already present)
CREATE OR REPLACE FUNCTION assigned_properties()
RETURNS UUID[] AS $$
DECLARE
  props JSONB;
BEGIN
  props := auth.jwt() -> 'assigned_properties';
  IF props IS NULL THEN
    RETURN ARRAY[]::UUID[];
  END IF;
  RETURN (
    SELECT ARRAY(
      SELECT jsonb_array_elements_text(props)::UUID
    )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 2. themes + task_themes (migrate from legacy groups / task_groups)
-- ============================================================================
CREATE TABLE IF NOT EXISTS themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  parent_id UUID REFERENCES themes(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('category', 'project', 'tag', 'group')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT themes_no_circular_parent CHECK (id IS DISTINCT FROM parent_id)
);

CREATE INDEX IF NOT EXISTS idx_themes_type ON themes(org_id, type);
CREATE INDEX IF NOT EXISTS idx_themes_org ON themes(org_id);

CREATE TABLE IF NOT EXISTS task_themes (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, theme_id)
);

CREATE INDEX IF NOT EXISTS idx_task_themes_task ON task_themes(task_id);
CREATE INDEX IF NOT EXISTS idx_task_themes_theme ON task_themes(theme_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'groups'
  ) THEN
    INSERT INTO themes (id, org_id, name, color, icon, type, created_at, updated_at)
    SELECT
      g.id,
      g.org_id,
      COALESCE(NULLIF(g.display_name, ''), g.name),
      g.color,
      g.icon,
      CASE
        WHEN g.category IS NOT NULL AND NULLIF(trim(g.category), '') IS NOT NULL THEN 'category'
        ELSE 'group'
      END,
      COALESCE(g.created_at, now()),
      COALESCE(g.updated_at, now())
    FROM groups g
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'task_groups'
  ) THEN
    INSERT INTO task_themes (task_id, theme_id)
    SELECT tg.task_id, tg.group_id
    FROM task_groups tg
    WHERE EXISTS (SELECT 1 FROM themes th WHERE th.id = tg.group_id)
    ON CONFLICT (task_id, theme_id) DO NOTHING;
  END IF;
END $$;

ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_themes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "themes_select" ON themes;
CREATE POLICY "themes_select" ON themes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM organisation_members om
    WHERE om.org_id = themes.org_id AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "themes_insert" ON themes;
CREATE POLICY "themes_insert" ON themes FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM organisation_members om
    WHERE om.org_id = themes.org_id AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "themes_update" ON themes;
CREATE POLICY "themes_update" ON themes FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM organisation_members om
    WHERE om.org_id = themes.org_id AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "themes_delete" ON themes;
CREATE POLICY "themes_delete" ON themes FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM organisation_members om
    WHERE om.org_id = themes.org_id AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "task_themes_select" ON task_themes;
CREATE POLICY "task_themes_select" ON task_themes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN organisation_members om ON om.org_id = t.org_id
    WHERE t.id = task_themes.task_id AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "task_themes_insert" ON task_themes;
CREATE POLICY "task_themes_insert" ON task_themes FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN organisation_members om ON om.org_id = t.org_id
    WHERE t.id = task_themes.task_id AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "task_themes_delete" ON task_themes;
CREATE POLICY "task_themes_delete" ON task_themes FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN organisation_members om ON om.org_id = t.org_id
    WHERE t.id = task_themes.task_id AND om.user_id = auth.uid()
  )
);

-- Optional milestones column (modern app types)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS milestones JSONB DEFAULT '[]'::jsonb;

-- ============================================================================
-- 3. properties_view (legacy-aware: optional assets, compliance_documents, spaces)
-- ============================================================================
DO $$
DECLARE
  v_has_assets boolean;
  v_has_compliance boolean;
  v_has_spaces boolean;
  v_has_archived boolean;
  v_assets_count text;
  v_expired_count text;
  v_valid_count text;
  v_spaces_count text;
  v_join_assets text := '';
  v_join_compliance text := '';
  v_join_spaces text := '';
  v_where text := '';
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'assets'
  ) INTO v_has_assets;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'compliance_documents'
  ) INTO v_has_compliance;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spaces'
  ) INTO v_has_spaces;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'properties'
      AND column_name = 'is_archived'
  ) INTO v_has_archived;

  IF v_has_assets THEN
    v_assets_count := 'COALESCE(COUNT(DISTINCT a.id), 0)::integer';
    v_join_assets := 'LEFT JOIN assets a ON a.property_id = p.id AND a.org_id = p.org_id';
  ELSE
    v_assets_count := '0::integer';
  END IF;

  IF v_has_compliance THEN
    v_expired_count := 'COALESCE(COUNT(DISTINCT cd.id) FILTER (WHERE cd.expiry_date < CURRENT_DATE), 0)::integer';
    v_valid_count := 'COALESCE(COUNT(DISTINCT cd.id) FILTER (WHERE cd.expiry_date >= CURRENT_DATE OR cd.expiry_date IS NULL), 0)::integer';
    v_join_compliance := 'LEFT JOIN compliance_documents cd ON cd.org_id = p.org_id';
  ELSE
    v_expired_count := '0::integer';
    v_valid_count := '0::integer';
  END IF;

  IF v_has_spaces THEN
    v_spaces_count := 'COALESCE(COUNT(DISTINCT s.id), 0)::integer';
    v_join_spaces := 'LEFT JOIN spaces s ON s.property_id = p.id AND s.org_id = p.org_id';
  ELSE
    v_spaces_count := '0::integer';
  END IF;

  IF v_has_archived THEN
    v_where := 'WHERE (p.is_archived = false OR p.is_archived IS NULL)';
  END IF;

  EXECUTE format(
    $sql$
    DROP VIEW IF EXISTS properties_view CASCADE;
    CREATE VIEW properties_view
    WITH (security_invoker = true)
    AS
    SELECT
      p.id,
      p.org_id,
      p.address,
      p.nickname,
      p.thumbnail_url,
      p.icon_name,
      p.icon_color_hex,
      p.owner_name,
      p.owner_email,
      p.contact_name,
      p.contact_email,
      p.contact_phone,
      p.created_at,
      p.updated_at,
      COALESCE(COUNT(DISTINCT t.id) FILTER (WHERE t.status IN ('open', 'in_progress')), 0)::integer AS open_tasks_count,
      %s AS assets_count,
      %s AS expired_compliance_count,
      %s AS valid_compliance_count,
      %s AS spaces_count
    FROM properties p
    LEFT JOIN tasks t ON t.property_id = p.id AND t.org_id = p.org_id
    %s
    %s
    %s
    %s
    GROUP BY
      p.id, p.org_id, p.address, p.nickname, p.thumbnail_url, p.icon_name, p.icon_color_hex,
      p.owner_name, p.owner_email, p.contact_name, p.contact_email, p.contact_phone,
      p.created_at, p.updated_at
    $sql$,
    v_assets_count,
    v_expired_count,
    v_valid_count,
    v_spaces_count,
    v_join_assets,
    v_join_compliance,
    v_join_spaces,
    v_where
  );
END $$;

-- ============================================================================
-- 4. tasks_view (legacy-aware: due_at/due_date, space_ids, teams, images)
-- ============================================================================
DO $$
DECLARE
  v_has_due_at boolean;
  v_has_due_date boolean;
  v_has_milestones boolean;
  v_has_space_ids boolean;
  v_has_spaces boolean;
  v_has_task_spaces boolean;
  v_has_assigned_team_ids boolean;
  v_has_task_teams boolean;
  v_has_teams boolean;
  v_has_image_url boolean;
  v_has_attachments boolean;
  v_has_assigned_user_id boolean;
  v_has_assignee_user_id boolean;
  v_due_expr text;
  v_assignee_expr text;
  v_milestones_expr text;
  v_spaces_expr text;
  v_teams_expr text;
  v_images_expr text;
  v_group_extra text := '';
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_at'
  ) INTO v_has_due_at;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_date'
  ) INTO v_has_due_date;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'milestones'
  ) INTO v_has_milestones;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'space_ids'
  ) INTO v_has_space_ids;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spaces'
  ) INTO v_has_spaces;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'task_spaces'
  ) INTO v_has_task_spaces;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'assigned_team_ids'
  ) INTO v_has_assigned_team_ids;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'task_teams'
  ) INTO v_has_task_teams;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'teams'
  ) INTO v_has_teams;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'image_url'
  ) INTO v_has_image_url;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'attachments'
  ) INTO v_has_attachments;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'assigned_user_id'
  ) INTO v_has_assigned_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'assignee_user_id'
  ) INTO v_has_assignee_user_id;

  IF v_has_due_at THEN
    v_due_expr := 't.due_at AS due_date';
  ELSIF v_has_due_date THEN
    v_due_expr := 't.due_date';
  ELSE
    v_due_expr := 'NULL::timestamptz AS due_date';
  END IF;

  IF v_has_assigned_user_id THEN
    v_assignee_expr := 't.assigned_user_id';
  ELSIF v_has_assignee_user_id THEN
    v_assignee_expr := 't.assignee_user_id AS assigned_user_id';
  ELSE
    v_assignee_expr := 'NULL::uuid AS assigned_user_id';
  END IF;

  IF v_has_milestones THEN
    v_milestones_expr := 'COALESCE(t.milestones, ''[]''::jsonb) AS milestones';
  ELSE
    v_milestones_expr := '''[]''::jsonb AS milestones';
  END IF;

  IF v_has_space_ids AND v_has_spaces THEN
    v_spaces_expr := $expr$
      COALESCE(
        (
          SELECT json_agg(DISTINCT jsonb_build_object('id', sp.id, 'name', sp.name))
          FROM unnest(COALESCE(t.space_ids, ARRAY[]::uuid[])) AS sid(space_id)
          JOIN spaces sp ON sp.id = sid.space_id AND sp.org_id = t.org_id
        ),
        '[]'::json
      ) AS spaces
    $expr$;
    v_group_extra := v_group_extra || ', t.space_ids';
  ELSIF v_has_task_spaces AND v_has_spaces THEN
    v_spaces_expr := $expr$
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('id', sp.id, 'name', sp.name))
          FILTER (WHERE sp.id IS NOT NULL),
        '[]'::json
      ) AS spaces
    $expr$;
  ELSE
    v_spaces_expr := '''[]''::json AS spaces';
  END IF;

  IF v_has_assigned_team_ids AND v_has_teams THEN
    v_teams_expr := $expr$
      COALESCE(
        (
          SELECT json_agg(DISTINCT jsonb_build_object(
            'id', tm.id, 'name', tm.name, 'color', tm.color, 'icon', tm.icon
          ))
          FROM unnest(COALESCE(t.assigned_team_ids, ARRAY[]::uuid[])) AS tid(team_id)
          JOIN teams tm ON tm.id = tid.team_id
        ),
        '[]'::json
      ) AS teams
    $expr$;
    v_group_extra := v_group_extra || ', t.assigned_team_ids';
  ELSIF v_has_task_teams AND v_has_teams THEN
    v_teams_expr := $expr$
      COALESCE(
        json_agg(DISTINCT jsonb_build_object(
          'id', tm.id, 'name', tm.name, 'color', tm.color, 'icon', tm.icon
        )) FILTER (WHERE tm.id IS NOT NULL),
        '[]'::json
      ) AS teams
    $expr$;
  ELSE
    v_teams_expr := '''[]''::json AS teams';
  END IF;

  IF v_has_image_url THEN
    v_images_expr := $expr$
      CASE
        WHEN t.image_url IS NOT NULL THEN json_build_array(jsonb_build_object('file_url', t.image_url))
        ELSE '[]'::json
      END AS images
    $expr$;
    v_group_extra := v_group_extra || ', t.image_url';
  ELSIF v_has_attachments THEN
    v_images_expr := $expr$
      COALESCE(
        json_agg(DISTINCT jsonb_build_object(
          'id', att.id,
          'file_url', att.file_url,
          'thumbnail_url', att.thumbnail_url,
          'file_name', att.file_name,
          'file_type', att.file_type
        )) FILTER (WHERE att.id IS NOT NULL),
        '[]'::json
      ) AS images
    $expr$;
  ELSE
    v_images_expr := '''[]''::json AS images';
  END IF;

  EXECUTE format(
    $sql$
    DROP VIEW IF EXISTS tasks_view CASCADE;
    CREATE VIEW tasks_view
    WITH (security_invoker = true)
    AS
    SELECT
      t.id,
      t.org_id,
      t.title,
      t.description,
      t.status,
      t.priority,
      %s,
      %s,
      %s,
      t.property_id,
      t.created_at,
      t.updated_at,
      p.nickname AS property_name,
      p.address AS property_address,
      p.thumbnail_url AS property_thumbnail_url,
      %s,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object(
          'id', th.id, 'name', th.name, 'color', th.color, 'icon', th.icon
        )) FILTER (WHERE th.id IS NOT NULL),
        '[]'::json
      ) AS themes,
      %s,
      %s
    FROM tasks t
    LEFT JOIN properties p ON p.id = t.property_id AND p.org_id = t.org_id
    %s
    %s
    LEFT JOIN task_themes tt ON tt.task_id = t.id
    LEFT JOIN themes th ON th.id = tt.theme_id AND th.org_id = t.org_id
    %s
    GROUP BY
      t.id, t.org_id, t.title, t.description, t.status, t.priority,
      %s,
      %s,
      t.property_id, t.created_at, t.updated_at%s,
      p.nickname, p.address, p.thumbnail_url
    $sql$,
    v_due_expr,
    v_milestones_expr,
    v_assignee_expr,
    v_spaces_expr,
    v_teams_expr,
    v_images_expr,
    CASE
      WHEN v_has_task_spaces AND v_has_spaces THEN
        'LEFT JOIN task_spaces ts ON ts.task_id = t.id LEFT JOIN spaces sp ON sp.id = ts.space_id AND sp.org_id = t.org_id'
      ELSE ''
    END,
    CASE
      WHEN v_has_task_teams AND v_has_teams THEN
        'LEFT JOIN task_teams ttm ON ttm.task_id = t.id LEFT JOIN teams tm ON tm.id = ttm.team_id AND tm.org_id = t.org_id'
      ELSE ''
    END,
    CASE
      WHEN v_has_attachments AND NOT v_has_image_url THEN
        'LEFT JOIN attachments att ON att.parent_id = t.id AND att.parent_type = ''task'' AND att.org_id = t.org_id'
      ELSE ''
    END,
    CASE
      WHEN v_has_due_at THEN 't.due_at'
      WHEN v_has_due_date THEN 't.due_date'
      ELSE 'NULL::timestamptz'
    END,
    CASE
      WHEN v_has_assigned_user_id THEN 't.assigned_user_id'
      WHEN v_has_assignee_user_id THEN 't.assignee_user_id'
      ELSE 'NULL::uuid'
    END,
    v_group_extra
  );
END $$;

-- ============================================================================
-- 5. Grants + PostgREST schema reload
-- ============================================================================
GRANT SELECT ON themes TO anon, authenticated;
GRANT SELECT ON task_themes TO anon, authenticated;
GRANT SELECT ON properties_view TO anon, authenticated;
GRANT SELECT ON tasks_view TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
