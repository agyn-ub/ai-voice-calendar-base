import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testContactSearch() {
  console.log('🔍 Testing Contact Search...\n');

  // First, let's see what contacts exist
  console.log('1. Fetching all contacts with "Agyn" in the name...');
  const { data: allContacts, error: fetchError } = await supabase
    .from('contacts')
    .select('*')
    .or('name.ilike.%Agyn%,email.ilike.%agyn%')
    .limit(10);

  if (fetchError) {
    console.error('   ❌ Error:', fetchError.message);
  } else {
    console.log('   ✅ Found contacts:');
    if (allContacts && allContacts.length > 0) {
      allContacts.forEach(contact => {
        console.log(`      - Name: "${contact.name}", Email: ${contact.email}, Account ID: ${contact.account_id}`);
      });
    } else {
      console.log('      No contacts found with "Agyn"');
    }
  }

  // Check what account IDs exist
  console.log('\n2. Checking accounts in the database...');
  const { data: accounts, error: accountError } = await supabase
    .from('accounts')
    .select('id, wallet_address, google_email')
    .limit(5);

  if (accountError) {
    console.error('   ❌ Error:', accountError.message);
  } else {
    console.log('   ✅ Accounts found:');
    if (accounts && accounts.length > 0) {
      accounts.forEach(account => {
        console.log(`      - ID: ${account.id}, Wallet: ${account.wallet_address}, Email: ${account.google_email}`);
      });
    } else {
      console.log('      No accounts found');
    }
  }

  // Test the exact search query that's failing
  console.log('\n3. Testing the exact search query from the code...');
  
  // Assuming account ID 1 (adjust if needed)
  const accountId = accounts && accounts.length > 0 ? accounts[0].id : 1;
  const searchQuery = 'Agyn';
  
  console.log(`   Searching for "${searchQuery}" in account ${accountId}...`);
  
  // This mimics the exact query from postgresContactsDb.ts
  const { data: searchResults, error: searchError } = await supabase
    .from('contacts')
    .select('email, name')
    .eq('account_id', accountId)
    .or(`name.eq.${searchQuery},name.ilike.${searchQuery}%,name.ilike.%${searchQuery}%`)
    .order('name', { ascending: true })
    .order('email', { ascending: true })
    .limit(50);

  if (searchError) {
    console.error('   ❌ Search Error:', searchError.message);
  } else {
    console.log('   Search Results:');
    if (searchResults && searchResults.length > 0) {
      searchResults.forEach(contact => {
        console.log(`      ✅ Found: Name: "${contact.name}", Email: ${contact.email}`);
      });
    } else {
      console.log('      ❌ No results found');
    }
  }

  // Let's also check if there are ANY contacts for this account
  console.log(`\n4. Checking total contacts for account ${accountId}...`);
  const { count, error: countError } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId);

  if (countError) {
    console.error('   ❌ Count Error:', countError.message);
  } else {
    console.log(`   Total contacts for account ${accountId}: ${count || 0}`);
  }

  // Sample some contacts to see what names look like
  console.log(`\n5. Sample contacts from account ${accountId}...`);
  const { data: sampleContacts, error: sampleError } = await supabase
    .from('contacts')
    .select('name, email')
    .eq('account_id', accountId)
    .limit(10);

  if (sampleError) {
    console.error('   ❌ Sample Error:', sampleError.message);
  } else {
    console.log('   Sample contacts:');
    if (sampleContacts && sampleContacts.length > 0) {
      sampleContacts.forEach(contact => {
        console.log(`      - Name: "${contact.name}", Email: ${contact.email}`);
      });
    } else {
      console.log('      No contacts found for this account');
    }
  }
}

testContactSearch();