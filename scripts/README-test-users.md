# Create Test Users Script

This script creates fake test users in Supabase for development/testing.

## Usage

```bash
node scripts/create-test-users.js
```

## Requirements

Set these environment variables in `.env.local`:

- `VITE_SUPABASE_URL` or `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (from Supabase Dashboard > Settings > API)

## What it does

Creates 4 test users:
- `staff1@test.filla.app` - Alice Staff
- `staff2@test.filla.app` - Bob Worker  
- `manager1@test.filla.app` - Carol Manager
- `member1@test.filla.app` - David Member

All users have password: `TestPassword123!`

## Note

- Users are created with `email_confirm: true` so they don't need to verify email
- If users already exist, they won't be recreated
- Users will need to be manually added to organisations via invitations or database

## Adding users to organisations

After creating users, you can:
1. Use the invitation flow in the app to invite them
2. Or manually add them via Supabase SQL:

```sql
-- Add a user to an organisation
INSERT INTO organisation_members (user_id, org_id, role, assigned_properties)
SELECT 
  u.id,
  'your-org-id-here'::uuid,
  'staff', -- or 'member', 'manager'
  ARRAY[]::uuid[] -- or ARRAY['property-id-1'::uuid, 'property-id-2'::uuid] for specific properties
FROM auth.users u
WHERE u.email = 'staff1@test.filla.app';
```
