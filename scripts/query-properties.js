// Quick script to query properties table
// Usage: node scripts/query-properties.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function queryProperties() {
  const { data, error } = await supabase
    .from('properties')
    .select('id, address, org_id');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Properties:');
  console.table(data);
}

queryProperties();

