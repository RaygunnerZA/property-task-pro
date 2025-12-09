-- Migration: Tasks metadata JSONB with helpers, indexes, and triggers

-- Add validation for metadata keys (drop first if exists)
ALTER TABLE public.tasks
DROP CONSTRAINT IF EXISTS tasks_metadata_is_object;

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_metadata_is_object CHECK (jsonb_typeof(metadata) = 'object');

-- Add repeat rule getters/setters inside metadata
CREATE OR REPLACE FUNCTION public.task_set_repeat_rule(task_id UUID, rule JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.tasks
    SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{repeat}',
        rule,
        true
    ),
    updated_at = NOW()
    WHERE id = task_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.task_get_repeat_rule(task_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE r JSONB;
BEGIN
    SELECT metadata->'repeat' INTO r FROM public.tasks WHERE id = task_id;
    RETURN r;
END;
$$;

-- Add AI metadata helpers
CREATE OR REPLACE FUNCTION public.task_set_ai_metadata(task_id UUID, ai JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.tasks
    SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{ai}',
        ai,
        true
    ),
    updated_at = NOW()
    WHERE id = task_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.task_get_ai_metadata(task_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE ai JSONB;
BEGIN
    SELECT metadata->'ai' INTO ai FROM public.tasks WHERE id = task_id;
    RETURN ai;
END;
$$;

-- Add AI confidence accessor
CREATE OR REPLACE FUNCTION public.task_ai_confidence(task_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE c NUMERIC;
BEGIN
    SELECT (metadata->'ai'->>'confidence')::numeric INTO c FROM public.tasks WHERE id = task_id;
    RETURN c;
END;
$$;

-- Add computed column via view for querying repeat rules
CREATE OR REPLACE VIEW public.task_repeat_rules AS
SELECT
    id,
    org_id,
    (metadata->'repeat') AS repeat_rule
FROM public.tasks;

-- Set view to SECURITY INVOKER
ALTER VIEW public.task_repeat_rules SET (security_invoker = true);

-- Add indexes for metadata lookups
CREATE INDEX IF NOT EXISTS idx_tasks_metadata_gin ON public.tasks USING GIN (metadata jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_tasks_repeat_rule ON public.tasks ((metadata->'repeat'));
CREATE INDEX IF NOT EXISTS idx_tasks_ai_metadata ON public.tasks ((metadata->'ai'));

-- Add updated_at trigger for any metadata changes
CREATE OR REPLACE FUNCTION public.update_timestamp_on_metadata_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.metadata IS DISTINCT FROM OLD.metadata THEN
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_metadata_timestamp ON public.tasks;

CREATE TRIGGER trg_update_metadata_timestamp
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp_on_metadata_change();

-- Add JSON schema constraints (soft enforcement)
ALTER TABLE public.tasks
DROP CONSTRAINT IF EXISTS tasks_metadata_repeat_format;

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_metadata_repeat_format CHECK (
    (metadata ? 'repeat' AND jsonb_typeof(metadata->'repeat') = 'object')
    OR NOT (metadata ? 'repeat')
) NOT VALID;

-- Add helper function to compute next due date based on repeat rule
CREATE OR REPLACE FUNCTION public.task_next_due_date(task_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    base TIMESTAMPTZ;
    rule JSONB;
    rtype TEXT;
BEGIN
    SELECT due_at, metadata->'repeat' INTO base, rule FROM public.tasks WHERE id = task_id;

    IF rule IS NULL THEN
        RETURN base;
    END IF;

    rtype := rule->>'type';

    IF rtype = 'daily' THEN
        RETURN base + INTERVAL '1 day';
    ELSIF rtype = 'weekly' THEN
        RETURN base + INTERVAL '1 week';
    ELSIF rtype = 'monthly' THEN
        RETURN base + INTERVAL '1 month';
    ELSE
        RETURN base;
    END IF;
END;
$$;