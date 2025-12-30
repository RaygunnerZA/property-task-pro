-- Add metadata and original_file_url columns to property_image_versions
ALTER TABLE property_image_versions 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS original_file_url TEXT;

-- Add index for metadata queries
CREATE INDEX IF NOT EXISTS idx_property_image_versions_metadata ON property_image_versions USING GIN (metadata);

-- Update annotate_property_image function to handle metadata and original_file_url
CREATE OR REPLACE FUNCTION annotate_property_image(
  p_property_id UUID,
  p_annotated_storage_path TEXT,
  p_annotated_thumbnail_path TEXT,
  p_annotation_summary TEXT DEFAULT NULL,
  p_annotation_json JSONB DEFAULT NULL,
  p_original_file_url TEXT DEFAULT NULL
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
  v_current_storage_path TEXT;
  v_is_first_annotation BOOLEAN;
  v_original_url TEXT;
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
  SELECT id, storage_path INTO v_current_version_id, v_current_storage_path
  FROM property_image_versions
  WHERE property_id = p_property_id
    AND is_archived = false
  ORDER BY version_number DESC
  LIMIT 1;
  
  IF v_current_version_id IS NULL THEN
    RAISE EXCEPTION 'No active image version found for property';
  END IF;
  
  -- Check if this is the first annotation (no metadata.annotation_json exists)
  SELECT (metadata->>'annotation_json') IS NULL INTO v_is_first_annotation
  FROM property_image_versions
  WHERE id = v_current_version_id;
  
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
  FROM property_image_versions
  WHERE property_id = p_property_id;
  
  -- Determine original_file_url: use provided value, or current storage_path if first annotation
  IF p_original_file_url IS NOT NULL THEN
    v_original_url := p_original_file_url;
  ELSIF v_is_first_annotation THEN
    v_original_url := v_current_storage_path;
  ELSE
    -- Get original from current version
    SELECT original_file_url INTO v_original_url
    FROM property_image_versions
    WHERE id = v_current_version_id;
  END IF;
  
  -- Archive current version
  UPDATE property_image_versions
  SET is_archived = true
  WHERE id = v_current_version_id;
  
  -- Create new annotated version
  INSERT INTO property_image_versions (
    property_id,
    version_number,
    storage_path,
    thumbnail_path,
    annotation_summary,
    metadata,
    original_file_url,
    is_original,
    is_archived,
    created_by
  ) VALUES (
    p_property_id,
    v_next_version,
    p_annotated_storage_path,
    p_annotated_thumbnail_path,
    p_annotation_summary,
    COALESCE(p_annotation_json, '{}'::jsonb),
    v_original_url,
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
      'has_annotation_json', p_annotation_json IS NOT NULL
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
GRANT EXECUTE ON FUNCTION annotate_property_image(UUID, TEXT, TEXT, TEXT, JSONB, TEXT) TO authenticated;

