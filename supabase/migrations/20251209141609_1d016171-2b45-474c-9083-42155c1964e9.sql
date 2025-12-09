-- Migration Step 9: Add hierarchical spaces + icons
-- Purpose: Enable nested spaces and icon display

ALTER TABLE public.spaces
ADD COLUMN IF NOT EXISTS parent_space_id UUID REFERENCES public.spaces(id) ON DELETE SET NULL;

ALTER TABLE public.spaces
ADD COLUMN IF NOT EXISTS icon TEXT;

COMMENT ON COLUMN public.spaces.parent_space_id IS 'Optional parent for nested spaces.';
COMMENT ON COLUMN public.spaces.icon IS 'Icon used for chips and UI.';