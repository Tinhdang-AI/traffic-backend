const fs = require('fs');
const path = require('path');

// 1. Raw file parse
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envRaw = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    if (key && !key.startsWith('#')) {
      envRaw[key] = value;
    }
  }
});

const keyRaw = envRaw['SUPABASE_SERVICE_ROLE_KEY'];

// 2. Load via dotenv
// NestJS uses dotenv under the hood. Let's see what dotenv produces.
// We can require dotenv if it's installed, or let's see.
let dotenvKey = null;
try {
  const dotenv = require('dotenv');
  const parsed = dotenv.config({ path: envPath }).parsed;
  dotenvKey = parsed['SUPABASE_SERVICE_ROLE_KEY'];
} catch (e) {
  console.log('dotenv not found or error:', e.message);
}

console.log('Key Raw:');
console.log('Length:', keyRaw ? keyRaw.length : 0);
console.log('Value:', keyRaw);

if (dotenvKey) {
  console.log('\nKey via dotenv:');
  console.log('Length:', dotenvKey.length);
  console.log('Value:', dotenvKey);
  console.log('Equal?:', keyRaw === dotenvKey);
}

// Let's also check if there is an environment variable in process.env
console.log('\nprocess.env.SUPABASE_SERVICE_ROLE_KEY:');
console.log('Length:', process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.length : 0);
console.log('Value:', process.env.SUPABASE_SERVICE_ROLE_KEY);
