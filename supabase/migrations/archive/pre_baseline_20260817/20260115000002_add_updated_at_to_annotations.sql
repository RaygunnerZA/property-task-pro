-- Add updated_at column to task_image_annotations table
-- Auto-updates on any annotation change

ALTER TABLE task_image_annotations 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_annotation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_image_annotations_updated_at ON task_image_annotations;
CREATE TRIGGER task_image_annotations_updated_at
BEFORE UPDATE ON task_image_annotations
FOR EACH ROW
EXECUTE FUNCTION update_annotation_updated_at();
