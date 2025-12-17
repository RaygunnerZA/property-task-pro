-- Migration: Master task creation function with validation

-- MASTER FUNCTION: CREATE TASK WITH EVERYTHING IN ONE TRANSACTION
CREATE OR REPLACE FUNCTION public.create_task_full(
    p_org UUID,
    p_property UUID,
    p_title TEXT,
    p_description TEXT,
    p_priority TEXT,
    p_due_at TIMESTAMPTZ,
    p_assigned_user UUID,
    p_assigned_teams UUID[],
    p_space_ids UUID[],
    p_is_compliance BOOLEAN,
    p_compliance_level TEXT,
    p_metadata JSONB,
    p_subtasks JSONB,
    p_groups UUID[],
    p_template UUID,
    p_images JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    -- ASSIGN GROUPS
    IF p_groups IS NOT NULL THEN
        FOREACH g IN ARRAY p_groups LOOP
            INSERT INTO public.task_groups (task_id, group_id)
            VALUES (t_id, g)
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
$$;

-- VALIDATION FUNCTION
CREATE OR REPLACE FUNCTION public.validate_task_payload(
    p_title TEXT,
    p_priority TEXT,
    p_space_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
        RAISE EXCEPTION 'Task title cannot be empty';
    END IF;

    IF p_priority IS NOT NULL AND p_priority NOT IN ('low', 'normal', 'urgent') THEN
        RAISE EXCEPTION 'Invalid priority';
    END IF;

    IF p_space_ids IS NOT NULL AND array_length(p_space_ids, 1) > 20 THEN
        RAISE EXCEPTION 'Too many spaces linked to task';
    END IF;
END;
$$;

-- WRAPPER: VALIDATE → CREATE → RETURN TASK
CREATE OR REPLACE FUNCTION public.create_task_safe(
    p_org UUID,
    p_property UUID,
    p_payload JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        COALESCE(p_payload->>'priority', 'normal'),
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
$$;

-- INDEXES FOR PIPELINE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_tasks_space_ids_gin ON public.tasks USING gin(space_ids);
CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON public.subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_task_images_task_id ON public.task_images(task_id);