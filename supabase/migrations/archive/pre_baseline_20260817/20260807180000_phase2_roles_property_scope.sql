-- Phase 2: Primary Owner, member→staff, property scope RLS, Staff create-task deny,
-- role-change audit, accept_invitation default staff, transfer ownership, revoke invite.
-- @Docs/02_Identity.md §3a §10 §11 · @Docs/28_Billing_Implementation_Plan.md Phase 2

-- ---------------------------------------------------------------------------
-- 1) Primary Owner + membership status
-- ---------------------------------------------------------------------------
ALTER TABLE public.organisation_members
  ADD COLUMN IF NOT EXISTS is_primary_owner BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.organisation_members
  ADD COLUMN IF NOT EXISTS membership_status TEXT NOT NULL DEFAULT 'active';

COMMENT ON COLUMN public.organisation_members.is_primary_owner IS
  'Exactly one Primary Owner per org; controls transfer/delete/billing defaults.';
COMMENT ON COLUMN public.organisation_members.membership_status IS
  'active | suspended — suspended members lose product access.';

CREATE UNIQUE INDEX IF NOT EXISTS organisation_members_one_primary_owner
  ON public.organisation_members (org_id)
  WHERE is_primary_owner = true;

-- Migrate legacy member → staff
UPDATE public.organisation_members
SET role = 'staff'
WHERE lower(role) = 'member';

-- Backfill Primary Owner: earliest owner per org (else earliest member)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY org_id
      ORDER BY
        CASE WHEN lower(role) = 'owner' THEN 0 ELSE 1 END,
        created_at ASC NULLS LAST
    ) AS rn
  FROM public.organisation_members
)
UPDATE public.organisation_members om
SET is_primary_owner = true
FROM ranked r
WHERE om.id = r.id
  AND r.rn = 1
  AND NOT EXISTS (
    SELECT 1 FROM public.organisation_members x
    WHERE x.org_id = om.org_id AND x.is_primary_owner = true
  );

-- Ensure Primary Owners are owners
UPDATE public.organisation_members
SET role = 'owner'
WHERE is_primary_owner = true AND lower(role) IS DISTINCT FROM 'owner';

-- ---------------------------------------------------------------------------
-- 2) Guard: cannot clear last Primary Owner / demote without transfer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.organisation_members_primary_owner_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_primary_owner = true AND NEW.is_primary_owner = false THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.organisation_members
        WHERE org_id = OLD.org_id
          AND id IS DISTINCT FROM OLD.id
          AND is_primary_owner = true
      ) THEN
        RAISE EXCEPTION 'Cannot remove Primary Owner without transferring ownership first';
      END IF;
    END IF;
    IF OLD.is_primary_owner = true AND lower(NEW.role) IS DISTINCT FROM 'owner' THEN
      RAISE EXCEPTION 'Primary Owner must keep the owner role; transfer ownership first';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_primary_owner = true THEN
      RAISE EXCEPTION 'Cannot delete Primary Owner; transfer ownership first';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS organisation_members_primary_owner_guard ON public.organisation_members;
CREATE TRIGGER organisation_members_primary_owner_guard
  BEFORE UPDATE OR DELETE ON public.organisation_members
  FOR EACH ROW
  EXECUTE FUNCTION public.organisation_members_primary_owner_guard();

