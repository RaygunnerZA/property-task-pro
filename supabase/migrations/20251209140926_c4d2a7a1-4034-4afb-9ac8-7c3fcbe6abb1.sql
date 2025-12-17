-- Migration Step 4: Add compliance & checklist extensions to subtasks table
-- Purpose: Support Yes/No verification items, digital signatures, and template linking

DO $$
BEGIN
  -- Add is_yes_no column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subtasks' 
    AND column_name = 'is_yes_no'
  ) THEN
    ALTER TABLE public.subtasks 
    ADD COLUMN is_yes_no BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Column subtasks.is_yes_no added successfully';
  ELSE
    RAISE NOTICE 'Column subtasks.is_yes_no already exists, skipping';
  END IF;

  -- Add requires_signature column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subtasks' 
    AND column_name = 'requires_signature'
  ) THEN
    ALTER TABLE public.subtasks 
    ADD COLUMN requires_signature BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Column subtasks.requires_signature added successfully';
  ELSE
    RAISE NOTICE 'Column subtasks.requires_signature already exists, skipping';
  END IF;

  -- Add signed_by column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subtasks' 
    AND column_name = 'signed_by'
  ) THEN
    ALTER TABLE public.subtasks 
    ADD COLUMN signed_by UUID;
    RAISE NOTICE 'Column subtasks.signed_by added successfully';
  ELSE
    RAISE NOTICE 'Column subtasks.signed_by already exists, skipping';
  END IF;

  -- Add signed_at column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subtasks' 
    AND column_name = 'signed_at'
  ) THEN
    ALTER TABLE public.subtasks 
    ADD COLUMN signed_at TIMESTAMPTZ;
    RAISE NOTICE 'Column subtasks.signed_at added successfully';
  ELSE
    RAISE NOTICE 'Column subtasks.signed_at already exists, skipping';
  END IF;

  -- Add template_id column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subtasks' 
    AND column_name = 'template_id'
  ) THEN
    ALTER TABLE public.subtasks 
    ADD COLUMN template_id UUID;
    RAISE NOTICE 'Column subtasks.template_id added successfully';
  ELSE
    RAISE NOTICE 'Column subtasks.template_id already exists, skipping';
  END IF;
END $$;

-- Add descriptive comments
COMMENT ON COLUMN public.subtasks.is_yes_no IS 'If true, this subtask is a Yes/No verification item.';
COMMENT ON COLUMN public.subtasks.requires_signature IS 'If true, this subtask requires a digital signature.';
COMMENT ON COLUMN public.subtasks.signed_by IS 'User who completed the signature.';
COMMENT ON COLUMN public.subtasks.signed_at IS 'Timestamp of signature event.';
COMMENT ON COLUMN public.subtasks.template_id IS 'Links this subtask to a checklist template.';