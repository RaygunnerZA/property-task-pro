-- Fix task_groups RLS to check org_id directly instead of via tasks->properties chain
DROP POLICY IF EXISTS task_groups_select ON public.task_groups;
DROP POLICY IF EXISTS task_groups_insert ON public.task_groups;
DROP POLICY IF EXISTS task_groups_update ON public.task_groups;
DROP POLICY IF EXISTS task_groups_delete ON public.task_groups;

CREATE POLICY "task_groups_select" ON public.task_groups
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "task_groups_insert" ON public.task_groups
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "task_groups_update" ON public.task_groups
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "task_groups_delete" ON public.task_groups
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());