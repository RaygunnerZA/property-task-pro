-- Org-level required fields on tasks (photo, location, category).
-- Owner/Manager policy in org_settings; completion is enforced in the database.
-- Staff may read the policy (so the create/complete UI can explain what is missing)
-- but must not write org_settings.

ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS require_task_photo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_task_location boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_task_category boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.org_settings.require_task_photo IS
  'When true, a task must have a photo (non-signature image attachment or image_url) before it can be completed.';
COMMENT ON COLUMN public.org_settings.require_task_location IS
  'When true, a task must have a property and at least one space before it can be completed.';
COMMENT ON COLUMN public.org_settings.require_task_category IS
  'When true, a task must have at least one theme/category before it can be completed.';

DROP POLICY IF EXISTS org_settings_insert ON public.org_settings;
DROP POLICY IF EXISTS org_settings_update ON public.org_settings;

CREATE POLICY org_settings_insert ON public.org_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_owner_or_manager(org_id));

CREATE POLICY org_settings_update ON public.org_settings
  FOR UPDATE TO authenticated
  USING (public.is_org_owner_or_manager(org_id))
  WITH CHECK (public.is_org_owner_or_manager(org_id));

-- Completion gate. SECURITY DEFINER so assignees can be blocked even though
-- they cannot write org_settings. search_path pinned. Fail closed.
CREATE OR REPLACE FUNCTION public.enforce_task_capture_requirements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_require_photo boolean := false;
  v_require_location boolean := false;
  v_require_category boolean := false;
  v_has_photo boolean := false;
  v_has_location boolean := false;
  v_has_category boolean := false;
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(os.require_task_photo, false),
    COALESCE(os.require_task_location, false),
    COALESCE(os.require_task_category, false)
  INTO v_require_photo, v_require_location, v_require_category
  FROM public.org_settings os
  WHERE os.org_id = NEW.org_id;

  IF NOT COALESCE(v_require_photo, false)
     AND NOT COALESCE(v_require_location, false)
     AND NOT COALESCE(v_require_category, false) THEN
    RETURN NEW;
  END IF;

  IF v_require_photo THEN
    v_has_photo :=
      NEW.image_url IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM public.attachments att
        WHERE att.parent_id = NEW.id
          AND att.parent_type = 'task'
          AND att.org_id = NEW.org_id
          AND COALESCE(lower(att.file_name), '') NOT LIKE 'signature.%'
          AND COALESCE(att.metadata ->> 'evidence_kind', '') IS DISTINCT FROM 'signature'
          AND (
            COALESCE(att.file_type, '') ILIKE 'image/%'
            OR COALESCE(att.file_name, '') ~* '\.(jpe?g|png|gif|webp|heic|heif)$'
          )
      );
    IF NOT v_has_photo THEN
      v_missing := array_append(v_missing, 'a photo');
    END IF;
  END IF;

  IF v_require_location THEN
    v_has_location :=
      NEW.property_id IS NOT NULL
      AND (
        COALESCE(array_length(NEW.space_ids, 1), 0) > 0
        OR EXISTS (SELECT 1 FROM public.task_spaces ts WHERE ts.task_id = NEW.id)
      );
    IF NOT v_has_location THEN
      v_missing := array_append(v_missing, 'a location (property and space)');
    END IF;
  END IF;

  IF v_require_category THEN
    v_has_category := EXISTS (
      SELECT 1 FROM public.task_themes tt WHERE tt.task_id = NEW.id
    );
    IF NOT v_has_category THEN
      v_missing := array_append(v_missing, 'a category');
    END IF;
  END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'TASK_CAPTURE_REQUIRED: Add % before completing this task.',
      array_to_string(v_missing, ', ')
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_task_capture_requirements() IS
  'Blocks completing a task when org_settings require photo, location (property+space), or category and those are missing.';

DROP TRIGGER IF EXISTS trg_enforce_task_capture_requirements ON public.tasks;
CREATE TRIGGER trg_enforce_task_capture_requirements
  BEFORE INSERT OR UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_task_capture_requirements();

REVOKE ALL ON FUNCTION public.enforce_task_capture_requirements() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_task_capture_requirements() FROM anon, authenticated;
