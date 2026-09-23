-- Personal Filla inbox address: one revocable token per active membership.
-- The webhook resolves a SHA-256 hash. The plaintext token is encrypted for display
-- and is never granted to the client API. Membership end revokes the address.

CREATE TABLE IF NOT EXISTS public.intake_email_keyring (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  secret text NOT NULL
);

INSERT INTO public.intake_email_keyring (id, secret)
VALUES (true, encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.intake_email_keyring ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.intake_email_keyring FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.member_intake_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  token_hash text NOT NULL,
  token_ciphertext bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  revoked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS member_intake_addresses_token_hash_key
  ON public.member_intake_addresses (token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS member_intake_addresses_one_active
  ON public.member_intake_addresses (org_id, user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.member_intake_addresses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.member_intake_addresses FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE public.member_intake_addresses IS
  'Personal inbound address secret. Lookup is by token_hash. revoked_at kills the address. Plaintext exists only as ciphertext for the signed-in member display RPC.';

CREATE TABLE IF NOT EXISTS public.inbound_email_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  token_hash text NOT NULL,
  sender_hash text NOT NULL,
  message_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inbound_email_receipts_message_unique UNIQUE (org_id, message_id)
);

CREATE INDEX IF NOT EXISTS inbound_email_receipts_token_created_idx
  ON public.inbound_email_receipts (token_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS inbound_email_receipts_sender_created_idx
  ON public.inbound_email_receipts (sender_hash, created_at DESC);

ALTER TABLE public.inbound_email_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.inbound_email_receipts FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE public.inbound_email_receipts IS
  'Idempotency and rate-limit ledger for personal inbound mail. Stores hashes and message id, not the message body.';

ALTER TABLE public.intake_items
  ADD COLUMN IF NOT EXISTS email_provenance jsonb;

COMMENT ON COLUMN public.intake_items.email_provenance IS
  'Preserved inbound mail facts: sender, recipients, received time, message id, attachment paths and hashes, sender_verified, authorship. created_by is the review-queue owner, not the author when authorship is external.';

COMMENT ON COLUMN public.intake_items.created_by IS
  'Review-queue owner. For personal inbound mail this is the membership the token resolved to. Authorship of the message is email_provenance.authorship, not this column.';

CREATE INDEX IF NOT EXISTS intake_items_email_message_id_idx
  ON public.intake_items ((email_provenance->>'message_id'))
  WHERE source_type = 'forwarded_email';

-- Freeze server-written mail facts against the member's JWT.
CREATE OR REPLACE FUNCTION public.protect_intake_email_provenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.source_type = 'forwarded_email' THEN
      RAISE EXCEPTION 'forwarded_email intake is server-created';
    END IF;
    NEW.email_provenance := NULL;
    RETURN NEW;
  END IF;

  NEW.email_provenance := OLD.email_provenance;
  NEW.raw_text := OLD.raw_text;
  NEW.storage_path := OLD.storage_path;
  NEW.file_name := OLD.file_name;
  NEW.mime_type := OLD.mime_type;
  NEW.file_size := OLD.file_size;
  NEW.ai_extracted := OLD.ai_extracted;
  NEW.ai_classification := OLD.ai_classification;
  NEW.ai_confidence := OLD.ai_confidence;
  NEW.created_by := OLD.created_by;
  NEW.org_id := OLD.org_id;
  NEW.source_type := OLD.source_type;
  NEW.property_id := OLD.property_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS intake_items_protect_email_provenance ON public.intake_items;
CREATE TRIGGER intake_items_protect_email_provenance
  BEFORE INSERT OR UPDATE ON public.intake_items
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_intake_email_provenance();

REVOKE ALL ON FUNCTION public.protect_intake_email_provenance() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.revoke_member_intake_address()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_user uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_org := OLD.org_id;
    v_user := OLD.user_id;
  ELSIF coalesce(NEW.membership_status, 'active') IS DISTINCT FROM 'active' THEN
    v_org := NEW.org_id;
    v_user := NEW.user_id;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.member_intake_addresses
  SET revoked_at = now()
  WHERE org_id = v_org
    AND user_id = v_user
    AND revoked_at IS NULL;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisation_members_revoke_intake_email ON public.organisation_members;
CREATE TRIGGER organisation_members_revoke_intake_email
  AFTER UPDATE OF membership_status OR DELETE ON public.organisation_members
  FOR EACH ROW
  EXECUTE FUNCTION public.revoke_member_intake_address();

REVOKE ALL ON FUNCTION public.revoke_member_intake_address() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.intake_email_cipher_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT secret INTO v_key FROM public.intake_email_keyring WHERE id IS TRUE;
  IF v_key IS NULL OR length(v_key) < 32 THEN
    RAISE EXCEPTION 'intake_email_key_missing';
  END IF;
  RETURN v_key;
END;
$$;

REVOKE ALL ON FUNCTION public.intake_email_cipher_key() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._issue_member_intake_address(
  p_org_id uuid,
  p_user_id uuid,
  p_rotate boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token text;
  v_hash text;
  v_email text;
  v_slug text;
  v_domain text := coalesce(current_setting('app.intake_email_domain', true), 'inbox.filla.app');
  v_existing bytea;
BEGIN
  IF p_rotate THEN
    UPDATE public.member_intake_addresses
    SET revoked_at = now(),
        rotated_at = now()
    WHERE org_id = p_org_id
      AND user_id = p_user_id
      AND revoked_at IS NULL;
  ELSE
    SELECT token_ciphertext INTO v_existing
    FROM public.member_intake_addresses
    WHERE org_id = p_org_id
      AND user_id = p_user_id
      AND revoked_at IS NULL
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      v_token := extensions.pgp_sym_decrypt(v_existing, public.intake_email_cipher_key());
    END IF;
  END IF;

  IF v_token IS NULL THEN
    v_token := encode(extensions.gen_random_bytes(16), 'hex');
    v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
    INSERT INTO public.member_intake_addresses (
      org_id, user_id, token_hash, token_ciphertext
    ) VALUES (
      p_org_id,
      p_user_id,
      v_hash,
      extensions.pgp_sym_encrypt(v_token, public.intake_email_cipher_key())
    );
  END IF;

  SELECT lower(split_part(u.email, '@', 1))
  INTO v_email
  FROM auth.users u
  WHERE u.id = p_user_id;

  v_slug := left(regexp_replace(coalesce(v_email, ''), '[^a-z0-9]', '', 'g'), 20);
  IF v_slug IS NULL OR length(v_slug) < 2 THEN
    v_slug := 'me';
  END IF;

  RETURN v_slug || '+' || v_token || '@' || v_domain;
END;
$$;

REVOKE ALL ON FUNCTION public._issue_member_intake_address(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_member_intake_email(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND coalesce(membership_status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'Not an active member of this organisation';
  END IF;

  RETURN public._issue_member_intake_address(p_org_id, auth.uid(), false);
END;
$$;

REVOKE ALL ON FUNCTION public.get_member_intake_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_member_intake_email(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rotate_member_intake_email(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND coalesce(membership_status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'Not an active member of this organisation';
  END IF;

  RETURN public._issue_member_intake_address(p_org_id, auth.uid(), true);
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_member_intake_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_member_intake_email(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_member_by_intake_token(p_token text)
RETURNS TABLE(org_id uuid, user_id uuid, token_hash text, login_email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT a.org_id, a.user_id, a.token_hash, u.email
  FROM public.member_intake_addresses a
  INNER JOIN public.organisation_members om
    ON om.org_id = a.org_id
   AND om.user_id = a.user_id
   AND coalesce(om.membership_status, 'active') = 'active'
  INNER JOIN auth.users u ON u.id = a.user_id
  WHERE a.revoked_at IS NULL
    AND a.token_hash = encode(extensions.digest(trim(p_token), 'sha256'), 'hex')
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_member_by_intake_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_member_by_intake_token(text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_inbound_member_email(
  p_org_id uuid,
  p_user_id uuid,
  p_token_hash text,
  p_sender_email text,
  p_message_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sender_hash text;
  v_message text;
  v_existing uuid;
  v_status public.intake_item_status;
BEGIN
  IF p_org_id IS NULL OR p_user_id IS NULL OR p_token_hash IS NULL OR length(trim(p_token_hash)) < 32 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim');
  END IF;

  v_message := left(trim(coalesce(p_message_id, '')), 500);
  IF v_message = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_message_id');
  END IF;

  SELECT id, status INTO v_existing, v_status
  FROM public.intake_items
  WHERE org_id = p_org_id
    AND email_provenance->>'message_id' = v_message
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    IF v_status IN ('pending', 'processing') THEN
      RETURN jsonb_build_object('ok', true, 'replay', true, 'intake_item_id', v_existing);
    END IF;
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate', 'intake_item_id', v_existing);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.inbound_email_receipts
    WHERE org_id = p_org_id AND message_id = v_message
  ) THEN
    RETURN jsonb_build_object('ok', true, 'replay', true);
  END IF;

  v_sender_hash := encode(
    extensions.digest(lower(trim(coalesce(p_sender_email, ''))), 'sha256'),
    'hex'
  );

  IF (
    SELECT count(*)
    FROM public.inbound_email_receipts
    WHERE token_hash = p_token_hash
      AND created_at > now() - interval '1 hour'
  ) >= 30 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'token_rate_limited');
  END IF;

  IF (
    SELECT count(*)
    FROM public.inbound_email_receipts
    WHERE sender_hash = v_sender_hash
      AND created_at > now() - interval '1 hour'
  ) >= 40 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sender_rate_limited');
  END IF;

  BEGIN
    INSERT INTO public.inbound_email_receipts (
      org_id, user_id, token_hash, sender_hash, message_id
    ) VALUES (
      p_org_id, p_user_id, p_token_hash, v_sender_hash, v_message
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate');
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_inbound_member_email(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_inbound_member_email(uuid, uuid, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.create_member_email_intake(
  p_org_id uuid,
  p_queue_owner uuid,
  p_id uuid,
  p_raw_text text,
  p_file_name text,
  p_mime_type text,
  p_file_size bigint,
  p_storage_path text,
  p_provenance jsonb
)
RETURNS public.intake_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.intake_items;
  v_provenance jsonb;
BEGIN
  IF p_org_id IS NULL OR p_queue_owner IS NULL OR p_provenance IS NULL OR jsonb_typeof(p_provenance) <> 'object' THEN
    RAISE EXCEPTION 'org, queue owner and provenance are required';
  END IF;

  IF octet_length(p_provenance::text) > 48000 THEN
    RAISE EXCEPTION 'provenance too large';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE org_id = p_org_id
      AND user_id = p_queue_owner
      AND coalesce(membership_status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'queue owner is not an active member';
  END IF;

  IF p_storage_path IS NOT NULL THEN
    IF split_part(p_storage_path, '/', 1) <> 'orgs'
       OR split_part(p_storage_path, '/', 3) <> 'inbox'
       OR split_part(p_storage_path, '/', 2)::uuid <> p_org_id THEN
      RAISE EXCEPTION 'Invalid inbox storage path for org';
    END IF;
  END IF;

  v_provenance := p_provenance
    - 'token'
    - 'token_hash'
    - 'intake_email_token'
    - 'login_email';

  IF coalesce(v_provenance->>'channel', '') <> 'member_intake_email' THEN
    RAISE EXCEPTION 'invalid intake channel';
  END IF;

  INSERT INTO public.intake_items (
    id,
    org_id,
    created_by,
    source_type,
    status,
    storage_path,
    file_name,
    mime_type,
    file_size,
    raw_text,
    email_provenance
  ) VALUES (
    coalesce(p_id, gen_random_uuid()),
    p_org_id,
    p_queue_owner,
    'forwarded_email',
    'processing',
    p_storage_path,
    p_file_name,
    NULLIF(p_mime_type, ''),
    p_file_size,
    NULLIF(left(p_raw_text, 8000), ''),
    v_provenance
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_member_email_intake(uuid, uuid, uuid, text, text, text, bigint, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_member_email_intake(uuid, uuid, uuid, text, text, text, bigint, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_intake_as_knowledge(p_intake_item_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.intake_items;
  v_title text;
  v_summary text;
  v_body text;
  v_knowledge public.knowledge;
  v_extracted jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_item
  FROM public.intake_items
  WHERE id = p_intake_item_id;

  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'Intake item not found';
  END IF;

  IF v_item.created_by <> auth.uid() THEN
    RAISE EXCEPTION 'Only the review owner may file this email';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE org_id = v_item.org_id
      AND user_id = auth.uid()
      AND coalesce(membership_status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'Not an active member of this organisation';
  END IF;

  IF v_item.status <> 'ready' OR v_item.source_type <> 'forwarded_email' THEN
    RAISE EXCEPTION 'Email is not ready to file';
  END IF;

  IF coalesce(v_item.email_provenance->>'channel', '') <> 'member_intake_email' THEN
    RAISE EXCEPTION 'Not a personal intake email';
  END IF;

  v_extracted := coalesce(v_item.ai_extracted, '{}'::jsonb);
  v_title := left(trim(coalesce(v_extracted->>'suggested_title', v_item.file_name, 'Email note')), 180);
  IF v_title = '' THEN
    v_title := 'Email note';
  END IF;
  v_body := left(coalesce(v_item.raw_text, v_extracted->>'summary', ''), 8000);
  v_summary := left(trim(coalesce(v_extracted->>'summary', left(v_body, 280), v_title)), 400);

  v_knowledge := public.create_knowledge_candidate(
    'organisation',
    v_item.org_id,
    v_title,
    NULLIF(v_summary, ''),
    NULLIF(v_body, ''),
    'org_upload',
    '{}'::jsonb,
    jsonb_strip_nulls(jsonb_build_object(
      'via', 'member_intake_email',
      'intake_item_id', v_item.id,
      'message_id', v_item.email_provenance->>'message_id',
      'from', v_item.email_provenance->>'from',
      'sender_verified', v_item.email_provenance->'sender_verified',
      'authorship', coalesce(v_item.email_provenance->>'authorship', 'external'),
      'confirmed_by', auth.uid()
    )),
    NULL,
    NULL,
    auth.uid(),
    jsonb_build_object('unscoped', true)
  );

  UPDATE public.intake_items
  SET status = 'confirmed'
  WHERE id = v_item.id;

  RETURN v_knowledge.id;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_intake_as_knowledge(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_intake_as_knowledge(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
