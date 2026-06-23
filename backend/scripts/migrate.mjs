import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const sql = 'ALTER TABLE projects ADD COLUMN IF NOT EXISTS recorded_revenue DECIMAL(15,2) DEFAULT 0;';

// Try rpc
const { error } = await supabase.rpc('exec_sql', { query_text: sql });
if (error) {
  // Fallback: try direct fetch to the SQL endpoint
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query_text: sql }),
  });
  if (!res.ok) {
    // Last resort: use pg connection info
    const text = await res.text();
    console.log('Fallback result:', text);
    // Try with a simple insert-check to verify
    const { data } = await supabase.from('projects').select('id, budget').limit(1);
    console.log('Projects work:', data?.length);
  } else {
    console.log('exec_sql via fetch succeeded');
  }
} else {
  console.log('exec_sql via rpc succeeded');
}
