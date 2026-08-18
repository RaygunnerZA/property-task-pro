-- Disable auto-onboarding trigger
-- New users should go through the clean onboarding flow without pre-created orgs
-- This removes the automatic creation of "My Personal Org" on user signup

-- ============================================================================
-- DROP TRIGGER: Remove auto-org creation on user signup
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- ============================================================================
-- OPTIONAL: Keep the function but make it a no-op (or drop it entirely)
-- ============================================================================
-- We can either drop the function or keep it empty in case we need it later
-- For now, we'll drop it to keep things clean

DROP FUNCTION IF EXISTS handle_new_user();

-- ============================================================================
-- NOTE: Existing users who already have auto-created orgs will keep them
-- New users will need to create their org through the onboarding flow
-- ============================================================================

