import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Testing Supabase Connection...\n');
console.log('URL:', supabaseUrl);
console.log('Service Key:', supabaseServiceKey ? '✅ Loaded' : '❌ Missing');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testConnection() {
  try {
    console.log('\n📊 Testing Database Tables...\n');

    // Test accounts table
    console.log('1. Testing accounts table...');
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .limit(1);

    if (accountsError) {
      console.error('   ❌ Error:', accountsError.message);
    } else {
      console.log('   ✅ accounts table accessible');
      console.log('   📝 Row count check:', Array.isArray(accounts) ? `${accounts.length} rows` : 'No data');
    }

    // Test contacts table
    console.log('\n2. Testing contacts table...');
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .limit(1);

    if (contactsError) {
      console.error('   ❌ Error:', contactsError.message);
    } else {
      console.log('   ✅ contacts table accessible');
      console.log('   📝 Row count check:', Array.isArray(contacts) ? `${contacts.length} rows` : 'No data');
    }

    // Test pending_meetings table
    console.log('\n3. Testing pending_meetings table...');
    const { data: meetings, error: meetingsError } = await supabase
      .from('pending_meetings')
      .select('*')
      .limit(1);

    if (meetingsError) {
      console.error('   ❌ Error:', meetingsError.message);
    } else {
      console.log('   ✅ pending_meetings table accessible');
      console.log('   📝 Row count check:', Array.isArray(meetings) ? `${meetings.length} rows` : 'No data');
    }

    // Test meeting_stakes table
    console.log('\n4. Testing meeting_stakes table...');
    const { data: stakes, error: stakesError } = await supabase
      .from('meeting_stakes')
      .select('*')
      .limit(1);

    if (stakesError) {
      console.error('   ❌ Error:', stakesError.message);
    } else {
      console.log('   ✅ meeting_stakes table accessible');
      console.log('   📝 Row count check:', Array.isArray(stakes) ? `${stakes.length} rows` : 'No data');
    }

    // Test insert and delete on accounts table
    console.log('\n📝 Testing Write Operations...\n');
    const testWallet = '0xtest' + Date.now();
    
    console.log('5. Testing INSERT on accounts table...');
    const { data: insertData, error: insertError } = await supabase
      .from('accounts')
      .insert({
        wallet_address: testWallet,
        google_email: 'test@example.com'
      })
      .select()
      .single();

    if (insertError) {
      console.error('   ❌ Insert Error:', insertError.message);
    } else {
      console.log('   ✅ Insert successful');
      console.log('   📝 Created account with ID:', insertData?.id);

      // Clean up test data
      console.log('\n6. Testing DELETE on accounts table...');
      const { error: deleteError } = await supabase
        .from('accounts')
        .delete()
        .eq('wallet_address', testWallet);

      if (deleteError) {
        console.error('   ❌ Delete Error:', deleteError.message);
      } else {
        console.log('   ✅ Delete successful');
      }
    }

    console.log('\n✅ Database connection test completed!');

  } catch (error) {
    console.error('\n❌ Unexpected error during testing:', error);
  }
}

testConnection();