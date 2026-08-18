-- Drop the 2-parameter overload of create_property_v2 so only the 6-parameter
-- version (with optional defaults) exists. This removes the "could not choose
-- the best candidate function" error when calling with 2 args.
DROP FUNCTION IF EXISTS create_property_v2(UUID, TEXT);
