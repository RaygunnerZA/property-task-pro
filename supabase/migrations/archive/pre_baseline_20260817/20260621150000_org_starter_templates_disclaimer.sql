-- Track org-level acceptance of starter template disclaimer (Manage Templates).

ALTER TABLE organisations
ADD COLUMN IF NOT EXISTS starter_templates_disclaimer_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN organisations.starter_templates_disclaimer_accepted_at IS
  'When the org accepted the starter template disclaimer (Add to library).';

CREATE OR REPLACE FUNCTION accept_starter_templates_disclaimer(p_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not an organisation member';
  END IF;

  UPDATE organisations
  SET starter_templates_disclaimer_accepted_at = now(),
      updated_at = now()
  WHERE id = p_org_id;
END;
$$;

REVOKE ALL ON FUNCTION accept_starter_templates_disclaimer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_starter_templates_disclaimer(UUID) TO authenticated;
