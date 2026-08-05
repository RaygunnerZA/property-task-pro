-- Apply checklist templates from JSONB `checklist_templates.items`,
-- including rich step_type / indent / required requirements.

CREATE OR REPLACE FUNCTION public.apply_checklist_template(
  p_task uuid,
  p_template uuid,
  p_org uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item jsonb;
  item_title text;
  item_yes_no boolean;
  item_requires_signature boolean;
  item_step_type text;
  item_is_sub_step boolean;
  item_is_required boolean;
  item_order integer := 0;
  legacy_count integer := 0;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.checklist_templates t
    WHERE t.id = p_template
      AND t.org_id = p_org
      AND jsonb_typeof(t.items) = 'array'
      AND jsonb_array_length(t.items) > 0
  ) THEN
    FOR item IN
      SELECT value
      FROM public.checklist_templates t,
           LATERAL jsonb_array_elements(t.items) AS value
      WHERE t.id = p_template
        AND t.org_id = p_org
    LOOP
      item_title := NULLIF(TRIM(COALESCE(item->>'title', item->>'label', '')), '');
      IF item_title IS NULL THEN
        CONTINUE;
      END IF;

      item_step_type := COALESCE(NULLIF(item->>'step_type', ''), 'check');
      IF item_step_type = 'sub_step' THEN
        item_step_type := 'check';
      END IF;

      item_yes_no := COALESCE((item->>'is_yes_no')::boolean, false);
      item_requires_signature := COALESCE((item->>'requires_signature')::boolean, false);
      IF item_step_type = 'yes_no' THEN
        item_yes_no := true;
        item_requires_signature := false;
      ELSIF item_step_type = 'signature' THEN
        item_yes_no := false;
        item_requires_signature := true;
      END IF;

      item_is_sub_step := COALESCE((item->>'is_sub_step')::boolean, false);
      item_is_required := COALESCE((item->>'is_required')::boolean, false);

      INSERT INTO public.subtasks (
        task_id,
        org_id,
        title,
        is_completed,
        completed,
        is_yes_no,
        requires_signature,
        step_type,
        is_sub_step,
        is_required,
        order_index,
        template_id,
        is_archived
      ) VALUES (
        p_task,
        p_org,
        item_title,
        FALSE,
        FALSE,
        item_yes_no,
        item_requires_signature,
        item_step_type,
        item_is_sub_step,
        item_is_required,
        item_order,
        p_template,
        FALSE
      );

      item_order := item_order + 1;
    END LOOP;

    RETURN;
  END IF;

  SELECT COUNT(*) INTO legacy_count
  FROM public.checklist_template_items
  WHERE template_id = p_template;

  IF legacy_count = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.subtasks (
    task_id,
    org_id,
    title,
    is_completed,
    completed,
    is_yes_no,
    requires_signature,
    step_type,
    is_sub_step,
    is_required,
    order_index,
    template_id,
    is_archived
  )
  SELECT
    p_task,
    p_org,
    i.title,
    FALSE,
    FALSE,
    COALESCE(i.is_yes_no, false),
    COALESCE(i.requires_signature, false),
    CASE
      WHEN COALESCE(i.requires_signature, false) THEN 'signature'
      WHEN COALESCE(i.is_yes_no, false) THEN 'yes_no'
      ELSE 'check'
    END,
    false,
    false,
    COALESCE(i.order_index, 0),
    p_template,
    FALSE
  FROM public.checklist_template_items i
  WHERE i.template_id = p_template
  ORDER BY i.order_index ASC;
END;
$function$;
