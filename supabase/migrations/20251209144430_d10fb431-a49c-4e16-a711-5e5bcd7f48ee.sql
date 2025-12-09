-- Migration: Compliance events, auto-create function, and scheduling

-- COMPLIANCE EVENT LOG
CREATE TABLE IF NOT EXISTS public.compliance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    rule_id UUID REFERENCES public.compliance_rules(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.compliance_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compliance_events_select ON public.compliance_events;
DROP POLICY IF EXISTS compliance_events_insert ON public.compliance_events;
DROP POLICY IF EXISTS compliance_events_update ON public.compliance_events;
DROP POLICY IF EXISTS compliance_events_delete ON public.compliance_events;

CREATE POLICY compliance_events_select ON public.compliance_events
FOR SELECT USING (org_id = current_org_id());

CREATE POLICY compliance_events_insert ON public.compliance_events
FOR INSERT WITH CHECK (org_id = current_org_id());

CREATE POLICY compliance_events_update ON public.compliance_events
FOR UPDATE USING (org_id = current_org_id());

CREATE POLICY compliance_events_delete ON public.compliance_events
FOR DELETE USING (org_id = current_org_id());

CREATE INDEX IF NOT EXISTS idx_compliance_events_org ON public.compliance_events(org_id);
CREATE INDEX IF NOT EXISTS idx_compliance_events_property ON public.compliance_events(property_id);
CREATE INDEX IF NOT EXISTS idx_compliance_events_task ON public.compliance_events(task_id);
CREATE INDEX IF NOT EXISTS idx_compliance_events_rule ON public.compliance_events(rule_id);
CREATE INDEX IF NOT EXISTS idx_compliance_events_type ON public.compliance_events(event_type);
CREATE INDEX IF NOT EXISTS idx_compliance_events_when ON public.compliance_events(occurred_at);

-- Add recurrence fields to compliance_assignments
ALTER TABLE public.compliance_assignments
ADD COLUMN IF NOT EXISTS recurrence_type TEXT,
ADD COLUMN IF NOT EXISTS recurrence_value INT,
ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ;

-- COMPLIANCE TASK AUTO-CREATE FUNCTION
CREATE OR REPLACE FUNCTION public.create_compliance_task(
    p_org UUID,
    p_property UUID,
    p_rule UUID,
    p_title TEXT,
    p_due TIMESTAMPTZ,
    p_level TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_task UUID;
BEGIN
    INSERT INTO public.tasks (
        org_id,
        property_id,
        title,
        description,
        priority,
        due_at,
        is_compliance,
        compliance_level,
        metadata
    ) VALUES (
        p_org,
        p_property,
        p_title,
        CONCAT('Auto-created from compliance rule ', p_rule),
        CASE WHEN p_level = 'critical' THEN 'urgent' ELSE 'normal' END,
        p_due,
        TRUE,
        p_level,
        jsonb_build_object(
            'compliance', jsonb_build_object(
                'rule_id', p_rule,
                'auto_created', true
            )
        )
    )
    RETURNING id INTO new_task;

    INSERT INTO public.compliance_events (
        org_id,
        property_id,
        task_id,
        rule_id,
        event_type,
        details
    ) VALUES (
        p_org,
        p_property,
        new_task,
        p_rule,
        'task_created',
        jsonb_build_object('reason', 'compliance_rule_trigger')
    );

    RETURN new_task;
END;
$$;

-- COMPLIANCE RECURRING CHECK FUNCTION
CREATE OR REPLACE FUNCTION public.process_compliance_schedules()
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    rule RECORD;
    next_due DATE;
BEGIN
    FOR rule IN
        SELECT id, org_id, property_id, recurrence_type, recurrence_value, last_triggered_at
        FROM public.compliance_assignments
        WHERE recurrence_type IS NOT NULL
    LOOP
        IF rule.recurrence_type = 'monthly' THEN
            next_due := (COALESCE(rule.last_triggered_at, NOW() - INTERVAL '1 month') + (rule.recurrence_value || ' months')::interval)::date;
        ELSIF rule.recurrence_type = 'yearly' THEN
            next_due := (COALESCE(rule.last_triggered_at, NOW() - INTERVAL '1 year') + (rule.recurrence_value || ' years')::interval)::date;
        END IF;

        IF next_due <= NOW()::date THEN
            PERFORM public.create_compliance_task(
                rule.org_id,
                rule.property_id,
                rule.id,
                'Scheduled Compliance Check',
                NOW() + INTERVAL '7 days',
                'medium'
            );

            UPDATE public.compliance_assignments
            SET last_triggered_at = NOW()
            WHERE id = rule.id;
        END IF;
    END LOOP;
END;
$$;

-- INDEXES FOR SCHEDULING VIEWS
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON public.tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_is_compliance ON public.tasks(is_compliance);
CREATE INDEX IF NOT EXISTS idx_tasks_compliance_level ON public.tasks(compliance_level);
CREATE INDEX IF NOT EXISTS idx_subtasks_completed ON public.subtasks(is_completed);