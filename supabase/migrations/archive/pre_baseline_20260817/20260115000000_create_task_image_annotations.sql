-- Create task_image_annotations table for image annotation system
-- Annotations are stored as JSONB with append-only versioning

CREATE TABLE IF NOT EXISTS task_image_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  image_id UUID NOT NULL, -- References task_images.id or attachments.id
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  annotations JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_task_image_annotations_task_image 
  ON task_image_annotations(task_id, image_id);

CREATE INDEX IF NOT EXISTS idx_task_image_annotations_image 
  ON task_image_annotations(image_id);

-- Enable RLS
ALTER TABLE task_image_annotations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read annotations for images in their org
CREATE POLICY "Users can read task image annotations"
ON task_image_annotations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN organisation_members om ON om.org_id = t.organisation_id
    WHERE t.id = task_image_annotations.task_id
      AND om.user_id = auth.uid()
  )
);

-- RLS Policy: Users can create annotations for images in their org
CREATE POLICY "Users can create task image annotations"
ON task_image_annotations FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by AND
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN organisation_members om ON om.org_id = t.organisation_id
    WHERE t.id = task_image_annotations.task_id
      AND om.user_id = auth.uid()
  )
);

-- RLS Policy: Users can update annotations they created (append-only)
CREATE POLICY "Users can update task image annotations"
ON task_image_annotations FOR UPDATE
TO authenticated
USING (
  auth.uid() = created_by AND
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN organisation_members om ON om.org_id = t.organisation_id
    WHERE t.id = task_image_annotations.task_id
      AND om.user_id = auth.uid()
  )
);
