-- Migration Step 22: Comprehensive tasks RLS with owner/assignee/team visibility

-- Drop existing policies
DROP POLICY IF EXISTS tasks_select ON public.tasks;
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
DROP POLICY IF EXISTS tasks_update ON public.tasks;
DROP POLICY IF EXISTS tasks_delete ON public.tasks;

-- SELECT — user may see a task if ANY is true:
-- 1. They own it (owner_user_id)
-- 2. Their team owns it (owner_team_id via teams.member_ids)
-- 3. They are assigned directly (assigned_user_id)
-- 4. They are a member of an assigned team
-- 5. They belong to the same org via property → org_id
-- 6. Contractor token path (existing)

CREATE POLICY tasks_select ON public.tasks
FOR SELECT USING (
  -- Owner user
  owner_user_id = auth.uid()

  OR

  -- Owner team
  owner_team_id IN (
    SELECT t.id FROM public.teams t
    WHERE t.org_id = current_org_id()
    AND auth.uid() = ANY(t.member_ids)
  )

  OR

  -- User is assigned
  assigned_user_id = auth.uid()

  OR

  -- User is in an assigned team
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.org_id = current_org_id()
    AND auth.uid() = ANY(t.member_ids)
    AND t.id = ANY(tasks.assigned_team_ids)
  )

  OR

  -- Org-wide visibility via property
  property_id IN (
    SELECT p.id FROM public.properties p
    WHERE p.org_id = current_org_id()
  )

  OR

  -- Contractor access token
  id IN (
    SELECT contractor_task_access.task_id
    FROM public.contractor_task_access
    WHERE contractor_task_access.contractor_token = current_contractor_token()
  )
);

-- INSERT — allowed if user is in org; owner_user_id defaults to auth.uid()

CREATE POLICY tasks_insert ON public.tasks
FOR INSERT WITH CHECK (
  owner_user_id = auth.uid()
  OR (owner_user_id IS NULL
  AND property_id IN (
    SELECT p.id FROM public.properties p
    WHERE p.org_id = current_org_id()
  ))
);

-- UPDATE — allowed if user is owner or owner-team member

CREATE POLICY tasks_update ON public.tasks
FOR UPDATE USING (
  owner_user_id = auth.uid()
  OR owner_team_id IN (
    SELECT t.id FROM public.teams t
    WHERE t.org_id = current_org_id()
    AND auth.uid() = ANY(t.member_ids)
  )
)
WITH CHECK (
  owner_user_id = auth.uid()
  OR owner_team_id IN (
    SELECT t.id FROM public.teams t
    WHERE t.org_id = current_org_id()
    AND auth.uid() = ANY(t.member_ids)
  )
);

-- DELETE — same authority as update

CREATE POLICY tasks_delete ON public.tasks
FOR DELETE USING (
  owner_user_id = auth.uid()
  OR owner_team_id IN (
    SELECT t.id FROM public.teams t
    WHERE t.org_id = current_org_id()
    AND auth.uid() = ANY(t.member_ids)
  )
);