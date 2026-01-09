-- AI Resolution Memory Table
-- Stores resolved mappings in database (org-scoped)
-- Enables Filla to feel smarter over time

CREATE TABLE IF NOT EXISTS ai_resolution_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,  -- e.g., "the accountant"
  entity_type TEXT NOT NULL,  -- 'person' | 'team' | 'space' | 'asset' | 'category'
  entity_id UUID NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, key, entity_type)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_resolution_memory_lookup 
  ON ai_resolution_memory(org_id, key, entity_type);

-- RLS Policies
ALTER TABLE ai_resolution_memory ENABLE ROW LEVEL SECURITY;

-- Users can read resolution memory for their org
CREATE POLICY "Users can read resolution memory for their org"
  ON ai_resolution_memory
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = ai_resolution_memory.org_id
      AND org_members.user_id = auth.uid()
    )
  );

-- Users can insert/update resolution memory for their org
CREATE POLICY "Users can manage resolution memory for their org"
  ON ai_resolution_memory
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = ai_resolution_memory.org_id
      AND org_members.user_id = auth.uid()
    )
  );

