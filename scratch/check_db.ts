import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    return;
  }
  
  const supabase = createClient(url, key);
  console.log('Connecting to Supabase:', url);
  
  // Test calling get_nearby_approved_signs
  console.log('Testing RPC get_nearby_approved_signs...');
  const { data, error } = await supabase.rpc('get_nearby_approved_signs', {
    lat: 10.7769,
    lng: 106.7009,
    radius_meters: 5000
  });
  
  if (error) {
    console.error('RPC Test Failed:', error.message);
  } else {
    console.log('RPC Test Successful! Returned rows:', data ? data.length : 0);
  }
}

run();
