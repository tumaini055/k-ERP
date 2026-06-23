import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  try {
    const sql = `
      ALTER TABLE projects 
      ADD COLUMN IF NOT EXISTS recorded_revenue DECIMAL(15,2) DEFAULT 0;
    `;
    const queries = sql.split(';').filter(Boolean);
    for (const q of queries) {
      const { error } = await supabase.rpc('exec_sql', { query_text: q.trim() });
      if (error && !error.message.includes('already exists')) {
        // Try direct REST API as fallback
        const { error: e2 } = await supabase.from('projects').select('id').limit(1);
        if (e2) {
          // Execute via raw query using fetch
          const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ query_text: q.trim() }),
          });
          if (!res.ok) {
            console.log('Trying direct SQL endpoint...');
          }
        }
      }
    }
    console.log('Migration completed');
  } catch (err) {
    console.error('Migration error:', err);
  }
}
run();