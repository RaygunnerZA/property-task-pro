-- Migration Step 13: Add helpful indexes for performance

-- Improve querying on tasks
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON public.tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_property_id ON public.tasks(property_id);
CREATE INDEX IF NOT EXISTS idx_tasks_space_ids_gin ON public.tasks USING GIN (space_ids);

-- Improve subtasks performance
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON public.subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_order ON public.subtasks(order_index);

-- Improve checklist template performance
CREATE INDEX IF NOT EXISTS idx_templates_org ON public.checklist_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_template_items_order ON public.checklist_template_items(order_index);

-- Improve group querying
CREATE INDEX IF NOT EXISTS idx_groups_parent ON public.groups(parent_group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members(group_id);

-- Improve task_groups junction performance
CREATE INDEX IF NOT EXISTS idx_task_groups_task ON public.task_groups(task_id);
CREATE INDEX IF NOT EXISTS idx_task_groups_group ON public.task_groups(group_id);

-- Improve spaces hierarchy
CREATE INDEX IF NOT EXISTS idx_spaces_parent ON public.spaces(parent_space_id);

-- Improve compliance-level/task filtering
CREATE INDEX IF NOT EXISTS idx_tasks_compliance ON public.tasks(is_compliance, compliance_level);

-- JSONB metadata queries
CREATE INDEX IF NOT EXISTS idx_tasks_metadata_gin ON public.tasks USING GIN (metadata);