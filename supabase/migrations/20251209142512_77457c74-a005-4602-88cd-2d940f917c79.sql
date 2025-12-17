-- Migration Step 19: Replace task_groups RLS with task-based lookup

-- Drop existing policies
DROP POLICY IF EXISTS task_groups_select ON public.task_groups;
DROP POLICY IF EXISTS task_groups_insert ON public.task_groups;
DROP POLICY IF EXISTS task_groups_update ON public.task_groups;
DROP POLICY IF EXISTS task_groups_delete ON public.task_groups;

-- Ensure RLS is enabled
ALTER TABLE public.task_groups ENABLE ROW LEVEL SECURITY;

-- SELECT
CREATE POLICY "tg_select" ON public.task_groups
FOR SELECT USING (
  task_id IN (
    SELECT id FROM public.tasks
    WHERE property_id IN (
      SELECT id FROM public.properties
      WHERE org_id = current_org_id()
    )
  )
);

-- INSERT
CREATE POLICY "tg_insert" ON public.task_groups
FOR INSERT WITH CHECK (
  task_id IN (
    SELECT id FROM public.tasks
    WHERE property_id IN (
      SELECT id FROM public.properties
      WHERE org_id = current_org_id()
    )
  )
);

-- UPDATE
CREATE POLICY "tg_update" ON public.task_groups
FOR UPDATE USING (
  task_id IN (
    SELECT id FROM public.tasks
    WHERE property_id IN (
      SELECT id FROM public.properties
      WHERE org_id = current_org_id()
    )
  )
);

-- DELETE
CREATE POLICY "tg_delete" ON public.task_groups
FOR DELETE USING (
  task_id IN (
    SELECT id FROM public.tasks
    WHERE property_id IN (
      SELECT id FROM public.properties
      WHERE org_id = current_org_id()
    )
  )
);