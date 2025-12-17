-- Migration Step 16: Ensure annotations + versions fully supported

-- Support richer annotation data on image versions
ALTER TABLE public.task_image_versions
ADD COLUMN IF NOT EXISTS annotation_json JSONB DEFAULT '{}'::jsonb;

-- Support per-version AI metadata
ALTER TABLE public.task_image_versions
ADD COLUMN IF NOT EXISTS ai_metadata JSONB DEFAULT '{}'::jsonb;

-- Support extended action metadata for annotation tools
ALTER TABLE public.task_image_actions
ADD COLUMN IF NOT EXISTS extended_metadata JSONB DEFAULT '{}'::jsonb;

-- Improve lookup speed
CREATE INDEX IF NOT EXISTS idx_task_image_versions_task_image_id ON public.task_image_versions(task_image_id);
CREATE INDEX IF NOT EXISTS idx_task_image_actions_image_version_id ON public.task_image_actions(image_version_id);

-- Add comments
COMMENT ON COLUMN public.task_image_versions.annotation_json IS 'Stores annotation shapes, markers, and drawing data.';
COMMENT ON COLUMN public.task_image_versions.ai_metadata IS 'AI-generated metadata like captions, detected objects, etc.';
COMMENT ON COLUMN public.task_image_actions.extended_metadata IS 'Extended action metadata for annotation tools.';