-- Simplify tasks RLS to check org_id directly like other tables
DROP POLICY IF EXISTS tasks_select ON public.tasks;
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
DROP POLICY IF EXISTS tasks_update ON public.tasks;
DROP POLICY IF EXISTS tasks_delete ON public.tasks;

-- Simple org-based RLS (consistent with other tables)
CREATE POLICY "tasks_select" ON public.tasks
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "tasks_insert" ON public.tasks
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "tasks_update" ON public.tasks
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "tasks_delete" ON public.tasks
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());