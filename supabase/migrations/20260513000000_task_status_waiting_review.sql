-- Add waiting_review to task_status (must be its own migration transaction: PG forbids
-- using a new enum label in the same transaction as ALTER TYPE ... ADD VALUE — 55P04).
-- Views + index: `20260513000001_task_status_waiting_review_views.sql`.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'task_status'
      AND e.enumlabel = 'waiting_review'
  ) THEN
    ALTER TYPE task_status ADD VALUE 'waiting_review';
  END IF;
END $$;
