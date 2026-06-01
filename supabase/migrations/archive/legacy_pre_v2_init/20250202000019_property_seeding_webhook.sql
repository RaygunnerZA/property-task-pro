-- Property Seeding Webhook
-- Sets up database webhook to call seed-property edge function when property is created
-- Source: @Docs/03_Data_Model.md

-- ============================================================================
-- ENABLE PG_NET EXTENSION (for HTTP requests)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- FUNCTION: Call Seed Property Edge Function
-- ============================================================================

CREATE OR REPLACE FUNCTION call_seed_property_function(p_property_id UUID, p_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_function_url TEXT;
  v_payload JSONB;
  v_response_id BIGINT;
  v_service_role_key TEXT;
BEGIN
  -- Get Supabase URL from environment or use default
  -- In production, this should be set via Supabase dashboard or config
  v_function_url := COALESCE(
    current_setting('app.settings.supabase_url', true),
    'https://tuyflmyojrmvlbptnpcg.supabase.co'
  ) || '/functions/v1/seed-property';

  -- Get service role key (should be set via Supabase secrets)
  v_service_role_key := COALESCE(
    current_setting('app.settings.supabase_service_role_key', true),
    '' -- Will fail gracefully if not set
  );

  -- Construct payload matching Supabase webhook format
  v_payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'properties',
    'record', jsonb_build_object(
      'id', p_property_id,
      'org_id', p_org_id
    )
  );

  -- Make async HTTP request to edge function (don't wait for response)
  -- This ensures property creation doesn't block
  SELECT net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    )::jsonb,
    body := v_payload::text
  ) INTO v_response_id;

  -- Log the request
  RAISE NOTICE 'Queued seed-property function call for property % (request_id: %)', p_property_id, v_response_id;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail property creation
    -- The edge function can be called manually if needed
    RAISE WARNING 'Error calling seed-property function for property %: %', p_property_id, SQLERRM;
END;
$$;

-- ============================================================================
-- TRIGGER FUNCTION: Trigger Webhook on Property Insert
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_seed_property_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Call the edge function asynchronously (don't wait for response)
  -- This ensures property creation doesn't block on seeding
  PERFORM call_seed_property_function(NEW.id, NEW.org_id);
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- CREATE TRIGGER
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS seed_property_webhook_trigger ON properties;

-- Create trigger that fires AFTER INSERT
CREATE TRIGGER seed_property_webhook_trigger
  AFTER INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_property_webhook();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION call_seed_property_function(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION trigger_seed_property_webhook() TO service_role;

