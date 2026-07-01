-- Security Advisor: anon inherits EXECUTE via PUBLIC on SECURITY DEFINER RPCs.
-- Revoke from PUBLIC; retain authenticated + service_role only.

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
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.proc);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.proc);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.proc);
  END LOOP;
END $$;
