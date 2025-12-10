-- Fix current_org_id() to read org_id from app_metadata where Supabase actually stores it
CREATE OR REPLACE FUNCTION public.current_org_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT nullif(
      (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'org_id'),
      ''
  )::uuid;
$function$;