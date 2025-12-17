-- Migration: Subtasks signature fields, templates, and helper functions

-- Add constraint: signature must have signed_by and signed_at (soft enforcement)
ALTER TABLE public.subtasks
DROP CONSTRAINT IF EXISTS subtasks_signature_valid;

ALTER TABLE public.subtasks
ADD CONSTRAINT subtasks_signature_valid CHECK (
    requires_signature = FALSE
    OR (signed_by IS NOT NULL AND signed_at IS NOT NULL)
) NOT VALID;

-- Make signature write safe
CREATE OR REPLACE FUNCTION public.subtask_sign(subtask UUID, user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.subtasks
    SET signed_by = user_id,
        signed_at = NOW()
    WHERE id = subtask;
END;
$$;

-- Remove signature
CREATE OR REPLACE FUNCTION public.subtask_unsign(subtask UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.subtasks
    SET signed_by = NULL,
        signed_at = NULL
    WHERE id = subtask;
END;
$$;

-- Add is_yes_no to checklist_templates if not exists
ALTER TABLE public.checklist_templates
ADD COLUMN IF NOT EXISTS is_yes_no BOOLEAN DEFAULT FALSE;

-- Update checklist_template_items RLS to use template chain
DROP POLICY IF EXISTS checklist_template_items_select ON public.checklist_template_items;
DROP POLICY IF EXISTS checklist_template_items_insert ON public.checklist_template_items;
DROP POLICY IF EXISTS checklist_template_items_update ON public.checklist_template_items;
DROP POLICY IF EXISTS checklist_template_items_delete ON public.checklist_template_items;

CREATE POLICY checklist_template_items_select ON public.checklist_template_items
FOR SELECT USING (
    template_id IN (SELECT id FROM public.checklist_templates WHERE org_id = current_org_id())
);

CREATE POLICY checklist_template_items_insert ON public.checklist_template_items
FOR INSERT WITH CHECK (
    template_id IN (SELECT id FROM public.checklist_templates WHERE org_id = current_org_id())
);

CREATE POLICY checklist_template_items_update ON public.checklist_template_items
FOR UPDATE USING (
    template_id IN (SELECT id FROM public.checklist_templates WHERE org_id = current_org_id())
);

CREATE POLICY checklist_template_items_delete ON public.checklist_template_items
FOR DELETE USING (
    template_id IN (SELECT id FROM public.checklist_templates WHERE org_id = current_org_id())
);

-- Add helper: duplicate template into subtasks
CREATE OR REPLACE FUNCTION public.apply_template_to_task(task UUID, template UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item RECORD;
BEGIN
    FOR item IN SELECT * FROM public.checklist_template_items WHERE template_id = template ORDER BY order_index LOOP
        INSERT INTO public.subtasks (id, org_id, task_id, title, is_yes_no, order_index, template_id)
        VALUES (
            gen_random_uuid(),
            current_org_id(),
            task,
            item.title,
            item.is_yes_no,
            item.order_index,
            template
        );
    END LOOP;
END;
$$;

-- Indexes for subtasks
CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON public.subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_template_id ON public.subtasks(template_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_signed_by ON public.subtasks(signed_by);