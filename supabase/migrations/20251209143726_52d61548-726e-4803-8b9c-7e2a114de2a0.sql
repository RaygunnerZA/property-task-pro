-- Migration Steps 46-55: Groups enhancements

-- Step 46-50: Add columns
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS accent_color TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Step 51: Parent group FK (drop first if exists to avoid conflicts)
ALTER TABLE public.groups
DROP CONSTRAINT IF EXISTS groups_parent_group_fk;

ALTER TABLE public.groups
ADD CONSTRAINT groups_parent_group_fk
FOREIGN KEY (parent_group_id)
REFERENCES public.groups(id)
ON DELETE SET NULL;

-- Step 52: Unique constraint for (org_id, name)
ALTER TABLE public.groups
DROP CONSTRAINT IF EXISTS groups_org_name_unique;

ALTER TABLE public.groups
ADD CONSTRAINT groups_org_name_unique UNIQUE (org_id, name);

-- Step 53: Enable pg_trgm extension for trigram search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS groups_name_trgm_idx
ON public.groups
USING gin (name gin_trgm_ops);

-- Step 55: Unique index for org + slug
CREATE UNIQUE INDEX IF NOT EXISTS groups_org_slug_idx
ON public.groups (org_id, slug);