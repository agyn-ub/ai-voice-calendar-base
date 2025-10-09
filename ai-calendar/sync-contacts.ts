import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const WALLET_ADDRESS = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'; // From your database

async function syncContacts() {
  console.log('📧 Syncing Gmail contacts...\n');
  console.log('Wallet address:', WALLET_ADDRESS);
  console.log('API URL:', `${BASE_URL}/api/calendar/google/sync-contacts`);
  
  try {
    // First, preview what contacts we'll sync
    console.log('\n1. Getting preview of contacts...');
    const previewResponse = await fetch(`${BASE_URL}/api/calendar/google/sync-contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wallet_address: WALLET_ADDRESS,
        action: 'preview',
        maxPages: 1
      })
    });

    if (!previewResponse.ok) {
      const error = await previewResponse.json();
      console.error('❌ Preview failed:', error);
      return;
    }

    const previewData = await previewResponse.json();
    console.log('Preview results:');
    console.log('  Total contacts found:', previewData.summary?.totalContacts || 0);
    console.log('  With names:', previewData.summary?.withNames || 0);
    console.log('  Without names:', previewData.summary?.withoutNames || 0);
    
    if (previewData.summary?.sampleContacts) {
      console.log('\n  Sample contacts:');
      previewData.summary.sampleContacts.slice(0, 5).forEach((c: any) => {
        console.log(`    - Name: "${c.name}", Email: ${c.email}`);
      });
    }

    // Now perform the actual sync
    console.log('\n2. Syncing contacts to database...');
    const syncResponse = await fetch(`${BASE_URL}/api/calendar/google/sync-contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wallet_address: WALLET_ADDRESS,
        action: 'sync',
        maxPages: 10 // Sync up to 10 pages of messages
      })
    });

    if (!syncResponse.ok) {
      const error = await syncResponse.json();
      console.error('❌ Sync failed:', error);
      return;
    }

    const syncData = await syncResponse.json();
    console.log('\n✅ Sync completed successfully!');
    console.log('  Total contacts synced:', syncData.totalContacts);
    console.log('  Inserted into database:', syncData.inserted);
    console.log('  With names:', syncData.withNames);
    console.log('  Without names:', syncData.withoutNames);
    
    if (syncData.topContacts) {
      console.log('\n  Top contacts:');
      syncData.topContacts.slice(0, 10).forEach((c: any) => {
        console.log(`    - Name: "${c.name}", Email: ${c.email}`);
      });
    }

    // Check if "Agyn" is in the synced contacts
    if (syncData.topContacts) {
      const agynContact = syncData.topContacts.find((c: any) => 
        (c.name && c.name.toLowerCase().includes('agyn')) ||
        (c.email && c.email.toLowerCase().includes('agyn'))
      );
      
      if (agynContact) {
        console.log('\n🎉 Found "Agyn" in synced contacts!');
        console.log(`  Name: "${agynContact.name}", Email: ${agynContact.email}`);
      }
    }

  } catch (error) {
    console.error('❌ Error syncing contacts:', error);
  }
}

syncContacts();