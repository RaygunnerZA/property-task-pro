-- Resolution Memory Table
-- Used by the resolver pipeline to boost confidence for known associations.
-- Phase 2: Read-only. Phase 4: Writes enabled.
--
-- This is separate from ai_resolution_memory as it has a different schema
-- optimized for the new resolver pipeline.

CREATE TABLE IF NOT EXISTS resolution_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'team', 'space', 'asset', 'category', 'tag', 'compliance')),
  entity_id UUID NOT NULL,
  usage_count INT DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: same text -> same entity within org/property scope
  UNIQUE(org_id, property_id, normalized_text, entity_type)
);

-- Partial unique index for org-wide resolutions (null property_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_resolution_memory_org_wide
  ON resolution_memory(org_id, normalized_text, entity_type)
  WHERE property_id IS NULL;

-- Index for fast lookups by normalized text
CREATE INDEX IF NOT EXISTS idx_resolution_memory_lookup 
  ON resolution_memory(org_id, normalized_text);

-- Index for property-scoped lookups
CREATE INDEX IF NOT EXISTS idx_resolution_memory_property_lookup 
  ON resolution_memory(org_id, property_id, normalized_text)
  WHERE property_id IS NOT NULL;

-- Index for usage-based ordering
CREATE INDEX IF NOT EXISTS idx_resolution_memory_usage
  ON resolution_memory(org_id, usage_count DESC);

-- RLS Policies
ALTER TABLE resolution_memory ENABLE ROW LEVEL SECURITY;

-- Users can read resolution memory for their org
CREATE POLICY "Users can read resolution memory for their org"
  ON resolution_memory
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = resolution_memory.org_id
      AND org_members.user_id = auth.uid()
    )
  );

-- Users can manage resolution memory for their org
-- Note: Phase 2 is read-only, but policy is ready for Phase 4
CREATE POLICY "Users can manage resolution memory for their org"
  ON resolution_memory
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = resolution_memory.org_id
      AND org_members.user_id = auth.uid()
    )
  );

-- Function to increment usage count (for Phase 4)
CREATE OR REPLACE FUNCTION increment_resolution_memory_usage(
  p_org_id UUID,
  p_property_id UUID,
  p_normalized_text TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_raw_text TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO resolution_memory (
    org_id,
    property_id,
    raw_text,
    normalized_text,
    entity_type,
    entity_id,
    usage_count,
    last_used_at
  )
  VALUES (
    p_org_id,
    p_property_id,
    p_raw_text,
    p_normalized_text,
    p_entity_type,
    p_entity_id,
    1,
    NOW()
  )
  ON CONFLICT (org_id, property_id, normalized_text, entity_type)
  DO UPDATE SET
    usage_count = resolution_memory.usage_count + 1,
    last_used_at = NOW();
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION increment_resolution_memory_usage TO authenticated;
