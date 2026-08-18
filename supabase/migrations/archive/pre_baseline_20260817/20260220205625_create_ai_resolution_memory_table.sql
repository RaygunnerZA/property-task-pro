-- Re-create ai_resolution_memory table.
-- The original migration (20260107000000) was tracked but never executed because its
-- RLS policies referenced 'org_members' instead of the correct 'organisation_members',
-- causing the transaction to roll back silently.

CREATE TABLE IF NOT EXISTS ai_resolution_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, key, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_ai_resolution_memory_lookup
  ON ai_resolution_memory(org_id, key, entity_type);

ALTER TABLE ai_resolution_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read resolution memory for their org" ON ai_resolution_memory;
CREATE POLICY "Users can read resolution memory for their org"
  ON ai_resolution_memory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organisation_members
      WHERE organisation_members.org_id = ai_resolution_memory.org_id
        AND organisation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage resolution memory for their org" ON ai_resolution_memory;
CREATE POLICY "Users can manage resolution memory for their org"
  ON ai_resolution_memory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organisation_members
      WHERE organisation_members.org_id = ai_resolution_memory.org_id
        AND organisation_members.user_id = auth.uid()
    )
  );
