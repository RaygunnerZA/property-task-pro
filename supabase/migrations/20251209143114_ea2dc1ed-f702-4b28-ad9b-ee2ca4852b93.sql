-- Migration: Update subtasks RLS to follow task visibility rules

-- Drop existing policies to replace them cleanly
DROP POLICY IF EXISTS subtasks_select ON public.subtasks;
DROP POLICY IF EXISTS subtasks_insert ON public.subtasks;
DROP POLICY IF EXISTS subtasks_update ON public.subtasks;
DROP POLICY IF EXISTS subtasks_delete ON public.subtasks;

-- SELECT — user may see a subtask if they may see the parent task
CREATE POLICY subtasks_select ON public.subtasks
FOR SELECT USING (
  task_id IN (
    SELECT t.id FROM public.tasks t
    LEFT JOIN public.teams tm ON tm.id = t.owner_team_id
    WHERE
      -- Owner user
      t.owner_user_id = auth.uid()

      OR

      -- Owner team
      (tm.org_id = current_org_id() AND auth.uid() = ANY(tm.member_ids))

      OR

      -- User is assigned directly
      t.assigned_user_id = auth.uid()

      OR

      -- User is in an assigned team
      EXISTS (
        SELECT 1 FROM public.teams tt
        WHERE tt.org_id = current_org_id()
        AND auth.uid() = ANY(tt.member_ids)
        AND tt.id = ANY(t.assigned_team_ids)
      )

      OR

      -- Org visibility via property
      t.property_id IN (
        SELECT p.id FROM public.properties p
        WHERE p.org_id = current_org_id()
      )

      OR

      -- Contractor token path
      t.id IN (
        SELECT contractor_task_access.task_id
        FROM public.contractor_task_access
        WHERE contractor_task_access.contractor_token = current_contractor_token()
      )
  )
);

-- INSERT — must satisfy same visibility as parent task
CREATE POLICY subtasks_insert ON public.subtasks
FOR INSERT WITH CHECK (
  task_id IN (
    SELECT t.id FROM public.tasks t
    LEFT JOIN public.teams tm ON tm.id = t.owner_team_id
    WHERE
      t.owner_user_id = auth.uid()
      OR (tm.org_id = current_org_id() AND auth.uid() = ANY(tm.member_ids))
  )
);

-- UPDATE — allowed if user owns the task or belongs to owner team
CREATE POLICY subtasks_update ON public.subtasks
FOR UPDATE USING (
  task_id IN (
    SELECT t.id FROM public.tasks t
    LEFT JOIN public.teams tm ON tm.id = t.owner_team_id
    WHERE
      t.owner_user_id = auth.uid()
      OR (tm.org_id = current_org_id() AND auth.uid() = ANY(tm.member_ids))
  )
)
WITH CHECK (
  task_id IN (
    SELECT t.id FROM public.tasks t
    LEFT JOIN public.teams tm ON tm.id = t.owner_team_id
    WHERE
      t.owner_user_id = auth.uid()
      OR (tm.org_id = current_org_id() AND auth.uid() = ANY(tm.member_ids))
  )
);

-- DELETE — same authority as update
CREATE POLICY subtasks_delete ON public.subtasks
FOR DELETE USING (
  task_id IN (
    SELECT t.id FROM public.tasks t
    LEFT JOIN public.teams tm ON tm.id = t.owner_team_id
    WHERE
      t.owner_user_id = auth.uid()
      OR (tm.org_id = current_org_id() AND auth.uid() = ANY(tm.member_ids))
  )
);