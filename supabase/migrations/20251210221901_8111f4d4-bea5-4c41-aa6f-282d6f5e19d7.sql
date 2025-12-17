-- Fix validate_task_payload to use correct priority values: low, medium, high, urgent
CREATE OR REPLACE FUNCTION public.validate_task_payload(p_title text, p_priority text, p_space_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
        RAISE EXCEPTION 'Task title cannot be empty';
    END IF;

    IF p_priority IS NOT NULL AND p_priority NOT IN ('low', 'medium', 'high', 'urgent') THEN
        RAISE EXCEPTION 'Invalid priority';
    END IF;

    IF p_space_ids IS NOT NULL AND array_length(p_space_ids, 1) > 20 THEN
        RAISE EXCEPTION 'Too many spaces linked to task';
    END IF;
END;
$function$;