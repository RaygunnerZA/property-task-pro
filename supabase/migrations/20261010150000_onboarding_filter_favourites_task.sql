-- Teach filter-favourite drag and drop as an onboarding setup task.
-- The main demo seed returns early once a property already has sample tasks,
-- so this companion runs after that seed and backfills properties that already
-- received the demo.

CREATE OR REPLACE FUNCTION public.seed_filter_favourites_onboarding_task(p_property_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SET LOCAL row_security = off;

  SELECT org_id INTO v_org_id FROM public.properties WHERE id = p_property_id;
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tasks
    WHERE property_id = p_property_id
      AND title = 'Pin Filter Favourites'
      AND description LIKE '%[onboarding_demo]%'
  ) THEN
    RETURN;
  END IF;

  -- Stay quiet on properties that never received the onboarding demo.
  IF NOT EXISTS (
    SELECT 1
    FROM public.tasks
    WHERE property_id = p_property_id
      AND description LIKE '%[onboarding_demo]%'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.tasks (org_id, property_id, title, description, status, priority, icon_name)
  VALUES (
    v_org_id,
    p_property_id,
    'Pin Filter Favourites',
    'Hold a filter chip and drop it on the favourites row. Drag a favourite to reorder it, or drop it on Remove to unpin it. Why: The filters you use stay one tap away. [onboarding_demo]',
    'open',
    'low',
    'bookmark'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.seed_filter_favourites_onboarding_task(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_filter_favourites_onboarding_task(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.seed_filter_favourites_onboarding_task(uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.trigger_seed_property_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM seed_property_defaults(NEW.id, NEW.org_id);
  PERFORM seed_onboarding_demo_for_property(NEW.id);
  PERFORM seed_filter_favourites_onboarding_task(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_onboarding_education_for_property(p_property_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM clear_onboarding_demo_for_property(p_property_id);
  PERFORM seed_onboarding_demo_for_property(p_property_id);
  PERFORM seed_filter_favourites_onboarding_task(p_property_id);
END;
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT property_id
    FROM public.tasks
    WHERE property_id IS NOT NULL
      AND description LIKE '%[onboarding_demo]%'
  LOOP
    PERFORM public.seed_filter_favourites_onboarding_task(r.property_id);
  END LOOP;
END $$;
