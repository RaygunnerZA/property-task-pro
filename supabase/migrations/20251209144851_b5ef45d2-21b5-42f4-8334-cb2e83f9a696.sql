-- Migration: Task deletion, archival, and restoration functions

-- HARD DELETE A TASK AND ALL DEPENDENCIES
CREATE OR REPLACE FUNCTION public.delete_task_full(
    p_task_id UUID,
    p_org UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    img RECORD;
BEGIN
    -- VALIDATE TASK BELONGS TO ORG
    IF NOT EXISTS (
        SELECT 1 FROM public.tasks
        WHERE id = p_task_id AND org_id = p_org
    ) THEN
        RAISE EXCEPTION 'Task % not found or not in org %', p_task_id, p_org;
    END IF;

    -- DELETE SIGNALS
    DELETE FROM public.signals
    WHERE task_id = p_task_id AND org_id = p_org;

    -- DELETE GROUP LINKS
    DELETE FROM public.task_groups
    WHERE task_id = p_task_id;

    -- DELETE SUBTASKS
    DELETE FROM public.subtasks
    WHERE task_id = p_task_id AND org_id = p_org;

    -- DELETE IMAGE ACTIONS + VERSIONS + IMAGES
    FOR img IN
        SELECT id FROM public.task_images
        WHERE task_id = p_task_id AND org_id = p_org
    LOOP
        DELETE FROM public.task_image_actions
        WHERE task_image_id = img.id;

        DELETE FROM public.task_image_versions
        WHERE task_image_id = img.id;

        DELETE FROM public.task_images
        WHERE id = img.id;
    END LOOP;

    -- DELETE TASK
    DELETE FROM public.tasks
    WHERE id = p_task_id AND org_id = p_org;
END;
$$;

-- SOFT DELETE VERSION
CREATE OR REPLACE FUNCTION public.archive_task(
    p_task_id UUID,
    p_org UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.tasks
    SET status = 'archived',
        updated_at = NOW()
    WHERE id = p_task_id AND org_id = p_org;
END;
$$;

-- RESTORE ARCHIVED TASK
CREATE OR REPLACE FUNCTION public.restore_task(
    p_task_id UUID,
    p_org UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.tasks
    SET status = 'pending',
        updated_at = NOW()
    WHERE id = p_task_id AND org_id = p_org;
END;
$$;

-- DELETE ALL COMPLETED TASKS OLDER THAN X DAYS
CREATE OR REPLACE FUNCTION public.purge_completed_tasks(
    p_org UUID,
    p_days INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count INTEGER;
    task_rec RECORD;
BEGIN
    deleted_count := 0;
    
    FOR task_rec IN
        SELECT id
        FROM public.tasks
        WHERE org_id = p_org
        AND status = 'completed'
        AND completed_at < NOW() - (p_days || ' days')::interval
    LOOP
        PERFORM public.delete_task_full(task_rec.id, p_org);
        deleted_count := deleted_count + 1;
    END LOOP;

    RETURN deleted_count;
END;
$$;

-- INDEXES FOR DELETION/ARCHIVAL PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_tasks_status_completed ON public.tasks(status, completed_at);
CREATE INDEX IF NOT EXISTS idx_signals_task_id ON public.signals(task_id);
CREATE INDEX IF NOT EXISTS idx_task_images_org_task ON public.task_images(org_id, task_id);