-- Add checklist category for template filtering in Create Task.
-- V1 categories: compliance, maintenance, security, operations

ALTER TABLE checklist_templates
ADD COLUMN category TEXT NOT NULL DEFAULT 'operations';

ALTER TABLE checklist_templates
ADD CONSTRAINT checklist_templates_category_check
CHECK (category IN ('compliance', 'maintenance', 'security', 'operations'));

CREATE INDEX idx_checklist_templates_category
  ON checklist_templates(category)
  WHERE is_archived = false;
