-- Phase 10B: AI & Automation Preference Panel
-- Granular org-level automation settings

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS automation_mode TEXT DEFAULT 'recommended'
    CHECK (automation_mode IN ('conservative', 'recommended', 'aggressive')),

  ADD COLUMN IF NOT EXISTS auto_task_generation BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_task_levels TEXT[] DEFAULT NULL,

  ADD COLUMN IF NOT EXISTS auto_assign_contractors BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_assign_confidence NUMERIC DEFAULT 0.8,

  ADD COLUMN IF NOT EXISTS auto_expiry_update BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_expiry_confidence NUMERIC DEFAULT 0.85,

  ADD COLUMN IF NOT EXISTS auto_link_assets BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_link_asset_confidence NUMERIC DEFAULT 0.75,

  ADD COLUMN IF NOT EXISTS auto_link_spaces BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_link_space_confidence NUMERIC DEFAULT 0.70;

COMMENT ON COLUMN org_settings.automation_mode IS 'Master automation mode: conservative, recommended, aggressive';
COMMENT ON COLUMN org_settings.auto_task_levels IS 'Risk levels that trigger auto-tasks: critical, high, expiring_soon, upcoming';
