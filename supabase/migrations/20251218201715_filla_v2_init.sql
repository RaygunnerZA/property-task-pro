-- Filla V2 Database Initialization (Corrected & Pragmatic)

-- ============================================================================
-- ENUMS
-- ============================================================================
CREATE TYPE identity_type AS ENUM ('personal', 'manager', 'staff', 'contractor', 'contractor_pro');
CREATE TYPE task_status AS ENUM ('open', 'in_progress', 'completed', 'archived');
CREATE TYPE org_type AS ENUM ('personal', 'business', 'contractor');

-- ============================================================================
-- ORGANISATIONS
-- ============================================================================
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- Added per review
  org_type org_type NOT NULL,
  created_by UUID NOT NULL, -- Added per review
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

CREATE TABLE organisation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL, -- owner, manager, member, staff
  assigned_properties UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE organisation_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROPERTIES & ASSETS
-- ============================================================================
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE TABLE spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Renamed from type to name for clarity
  space_type TEXT, -- Added back as optional useful metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
  serial_number TEXT, -- Renamed from serial
  condition_score INTEGER DEFAULT 100, -- Kept because it is core to Ch 17
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TASKS & SCHEDULE
-- ============================================================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- Added per review
  description TEXT,
  status task_status NOT NULL DEFAULT 'open',
  priority TEXT DEFAULT 'normal', -- Kept for utility
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL, -- Kept for utility
  next_occurrence TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE schedule_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE task_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE task_instances ENABLE ROW LEVEL SECURITY;

CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title TEXT,
  severity TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COMPLIANCE
-- ============================================================================
CREATE TABLE compliance_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE compliance_sources ENABLE ROW LEVEL SECURITY;

CREATE TABLE compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  expiry_date DATE,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE compliance_documents ENABLE ROW LEVEL SECURITY;

CREATE TABLE compliance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE compliance_rules ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- MEDIA
-- ============================================================================
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  parent_type TEXT NOT NULL, -- Kept for polymorphic utility
  parent_id UUID NOT NULL,   -- Kept for polymorphic utility
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE TABLE evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  attachment_id UUID NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CONTRACTOR TOKENS (Must be after tasks)
-- ============================================================================
CREATE TABLE contractor_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, -- Added FK per review
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE contractor_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- BILLING
-- ============================================================================
CREATE TABLE subscription_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  price_id TEXT,
  entitlements JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;

CREATE TABLE org_subscriptions (
  org_id UUID PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  plan_id TEXT REFERENCES subscription_tiers(id),
  seat_count INTEGER,
  usage_limits JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE org_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE org_usage (
  org_id UUID PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  storage_used_bytes BIGINT NOT NULL DEFAULT 0,
  property_count INTEGER NOT NULL DEFAULT 0,
  staff_count INTEGER NOT NULL DEFAULT 0,
  compliance_docs_count INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE org_usage ENABLE ROW LEVEL SECURITY;