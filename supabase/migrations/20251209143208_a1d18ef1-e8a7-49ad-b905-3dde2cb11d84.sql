-- Migration: Update checklist_templates RLS for org-scoped access

-- Drop existing policies if any
DROP POLICY IF EXISTS checklist_templates_select ON public.checklist_templates;
DROP POLICY IF EXISTS checklist_templates_insert ON public.checklist_templates;
DROP POLICY IF EXISTS checklist_templates_update ON public.checklist_templates;
DROP POLICY IF EXISTS checklist_templates_delete ON public.checklist_templates;

-- SELECT — user can see templates from their org
CREATE POLICY checklist_templates_select ON public.checklist_templates
FOR SELECT USING (
  org_id = current_org_id()
);

-- INSERT — user can create templates in their org
CREATE POLICY checklist_templates_insert ON public.checklist_templates
FOR INSERT WITH CHECK (
  org_id = current_org_id()
);

-- UPDATE — user may update templates only within org
CREATE POLICY checklist_templates_update ON public.checklist_templates
FOR UPDATE USING (
  org_id = current_org_id()
)
WITH CHECK (
  org_id = current_org_id()
);

-- DELETE — same authority
CREATE POLICY checklist_templates_delete ON public.checklist_templates
FOR DELETE USING (
  org_id = current_org_id()
);