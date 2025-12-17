-- Migration: Add owner columns to tasks

-- Add columns
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS owner_user_id UUID;

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS owner_team_id UUID;

-- Add FK for owner_team_id (teams table exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tasks_owner_team_id_fkey'
    AND table_name = 'tasks'
  ) THEN
    ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_owner_team_id_fkey
    FOREIGN KEY (owner_team_id)
    REFERENCES public.teams(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Note: Skipping FK for owner_user_id since there's no public.users table
-- (auth.users is managed by Supabase and can't have FKs from public schema)

-- Indexes for fast permission checks
CREATE INDEX IF NOT EXISTS idx_tasks_owner_user_id ON public.tasks(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_team_id ON public.tasks(owner_team_id);

-- Add comments
COMMENT ON COLUMN public.tasks.owner_user_id IS 'User who owns this task (for direct ownership visibility).';
COMMENT ON COLUMN public.tasks.owner_team_id IS 'Team that owns this task (for team-based visibility).';