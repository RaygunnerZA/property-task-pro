-- Collaborative task-image annotation layers (append-only edits).
-- Product: each save is a layer (avatar + time). Users cannot mutate others'
-- layers; editing an earlier layer supersedes it (is_enabled = false) and
-- inserts a new layer. @Docs/Schema_Discrepancy_Register.md — table was
-- referenced in app code but missing on live.

CREATE TABLE IF NOT EXISTS public.task_image_annotation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  image_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  version_number integer NOT NULL,
  label text,
  annotations jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- When false, layer is excluded from the default composite but remains viewable.
  is_enabled boolean NOT NULL DEFAULT true,
  supersedes_id uuid REFERENCES public.task_image_annotation_versions(id) ON DELETE SET NULL,
  CONSTRAINT task_image_annotation_versions_annotations_is_array
    CHECK (jsonb_typeof(annotations) = 'array'),
  CONSTRAINT task_image_annotation_versions_task_image_version_unique
    UNIQUE (task_id, image_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_task_image_annotation_versions_task_image
  ON public.task_image_annotation_versions (task_id, image_id, version_number);

CREATE INDEX IF NOT EXISTS idx_task_image_annotation_versions_org
  ON public.task_image_annotation_versions (org_id);

CREATE INDEX IF NOT EXISTS idx_task_image_annotation_versions_image
  ON public.task_image_annotation_versions (image_id);

COMMENT ON TABLE public.task_image_annotation_versions IS
  'Append-only annotation layers per task attachment image. Each row is one edit session.';

COMMENT ON COLUMN public.task_image_annotation_versions.image_id IS
  'attachments.id for the task image being annotated.';

COMMENT ON COLUMN public.task_image_annotation_versions.is_enabled IS
  'False when a later edit superseded this layer; still listed for viewing.';

COMMENT ON COLUMN public.task_image_annotation_versions.annotations IS
  'Delta shapes for this edit only (not a full cumulative snapshot).';

ALTER TABLE public.task_image_annotation_versions ENABLE ROW LEVEL SECURITY;

-- Active org members on the task may read layers.
DROP POLICY IF EXISTS task_image_annotation_versions_select ON public.task_image_annotation_versions;
CREATE POLICY task_image_annotation_versions_select
  ON public.task_image_annotation_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      JOIN public.organisation_members om
        ON om.org_id = t.org_id
       AND om.user_id = auth.uid()
       AND COALESCE(om.membership_status, 'active') = 'active'
      WHERE t.id = task_image_annotation_versions.task_id
        AND t.org_id = task_image_annotation_versions.org_id
    )
  );

-- Members may insert their own layers for images on tasks in their org.
DROP POLICY IF EXISTS task_image_annotation_versions_insert ON public.task_image_annotation_versions;
CREATE POLICY task_image_annotation_versions_insert
  ON public.task_image_annotation_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.tasks t
      JOIN public.organisation_members om
        ON om.org_id = t.org_id
       AND om.user_id = auth.uid()
       AND COALESCE(om.membership_status, 'active') = 'active'
      WHERE t.id = task_image_annotation_versions.task_id
        AND t.org_id = task_image_annotation_versions.org_id
    )
  );

-- Creator may update own row (e.g. same-session label). Org members may set
-- is_enabled when superseding an earlier layer they are replacing.
DROP POLICY IF EXISTS task_image_annotation_versions_update ON public.task_image_annotation_versions;
CREATE POLICY task_image_annotation_versions_update
  ON public.task_image_annotation_versions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      JOIN public.organisation_members om
        ON om.org_id = t.org_id
       AND om.user_id = auth.uid()
       AND COALESCE(om.membership_status, 'active') = 'active'
      WHERE t.id = task_image_annotation_versions.task_id
        AND t.org_id = task_image_annotation_versions.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      JOIN public.organisation_members om
        ON om.org_id = t.org_id
       AND om.user_id = auth.uid()
       AND COALESCE(om.membership_status, 'active') = 'active'
      WHERE t.id = task_image_annotation_versions.task_id
        AND t.org_id = task_image_annotation_versions.org_id
    )
  );

-- No DELETE policy — layers are append-only / soft-disabled via is_enabled.
