-- Align tasks.status with constitutional lifecycle:
-- open | in_progress | waiting_review | completed | archived
--
-- Remote Filla-v2 used a text CHECK (tasks_status_check) with legacy values
-- pending_vendor / waiting_external, which blocked app updates to waiting_review
-- and archived ("Couldn't update status").

-- 1) Ensure enum label exists on environments that still use task_status.
--    (Separate from using the label; remote uses text + CHECK.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_enum e
       JOIN pg_type t ON e.enumtypid = t.oid
       WHERE t.typname = 'task_status'
         AND e.enumlabel = 'waiting_review'
     ) THEN
    ALTER TYPE task_status ADD VALUE 'waiting_review';
  END IF;
END $$;

-- 2) Drop legacy CHECK so remaps / constitutional values can write.
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- 3) Remap legacy statuses.
UPDATE public.tasks
SET status = 'waiting_review'
WHERE status IN ('waiting_external', 'pending_vendor');

-- 4) Recreate CHECK for text status columns.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'status'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_status_check
      CHECK (
        status = ANY (
          ARRAY[
            'open'::text,
            'in_progress'::text,
            'waiting_review'::text,
            'completed'::text,
            'archived'::text
          ]
        )
      );
  END IF;
END $$;

-- 5) Patch onboarding seed so new demos write constitutional statuses.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'seed_onboarding_demo_for_property'
  LIMIT 1;

  IF v_def IS NULL THEN
    RETURN;
  END IF;

  IF position('waiting_external' IN v_def) = 0 THEN
    RETURN;
  END IF;

  v_def := replace(v_def, 'waiting_external', 'waiting_review');
  EXECUTE v_def;
END $$;
