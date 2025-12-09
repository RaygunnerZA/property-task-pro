-- Migration: checklist_template_items RLS, indexes, and view

-- Drop existing policies if any
DROP POLICY IF EXISTS checklist_template_items_select ON public.checklist_template_items;
DROP POLICY IF EXISTS checklist_template_items_insert ON public.checklist_template_items;
DROP POLICY IF EXISTS checklist_template_items_update ON public.checklist_template_items;
DROP POLICY IF EXISTS checklist_template_items_delete ON public.checklist_template_items;

-- SELECT
CREATE POLICY checklist_template_items_select ON public.checklist_template_items
FOR SELECT USING (
  org_id = current_org_id()
);

-- INSERT
CREATE POLICY checklist_template_items_insert ON public.checklist_template_items
FOR INSERT WITH CHECK (
  org_id = current_org_id()
);

-- UPDATE
CREATE POLICY checklist_template_items_update ON public.checklist_template_items
FOR UPDATE USING (
  org_id = current_org_id()
)
WITH CHECK (
  org_id = current_org_id()
);

-- DELETE
CREATE POLICY checklist_template_items_delete ON public.checklist_template_items
FOR DELETE USING (
  org_id = current_org_id()
);

-- Helper indexes for performance
CREATE INDEX IF NOT EXISTS checklist_templates_org_id_idx
  ON public.checklist_templates (org_id);

CREATE INDEX IF NOT EXISTS checklist_template_items_template_id_idx
  ON public.checklist_template_items (template_id);

CREATE INDEX IF NOT EXISTS checklist_template_items_org_id_idx
  ON public.checklist_template_items (org_id);

-- View to fetch templates with items ordered for UI
CREATE OR REPLACE VIEW public.checklist_templates_with_items AS
SELECT
  t.id AS template_id,
  t.org_id,
  t.name AS template_name,
  ti.id AS item_id,
  ti.title AS item_title,
  ti.is_yes_no,
  ti.order_index
FROM public.checklist_templates t
LEFT JOIN public.checklist_template_items ti
  ON ti.template_id = t.id
WHERE t.org_id = current_org_id()
ORDER BY t.id, ti.order_index;