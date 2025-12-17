-- Migration Step 20: Update tasks RLS with owner fields using member_ids array

-- Drop existing policies
DROP POLICY IF EXISTS tasks_select ON public.tasks;
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
DROP POLICY IF EXISTS tasks_update ON public.tasks;
DROP POLICY IF EXISTS tasks_delete ON public.tasks;

-- SELECT: property-based OR owner visibility
CREATE POLICY "tasks_select" ON public.tasks
FOR SELECT USING (
  -- Property-based visibility (existing pattern)
  (property_id IN (
    SELECT id FROM public.properties
    WHERE org_id = current_org_id()
  ))
  OR
  -- Direct user ownership
  (owner_user_id = auth.uid())
  OR
  -- Team ownership via member_ids array
  (owner_team_id IN (
    SELECT id FROM public.teams
    WHERE auth.uid() = ANY(member_ids)
  ))
  OR
  -- Contractor access
  (id IN (
    SELECT task_id FROM public.contractor_task_access
    WHERE contractor_token = current_contractor_token()
  ))
);

-- INSERT: property-based only
CREATE POLICY "tasks_insert" ON public.tasks
FOR INSERT WITH CHECK (
  property_id IN (
    SELECT id FROM public.properties
    WHERE org_id = current_org_id()
  )
);

-- UPDATE: property-based OR owner
CREATE POLICY "tasks_update" ON public.tasks
FOR UPDATE USING (
  (property_id IN (
    SELECT id FROM public.properties
    WHERE org_id = current_org_id()
  ))
  OR
  (owner_user_id = auth.uid())
  OR
  (owner_team_id IN (
    SELECT id FROM public.teams
    WHERE auth.uid() = ANY(member_ids)
  ))
  OR
  (id IN (
    SELECT task_id FROM public.contractor_task_access
    WHERE contractor_token = current_contractor_token()
  ))
);

-- DELETE: property-based OR owner
CREATE POLICY "tasks_delete" ON public.tasks
FOR DELETE USING (
  (property_id IN (
    SELECT id FROM public.properties
    WHERE org_id = current_org_id()
  ))
  OR
  (owner_user_id = auth.uid())
  OR
  (owner_team_id IN (
    SELECT id FROM public.teams
    WHERE auth.uid() = ANY(member_ids)
  ))
);