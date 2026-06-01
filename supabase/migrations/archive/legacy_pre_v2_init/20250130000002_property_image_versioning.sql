-- Property Image Versioning and Audit System
-- Similar to task_images system, tracks all versions and changes to property images

-- Create property_image_versions table
CREATE TABLE IF NOT EXISTS property_image_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  annotation_summary TEXT,
  is_original BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, version_number)
);

-- Create property_image_actions table for audit logging
CREATE TABLE IF NOT EXISTS property_image_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  image_version_id UUID REFERENCES property_image_versions(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- 'upload', 'annotate', 'replace', 'archive', 'restore'
  user_id UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_property_image_versions_property_id ON property_image_versions(property_id);
CREATE INDEX IF NOT EXISTS idx_property_image_versions_is_archived ON property_image_versions(is_archived);
CREATE INDEX IF NOT EXISTS idx_property_image_actions_property_id ON property_image_actions(property_id);
CREATE INDEX IF NOT EXISTS idx_property_image_actions_image_version_id ON property_image_actions(image_version_id);
CREATE INDEX IF NOT EXISTS idx_property_image_actions_action_type ON property_image_actions(action_type);

-- RLS Policies
ALTER TABLE property_image_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_image_actions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view property image versions for properties in their org
CREATE POLICY "Users can view property image versions"
ON property_image_versions FOR SELECT
TO authenticated
USING (
  property_id IN (
    SELECT p.id FROM properties p
    INNER JOIN organisation_members om ON p.org_id = om.org_id
    WHERE om.user_id = auth.uid()
  )
);

-- Policy: Users can insert property image versions for properties in their org
CREATE POLICY "Users can insert property image versions"
ON property_image_versions FOR INSERT
TO authenticated
WITH CHECK (
  property_id IN (
    SELECT p.id FROM properties p
    INNER JOIN organisation_members om ON p.org_id = om.org_id
    WHERE om.user_id = auth.uid()
  )
);

-- Policy: Users can update property image versions for properties in their org
CREATE POLICY "Users can update property image versions"
ON property_image_versions FOR UPDATE
TO authenticated
USING (
  property_id IN (
    SELECT p.id FROM properties p
    INNER JOIN organisation_members om ON p.org_id = om.org_id
    WHERE om.user_id = auth.uid()
  )
);

-- Policy: Users can view property image actions for properties in their org
CREATE POLICY "Users can view property image actions"
ON property_image_actions FOR SELECT
TO authenticated
USING (
  property_id IN (
    SELECT p.id FROM properties p
    INNER JOIN organisation_members om ON p.org_id = om.org_id
    WHERE om.user_id = auth.uid()
  )
);

-- Policy: Users can insert property image actions for properties in their org
CREATE POLICY "Users can insert property image actions"
ON property_image_actions FOR INSERT
TO authenticated
WITH CHECK (
  property_id IN (
    SELECT p.id FROM properties p
    INNER JOIN organisation_members om ON p.org_id = om.org_id
    WHERE om.user_id = auth.uid()
  )
);

-- RPC Function: Archive property image version
CREATE OR REPLACE FUNCTION archive_property_image_version(
  p_property_id UUID,
  p_version_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_version_record RECORD;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: User must be authenticated';
  END IF;
  
  -- Get property org_id
  SELECT org_id INTO v_org_id
  FROM properties
  WHERE id = p_property_id;
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Property not found: %', p_property_id;
  END IF;
  
  -- Check user is member of org
  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = v_org_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access Denied: User is not a member of this organisation';
  END IF;
  
  -- Get version record
  SELECT * INTO v_version_record
  FROM property_image_versions
  WHERE id = p_version_id AND property_id = p_property_id;
  
  IF v_version_record IS NULL THEN
    RAISE EXCEPTION 'Image version not found';
  END IF;
  
  -- Archive the version
  UPDATE property_image_versions
  SET is_archived = true
  WHERE id = p_version_id;
  
  -- Log the action
  INSERT INTO property_image_actions (
    property_id,
    image_version_id,
    action_type,
    user_id,
    metadata
  ) VALUES (
    p_property_id,
    p_version_id,
    'archive',
    v_user_id,
    jsonb_build_object(
      'previous_version_number', v_version_record.version_number,
      'storage_path', v_version_record.storage_path
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'version_id', p_version_id
  );
END;
$$;

-- RPC Function: Replace property image (creates new version, archives old)
CREATE OR REPLACE FUNCTION replace_property_image(
  p_property_id UUID,
  p_new_storage_path TEXT,
  p_new_thumbnail_path TEXT,
  p_annotation_summary TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_next_version INTEGER;
  v_new_version_id UUID;
  v_current_version_id UUID;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: User must be authenticated';
  END IF;
  
  -- Get property org_id
  SELECT org_id INTO v_org_id
  FROM properties
  WHERE id = p_property_id;
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Property not found: %', p_property_id;
  END IF;
  
  -- Check user is member of org
  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = v_org_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access Denied: User is not a member of this organisation';
  END IF;
  
  -- Get current active version (not archived)
  SELECT id INTO v_current_version_id
  FROM property_image_versions
  WHERE property_id = p_property_id
    AND is_archived = false
  ORDER BY version_number DESC
  LIMIT 1;
  
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
  FROM property_image_versions
  WHERE property_id = p_property_id;
  
  -- Archive current version if exists
  IF v_current_version_id IS NOT NULL THEN
    UPDATE property_image_versions
    SET is_archived = true
    WHERE id = v_current_version_id;
  END IF;
  
  -- Create new version
  INSERT INTO property_image_versions (
    property_id,
    version_number,
    storage_path,
    thumbnail_path,
    annotation_summary,
    is_original,
    is_archived,
    created_by
  ) VALUES (
    p_property_id,
    v_next_version,
    p_new_storage_path,
    p_new_thumbnail_path,
    p_annotation_summary,
    v_current_version_id IS NULL, -- First version is original
    false,
    v_user_id
  )
  RETURNING id INTO v_new_version_id;
  
  -- Update property thumbnail_url
  UPDATE properties
  SET thumbnail_url = p_new_thumbnail_path
  WHERE id = p_property_id;
  
  -- Log the action
  INSERT INTO property_image_actions (
    property_id,
    image_version_id,
    action_type,
    user_id,
    metadata
  ) VALUES (
    p_property_id,
    v_new_version_id,
    CASE WHEN v_current_version_id IS NOT NULL THEN 'replace' ELSE 'upload' END,
    v_user_id,
    jsonb_build_object(
      'version_number', v_next_version,
      'storage_path', p_new_storage_path,
      'thumbnail_path', p_new_thumbnail_path,
      'previous_version_id', v_current_version_id,
      'annotation_summary', p_annotation_summary
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'version_id', v_new_version_id,
    'version_number', v_next_version
  );
END;
$$;

-- RPC Function: Annotate property image (creates annotated version)
CREATE OR REPLACE FUNCTION annotate_property_image(
  p_property_id UUID,
  p_annotated_storage_path TEXT,
  p_annotated_thumbnail_path TEXT,
  p_annotation_summary TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_next_version INTEGER;
  v_new_version_id UUID;
  v_current_version_id UUID;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: User must be authenticated';
  END IF;
  
  -- Get property org_id
  SELECT org_id INTO v_org_id
  FROM properties
  WHERE id = p_property_id;
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Property not found: %', p_property_id;
  END IF;
  
  -- Check user is member of org
  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = v_org_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access Denied: User is not a member of this organisation';
  END IF;
  
  -- Get current active version
  SELECT id INTO v_current_version_id
  FROM property_image_versions
  WHERE property_id = p_property_id
    AND is_archived = false
  ORDER BY version_number DESC
  LIMIT 1;
  
  IF v_current_version_id IS NULL THEN
    RAISE EXCEPTION 'No active image version found for property';
  END IF;
  
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
  FROM property_image_versions
  WHERE property_id = p_property_id;
  
  -- Create new annotated version (don't archive current, keep both)
  INSERT INTO property_image_versions (
    property_id,
    version_number,
    storage_path,
    thumbnail_path,
    annotation_summary,
    is_original,
    is_archived,
    created_by
  ) VALUES (
    p_property_id,
    v_next_version,
    p_annotated_storage_path,
    p_annotated_thumbnail_path,
    p_annotation_summary,
    false,
    false,
    v_user_id
  )
  RETURNING id INTO v_new_version_id;
  
  -- Update property thumbnail_url to annotated version
  UPDATE properties
  SET thumbnail_url = p_annotated_thumbnail_path
  WHERE id = p_property_id;
  
  -- Log the action
  INSERT INTO property_image_actions (
    property_id,
    image_version_id,
    action_type,
    user_id,
    metadata
  ) VALUES (
    p_property_id,
    v_new_version_id,
    'annotate',
    v_user_id,
    jsonb_build_object(
      'version_number', v_next_version,
      'storage_path', p_annotated_storage_path,
      'thumbnail_path', p_annotated_thumbnail_path,
      'annotation_summary', p_annotation_summary,
      'based_on_version_id', v_current_version_id
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'version_id', v_new_version_id,
    'version_number', v_next_version
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION archive_property_image_version(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION replace_property_image(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION annotate_property_image(UUID, TEXT, TEXT, TEXT) TO authenticated;

