-- Fix set_subtask_org_from_task to use correct column name org_id instead of organisation_id
CREATE OR REPLACE FUNCTION public.set_subtask_org_from_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  -- Auto-inherit org_id from parent task if not provided
  IF NEW.org_id IS NULL THEN
    SELECT t.org_id
    INTO NEW.org_id
    FROM public.tasks AS t
    WHERE t.id = NEW.task_id;
  END IF;

  RETURN NEW;
END;
$function$;