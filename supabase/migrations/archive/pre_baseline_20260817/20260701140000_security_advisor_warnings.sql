-- Security Advisor: search_path hardening, org insert RLS, pg_trgm schema,
-- revoke anon table/function exposure (GraphQL discoverability + RPC surface).

-- ============================================================================
-- 1) Pin search_path on slug / invitation helper functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_unique_org_slug(base text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate text := lower(regexp_replace(base, '[^a-zA-Z0-9]+', '-', 'g'));
  final_slug text := candidate;
  counter int := 1;
BEGIN
  WHILE EXISTS (SELECT 1 FROM public.organisations WHERE slug = final_slug) LOOP
    final_slug := candidate || '-' || counter;
    counter := counter + 1;
  END LOOP;

  RETURN final_slug;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_unique_slug(base text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_slug text := lower(regexp_replace(base, '[^a-zA-Z0-9]+', '-', 'g'));
  candidate text;
  counter int := 0;
BEGIN
  LOOP
    candidate := new_slug || CASE WHEN counter = 0 THEN '' ELSE '-' || counter END;

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.organisations WHERE slug = candidate
    );

    counter := counter + 1;
  END LOOP;

  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.organisations_slug_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF new.slug IS NULL OR new.slug = '' THEN
    new.slug := public.generate_unique_org_slug(new.name);
  END IF;

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_invitation_token()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  token text;
BEGIN
  token := encode(extensions.gen_random_bytes(24), 'base64url');
  RETURN token;
END;
$$;

-- ============================================================================
-- 2) organisations INSERT policy — require authenticated creator
-- ============================================================================

DROP POLICY IF EXISTS "org_insert" ON public.organisations;
DROP POLICY IF EXISTS "organisations_insert" ON public.organisations;

CREATE POLICY "org_insert" ON public.organisations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (created_by IS NULL OR created_by = auth.uid())
  );

-- ============================================================================
-- 3) Move pg_trgm out of public schema
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;

ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- ============================================================================
-- 4) Revoke anon SELECT on public tables/views (RLS still applies for authenticated)
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS obj
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'v', 'm', 'f')
  LOOP
    EXECUTE format('REVOKE SELECT ON %s FROM anon', r.obj);
  END LOOP;
END $$;

-- ============================================================================
-- 5) Revoke anon EXECUTE on SECURITY DEFINER RPCs (app uses authenticated JWT)
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS proc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.proc);
  END LOOP;
END $$;
