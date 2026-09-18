-- Org-scoped contacts directory (People surface).
-- @Docs/03_Data_Model.md · @Docs/Appendix_A.md (People = staff, contractors, suppliers, contacts)
--
-- Contacts are address-book rows, not seats. They do not grant product access.
-- Isolation: org membership + optional property assignment via member_can_access_property.

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  phone text,
  role_label text,
  kind text NOT NULL DEFAULT 'contact'
    CHECK (kind IN ('contact', 'contractor', 'supplier', 'agent', 'other')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contacts_name_nonblank CHECK (length(btrim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_contacts_org ON public.contacts (org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org_property ON public.contacts (org_id, property_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org_name ON public.contacts (org_id, lower(name));

COMMENT ON TABLE public.contacts IS
  'Operational address book (People). Not organisation membership or billing seats.';

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS contacts_set_updated_at ON public.contacts;
CREATE TRIGGER contacts_set_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- SELECT: active org members; property-scoped rows require property access
DROP POLICY IF EXISTS contacts_select ON public.contacts;
CREATE POLICY contacts_select ON public.contacts
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(org_id)
    AND (
      property_id IS NULL
      OR public.member_can_access_property(org_id, property_id)
    )
  );

-- INSERT: active members; bind created_by to caller; property scope when set
DROP POLICY IF EXISTS contacts_insert ON public.contacts;
CREATE POLICY contacts_insert ON public.contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_member(org_id)
    AND created_by IS NOT DISTINCT FROM auth.uid()
    AND (
      property_id IS NULL
      OR public.member_can_access_property(org_id, property_id)
    )
  );

-- UPDATE: active members with property access; org_id immutable via WITH CHECK
DROP POLICY IF EXISTS contacts_update ON public.contacts;
CREATE POLICY contacts_update ON public.contacts
  FOR UPDATE
  TO authenticated
  USING (
    public.is_org_member(org_id)
    AND (
      property_id IS NULL
      OR public.member_can_access_property(org_id, property_id)
    )
  )
  WITH CHECK (
    public.is_org_member(org_id)
    AND (
      property_id IS NULL
      OR public.member_can_access_property(org_id, property_id)
    )
  );

-- DELETE: same as update
DROP POLICY IF EXISTS contacts_delete ON public.contacts;
CREATE POLICY contacts_delete ON public.contacts
  FOR DELETE
  TO authenticated
  USING (
    public.is_org_member(org_id)
    AND (
      property_id IS NULL
      OR public.member_can_access_property(org_id, property_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
