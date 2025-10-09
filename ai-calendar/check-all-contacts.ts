import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkAllContacts() {
  // Get all contacts regardless of account
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('account_id', { ascending: true })
    .order('name', { ascending: true });
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Total contacts in database:', data?.length || 0);
  
  if (data && data.length > 0) {
    console.log('\nContacts by account:');
    const byAccount: Record<string, any[]> = {};
    
    data.forEach(c => {
      if (!byAccount[c.account_id]) byAccount[c.account_id] = [];
      byAccount[c.account_id].push(c);
    });
    
    Object.keys(byAccount).forEach(accountId => {
      console.log(`\n  Account ${accountId}: ${byAccount[accountId].length} contacts`);
      console.log('  Sample contacts:');
      byAccount[accountId].slice(0, 5).forEach(c => {
        console.log(`    - Name: "${c.name}", Email: ${c.email}`);
      });
    });
    
    // Search for anything with "Agyn"
    console.log('\n\nSearching for "Agyn" in all contacts:');
    const agynContacts = data.filter(c => 
      (c.name && c.name.toLowerCase().includes('agyn')) ||
      (c.email && c.email.toLowerCase().includes('agyn'))
    );
    
    if (agynContacts.length > 0) {
      console.log('Found contacts with "Agyn":');
      agynContacts.forEach(c => {
        console.log(`  - Account ${c.account_id}: Name: "${c.name}", Email: ${c.email}`);
      });
    } else {
      console.log('No contacts found with "Agyn" in name or email');
    }
  } else {
    console.log('\n❌ No contacts found in the database at all!');
    console.log('You need to sync contacts first by calling /api/calendar/google/sync-contacts');
  }
}

checkAllContacts();