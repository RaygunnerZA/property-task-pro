-- Migration Step 10: Add icon + image support to teams
-- Purpose: Enable icon and avatar display for teams

ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS icon TEXT;

ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.teams.icon IS 'Icon for chip and UI representation.';
COMMENT ON COLUMN public.teams.image_url IS 'Optional team avatar or badge.';