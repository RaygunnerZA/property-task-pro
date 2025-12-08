-- Fix RLS policies for properties table to prevent null org_id rows from being visible
-- Drop existing policies first
DROP POLICY IF EXISTS "properties_select" ON public.properties;
DROP POLICY IF EXISTS "properties_insert" ON public.properties;
DROP POLICY IF EXISTS "properties_update" ON public.properties;
DROP POLICY IF EXISTS "properties_delete" ON public.properties;

-- Recreate policies with explicit org_id IS NOT NULL check
CREATE POLICY "properties_select" ON public.properties
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "properties_insert" ON public.properties
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "properties_update" ON public.properties
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "properties_delete" ON public.properties
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- Also fix spaces table RLS if not already set
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spaces_select" ON public.spaces;
DROP POLICY IF EXISTS "spaces_insert" ON public.spaces;
DROP POLICY IF EXISTS "spaces_update" ON public.spaces;
DROP POLICY IF EXISTS "spaces_delete" ON public.spaces;

CREATE POLICY "spaces_select" ON public.spaces
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "spaces_insert" ON public.spaces
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "spaces_update" ON public.spaces
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "spaces_delete" ON public.spaces
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());