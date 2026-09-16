-- Restore task ↔ asset junction omitted from baseline (was in pre-baseline asset_database_v1).
-- Mirrors task_spaces / task_themes: RLS via org membership on the linked task.
-- INSERT also requires the asset to belong to the same org as the task (tenant isolation).

CREATE TABLE IF NOT EXISTS public.task_assets (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assets_task ON public.task_assets (task_id);
CREATE INDEX IF NOT EXISTS idx_task_assets_asset ON public.task_assets (asset_id);

ALTER TABLE public.task_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_assets_select ON public.task_assets;
CREATE POLICY task_assets_select ON public.task_assets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      JOIN public.organisation_members om
        ON om.org_id = t.org_id AND om.user_id = auth.uid()
      WHERE t.id = task_assets.task_id
    )
  );

DROP POLICY IF EXISTS task_assets_insert ON public.task_assets;
CREATE POLICY task_assets_insert ON public.task_assets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      JOIN public.organisation_members om
        ON om.org_id = t.org_id AND om.user_id = auth.uid()
      JOIN public.assets a
        ON a.id = task_assets.asset_id AND a.org_id = t.org_id
      WHERE t.id = task_assets.task_id
    )
  );

DROP POLICY IF EXISTS task_assets_delete ON public.task_assets;
CREATE POLICY task_assets_delete ON public.task_assets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      JOIN public.organisation_members om
        ON om.org_id = t.org_id AND om.user_id = auth.uid()
      WHERE t.id = task_assets.task_id
    )
  );

COMMENT ON TABLE public.task_assets IS 'Many-to-many: tasks ↔ assets.';
