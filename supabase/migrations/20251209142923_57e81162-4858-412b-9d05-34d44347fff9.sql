-- Migration Step 21: Update RLS policies for task_groups (replace existing)

-- 1. Drop existing policies
DROP POLICY IF EXISTS "task_groups_select" ON public.task_groups;
DROP POLICY IF EXISTS "task_groups_insert" ON public.task_groups;
DROP POLICY IF EXISTS "task_groups_update" ON public.task_groups;
DROP POLICY IF EXISTS "task_groups_delete" ON public.task_groups;
DROP POLICY IF EXISTS "tg_select" ON public.task_groups;
DROP POLICY IF EXISTS "tg_insert" ON public.task_groups;
DROP POLICY IF EXISTS "tg_update" ON public.task_groups;
DROP POLICY IF EXISTS "tg_delete" ON public.task_groups;

-- 2. SELECT policy
CREATE POLICY "task_groups_select"
ON public.task_groups
FOR SELECT
USING (
  task_id IN (
    SELECT t.id
    FROM public.tasks t
    JOIN public.properties p ON p.id = t.property_id
    WHERE p.org_id = current_org_id()
  )
);

-- 3. INSERT policy
CREATE POLICY "task_groups_insert"
ON public.task_groups
FOR INSERT
WITH CHECK (
  task_id IN (
    SELECT t.id
    FROM public.tasks t
    JOIN public.properties p ON p.id = t.property_id
    WHERE p.org_id = current_org_id()
  )
);

-- 4. UPDATE policy
CREATE POLICY "task_groups_update"
ON public.task_groups
FOR UPDATE
USING (
  task_id IN (
    SELECT t.id
    FROM public.tasks t
    JOIN public.properties p ON p.id = t.property_id
    WHERE p.org_id = current_org_id()
  )
)
WITH CHECK (
  task_id IN (
    SELECT t.id
    FROM public.tasks t
    JOIN public.properties p ON p.id = t.property_id
    WHERE p.org_id = current_org_id()
  )
);

-- 5. DELETE policy
CREATE POLICY "task_groups_delete"
ON public.task_groups
FOR DELETE
USING (
  task_id IN (
    SELECT t.id
    FROM public.tasks t
    JOIN public.properties p ON p.id = t.property_id
    WHERE p.org_id = current_org_id()
  )
);