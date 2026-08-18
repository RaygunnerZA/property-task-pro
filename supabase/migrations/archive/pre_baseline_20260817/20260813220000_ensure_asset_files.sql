-- Repair: asset_database_v1 was recorded as applied but asset_files was missing on remote.
-- Asset photo uploads write storage objects to task-images, then insert rows into asset_files.
-- RLS matches live assets policies (organisation_members), not legacy check_user_org_membership().

CREATE TABLE IF NOT EXISTS public.asset_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  file_url      TEXT NOT NULL,
  file_type     TEXT,  -- manual | certificate | photo | invoice
  thumbnail_url TEXT,
  uploaded_by   UUID REFERENCES auth.users(id),
  uploaded_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.asset_files ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_asset_files_asset ON public.asset_files(asset_id);

COMMENT ON TABLE public.asset_files IS
  'File references for assets (manuals, certificates, photos). Storage objects live in task-images.';
COMMENT ON COLUMN public.asset_files.thumbnail_url IS
  'URL to optimized thumbnail (WebP, ~200px) for list/card display.';

DROP POLICY IF EXISTS "asset_files_select" ON public.asset_files;
CREATE POLICY "asset_files_select" ON public.asset_files
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.assets a
      WHERE a.id = asset_files.asset_id
        AND a.org_id IN (
          SELECT om.org_id
          FROM public.organisation_members om
          WHERE om.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "asset_files_insert" ON public.asset_files;
CREATE POLICY "asset_files_insert" ON public.asset_files
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.assets a
      WHERE a.id = asset_files.asset_id
        AND a.org_id IN (
          SELECT om.org_id
          FROM public.organisation_members om
          WHERE om.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "asset_files_update" ON public.asset_files;
CREATE POLICY "asset_files_update" ON public.asset_files
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.assets a
      WHERE a.id = asset_files.asset_id
        AND a.org_id IN (
          SELECT om.org_id
          FROM public.organisation_members om
          WHERE om.user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.assets a
      WHERE a.id = asset_files.asset_id
        AND a.org_id IN (
          SELECT om.org_id
          FROM public.organisation_members om
          WHERE om.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "asset_files_delete" ON public.asset_files;
CREATE POLICY "asset_files_delete" ON public.asset_files
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.assets a
      WHERE a.id = asset_files.asset_id
        AND a.org_id IN (
          SELECT om.org_id
          FROM public.organisation_members om
          WHERE om.user_id = auth.uid()
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_files TO authenticated;
GRANT ALL ON public.asset_files TO service_role;
