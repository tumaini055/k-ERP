const { createClient } = require('./backend/node_modules/@supabase/supabase-js');

const supabase = createClient(
  'https://feqebcgmlstvhddljmrs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlcWViY2dtbHN0dmhkZGxqbXJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjIyOTkyOSwiZXhwIjoyMDk3ODA1OTI5fQ._Sge0_hV2nwNI3iR_FtA6kCpJEByqtCy1a-5bkaVXlA'
);

(async () => {
  const { data, error } = await supabase.from('users').select('last_login').limit(1);
  console.log('last_login column:', error?.message || 'OK');

  const { data: userData, error: userErr } = await supabase.from('users').select('*').limit(1);
  if (userErr) {
    console.log('User fetch error:', userErr.message);
  } else {
    console.log('User columns:', userData ? Object.keys(userData[0]) : 'no data');
  }
  process.exit(0);
})();
