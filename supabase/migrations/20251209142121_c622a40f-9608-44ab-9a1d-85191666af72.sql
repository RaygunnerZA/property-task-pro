-- Migration Step 15: Add missing indexes for performance

-- Tasks filtering and sorting
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON public.tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_property_id ON public.tasks(property_id);
CREATE INDEX IF NOT EXISTS idx_tasks_space_ids_gin ON public.tasks USING gin(space_ids);

-- JSONB metadata search
CREATE INDEX IF NOT EXISTS idx_tasks_metadata_gin ON public.tasks USING gin(metadata);

-- Subtasks ordering (composite index)
CREATE INDEX IF NOT EXISTS idx_subtasks_task_id_order ON public.subtasks(task_id, order_index);

-- Checklist template Items
CREATE INDEX IF NOT EXISTS idx_template_items_template_id ON public.checklist_template_items(template_id);

-- Groups
CREATE INDEX IF NOT EXISTS idx_groups_parent_group_id ON public.groups(parent_group_id);

-- Group members
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);

-- Task-groups join
CREATE INDEX IF NOT EXISTS idx_task_groups_task_id ON public.task_groups(task_id);
CREATE INDEX IF NOT EXISTS idx_task_groups_group_id ON public.task_groups(group_id);

-- Spaces hierarchy
CREATE INDEX IF NOT EXISTS idx_spaces_parent_space_id ON public.spaces(parent_space_id);