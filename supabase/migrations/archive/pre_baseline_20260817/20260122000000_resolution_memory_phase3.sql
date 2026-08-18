-- Resolution Memory Phase 3: Learning & Adaptive Intelligence
-- 
-- Extends resolution_memory with:
-- - confidence_override: User-set confidence (null = use calculated)
-- - source: Where the resolution came from ('rule', 'fuzzy', 'ai', 'user')
-- - last_confirmed_at: When user last confirmed this resolution
-- - user_id: For user-specific memory (null = org-wide)
-- - is_rejected: For negative learning (rejection tracking)
-- - rejection_expires_at: When negative learning expires (default 30 days)

-- Add new columns
ALTER TABLE resolution_memory 
ADD COLUMN IF NOT EXISTS confidence_override DECIMAL(3,2) CHECK (confidence_override IS NULL OR (confidence_override >= 0 AND confidence_override <= 1)),
ADD COLUMN IF NOT EXISTS source TEXT CHECK (source IN ('rule', 'fuzzy', 'ai', 'user')) DEFAULT 'rule',
ADD COLUMN IF NOT EXISTS last_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_rejected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rejection_expires_at TIMESTAMPTZ;

-- Index for user-specific lookups
CREATE INDEX IF NOT EXISTS idx_resolution_memory_user_lookup 
  ON resolution_memory(org_id, user_id, normalized_text)
  WHERE user_id IS NOT NULL;

-- Index for rejection expiry cleanup
CREATE INDEX IF NOT EXISTS idx_resolution_memory_rejection_expiry
  ON resolution_memory(rejection_expires_at)
  WHERE is_rejected = TRUE AND rejection_expires_at IS NOT NULL;

-- Function to record a learning event (reinforcement or rejection)
CREATE OR REPLACE FUNCTION record_resolution_learning(
  p_org_id UUID,
  p_user_id UUID,
  p_property_id UUID,
  p_raw_text TEXT,
  p_normalized_text TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_source TEXT,
  p_is_rejection BOOLEAN DEFAULT FALSE,
  p_confidence_override DECIMAL DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rejection_expires TIMESTAMPTZ;
BEGIN
  -- Set rejection expiry to 30 days from now if this is a rejection
  IF p_is_rejection THEN
    v_rejection_expires := NOW() + INTERVAL '30 days';
  END IF;

  -- Upsert the resolution memory
  INSERT INTO resolution_memory (
    org_id,
    user_id,
    property_id,
    raw_text,
    normalized_text,
    entity_type,
    entity_id,
    source,
    confidence_override,
    is_rejected,
    rejection_expires_at,
    usage_count,
    last_used_at,
    last_confirmed_at
  )
  VALUES (
    p_org_id,
    p_user_id,
    p_property_id,
    p_raw_text,
    p_normalized_text,
    p_entity_type,
    p_entity_id,
    p_source,
    CASE WHEN p_is_rejection THEN 0 ELSE COALESCE(p_confidence_override, 1.0) END,
    p_is_rejection,
    v_rejection_expires,
    CASE WHEN p_is_rejection THEN 0 ELSE 1 END,
    NOW(),
    CASE WHEN NOT p_is_rejection THEN NOW() ELSE NULL END
  )
  ON CONFLICT (org_id, property_id, normalized_text, entity_type)
  DO UPDATE SET
    -- If it's a rejection, mark as rejected
    is_rejected = p_is_rejection,
    rejection_expires_at = CASE WHEN p_is_rejection THEN v_rejection_expires ELSE NULL END,
    -- If it's a confirmation, clear rejection and boost
    confidence_override = CASE 
      WHEN p_is_rejection THEN 0 
      ELSE COALESCE(p_confidence_override, 1.0)
    END,
    source = CASE WHEN NOT p_is_rejection THEN p_source ELSE resolution_memory.source END,
    usage_count = CASE 
      WHEN p_is_rejection THEN 0 
      ELSE resolution_memory.usage_count + 1 
    END,
    last_used_at = NOW(),
    last_confirmed_at = CASE WHEN NOT p_is_rejection THEN NOW() ELSE resolution_memory.last_confirmed_at END,
    -- Preserve user_id if set, or use the new one
    user_id = COALESCE(resolution_memory.user_id, p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION record_resolution_learning TO authenticated;

-- Function to clean up expired rejections (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_rejections()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM resolution_memory
  WHERE is_rejected = TRUE
    AND rejection_expires_at IS NOT NULL
    AND rejection_expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Function to get resolution memory with user priority
-- Returns user-specific first, then org-wide
CREATE OR REPLACE FUNCTION get_resolution_memory(
  p_org_id UUID,
  p_user_id UUID,
  p_normalized_texts TEXT[],
  p_property_id UUID DEFAULT NULL
)
RETURNS TABLE (
  normalized_text TEXT,
  entity_type TEXT,
  entity_id UUID,
  confidence_override DECIMAL,
  source TEXT,
  usage_count INT,
  is_rejected BOOLEAN,
  is_user_specific BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH ranked_memory AS (
    SELECT 
      rm.normalized_text,
      rm.entity_type,
      rm.entity_id,
      rm.confidence_override,
      rm.source,
      rm.usage_count,
      rm.is_rejected,
      rm.user_id IS NOT NULL AS is_user_specific,
      -- Priority: user-specific > property-scoped > org-wide
      ROW_NUMBER() OVER (
        PARTITION BY rm.normalized_text, rm.entity_type
        ORDER BY 
          CASE WHEN rm.user_id = p_user_id THEN 0 ELSE 1 END,
          CASE WHEN rm.property_id = p_property_id THEN 0 ELSE 1 END,
          rm.usage_count DESC
      ) as rn
    FROM resolution_memory rm
    WHERE rm.org_id = p_org_id
      AND rm.normalized_text = ANY(p_normalized_texts)
      AND (rm.user_id IS NULL OR rm.user_id = p_user_id)
      AND (rm.property_id IS NULL OR rm.property_id = p_property_id)
      -- Exclude expired rejections
      AND (
        rm.is_rejected = FALSE 
        OR rm.rejection_expires_at IS NULL 
        OR rm.rejection_expires_at > NOW()
      )
  )
  SELECT 
    rm.normalized_text,
    rm.entity_type,
    rm.entity_id,
    rm.confidence_override,
    rm.source,
    rm.usage_count,
    rm.is_rejected,
    rm.is_user_specific
  FROM ranked_memory rm
  WHERE rm.rn = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_resolution_memory TO authenticated;

-- Add memory version for cache invalidation
CREATE TABLE IF NOT EXISTS resolution_memory_version (
  org_id UUID PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  version_hash TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to increment memory version (called on writes)
CREATE OR REPLACE FUNCTION increment_memory_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO resolution_memory_version (org_id, version_hash, updated_at)
  VALUES (
    COALESCE(NEW.org_id, OLD.org_id), 
    gen_random_uuid()::text, 
    NOW()
  )
  ON CONFLICT (org_id) 
  DO UPDATE SET 
    version_hash = gen_random_uuid()::text,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger to auto-increment version on memory changes
DROP TRIGGER IF EXISTS resolution_memory_version_trigger ON resolution_memory;
CREATE TRIGGER resolution_memory_version_trigger
  AFTER INSERT OR UPDATE OR DELETE ON resolution_memory
  FOR EACH ROW
  EXECUTE FUNCTION increment_memory_version();

-- RLS for memory version
ALTER TABLE resolution_memory_version ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read memory version for their org"
  ON resolution_memory_version
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = resolution_memory_version.org_id
      AND org_members.user_id = auth.uid()
    )
  );
