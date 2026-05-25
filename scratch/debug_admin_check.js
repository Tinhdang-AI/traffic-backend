const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Parse .env file
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    if (key && !key.startsWith('#')) {
      env[key] = value;
    }
  }
});

const url = env['SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
});

async function run() {
  const userId = '39bab503-042e-4a27-af62-2ec82e293e85';
  console.log('--- 1. Query BEFORE sign-in ---');
  const { data: adminRowBefore, error: errBefore } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
    
  console.log('Result BEFORE sign-in:', adminRowBefore);
  console.log('Error BEFORE sign-in:', errBefore);

  console.log('\n--- 2. Call signInWithPassword ---');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@gmail.com',
    password: 'admin123'
  });
  if (authError) {
    console.error('Sign-in failed:', authError.message);
    return;
  }
  console.log('Sign-in succeeded. Authenticated as:', authData.user.email);

  console.log('\n--- 3. Query AFTER sign-in ---');
  const { data: adminRowAfter, error: errAfter } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
    
  console.log('Result AFTER sign-in:', adminRowAfter);
  console.log('Error AFTER sign-in:', errAfter);
}

run();
