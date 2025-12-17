-- Fix create_task_full to include org_id when inserting into task_groups
CREATE OR REPLACE FUNCTION public.create_task_full(p_org uuid, p_property uuid, p_title text, p_description text, p_priority text, p_due_at timestamp with time zone, p_assigned_user uuid, p_assigned_teams uuid[], p_space_ids uuid[], p_is_compliance boolean, p_compliance_level text, p_metadata jsonb, p_subtasks jsonb, p_groups uuid[], p_template uuid, p_images jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    t_id UUID;
    st RECORD;
    g UUID;
    img RECORD;
    new_img UUID;
BEGIN
    -- CREATE TASK
    INSERT INTO public.tasks (
        org_id,
        property_id,
        title,
        description,
        priority,
        due_at,
        assigned_user_id,
        assigned_team_ids,
        space_ids,
        is_compliance,
        compliance_level,
        metadata
    ) VALUES (
        p_org,
        p_property,
        p_title,
        p_description,
        p_priority,
        p_due_at,
        p_assigned_user,
        COALESCE(p_assigned_teams, ARRAY[]::UUID[]),
        COALESCE(p_space_ids, ARRAY[]::UUID[]),
        COALESCE(p_is_compliance, FALSE),
        p_compliance_level,
        COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING id INTO t_id;

    -- APPLY CHECKLIST TEMPLATE IF PROVIDED
    IF p_template IS NOT NULL THEN
        PERFORM public.apply_checklist_template(t_id, p_template, p_org);
    END IF;

    -- INSERT SUBTASKS ARRAY (JSONB)
    IF p_subtasks IS NOT NULL THEN
        FOR st IN SELECT * FROM jsonb_to_recordset(p_subtasks)
            AS x(title TEXT, is_yes_no BOOLEAN, requires_signature BOOLEAN, order_index INTEGER)
        LOOP
            INSERT INTO public.subtasks (
                task_id,
                org_id,
                title,
                is_completed,
                is_yes_no,
                requires_signature,
                order_index
            ) VALUES (
                t_id,
                p_org,
                st.title,
                FALSE,
                COALESCE(st.is_yes_no, FALSE),
                COALESCE(st.requires_signature, FALSE),
                COALESCE(st.order_index, 0)
            );
        END LOOP;
    END IF;

    -- ASSIGN GROUPS (now includes org_id)
    IF p_groups IS NOT NULL THEN
        FOREACH g IN ARRAY p_groups LOOP
            INSERT INTO public.task_groups (task_id, group_id, org_id)
            VALUES (t_id, g, p_org)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    -- INSERT IMAGES (JSONB: [{path, url, original_filename, display_name, file_type}])
    IF p_images IS NOT NULL THEN
        FOR img IN SELECT * FROM jsonb_to_recordset(p_images)
            AS x(storage_path TEXT, image_url TEXT, original_filename TEXT, display_name TEXT, file_type TEXT)
        LOOP
            INSERT INTO public.task_images (
                task_id,
                org_id,
                storage_path,
                image_url,
                original_filename,
                display_name,
                file_type,
                status
            ) VALUES (
                t_id,
                p_org,
                img.storage_path,
                img.image_url,
                img.original_filename,
                img.display_name,
                img.file_type,
                'active'
            )
            RETURNING id INTO new_img;

            INSERT INTO public.task_image_versions (
                task_image_id,
                storage_path,
                version_number,
                is_original,
                created_at
            ) VALUES (
                new_img,
                img.storage_path,
                1,
                TRUE,
                NOW()
            );
        END LOOP;
    END IF;

    RETURN t_id;
END;
$function$;