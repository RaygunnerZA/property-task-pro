-- Migration Step 14: Confirm constraints, foreign keys, defaults

-- Ensure metadata always exists
ALTER TABLE public.tasks
ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

-- Ensure space_ids always exists
ALTER TABLE public.tasks
ALTER COLUMN space_ids SET DEFAULT '{}'::uuid[];

-- Add missing FKs idempotently
DO $$
BEGIN
  -- checklist_template_items FK (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'checklist_template_items_template_fk'
    AND table_name = 'checklist_template_items'
  ) THEN
    ALTER TABLE public.checklist_template_items
    ADD CONSTRAINT checklist_template_items_template_fk
    FOREIGN KEY (template_id) REFERENCES public.checklist_templates(id)
    ON DELETE CASCADE;
  END IF;

  -- task_groups task FK (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'task_groups_task_fk'
    AND table_name = 'task_groups'
  ) THEN
    ALTER TABLE public.task_groups
    ADD CONSTRAINT task_groups_task_fk
    FOREIGN KEY (task_id) REFERENCES public.tasks(id)
    ON DELETE CASCADE;
  END IF;

  -- task_groups group FK (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'task_groups_group_fk'
    AND table_name = 'task_groups'
  ) THEN
    ALTER TABLE public.task_groups
    ADD CONSTRAINT task_groups_group_fk
    FOREIGN KEY (group_id) REFERENCES public.groups(id)
    ON DELETE CASCADE;
  END IF;

  -- group_members FK (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'group_members_group_fk'
    AND table_name = 'group_members'
  ) THEN
    ALTER TABLE public.group_members
    ADD CONSTRAINT group_members_group_fk
    FOREIGN KEY (group_id) REFERENCES public.groups(id)
    ON DELETE CASCADE;
  END IF;

  -- groups parent FK (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'groups_parent_fk'
    AND table_name = 'groups'
  ) THEN
    ALTER TABLE public.groups
    ADD CONSTRAINT groups_parent_fk
    FOREIGN KEY (parent_group_id) REFERENCES public.groups(id)
    ON DELETE SET NULL;
  END IF;

  -- spaces parent FK (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'spaces_parent_fk'
    AND table_name = 'spaces'
  ) THEN
    ALTER TABLE public.spaces
    ADD CONSTRAINT spaces_parent_fk
    FOREIGN KEY (parent_space_id) REFERENCES public.spaces(id)
    ON DELETE SET NULL;
  END IF;

  -- compliance_level_valid check (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'compliance_level_valid'
    AND table_name = 'tasks'
  ) THEN
    ALTER TABLE public.tasks
    ADD CONSTRAINT compliance_level_valid
    CHECK (compliance_level IN ('low','medium','high','critical') OR compliance_level IS NULL);
  END IF;
END $$;