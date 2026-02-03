-- Fix task_image_annotations RLS to use tasks.org_id

DROP POLICY IF EXISTS "Users can read task image annotations"
ON task_image_annotations;

DROP POLICY IF EXISTS "Users can create task image annotations"
ON task_image_annotations;

DROP POLICY IF EXISTS "Users can update task image annotations"
ON task_image_annotations;

CREATE POLICY "Users can read task image annotations"
ON task_image_annotations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN organisation_members om ON om.org_id = t.org_id
    WHERE t.id = task_image_annotations.task_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create task image annotations"
ON task_image_annotations FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by AND
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN organisation_members om ON om.org_id = t.org_id
    WHERE t.id = task_image_annotations.task_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update task image annotations"
ON task_image_annotations FOR UPDATE
TO authenticated
USING (
  auth.uid() = created_by AND
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN organisation_members om ON om.org_id = t.org_id
    WHERE t.id = task_image_annotations.task_id
      AND om.user_id = auth.uid()
  )
);
