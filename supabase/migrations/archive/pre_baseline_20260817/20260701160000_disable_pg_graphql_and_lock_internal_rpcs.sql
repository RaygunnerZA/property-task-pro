-- This app uses PostgREST (supabase-js), not the GraphQL API.
-- Dropping pg_graphql clears pg_graphql_*_table_exposed advisor warnings.
-- Revoke authenticated EXECUTE on cron/edge-only SECURITY DEFINER RPCs.

DROP EXTENSION IF EXISTS pg_graphql;

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
      AND p.proname = ANY (ARRAY[
        'expire_old_invitations',
        'expire_stale_environmental_signals',
        'process_all_recurrences',
        'process_escalations',
        'handle_new_organisation',
        'trigger_seed_property_defaults',
        'emit_signal',
        'generate_recurring_task_instance',
        'purge_completed_tasks',
        'resolve_org_by_intake_email_token',
        'match_org_member_by_email',
        'create_intake_item_from_email',
        'create_intake_item_from_calendar_event',
        'create_intake_item_from_cloud_file',
        'create_compliance_task',
        'create_task_full',
        'apply_template_to_task',
        'save_ai_extraction',
        'task_set_ai_metadata',
        'task_set_repeat_rule',
        'update_thread_ai_summary',
        'get_invitation_by_token'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.proc);
  END LOOP;
END $$;
