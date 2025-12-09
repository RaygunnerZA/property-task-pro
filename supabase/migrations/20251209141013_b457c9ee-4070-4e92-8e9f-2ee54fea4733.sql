-- Migration Step 5: Create checklist_templates + checklist_template_items tables
-- Purpose: Reusable checklist templates for task creation

-- 1. Create checklist_templates table
CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create checklist_template_items table
CREATE TABLE IF NOT EXISTS public.checklist_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_yes_no BOOLEAN DEFAULT FALSE,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create index for efficient template item lookups
CREATE INDEX IF NOT EXISTS idx_checklist_template_items_template_id 
  ON public.checklist_template_items(template_id);

-- 4. Enable RLS on both tables
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for checklist_templates (org-scoped, matching existing patterns)
CREATE POLICY checklist_templates_select ON public.checklist_templates
  FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY checklist_templates_insert ON public.checklist_templates
  FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY checklist_templates_update ON public.checklist_templates
  FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY checklist_templates_delete ON public.checklist_templates
  FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- 6. RLS policies for checklist_template_items (org-scoped, matching existing patterns)
CREATE POLICY checklist_template_items_select ON public.checklist_template_items
  FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY checklist_template_items_insert ON public.checklist_template_items
  FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY checklist_template_items_update ON public.checklist_template_items
  FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY checklist_template_items_delete ON public.checklist_template_items
  FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- 7. Add descriptive comments
COMMENT ON TABLE public.checklist_templates IS 'Reusable checklist templates for task creation.';
COMMENT ON TABLE public.checklist_template_items IS 'Individual items within a checklist template.';
COMMENT ON COLUMN public.checklist_template_items.is_yes_no IS 'If true, this item is a Yes/No verification question.';