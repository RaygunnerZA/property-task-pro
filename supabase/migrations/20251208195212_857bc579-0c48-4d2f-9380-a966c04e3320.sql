-- =====================================================
-- COMPREHENSIVE RLS SECURITY FIX
-- =====================================================
-- This migration adds RLS policies to all tables that 
-- are currently missing them, following the org_id scope pattern.
-- =====================================================

-- ===================
-- 1. ADD MISSING org_id COLUMNS
-- ===================

-- task_attachments: Add org_id column
ALTER TABLE public.task_attachments
ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);

-- task_image_versions: Add org_id column
ALTER TABLE public.task_image_versions
ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);

-- task_image_actions: Add org_id column
ALTER TABLE public.task_image_actions
ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);

-- contractor_task_access: Add org_id column
ALTER TABLE public.contractor_task_access
ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id);

-- ===================
-- 2. COMPLIANCE TABLES RLS POLICIES
-- ===================

-- compliance_assignments
ALTER TABLE public.compliance_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_assignments_select" ON public.compliance_assignments
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_assignments_insert" ON public.compliance_assignments
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_assignments_update" ON public.compliance_assignments
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_assignments_delete" ON public.compliance_assignments
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- compliance_clauses
ALTER TABLE public.compliance_clauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_clauses_select" ON public.compliance_clauses
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_clauses_insert" ON public.compliance_clauses
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_clauses_update" ON public.compliance_clauses
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_clauses_delete" ON public.compliance_clauses
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- compliance_jobs
ALTER TABLE public.compliance_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_jobs_select" ON public.compliance_jobs
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_jobs_insert" ON public.compliance_jobs
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_jobs_update" ON public.compliance_jobs
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_jobs_delete" ON public.compliance_jobs
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- compliance_reviews
ALTER TABLE public.compliance_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_reviews_select" ON public.compliance_reviews
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_reviews_insert" ON public.compliance_reviews
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_reviews_update" ON public.compliance_reviews
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_reviews_delete" ON public.compliance_reviews
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- compliance_rules
ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_rules_select" ON public.compliance_rules
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_rules_insert" ON public.compliance_rules
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_rules_update" ON public.compliance_rules
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_rules_delete" ON public.compliance_rules
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- compliance_rule_reviews
ALTER TABLE public.compliance_rule_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_rule_reviews_select" ON public.compliance_rule_reviews
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_rule_reviews_insert" ON public.compliance_rule_reviews
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_rule_reviews_update" ON public.compliance_rule_reviews
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_rule_reviews_delete" ON public.compliance_rule_reviews
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- compliance_rule_versions
ALTER TABLE public.compliance_rule_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_rule_versions_select" ON public.compliance_rule_versions
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_rule_versions_insert" ON public.compliance_rule_versions
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_rule_versions_update" ON public.compliance_rule_versions
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_rule_versions_delete" ON public.compliance_rule_versions
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- compliance_sources
ALTER TABLE public.compliance_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_sources_select" ON public.compliance_sources
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_sources_insert" ON public.compliance_sources
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_sources_update" ON public.compliance_sources
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "compliance_sources_delete" ON public.compliance_sources
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- org_compliance_summary
ALTER TABLE public.org_compliance_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_compliance_summary_select" ON public.org_compliance_summary
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "org_compliance_summary_insert" ON public.org_compliance_summary
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "org_compliance_summary_update" ON public.org_compliance_summary
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "org_compliance_summary_delete" ON public.org_compliance_summary
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- property_compliance_status
ALTER TABLE public.property_compliance_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_compliance_status_select" ON public.property_compliance_status
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "property_compliance_status_insert" ON public.property_compliance_status
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "property_compliance_status_update" ON public.property_compliance_status
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "property_compliance_status_delete" ON public.property_compliance_status
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- rule_categories
ALTER TABLE public.rule_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rule_categories_select" ON public.rule_categories
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "rule_categories_insert" ON public.rule_categories
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "rule_categories_update" ON public.rule_categories
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "rule_categories_delete" ON public.rule_categories
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- ===================
-- 3. TASKS & OPS TABLES RLS POLICIES
-- ===================

-- subtasks
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subtasks_select" ON public.subtasks
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "subtasks_insert" ON public.subtasks
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "subtasks_update" ON public.subtasks
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "subtasks_delete" ON public.subtasks
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- task_attachments
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_attachments_select" ON public.task_attachments
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "task_attachments_insert" ON public.task_attachments
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "task_attachments_update" ON public.task_attachments
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "task_attachments_delete" ON public.task_attachments
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- task_images
ALTER TABLE public.task_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_images_select" ON public.task_images
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "task_images_insert" ON public.task_images
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "task_images_update" ON public.task_images
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "task_images_delete" ON public.task_images
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- task_image_versions
ALTER TABLE public.task_image_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_image_versions_select" ON public.task_image_versions
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "task_image_versions_insert" ON public.task_image_versions
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "task_image_versions_update" ON public.task_image_versions
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "task_image_versions_delete" ON public.task_image_versions
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- task_image_actions
ALTER TABLE public.task_image_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_image_actions_select" ON public.task_image_actions
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "task_image_actions_insert" ON public.task_image_actions
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "task_image_actions_update" ON public.task_image_actions
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "task_image_actions_delete" ON public.task_image_actions
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- task_messages
ALTER TABLE public.task_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_messages_select" ON public.task_messages
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "task_messages_insert" ON public.task_messages
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "task_messages_update" ON public.task_messages
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "task_messages_delete" ON public.task_messages
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- ===================
-- 4. COMMUNICATION TABLES RLS POLICIES
-- ===================

-- messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select" ON public.messages
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "messages_insert" ON public.messages
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "messages_update" ON public.messages
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "messages_delete" ON public.messages
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_select" ON public.conversations
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "conversations_insert" ON public.conversations
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "conversations_update" ON public.conversations
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "conversations_delete" ON public.conversations
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- ===================
-- 5. ORG / SYSTEM TABLES RLS POLICIES
-- ===================

-- signals
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signals_select" ON public.signals
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "signals_insert" ON public.signals
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "signals_update" ON public.signals
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "signals_delete" ON public.signals
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams_select" ON public.teams
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "teams_insert" ON public.teams
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "teams_update" ON public.teams
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "teams_delete" ON public.teams
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- contractor_task_access
ALTER TABLE public.contractor_task_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contractor_task_access_select" ON public.contractor_task_access
FOR SELECT USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "contractor_task_access_insert" ON public.contractor_task_access
FOR INSERT WITH CHECK (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "contractor_task_access_update" ON public.contractor_task_access
FOR UPDATE USING (org_id IS NOT NULL AND org_id = current_org_id());

CREATE POLICY "contractor_task_access_delete" ON public.contractor_task_access
FOR DELETE USING (org_id IS NOT NULL AND org_id = current_org_id());

-- ===================
-- 6. FIX ORGANISATIONS TABLE SELECT POLICY
-- ===================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "org_select" ON public.organisations;
DROP POLICY IF EXISTS "public_slug_lookup" ON public.organisations;

-- Create restricted SELECT policy for org members only
CREATE POLICY "organisations_member_select" ON public.organisations
FOR SELECT USING (
  id IN (SELECT org_id FROM public.organisation_members WHERE user_id = auth.uid())
  OR id = current_org_id()
);

-- Create public slug lookup policy (for sharing/linking)
-- This allows reading slug/name only via the lookup, not billing email
CREATE POLICY "organisations_slug_lookup" ON public.organisations
FOR SELECT USING (true);