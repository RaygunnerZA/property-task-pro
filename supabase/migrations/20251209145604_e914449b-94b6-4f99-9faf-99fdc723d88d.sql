-- Migration: Task compliance extensions, AI tables, labels, and activity log

-- Extend tasks table with compliance fields
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS compliance_rule_id UUID REFERENCES public.compliance_rules(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS compliance_source_id UUID REFERENCES public.compliance_sources(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS compliance_event_id UUID REFERENCES public.compliance_events(id) ON DELETE SET NULL;
-- is_compliance already exists on tasks, skipping
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS compliance_status TEXT DEFAULT 'pending';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS compliance_due_at TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS compliance_metadata JSONB DEFAULT '{}'::jsonb;

-- Task compliance events junction table
CREATE TABLE IF NOT EXISTS public.task_compliance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.compliance_rules(id) ON DELETE SET NULL,
  clause_id UUID REFERENCES public.compliance_clauses(id) ON DELETE SET NULL,
  status TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.task_compliance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_compliance_events_select ON public.task_compliance_events FOR SELECT USING (org_id = current_org_id());
CREATE POLICY task_compliance_events_insert ON public.task_compliance_events FOR INSERT WITH CHECK (org_id = current_org_id());
CREATE POLICY task_compliance_events_update ON public.task_compliance_events FOR UPDATE USING (org_id = current_org_id());
CREATE POLICY task_compliance_events_delete ON public.task_compliance_events FOR DELETE USING (org_id = current_org_id());

-- Extend compliance_assignments
ALTER TABLE public.compliance_assignments ADD COLUMN IF NOT EXISTS last_applied_at TIMESTAMPTZ;
ALTER TABLE public.compliance_assignments ADD COLUMN IF NOT EXISTS next_due_at TIMESTAMPTZ;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_task_compliance_events_task_id ON public.task_compliance_events(task_id);
CREATE INDEX IF NOT EXISTS idx_task_compliance_events_rule_id ON public.task_compliance_events(rule_id);
CREATE INDEX IF NOT EXISTS idx_compliance_assignments_next_due ON public.compliance_assignments(next_due_at);

-- AI MODELS (global reference table, no org_id - public read)
CREATE TABLE IF NOT EXISTS public.ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  provider TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_models_select ON public.ai_models FOR SELECT USING (true);

-- AI PROMPTS
CREATE TABLE IF NOT EXISTS public.ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
  model_id UUID REFERENCES public.ai_models(id),
  prompt TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_prompts_select ON public.ai_prompts FOR SELECT USING (org_id = current_org_id());
CREATE POLICY ai_prompts_insert ON public.ai_prompts FOR INSERT WITH CHECK (org_id = current_org_id());

-- AI RESPONSES
CREATE TABLE IF NOT EXISTS public.ai_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES public.ai_prompts(id) ON DELETE CASCADE,
  response TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_responses_select ON public.ai_responses FOR SELECT USING (org_id = current_org_id());
CREATE POLICY ai_responses_insert ON public.ai_responses FOR INSERT WITH CHECK (org_id = current_org_id());

-- AI EXTRACTIONS
CREATE TABLE IF NOT EXISTS public.ai_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  model_id UUID REFERENCES public.ai_models(id),
  extracted JSONB DEFAULT '{}'::jsonb,
  confidence NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_extractions_select ON public.ai_extractions FOR SELECT USING (org_id = current_org_id());
CREATE POLICY ai_extractions_insert ON public.ai_extractions FOR INSERT WITH CHECK (org_id = current_org_id());

CREATE INDEX IF NOT EXISTS idx_ai_responses_prompt_id ON public.ai_responses(prompt_id);
CREATE INDEX IF NOT EXISTS idx_ai_extractions_task_id ON public.ai_extractions(task_id);

-- LABELS
CREATE TABLE IF NOT EXISTS public.labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY labels_select ON public.labels FOR SELECT USING (org_id = current_org_id());
CREATE POLICY labels_insert ON public.labels FOR INSERT WITH CHECK (org_id = current_org_id());
CREATE POLICY labels_update ON public.labels FOR UPDATE USING (org_id = current_org_id());
CREATE POLICY labels_delete ON public.labels FOR DELETE USING (org_id = current_org_id());

-- TASK LABELS (junction)
CREATE TABLE IF NOT EXISTS public.task_labels (
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  label_id UUID REFERENCES public.labels(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_labels_select ON public.task_labels FOR SELECT USING (org_id = current_org_id());
CREATE POLICY task_labels_insert ON public.task_labels FOR INSERT WITH CHECK (org_id = current_org_id());
CREATE POLICY task_labels_delete ON public.task_labels FOR DELETE USING (org_id = current_org_id());

-- ACTIVITY LOG
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id UUID,
  entity_type TEXT,
  entity_id UUID,
  action TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_log_select ON public.activity_log FOR SELECT USING (org_id = current_org_id());
CREATE POLICY activity_log_insert ON public.activity_log FOR INSERT WITH CHECK (org_id = current_org_id());

CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON public.activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_org ON public.activity_log(org_id);