-- ---------------------------------------------------------------------------
-- 3) Role-change audit (uses audit_logs when present)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.organisation_members_role_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (
       OLD.role IS DISTINCT FROM NEW.role
       OR OLD.is_primary_owner IS DISTINCT FROM NEW.is_primary_owner
       OR OLD.assigned_properties IS DISTINCT FROM NEW.assigned_properties
       OR OLD.membership_status IS DISTINCT FROM NEW.membership_status
     )
     AND EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'audit_logs'
     )
  THEN
    INSERT INTO public.audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
    VALUES (
      NEW.org_id,
      auth.uid(),
      'organisation_member',
      NEW.id,
      'member.updated',
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'old_primary', OLD.is_primary_owner,
        'new_primary', NEW.is_primary_owner,
        'old_status', OLD.membership_status,
        'new_status', NEW.membership_status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisation_members_role_audit ON public.organisation_members;
CREATE TRIGGER organisation_members_role_audit
  AFTER UPDATE ON public.organisation_members
  FOR EACH ROW
  EXECUTE FUNCTION public.organisation_members_role_audit();

-- ---------------------------------------------------------------------------
-- 4) Helper: member can access property
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.member_can_access_property(
  p_org_id uuid,
  p_property_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organisation_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND COALESCE(om.membership_status, 'active') = 'active'
      AND (
        om.is_primary_owner = true
        OR lower(om.role) = 'owner'
        OR om.assigned_properties IS NULL
        OR cardinality(om.assigned_properties) = 0
        OR p_property_id = ANY (om.assigned_properties)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.member_can_create_tasks(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organisation_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND COALESCE(om.membership_status, 'active') = 'active'
      AND lower(om.role) IN ('owner', 'manager')
  );
$$;

REVOKE ALL ON FUNCTION public.member_can_access_property(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.member_can_create_tasks(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.member_can_access_property(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_can_create_tasks(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) RLS: properties scoped by assignment
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "properties_select" ON public.properties;
CREATE POLICY "properties_select" ON public.properties
  FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND public.member_can_access_property(org_id, id)
  );

-- ---------------------------------------------------------------------------
-- 6) RLS: Staff cannot insert tasks
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.member_can_create_tasks(org_id)
    AND (
      property_id IS NULL
      OR public.member_can_access_property(org_id, property_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 7) accept_invitation — staff default; normalize member
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION accept_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation invitations%ROWTYPE;
  v_user_id uuid;
  v_member_id uuid;
  v_property_id uuid;
  v_role text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT * INTO v_invitation
  FROM invitations
  WHERE token = p_token
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invitation_not_found');
  END IF;

  IF v_invitation.expires_at < now() THEN
    UPDATE invitations SET status = 'expired'
    WHERE id = v_invitation.id;
    RETURN jsonb_build_object('error', 'invitation_expired');
  END IF;

  IF lower((SELECT email FROM auth.users WHERE id = v_user_id)) != lower(v_invitation.email) THEN
    RETURN jsonb_build_object('error', 'email_mismatch');
  END IF;

  v_role := lower(COALESCE(v_invitation.role, 'staff'));
  IF v_role = 'member' THEN
    v_role := 'staff';
  END IF;

  IF EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = v_invitation.org_id
      AND user_id = v_user_id
  ) THEN
    UPDATE invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = v_invitation.id;

    UPDATE auth.users
    SET
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('org_id', v_invitation.org_id::text),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'invited', true,
          'onboarding_completed', true,
          'invitation_password_confirmed', true
        )
    WHERE id = v_user_id;

    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'seed_staff_training_tasks'
    ) THEN
      PERFORM seed_staff_training_tasks(
        v_invitation.org_id,
        v_user_id,
        CASE WHEN v_invitation.property_ids IS NOT NULL AND array_length(v_invitation.property_ids, 1) > 0
          THEN v_invitation.property_ids[1] ELSE NULL END
      );
    END IF;
    RETURN jsonb_build_object('org_id', v_invitation.org_id, 'already_member', true);
  END IF;

  INSERT INTO organisation_members (org_id, user_id, role, assigned_properties, is_primary_owner)
  VALUES (
    v_invitation.org_id,
    v_user_id,
    v_role,
    v_invitation.property_ids,
    false
  )
  RETURNING id INTO v_member_id;

  UPDATE invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invitation.id;

  UPDATE auth.users
  SET
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('org_id', v_invitation.org_id::text),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'invited', true,
        'onboarding_completed', true,
        'invitation_password_confirmed', true
      )
  WHERE id = v_user_id;

  v_property_id := CASE
    WHEN v_invitation.property_ids IS NOT NULL AND array_length(v_invitation.property_ids, 1) > 0
    THEN v_invitation.property_ids[1]
    ELSE NULL
  END;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'seed_staff_training_tasks'
  ) THEN
    PERFORM seed_staff_training_tasks(v_invitation.org_id, v_user_id, v_property_id);
  END IF;

  RETURN jsonb_build_object(
    'org_id', v_invitation.org_id,
    'member_id', v_member_id,
    'role', v_role,
    'property_ids', v_invitation.property_ids
  );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_invitation(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8) Transfer Primary Owner + revoke invitation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_primary_ownership(
  p_org_id uuid,
  p_new_primary_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_new_member_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE org_id = p_org_id
      AND user_id = v_actor
      AND is_primary_owner = true
      AND COALESCE(membership_status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'Only the Primary Owner can transfer ownership';
  END IF;

  SELECT id INTO v_new_member_id
  FROM public.organisation_members
  WHERE org_id = p_org_id
    AND user_id = p_new_primary_user_id
    AND COALESCE(membership_status, 'active') = 'active';

  IF v_new_member_id IS NULL THEN
    RAISE EXCEPTION 'Target user is not an active member of this organisation';
  END IF;

  -- Temporarily allow clearing primary via guard: set new first while both true would violate unique
  -- So: clear old in same transaction after setting new — unique index allows only one.
  -- Strategy: set old false using a deferred approach — disable trigger briefly not possible.
  -- Use: update new to owner + primary in two steps with guard that allows if another primary exists.
  -- First promote new (fails unique if old still primary). So clear old first while new will become primary:
  UPDATE public.organisation_members
  SET is_primary_owner = false
  WHERE org_id = p_org_id AND is_primary_owner = true AND user_id = v_actor;

  UPDATE public.organisation_members
  SET
    role = 'owner',
    is_primary_owner = true
  WHERE id = v_new_member_id;
END;
$$;

-- Fix transfer: the guard blocks clearing last primary. Need transfer that sets new before clearing,
-- but unique index prevents two primaries. Use CONSTRAINT DEFERRABLE or special path in trigger.

CREATE OR REPLACE FUNCTION public.organisation_members_primary_owner_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow transfer_primary_ownership (SECURITY DEFINER) to clear primary when
  -- session GUC is set.
  IF current_setting('app.allow_primary_owner_transfer', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_primary_owner = true AND NEW.is_primary_owner = false THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.organisation_members
        WHERE org_id = OLD.org_id
          AND id IS DISTINCT FROM OLD.id
          AND is_primary_owner = true
      ) THEN
        RAISE EXCEPTION 'Cannot remove Primary Owner without transferring ownership first';
      END IF;
    END IF;
    IF OLD.is_primary_owner = true AND lower(NEW.role) IS DISTINCT FROM 'owner' THEN
      RAISE EXCEPTION 'Primary Owner must keep the owner role; transfer ownership first';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_primary_owner = true THEN
      RAISE EXCEPTION 'Cannot delete Primary Owner; transfer ownership first';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_primary_ownership(
  p_org_id uuid,
  p_new_primary_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_new_member_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE org_id = p_org_id
      AND user_id = v_actor
      AND is_primary_owner = true
      AND COALESCE(membership_status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'Only the Primary Owner can transfer ownership';
  END IF;

  SELECT id INTO v_new_member_id
  FROM public.organisation_members
  WHERE org_id = p_org_id
    AND user_id = p_new_primary_user_id
    AND COALESCE(membership_status, 'active') = 'active';

  IF v_new_member_id IS NULL THEN
    RAISE EXCEPTION 'Target user is not an active member of this organisation';
  END IF;

  PERFORM set_config('app.allow_primary_owner_transfer', 'on', true);

  UPDATE public.organisation_members
  SET is_primary_owner = false
  WHERE org_id = p_org_id AND is_primary_owner = true;

  UPDATE public.organisation_members
  SET
    role = 'owner',
    is_primary_owner = true
  WHERE id = v_new_member_id;

  PERFORM set_config('app.allow_primary_owner_transfer', 'off', true);
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_primary_ownership(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_primary_ownership(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT org_id INTO v_org_id FROM public.invitations WHERE id = p_invitation_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE org_id = v_org_id
      AND user_id = v_actor
      AND COALESCE(membership_status, 'active') = 'active'
      AND lower(role) IN ('owner', 'manager')
  ) THEN
    RAISE EXCEPTION 'Only owners and managers can revoke invitations';
  END IF;

  UPDATE public.invitations
  SET status = 'revoked'
  WHERE id = p_invitation_id
    AND status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_invitation(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9) create_organisation — mark creator as Primary Owner
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_organisation(
  org_name TEXT,
  org_type_value org_type,
  creator_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  has_duplicate BOOLEAN;
BEGIN
  has_duplicate := check_duplicate_org_name(org_name, creator_id, org_type_value);

  IF has_duplicate THEN
    IF org_type_value = 'personal' THEN
      RAISE EXCEPTION 'You already have a personal organisation. You can only have one personal organisation.';
    ELSE
      RAISE EXCEPTION 'An organisation with this name already exists. Please choose a different name.';
    END IF;
  END IF;

  SET LOCAL row_security = off;

  INSERT INTO organisations (name, org_type, created_by)
  VALUES (org_name, org_type_value, creator_id)
  RETURNING id INTO new_org_id;

  INSERT INTO organisation_members (user_id, org_id, role, is_primary_owner)
  VALUES (creator_id, new_org_id, 'owner', true);

  RETURN new_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organisation(TEXT, org_type, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
