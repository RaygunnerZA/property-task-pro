-- Migration: Compliance events enhancement, triggers, views, and functions

-- Add missing columns to existing compliance_events table
ALTER TABLE public.compliance_events 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS body TEXT,
ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info',
ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Additional indexes
CREATE INDEX IF NOT EXISTS idx_compliance_events_org ON public.compliance_events(org_id);
CREATE INDEX IF NOT EXISTS idx_compliance_events_property ON public.compliance_events(property_id);
CREATE INDEX IF NOT EXISTS idx_compliance_events_due ON public.compliance_events(due_at);

-- AUTO EVENT: WHEN A COMPLIANCE TASK IS CREATED
CREATE OR REPLACE FUNCTION public.compliance_event_on_task_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.is_compliance = TRUE THEN
        INSERT INTO public.compliance_events(org_id, property_id, task_id, event_type, title, severity, due_at)
        VALUES (
            NEW.org_id,
            NEW.property_id,
            NEW.id,
            'created',
            COALESCE(NEW.title, 'Compliance Task'),
            'info',
            NEW.due_at
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compliance_event_task_insert ON public.tasks;
CREATE TRIGGER trg_compliance_event_task_insert
AFTER INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.compliance_event_on_task_insert();

-- AUTO EVENT: WHEN COMPLIANCE TASK DUE DATE CHANGES
CREATE OR REPLACE FUNCTION public.compliance_event_on_task_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.is_compliance = TRUE AND NEW.due_at IS DISTINCT FROM OLD.due_at THEN
        INSERT INTO public.compliance_events(org_id, property_id, task_id, event_type, title, severity, due_at)
        VALUES (
            NEW.org_id,
            NEW.property_id,
            NEW.id,
            'updated',
            COALESCE(NEW.title, 'Compliance Task Updated'),
            'info',
            NEW.due_at
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compliance_event_task_update ON public.tasks;
CREATE TRIGGER trg_compliance_event_task_update
AFTER UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.compliance_event_on_task_update();

-- AUTO EVENT: WHEN COMPLIANCE TASK EXPIRES (for cron job)
CREATE OR REPLACE FUNCTION public.compliance_event_daily_expiry_check()
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.compliance_events(org_id, property_id, task_id, rule_id, event_type, title, severity, due_at)
    SELECT
        t.org_id,
        t.property_id,
        t.id,
        NULL,
        'expired',
        t.title,
        'critical',
        t.due_at
    FROM public.tasks t
    WHERE t.is_compliance = TRUE
    AND t.status <> 'completed'
    AND t.due_at < NOW()
    AND NOT EXISTS (
        SELECT 1 FROM public.compliance_events ce
        WHERE ce.task_id = t.id AND ce.event_type = 'expired'
    );
END;
$$;

-- VIEW: ALL UPCOMING COMPLIANCE DEADLINES
CREATE OR REPLACE VIEW public.compliance_upcoming AS
SELECT
    t.id,
    t.org_id,
    t.property_id,
    t.title,
    t.due_at,
    EXTRACT(DAY FROM (t.due_at - NOW())) AS days_until_due,
    CASE
        WHEN t.due_at < NOW() THEN 'overdue'
        WHEN t.due_at < NOW() + INTERVAL '3 days' THEN 'urgent'
        WHEN t.due_at < NOW() + INTERVAL '7 days' THEN 'soon'
        ELSE 'normal'
    END AS urgency
FROM public.tasks t
WHERE t.is_compliance = TRUE
AND t.status <> 'completed';

-- INDEX FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_compliance_upcoming_due ON public.tasks(due_at) WHERE is_compliance = TRUE;

-- VIEW: PROPERTY COMPLIANCE SUMMARY (using address instead of name)
CREATE OR REPLACE VIEW public.compliance_property_summary AS
SELECT
    p.id AS property_id,
    COALESCE(p.nickname, p.address) AS property_name,
    p.org_id,
    COUNT(*) FILTER (WHERE t.is_compliance = TRUE) AS total,
    COUNT(*) FILTER (WHERE t.is_compliance = TRUE AND t.status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE t.is_compliance = TRUE AND t.due_at < NOW() AND t.status <> 'completed') AS overdue,
    COUNT(*) FILTER (WHERE t.is_compliance = TRUE AND t.due_at BETWEEN NOW() AND NOW() + INTERVAL '7 days') AS due_soon
FROM public.properties p
LEFT JOIN public.tasks t ON t.property_id = p.id
GROUP BY p.id, p.nickname, p.address, p.org_id;

-- VIEW: ORG-WIDE COMPLIANCE HEALTH
CREATE OR REPLACE VIEW public.compliance_org_health AS
SELECT
    org_id,
    COUNT(*) FILTER (WHERE is_compliance = TRUE) AS total_tasks,
    COUNT(*) FILTER (WHERE is_compliance = TRUE AND due_at < NOW() AND status <> 'completed') AS critical_overdue,
    COUNT(*) FILTER (WHERE is_compliance = TRUE AND status = 'completed') AS completed,
    MAX(updated_at) AS last_update
FROM public.tasks
GROUP BY org_id;

-- FUNCTION: GET COMPLIANCE SUMMARY FOR ORG
CREATE OR REPLACE FUNCTION public.get_compliance_summary(p_org UUID)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total', SUM(CASE WHEN is_compliance THEN 1 ELSE 0 END),
        'completed', SUM(CASE WHEN is_compliance AND status = 'completed' THEN 1 ELSE 0 END),
        'overdue', SUM(CASE WHEN is_compliance AND due_at < NOW() AND status <> 'completed' THEN 1 ELSE 0 END),
        'due_soon', SUM(CASE WHEN is_compliance AND due_at BETWEEN NOW() AND NOW() + INTERVAL '7 days' AND status <> 'completed' THEN 1 ELSE 0 END)
    )
    INTO result
    FROM public.tasks
    WHERE org_id = p_org;

    RETURN result;
END;
$$;