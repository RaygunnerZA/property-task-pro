-- Fix subtasks_signature_valid: allow unsigned signature-required checklist steps.
--
-- Previous constraint required signed_by/signed_at whenever requires_signature=true,
-- which made it impossible to create signature checklist items (insert always failed).
-- That aborted task create when any step was signature-typed (including keyword
-- auto-detect on titles containing "sign").

ALTER TABLE public.subtasks
  DROP CONSTRAINT IF EXISTS subtasks_signature_valid;

ALTER TABLE public.subtasks
  ADD CONSTRAINT subtasks_signature_valid CHECK (
    -- signed_by and signed_at must both be set or both be null
    ((signed_by IS NULL) = (signed_at IS NULL))
    -- signature fields only allowed on signature-required steps
    AND (
      requires_signature = true
      OR (signed_by IS NULL AND signed_at IS NULL)
    )
  );
