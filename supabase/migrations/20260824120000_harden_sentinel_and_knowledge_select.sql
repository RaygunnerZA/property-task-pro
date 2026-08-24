-- Harden sentinel + Knowledge SELECT boundaries raised in PR review.
-- 1) organisations_slug_lookup is USING (true) for invite/slug checks — exclude the
--    platform sentinel so `_platform` is never client-readable via that open policy.
-- 2) Re-assert knowledge SELECT: platform rows only when published (candidates stay
--    admin-RPC-only). Org rows remain member-scoped.

DROP POLICY IF EXISTS organisations_slug_lookup ON public.organisations;
CREATE POLICY organisations_slug_lookup ON public.organisations
  FOR SELECT
  USING (id <> '00000000-0000-0000-0000-000000000000'::uuid);

DROP POLICY IF EXISTS knowledge_select_org ON public.knowledge;
CREATE POLICY knowledge_select_org ON public.knowledge
  FOR SELECT
  TO authenticated
  USING (
    (
      scope = 'organisation'::text
      AND org_id IS NOT NULL
      AND public.is_org_member(org_id)
    )
    OR (
      scope = 'platform'::text
      AND status = 'published'::text
    )
  );

COMMENT ON POLICY knowledge_select_org ON public.knowledge IS
  'Org members see own org Knowledge; any authenticated member sees platform Knowledge only when status=published. Candidates/verified/stale/archived platform rows are not client-selectable — use admin SECURITY DEFINER RPCs.';
