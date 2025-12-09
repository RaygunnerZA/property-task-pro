-- Migration: Task threads, messaging, notifications, and escalation

-- TASK THREADS (one per task)
CREATE TABLE IF NOT EXISTS public.task_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    task_id UUID UNIQUE REFERENCES public.tasks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_threads_org ON public.task_threads(org_id);

ALTER TABLE public.task_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_threads_select ON public.task_threads FOR SELECT USING (org_id = current_org_id());
CREATE POLICY task_threads_insert ON public.task_threads FOR INSERT WITH CHECK (org_id = current_org_id());
CREATE POLICY task_threads_update ON public.task_threads FOR UPDATE USING (org_id = current_org_id());
CREATE POLICY task_threads_delete ON public.task_threads FOR DELETE USING (org_id = current_org_id());

-- AUTOMATIC THREAD CREATION FOR EACH TASK
CREATE OR REPLACE FUNCTION public.ensure_task_thread()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.task_threads (org_id, task_id)
    VALUES (NEW.org_id, NEW.id)
    ON CONFLICT (task_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_thread_create ON public.tasks;
CREATE TRIGGER trg_task_thread_create
AFTER INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.ensure_task_thread();

-- THREAD MESSAGES (renamed from task_messages to avoid conflict with existing table)
CREATE TABLE IF NOT EXISTS public.thread_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    thread_id UUID NOT NULL REFERENCES public.task_threads(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    sender_id UUID,
    body TEXT,
    ai_summary JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thread_messages_thread ON public.thread_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_task ON public.thread_messages(task_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_org ON public.thread_messages(org_id);

ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY thread_messages_select ON public.thread_messages FOR SELECT USING (org_id = current_org_id());
CREATE POLICY thread_messages_insert ON public.thread_messages FOR INSERT WITH CHECK (org_id = current_org_id());
CREATE POLICY thread_messages_update ON public.thread_messages FOR UPDATE USING (org_id = current_org_id());
CREATE POLICY thread_messages_delete ON public.thread_messages FOR DELETE USING (org_id = current_org_id());

-- THREAD MESSAGE ATTACHMENTS
CREATE TABLE IF NOT EXISTS public.thread_message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    message_id UUID NOT NULL REFERENCES public.thread_messages(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_url TEXT,
    file_type TEXT,
    ai_caption TEXT,
    metadata JSONB DEFAULT '{}',
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thread_msg_attachments_msg ON public.thread_message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_thread_msg_attachments_org ON public.thread_message_attachments(org_id);

ALTER TABLE public.thread_message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY thread_msg_attachments_select ON public.thread_message_attachments FOR SELECT USING (org_id = current_org_id());
CREATE POLICY thread_msg_attachments_insert ON public.thread_message_attachments FOR INSERT WITH CHECK (org_id = current_org_id());
CREATE POLICY thread_msg_attachments_update ON public.thread_message_attachments FOR UPDATE USING (org_id = current_org_id());
CREATE POLICY thread_msg_attachments_delete ON public.thread_message_attachments FOR DELETE USING (org_id = current_org_id());

-- AI SUMMARY FUNCTION FOR THREADS
CREATE OR REPLACE FUNCTION public.update_thread_ai_summary(p_thread_id UUID, p_summary JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    org uuid;
BEGIN
    SELECT org_id INTO org FROM public.task_threads WHERE id = p_thread_id;
    
    INSERT INTO public.thread_messages (org_id, thread_id, task_id, sender_id, body, ai_summary)
    SELECT org_id, p_thread_id, task_id, NULL, 'AI Summary Updated', p_summary
    FROM public.task_threads
    WHERE id = p_thread_id;
END;
$$;

-- NOTIFICATION CHANNELS
CREATE TABLE IF NOT EXISTS public.notification_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    user_id UUID,
    type TEXT NOT NULL,
    destination TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_channels_org ON public.notification_channels(org_id);
CREATE INDEX IF NOT EXISTS idx_notification_channels_user ON public.notification_channels(user_id);

ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_channels_select ON public.notification_channels FOR SELECT USING (org_id = current_org_id());
CREATE POLICY notification_channels_insert ON public.notification_channels FOR INSERT WITH CHECK (org_id = current_org_id());
CREATE POLICY notification_channels_update ON public.notification_channels FOR UPDATE USING (org_id = current_org_id());
CREATE POLICY notification_channels_delete ON public.notification_channels FOR DELETE USING (org_id = current_org_id());

-- SIGNALS (EXTENDED)
ALTER TABLE public.signals
ADD COLUMN IF NOT EXISTS severity TEXT,
ADD COLUMN IF NOT EXISTS scope TEXT,
ADD COLUMN IF NOT EXISTS ai_recommendation JSONB,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS resolved_by UUID;

CREATE INDEX IF NOT EXISTS idx_signals_severity ON public.signals(severity);
CREATE INDEX IF NOT EXISTS idx_signals_scope ON public.signals(scope);

-- ESCALATION RULES
CREATE TABLE IF NOT EXISTS public.escalation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalation_rules_org ON public.escalation_rules(org_id);

ALTER TABLE public.escalation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY escalation_rules_select ON public.escalation_rules FOR SELECT USING (org_id = current_org_id());
CREATE POLICY escalation_rules_insert ON public.escalation_rules FOR INSERT WITH CHECK (org_id = current_org_id());
CREATE POLICY escalation_rules_update ON public.escalation_rules FOR UPDATE USING (org_id = current_org_id());
CREATE POLICY escalation_rules_delete ON public.escalation_rules FOR DELETE USING (org_id = current_org_id());

-- ESCALATION EVENTS (LOG)
CREATE TABLE IF NOT EXISTS public.escalation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    rule_id UUID REFERENCES public.escalation_rules(id) ON DELETE CASCADE,
    signal_id UUID REFERENCES public.signals(id),
    task_id UUID REFERENCES public.tasks(id),
    event JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalation_events_org ON public.escalation_events(org_id);

ALTER TABLE public.escalation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY escalation_events_select ON public.escalation_events FOR SELECT USING (org_id = current_org_id());
CREATE POLICY escalation_events_insert ON public.escalation_events FOR INSERT WITH CHECK (org_id = current_org_id());

-- ESCALATION PROCESSOR
CREATE OR REPLACE FUNCTION public.process_escalations()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT * FROM public.escalation_rules
        WHERE enabled = TRUE
    LOOP
        IF r.trigger_type = 'overdue_task' THEN
            INSERT INTO public.escalation_events (org_id, rule_id, task_id, event)
            SELECT
                t.org_id,
                r.id,
                t.id,
                jsonb_build_object(
                    'type', 'overdue_trigger',
                    'rule', r.name,
                    'task', t.id,
                    'due_at', t.due_at
                )
            FROM public.tasks t
            WHERE t.org_id = r.org_id
            AND t.due_at < NOW() - ((r.conditions->>'days_overdue')::int * INTERVAL '1 day')
            AND t.status != 'completed'
            AND NOT EXISTS (
                SELECT 1 FROM public.escalation_events ee 
                WHERE ee.task_id = t.id AND ee.rule_id = r.id
            );
        END IF;
    END LOOP;
END;
$$;