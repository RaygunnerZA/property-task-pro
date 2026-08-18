-- Task Activity: record post-creation changes on tasks + checklist steps into audit_logs.
-- Activity tab reads entity_type = 'task' / entity_id = tasks.id (@Docs/03_Data_Model, 05_Task_Engine §5.9).

CREATE OR REPLACE FUNCTION public.record_task_audit(
  p_org_id uuid,
  p_task_id uuid,
  p_action text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_org_id IS NULL OR p_task_id IS NULL OR p_action IS NULL OR btrim(p_action) = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    p_org_id,
    auth.uid(),
    'task',
    p_task_id,
    p_action,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_task_audit(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_task_audit(uuid, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_task_audit(uuid, uuid, text, jsonb) TO service_role;

-- Friendly day label for summaries (e.g. "4 July").
CREATE OR REPLACE FUNCTION public._audit_day_label(p_ts timestamptz)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_ts IS NULL THEN 'none'
    ELSE trim(to_char(p_ts AT TIME ZONE 'UTC', 'FMDD Month'))
  END;
$$;

CREATE OR REPLACE FUNCTION public.tasks_activity_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary text;
BEGIN
  -- Title
  IF NEW.title IS DISTINCT FROM OLD.title THEN
    v_summary := format(
      'Title changed to %s',
      CASE
        WHEN NEW.title IS NULL OR btrim(NEW.title) = '' THEN 'untitled'
        ELSE left(btrim(NEW.title), 80)
      END
    );
    PERFORM public.record_task_audit(
      NEW.org_id,
      NEW.id,
      'task.title_changed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'title',
        'previous', OLD.title,
        'next', NEW.title
      )
    );
  END IF;

  -- Description
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    v_summary := CASE
      WHEN NEW.description IS NULL OR btrim(NEW.description) = '' THEN 'Description cleared'
      ELSE 'Description updated'
    END;
    PERFORM public.record_task_audit(
      NEW.org_id,
      NEW.id,
      'task.description_changed',
      jsonb_build_object('summary', v_summary, 'field', 'description')
    );
  END IF;

  -- Due date (column is due_at)
  IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN
    v_summary := CASE
      WHEN NEW.due_at IS NULL THEN 'Due Date cleared'
      ELSE format('Due Date changed to %s', public._audit_day_label(NEW.due_at))
    END;
    PERFORM public.record_task_audit(
      NEW.org_id,
      NEW.id,
      'task.due_date_changed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'due_date',
        'previous', OLD.due_at,
        'next', NEW.due_at
      )
    );
  END IF;

  -- Status
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_summary := format(
      'Status changed to %s',
      replace(COALESCE(NEW.status::text, 'unknown'), '_', ' ')
    );
    PERFORM public.record_task_audit(
      NEW.org_id,
      NEW.id,
      'task.status_changed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'status',
        'previous', OLD.status,
        'next', NEW.status
      )
    );
  END IF;

  -- Priority
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    v_summary := CASE
      WHEN NEW.priority IS NULL OR btrim(NEW.priority) = '' THEN 'Priority cleared'
      ELSE format('Priority changed to %s', NEW.priority)
    END;
    PERFORM public.record_task_audit(
      NEW.org_id,
      NEW.id,
      'task.priority_changed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'priority',
        'previous', OLD.priority,
        'next', NEW.priority
      )
    );
  END IF;

  -- Assignee
  IF NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id THEN
    v_summary := CASE
      WHEN NEW.assigned_user_id IS NULL THEN 'Assignee cleared'
      ELSE 'Assignee changed'
    END;
    PERFORM public.record_task_audit(
      NEW.org_id,
      NEW.id,
      'task.assignment_changed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'assigned_user_id',
        'previous', OLD.assigned_user_id,
        'next', NEW.assigned_user_id
      )
    );
  END IF;

  -- Property
  IF NEW.property_id IS DISTINCT FROM OLD.property_id THEN
    v_summary := CASE
      WHEN NEW.property_id IS NULL THEN 'Property cleared'
      ELSE 'Property changed'
    END;
    PERFORM public.record_task_audit(
      NEW.org_id,
      NEW.id,
      'task.property_changed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'property_id',
        'previous', OLD.property_id,
        'next', NEW.property_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_activity_audit ON public.tasks;
CREATE TRIGGER trg_tasks_activity_audit
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tasks_activity_audit();

CREATE OR REPLACE FUNCTION public.subtasks_activity_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_task_id uuid;
  v_item_num int;
  v_summary text;
  v_title text;
  v_archived_old boolean;
  v_archived_new boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_task_id := OLD.task_id;
    v_org_id := OLD.org_id;
    v_title := COALESCE(NULLIF(btrim(OLD.title), ''), 'Untitled step');
    PERFORM public.record_task_audit(
      v_org_id,
      v_task_id,
      'task.checklist_item_removed',
      jsonb_build_object(
        'summary', format('Checklist item removed (%s)', left(v_title, 60)),
        'field', 'checklist',
        'subtask_id', OLD.id,
        'title', OLD.title
      )
    );
    RETURN OLD;
  END IF;

  v_task_id := NEW.task_id;
  v_org_id := NEW.org_id;
  v_title := COALESCE(NULLIF(btrim(NEW.title), ''), 'Untitled step');

  IF TG_OP = 'INSERT' THEN
    -- Skip checklist rows inserted as part of initial task creation.
    IF EXISTS (
      SELECT 1
        FROM public.tasks t
       WHERE t.id = NEW.task_id
         AND t.created_at > (now() - interval '10 seconds')
         AND NOT EXISTS (
           SELECT 1
             FROM public.audit_logs al
            WHERE al.entity_type = 'task'
              AND al.entity_id = NEW.task_id
              AND al.action NOT LIKE 'task.checklist%'
         )
    ) THEN
      RETURN NEW;
    END IF;

    SELECT COUNT(*)::int
      INTO v_item_num
      FROM public.subtasks s
     WHERE s.task_id = NEW.task_id
       AND COALESCE(s.is_archived, false) = false;

    v_summary := format('Checklist item #%s added', v_item_num);
    IF NEW.title IS NOT NULL AND btrim(NEW.title) <> '' THEN
      v_summary := v_summary || format(' (%s)', left(btrim(NEW.title), 40));
    END IF;

    PERFORM public.record_task_audit(
      v_org_id,
      v_task_id,
      'task.checklist_item_added',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'checklist',
        'item_index', v_item_num,
        'subtask_id', NEW.id,
        'title', NEW.title,
        'step_type', NEW.step_type
      )
    );
    RETURN NEW;
  END IF;

  -- UPDATE
  v_archived_old := COALESCE(OLD.is_archived, false);
  v_archived_new := COALESCE(NEW.is_archived, false);

  IF v_archived_old IS DISTINCT FROM v_archived_new AND v_archived_new = true THEN
    SELECT COUNT(*)::int
      INTO v_item_num
      FROM public.subtasks s
     WHERE s.task_id = NEW.task_id
       AND s.id <> NEW.id
       AND COALESCE(s.is_archived, false) = false;

    -- Approximate former position as remaining + 1
    v_item_num := v_item_num + 1;
    v_summary := format('Checklist item #%s removed', v_item_num);
    IF OLD.title IS NOT NULL AND btrim(OLD.title) <> '' THEN
      v_summary := v_summary || format(' (%s)', left(btrim(OLD.title), 40));
    END IF;

    PERFORM public.record_task_audit(
      v_org_id,
      v_task_id,
      'task.checklist_item_removed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'checklist',
        'subtask_id', NEW.id,
        'title', OLD.title
      )
    );
    RETURN NEW;
  END IF;

  -- Ignore pure geo / metadata enrichment patches after completion.
  IF COALESCE(NEW.is_completed, false) IS DISTINCT FROM COALESCE(OLD.is_completed, false)
     AND COALESCE(NEW.is_completed, false) = true THEN
    v_summary := format('Checklist item completed (%s)', left(v_title, 60));
    PERFORM public.record_task_audit(
      v_org_id,
      v_task_id,
      'task.checklist_item_completed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'checklist',
        'subtask_id', NEW.id,
        'title', NEW.title,
        'step_type', NEW.step_type,
        'response_value', NEW.response_value
      )
    );
  ELSIF NEW.title IS DISTINCT FROM OLD.title THEN
    v_summary := format('Checklist item renamed to %s', left(v_title, 60));
    PERFORM public.record_task_audit(
      v_org_id,
      v_task_id,
      'task.checklist_item_renamed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'checklist',
        'subtask_id', NEW.id,
        'previous', OLD.title,
        'next', NEW.title
      )
    );
  ELSIF NEW.step_type IS DISTINCT FROM OLD.step_type THEN
    v_summary := format(
      'Checklist item type changed to %s',
      replace(COALESCE(NEW.step_type, 'check'), '_', ' ')
    );
    PERFORM public.record_task_audit(
      v_org_id,
      v_task_id,
      'task.checklist_item_type_changed',
      jsonb_build_object(
        'summary', v_summary,
        'field', 'checklist',
        'subtask_id', NEW.id,
        'previous', OLD.step_type,
        'next', NEW.step_type
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subtasks_activity_audit ON public.subtasks;
CREATE TRIGGER trg_subtasks_activity_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.subtasks
  FOR EACH ROW
  EXECUTE FUNCTION public.subtasks_activity_audit();

NOTIFY pgrst, 'reload schema';
