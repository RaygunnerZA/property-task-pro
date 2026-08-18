-- Security Advisor: compliance_schedule_view (security invoker), RLS on internal/catalog tables,
-- tasks_select uses app_metadata.dev_mode (not user_metadata — users cannot self-escalate).

-- 1) View: run with invoker privileges (no privilege escalation via view owner)
ALTER VIEW public.compliance_schedule_view SET (security_invoker = true);

-- 2) brain_extract_pending — internal queue; only service role / triggers should touch it
ALTER TABLE public.brain_extract_pending ENABLE ROW LEVEL SECURITY;

-- 3) icon_library / icon_search_synonyms — global read-only catalog (no org scoping)
ALTER TABLE public.icon_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icon_search_synonyms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "icon_library_select_authenticated" ON public.icon_library;
CREATE POLICY "icon_library_select_authenticated"
  ON public.icon_library
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "icon_search_synonyms_select_authenticated" ON public.icon_search_synonyms;
CREATE POLICY "icon_search_synonyms_select_authenticated"
  ON public.icon_search_synonyms
  FOR SELECT
  TO authenticated
  USING (true);

-- 4) tasks: dev_mode from app_metadata (set only via service role / sync-dev-mode edge function)
DROP POLICY IF EXISTS "tasks_select" ON tasks;

CREATE POLICY "tasks_select" ON tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = tasks.org_id
        AND organisation_members.user_id = auth.uid()
    )
    AND (
      (
        (auth.jwt() -> 'app_metadata' ->> 'dev_mode') = 'true'
        OR (auth.jwt() -> 'app_metadata' -> 'dev_mode') = 'true'::jsonb
      )
      OR (auth.jwt() ->> 'role') != 'staff'
      OR (
        (auth.jwt() ->> 'role') = 'staff'
        AND (property_id IS NULL OR property_id = ANY(assigned_properties()))
      )
      OR (auth.jwt() ->> 'role') IS NULL
    )
  );
