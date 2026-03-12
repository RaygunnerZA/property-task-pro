// Query Supabase for tasks in a property (or task counts per property).
// Usage: node scripts/tasks-for-property.js [propertyId]
// - With propertyId: list tasks for that property.
// - Without: list all properties with task count.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function tasksForProperty(propertyId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, status, property_id, due_date')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
  console.log(`Tasks for property ${propertyId}: ${data?.length ?? 0}`);
  if (data?.length) console.table(data);
  else console.log('(none)');
}

async function taskCountsPerProperty() {
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('property_id');

  if (tasksError) {
    console.error('Error:', tasksError.message);
    process.exit(1);
  }

  const counts = (tasks || []).reduce((acc, t) => {
    const id = t.property_id || '(no property)';
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});

  const { data: properties } = await supabase
    .from('properties')
    .select('id, nickname, address');

  const byId = new Map((properties || []).map((p) => [p.id, p]));
  console.log('Task count per property:');
  for (const [id, count] of Object.entries(counts)) {
    const p = byId.get(id);
    const label = p ? `${p.nickname || p.address || id}` : id;
    console.log(`  ${label}: ${count}`);
  }
  if (Object.keys(counts).length === 0) console.log('  (no tasks in any property)');
}

const propertyId = process.argv[2];
if (propertyId) {
  tasksForProperty(propertyId);
} else {
  taskCountsPerProperty();
}
