-- Migration: Checklist templates with locking and helper functions

-- Add columns to checklist_templates
ALTER TABLE public.checklist_templates
ADD COLUMN IF NOT EXISTS icon TEXT,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- Add requires_signature to template items
ALTER TABLE public.checklist_template_items
ADD COLUMN IF NOT EXISTS requires_signature BOOLEAN DEFAULT FALSE;

-- Update checklist_templates RLS with lock protection
DROP POLICY IF EXISTS checklist_templates_select ON public.checklist_templates;
DROP POLICY IF EXISTS checklist_templates_insert ON public.checklist_templates;
DROP POLICY IF EXISTS checklist_templates_update ON public.checklist_templates;
DROP POLICY IF EXISTS checklist_templates_delete ON public.checklist_templates;

CREATE POLICY checklist_templates_select ON public.checklist_templates
FOR SELECT USING (org_id = current_org_id());

CREATE POLICY checklist_templates_insert ON public.checklist_templates
FOR INSERT WITH CHECK (org_id = current_org_id());

CREATE POLICY checklist_templates_update ON public.checklist_templates
FOR UPDATE USING (org_id = current_org_id() AND is_locked = FALSE);

CREATE POLICY checklist_templates_delete ON public.checklist_templates
FOR DELETE USING (org_id = current_org_id() AND is_locked = FALSE);

CREATE INDEX IF NOT EXISTS idx_templates_org ON public.checklist_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_templates_locked ON public.checklist_templates(is_locked);

-- Update template_items RLS
DROP POLICY IF EXISTS template_items_select ON public.checklist_template_items;
DROP POLICY IF EXISTS template_items_insert ON public.checklist_template_items;
DROP POLICY IF EXISTS template_items_update ON public.checklist_template_items;
DROP POLICY IF EXISTS template_items_delete ON public.checklist_template_items;

CREATE POLICY template_items_select ON public.checklist_template_items
FOR SELECT USING (template_id IN (SELECT id FROM public.checklist_templates WHERE org_id = current_org_id()));

CREATE POLICY template_items_insert ON public.checklist_template_items
FOR INSERT WITH CHECK (template_id IN (SELECT id FROM public.checklist_templates WHERE org_id = current_org_id()));

CREATE POLICY template_items_update ON public.checklist_template_items
FOR UPDATE USING (template_id IN (SELECT id FROM public.checklist_templates WHERE org_id = current_org_id()));

CREATE POLICY template_items_delete ON public.checklist_template_items
FOR DELETE USING (template_id IN (SELECT id FROM public.checklist_templates WHERE org_id = current_org_id()));

CREATE INDEX IF NOT EXISTS idx_template_items_order ON public.checklist_template_items(order_index);

-- FUNCTION: CLONE TEMPLATE → SUBTASKS FOR A TASK
CREATE OR REPLACE FUNCTION public.apply_checklist_template(p_task UUID, p_template UUID, p_org UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    i RECORD;
    new_subtask UUID;
BEGIN
    FOR i IN
        SELECT id, title, is_yes_no, requires_signature, order_index
        FROM public.checklist_template_items
        WHERE template_id = p_template
        ORDER BY order_index ASC
    LOOP
        INSERT INTO public.subtasks (
            task_id,
            org_id,
            title,
            is_completed,
            is_yes_no,
            requires_signature,
            order_index,
            template_id
        ) VALUES (
            p_task,
            p_org,
            i.title,
            FALSE,
            i.is_yes_no,
            i.requires_signature,
            i.order_index,
            p_template
        )
        RETURNING id INTO new_subtask;
    END LOOP;
END;
$$;

-- FUNCTION: CREATE TEMPLATE FROM EXISTING TASK
CREATE OR REPLACE FUNCTION public.create_template_from_task(p_task UUID, p_org UUID, p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    t UUID;
    s RECORD;
BEGIN
    INSERT INTO public.checklist_templates (org_id, name, created_by)
    VALUES (p_org, p_name, auth.uid())
    RETURNING id INTO t;

    FOR s IN
        SELECT title, is_yes_no, requires_signature, order_index
        FROM public.subtasks
        WHERE task_id = p_task AND org_id = p_org
        ORDER BY order_index ASC
    LOOP
        INSERT INTO public.checklist_template_items (
            template_id,
            title,
            is_yes_no,
            requires_signature,
            order_index
        )
        VALUES (t, s.title, s.is_yes_no, s.requires_signature, s.order_index);
    END LOOP;

    RETURN t;
END;
$$;

-- FUNCTION: LOCK TEMPLATE
CREATE OR REPLACE FUNCTION public.lock_checklist_template(p_template UUID, p_org UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    UPDATE public.checklist_templates
    SET is_locked = TRUE
    WHERE id = p_template AND org_id = p_org;
END;
$$;

-- FUNCTION: UNLOCK TEMPLATE
CREATE OR REPLACE FUNCTION public.unlock_checklist_template(p_template UUID, p_org UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    UPDATE public.checklist_templates
    SET is_locked = FALSE
    WHERE id = p_template AND org_id = p_org;
END;
$$;

-- Index for subtasks template lookup
CREATE INDEX IF NOT EXISTS idx_subtasks_template ON public.subtasks(template_id);