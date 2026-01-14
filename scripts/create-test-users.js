/**
 * Create fake test users in Supabase for development/testing
 * 
 * Usage:
 *   node scripts/create-test-users.js
 * 
 * This creates test users in Supabase Auth and optionally adds them to organisations
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env or .env.local
if (existsSync(join(__dirname, '..', '.env.local'))) {
  dotenv.config({ path: join(__dirname, '..', '.env.local') });
} else if (existsSync(join(__dirname, '..', '.env'))) {
  dotenv.config({ path: join(__dirname, '..', '.env') });
} else {
  dotenv.config(); // Try default locations
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  if (!SUPABASE_URL) {
    console.error('   VITE_SUPABASE_URL or SUPABASE_URL');
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('   SUPABASE_SERVICE_ROLE_KEY');
    console.error('\n💡 To get your service role key:');
    console.error('   1. Go to Supabase Dashboard > Your Project > Settings > API');
    console.error('   2. Copy the "service_role" key (NOT the anon key)');
    console.error('   3. Add it to your .env file:');
    console.error('      SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here');
    console.error('\n   ⚠️  Keep this key secret! Never commit it to git.');
  }
  process.exit(1);
}

// Create admin client with service role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Test users to create
// Using +alias pattern so all emails go to the same inbox
const TEST_USERS = [
  {
    email: 'justinplunkett+alice@gmail.com',
    password: 'TestPassword123!',
    metadata: {
      first_name: 'Alice',
      last_name: 'Staff',
      display_name: 'Alice Staff',
    },
  },
  {
    email: 'justinplunkett+bob@gmail.com',
    password: 'TestPassword123!',
    metadata: {
      first_name: 'Bob',
      last_name: 'Worker',
      display_name: 'Bob Worker',
    },
  },
  {
    email: 'justinplunkett+carol@gmail.com',
    password: 'TestPassword123!',
    metadata: {
      first_name: 'Carol',
      last_name: 'Manager',
      display_name: 'Carol Manager',
    },
  },
  {
    email: 'justinplunkett+david@gmail.com',
    password: 'TestPassword123!',
    metadata: {
      first_name: 'David',
      last_name: 'Member',
      display_name: 'David Member',
    },
  },
];

async function createTestUsers() {
  console.log('🚀 Creating test users...\n');

  const results = [];

  for (const user of TEST_USERS) {
    try {
      console.log(`Creating user: ${user.email}...`);

      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u) => u.email === user.email);

      if (existingUser) {
        console.log(`  ⚠️  User already exists (ID: ${existingUser.id})`);
        results.push({
          email: user.email,
          success: true,
          userId: existingUser.id,
          created: false,
          message: 'User already exists',
        });
        continue;
      }

      // Create user with password
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // Auto-confirm email
        user_metadata: user.metadata,
      });

      if (authError) {
        console.error(`  ❌ Error: ${authError.message}`);
        results.push({
          email: user.email,
          success: false,
          error: authError.message,
        });
        continue;
      }

      if (authData?.user) {
        console.log(`  ✅ Created user (ID: ${authData.user.id})`);
        results.push({
          email: user.email,
          success: true,
          userId: authData.user.id,
          created: true,
          password: user.password,
        });
      }
    } catch (error) {
      console.error(`  ❌ Unexpected error: ${error.message}`);
      results.push({
        email: user.email,
        success: false,
        error: error.message,
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log('='.repeat(60));

  const created = results.filter((r) => r.success && r.created);
  const existing = results.filter((r) => r.success && !r.created);
  const failed = results.filter((r) => !r.success);

  console.log(`\n✅ Created: ${created.length}`);
  created.forEach((r) => {
    console.log(`   - ${r.email} (ID: ${r.userId})`);
  });

  console.log(`\n⚠️  Already exists: ${existing.length}`);
  existing.forEach((r) => {
    console.log(`   - ${r.email} (ID: ${r.userId})`);
  });

  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}`);
    failed.forEach((r) => {
      console.log(`   - ${r.email}: ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('📝 Test Credentials:');
  console.log('='.repeat(60));
  created.forEach((r) => {
    console.log(`\nEmail: ${r.email}`);
    console.log(`Password: ${r.password}`);
  });

  if (existing.length > 0) {
    console.log('\n💡 Note: These users already existed - passwords may be different');
    existing.forEach((r) => {
      console.log(`   - ${r.email}`);
    });
  }

  console.log('\n✨ Done!\n');
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith('create-test-users.js')) {
  createTestUsers().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { createTestUsers, TEST_USERS };
