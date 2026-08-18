-- Local/staging seed only. No customer data. No personal platform_admins UUID.
-- Applied by `supabase db reset` via supabase/config.toml [db.seed].

SET session_replication_role = replica;
INSERT INTO public.organisations (id, name, org_type, created_by)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  '_platform',
  'business',
  NULL
)
ON CONFLICT (id) DO NOTHING;
SET session_replication_role = origin;

INSERT INTO public.subscription_tiers (id, name, type, price_id, entitlements, is_active)
VALUES
  (
    'home',
    'Home',
    'personal',
    NULL,
    '{
      "active_properties_limit": 1,
      "coordinating_seats_limit": 1,
      "staff_active_monthly_allowance": 0,
      "can_add_staff": false,
      "multi_property_enabled": false,
      "external_submissions_enabled": false,
      "compliance_enabled": false,
      "advanced_reports_enabled": false,
      "api_enabled": false,
      "evidence_bytes_allowance": 536870912,
      "ai_ops_allowance": 25
    }'::jsonb,
    true
  ),
  (
    'home_plus',
    'Home Plus',
    'personal',
    NULL,
    '{
      "active_properties_limit": 1,
      "coordinating_seats_limit": 5,
      "staff_active_monthly_allowance": 10,
      "can_add_staff": true,
      "multi_property_enabled": false,
      "external_submissions_enabled": true,
      "compliance_enabled": false,
      "advanced_reports_enabled": false,
      "api_enabled": false,
      "evidence_bytes_allowance": 2147483648,
      "ai_ops_allowance": 100
    }'::jsonb,
    true
  ),
  (
    'portfolio_2_5',
    'Portfolio (2–5)',
    'business',
    NULL,
    '{
      "active_properties_limit": 5,
      "coordinating_seats_limit": 5,
      "staff_active_monthly_allowance": 25,
      "can_add_staff": true,
      "multi_property_enabled": true,
      "external_submissions_enabled": true,
      "compliance_enabled": true,
      "advanced_reports_enabled": false,
      "api_enabled": false,
      "evidence_bytes_allowance": 10737418240,
      "ai_ops_allowance": 500
    }'::jsonb,
    true
  ),
  (
    'portfolio_6_15',
    'Portfolio (6–15)',
    'business',
    NULL,
    '{
      "active_properties_limit": 15,
      "coordinating_seats_limit": 10,
      "staff_active_monthly_allowance": 50,
      "can_add_staff": true,
      "multi_property_enabled": true,
      "external_submissions_enabled": true,
      "compliance_enabled": true,
      "advanced_reports_enabled": true,
      "api_enabled": false,
      "evidence_bytes_allowance": 32212254720,
      "ai_ops_allowance": 1500
    }'::jsonb,
    true
  ),
  (
    'portfolio_16_40',
    'Portfolio (16–40)',
    'business',
    NULL,
    '{
      "active_properties_limit": 40,
      "coordinating_seats_limit": 20,
      "staff_active_monthly_allowance": 100,
      "can_add_staff": true,
      "multi_property_enabled": true,
      "external_submissions_enabled": true,
      "compliance_enabled": true,
      "advanced_reports_enabled": true,
      "api_enabled": false,
      "evidence_bytes_allowance": 107374182400,
      "ai_ops_allowance": 4000
    }'::jsonb,
    true
  ),
  (
    'business',
    'Business',
    'business',
    NULL,
    '{
      "active_properties_limit": 100,
      "coordinating_seats_limit": 50,
      "staff_active_monthly_allowance": 250,
      "can_add_staff": true,
      "multi_property_enabled": true,
      "external_submissions_enabled": true,
      "compliance_enabled": true,
      "advanced_reports_enabled": true,
      "api_enabled": true,
      "evidence_bytes_allowance": 549755813888,
      "ai_ops_allowance": 20000
    }'::jsonb,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  entitlements = EXCLUDED.entitlements,
  is_active = EXCLUDED.is_active;
