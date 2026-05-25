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

if (!url || !serviceRoleKey) {
  console.error('Missing URL or Service Role Key in .env!');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
});

async function run() {
  console.log('--- CHECKING SUPABASE USERS & ADMINS ---');
  
  // 1. List users from auth.admin
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error('Error fetching auth users:', authError.message);
  } else {
    console.log('\n--- AUTH USERS ---');
    authUsers.users.forEach(u => {
      console.log(`- ID: ${u.id} | Email: ${u.email} | Display Name: ${u.user_metadata?.display_name}`);
    });
  }

  // 2. List admin_users
  const { data: adminUsers, error: adminError } = await supabase
    .from('admin_users')
    .select('*');
  if (adminError) {
    console.error('Error fetching admin_users:', adminError.message);
  } else {
    console.log('\n--- ADMIN USERS IN DB ---');
    adminUsers.forEach(u => {
      console.log(`- User ID: ${u.user_id} | Granted At: ${u.granted_at}`);
    });
  }

  // 3. List profiles
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('*');
  if (profileError) {
    console.error('Error fetching profiles:', profileError.message);
  } else {
    console.log('\n--- PROFILES ---');
    profiles.forEach(p => {
      console.log(`- ID: ${p.id} | Email: ${p.email} | Display Name: ${p.display_name} | isAdmin: ${p.is_admin}`);
    });
  }
}

run();
