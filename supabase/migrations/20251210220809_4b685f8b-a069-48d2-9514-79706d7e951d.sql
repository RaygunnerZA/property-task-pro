-- Fix create_task_safe to default to 'medium' instead of 'normal'
CREATE OR REPLACE FUNCTION public.create_task_safe(p_org uuid, p_property uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    t UUID;
    v_space_ids UUID[];
    v_team_ids UUID[];
    v_group_ids UUID[];
BEGIN
    -- Parse arrays safely
    SELECT ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'space_ids', '[]'::jsonb)))::UUID[]
    INTO v_space_ids;
    
    SELECT ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'assigned_team_ids', '[]'::jsonb)))::UUID[]
    INTO v_team_ids;
    
    SELECT ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'groups', '[]'::jsonb)))::UUID[]
    INTO v_group_ids;

    PERFORM public.validate_task_payload(
        p_payload->>'title',
        p_payload->>'priority',
        v_space_ids
    );

    t := public.create_task_full(
        p_org,
        p_property,
        p_payload->>'title',
        p_payload->>'description',
        COALESCE(p_payload->>'priority', 'medium'),
        (p_payload->>'due_at')::timestamptz,
        (p_payload->>'assigned_user_id')::UUID,
        v_team_ids,
        v_space_ids,
        COALESCE((p_payload->>'is_compliance')::BOOLEAN, FALSE),
        p_payload->>'compliance_level',
        COALESCE(p_payload->'metadata', '{}'::jsonb),
        p_payload->'subtasks',
        v_group_ids,
        (p_payload->>'template_id')::UUID,
        p_payload->'images'
    );

    RETURN t;
END;
$function$;