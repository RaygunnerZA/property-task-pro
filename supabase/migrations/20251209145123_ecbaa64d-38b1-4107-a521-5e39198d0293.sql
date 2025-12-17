-- Migration: Task recurrence, AI extraction history, and task activity

-- TASK RECURRENCE TABLE
CREATE TABLE IF NOT EXISTS public.task_recurrence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    rule JSONB NOT NULL,
    next_run TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_recurrence_org ON public.task_recurrence(org_id);
CREATE INDEX IF NOT EXISTS idx_task_recurrence_next ON public.task_recurrence(next_run);

ALTER TABLE public.task_recurrence ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_recurrence_select ON public.task_recurrence FOR SELECT USING (org_id = current_org_id());
CREATE POLICY task_recurrence_insert ON public.task_recurrence FOR INSERT WITH CHECK (org_id = current_org_id());
CREATE POLICY task_recurrence_update ON public.task_recurrence FOR UPDATE USING (org_id = current_org_id());
CREATE POLICY task_recurrence_delete ON public.task_recurrence FOR DELETE USING (org_id = current_org_id());

-- AUTO CREATE NEXT TASK INSTANCE
CREATE OR REPLACE FUNCTION public.generate_recurring_task_instance(p_recur UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
    new_due TIMESTAMPTZ;
    new_id UUID;
BEGIN
    SELECT * INTO r FROM public.task_recurrence WHERE id = p_recur;

    IF r.rule->>'type' = 'daily' THEN
        new_due := r.next_run + ((r.rule->>'interval')::int * INTERVAL '1 day');
    ELSIF r.rule->>'type' = 'weekly' THEN
        new_due := r.next_run + ((r.rule->>'interval')::int * INTERVAL '1 week');
    ELSIF r.rule->>'type' = 'monthly' THEN
        new_due := r.next_run + ((r.rule->>'interval')::int * INTERVAL '1 month');
    ELSE
        RETURN;
    END IF;

    INSERT INTO public.tasks (
        org_id, property_id, title, description, priority, status, due_at,
        assigned_user_id, assigned_team_ids, space_ids, is_compliance, compliance_level, annotation_required, metadata, owner_user_id, owner_team_id
    )
    SELECT
        org_id, property_id, title, description, priority, 'pending', new_due,
        assigned_user_id, assigned_team_ids, space_ids, is_compliance, compliance_level, annotation_required, metadata, owner_user_id, owner_team_id
    FROM public.tasks WHERE id = r.task_id
    RETURNING id INTO new_id;

    UPDATE public.task_recurrence
    SET next_run = new_due
    WHERE id = p_recur;
END;
$$;

-- PROCESS ALL RECURRENCES (for cron job)
CREATE OR REPLACE FUNCTION public.process_all_recurrences()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT id FROM public.task_recurrence WHERE next_run <= NOW()
    LOOP
        PERFORM public.generate_recurring_task_instance(r.id);
    END LOOP;
END;
$$;

-- AI EXTRACTION HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.ai_extraction_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    extracted_at TIMESTAMPTZ DEFAULT NOW(),
    payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_extraction_history_task ON public.ai_extraction_history(task_id);
CREATE INDEX IF NOT EXISTS idx_ai_extraction_history_org ON public.ai_extraction_history(org_id);

ALTER TABLE public.ai_extraction_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_extraction_history_select ON public.ai_extraction_history FOR SELECT USING (org_id = current_org_id());
CREATE POLICY ai_extraction_history_insert ON public.ai_extraction_history FOR INSERT WITH CHECK (org_id = current_org_id());
CREATE POLICY ai_extraction_history_update ON public.ai_extraction_history FOR UPDATE USING (org_id = current_org_id());
CREATE POLICY ai_extraction_history_delete ON public.ai_extraction_history FOR DELETE USING (org_id = current_org_id());

-- FUNCTION TO SAVE AI EXTRACTION INTO HISTORY
CREATE OR REPLACE FUNCTION public.save_ai_extraction(
    p_task UUID,
    p_data JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    org uuid;
BEGIN
    SELECT org_id INTO org FROM public.tasks WHERE id = p_task;

    INSERT INTO public.ai_extraction_history (org_id, task_id, payload)
    VALUES (org, p_task, p_data);

    UPDATE public.tasks SET metadata = jsonb_set(COALESCE(metadata,'{}'), '{ai}', p_data)
    WHERE id = p_task;
END;
$$;

-- TASK ACTIVITY TABLE
CREATE TABLE IF NOT EXISTS public.task_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    body TEXT,
    metadata JSONB DEFAULT '{}',
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_task ON public.task_activity(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_org ON public.task_activity(org_id);

ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_activity_select ON public.task_activity FOR SELECT USING (org_id = current_org_id());
CREATE POLICY task_activity_insert ON public.task_activity FOR INSERT WITH CHECK (org_id = current_org_id());
CREATE POLICY task_activity_update ON public.task_activity FOR UPDATE USING (org_id = current_org_id());
CREATE POLICY task_activity_delete ON public.task_activity FOR DELETE USING (org_id = current_org_id());

-- INSERT ACTIVITY ON TASK CREATE
CREATE OR REPLACE FUNCTION public.task_activity_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.task_activity(org_id, task_id, activity_type, body, created_by)
    VALUES (
        NEW.org_id,
        NEW.id,
        'created',
        NEW.title,
        NEW.owner_user_id
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_activity_insert ON public.tasks;
CREATE TRIGGER trg_task_activity_insert
AFTER INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.task_activity_on_insert();

-- INSERT ACTIVITY ON TASK UPDATE (ASSIGNMENT, PRIORITY, STATUS)
CREATE OR REPLACE FUNCTION public.task_activity_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id THEN
        INSERT INTO public.task_activity(org_id, task_id, activity_type, body, metadata)
        VALUES (
            NEW.org_id,
            NEW.id,
            'assigned',
            'Task assigned',
            jsonb_build_object('user_id', NEW.assigned_user_id)
        );
    END IF;

    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
        INSERT INTO public.task_activity(org_id, task_id, activity_type, body)
        VALUES (
            NEW.org_id,
            NEW.id,
            'priority_changed',
            NEW.priority
        );
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO public.task_activity(org_id, task_id, activity_type, body)
        VALUES (
            NEW.org_id,
            NEW.id,
            'status_changed',
            NEW.status
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_activity_update ON public.tasks;
CREATE TRIGGER trg_task_activity_update
AFTER UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.task_activity_on_update();