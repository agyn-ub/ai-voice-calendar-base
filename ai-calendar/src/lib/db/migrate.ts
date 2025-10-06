import { readFileSync, existsSync, renameSync } from 'fs';
import { accountsDb } from './accountsDb';
import { contactsDb } from './contactsDb';

interface OldCalendarConnection {
  wallet_address: string;
  google_email?: string;
  access_token?: string;
  refresh_token?: string;
  token_expiry?: number;
  created_at?: number;
  updated_at?: number;
}

interface OldSimpleContact {
  email: string;
  name: string | null;
}

interface OldDatabase {
  connections: { [walletAddress: string]: OldCalendarConnection };
  extractedContacts?: { [walletAddress: string]: OldSimpleContact[] };
}

/**
 * Migrate data from JSON file to SQLite database
 */
export async function migrateFromJSON(jsonFilePath: string = './calendar-connections.json'): Promise<void> {
  console.log('[Migration] Starting migration from JSON to SQLite...');

  // Check if JSON file exists
  if (!existsSync(jsonFilePath)) {
    console.log('[Migration] No JSON file found at', jsonFilePath);
    console.log('[Migration] Starting with empty database.');
    return;
  }

  try {
    // Read and parse JSON file
    console.log('[Migration] Reading JSON file...');
    const jsonData = readFileSync(jsonFilePath, 'utf-8');
    const oldDb: OldDatabase = JSON.parse(jsonData);

    // Count totals
    const connectionCount = Object.keys(oldDb.connections || {}).length;
    const contactsCount = Object.keys(oldDb.extractedContacts || {}).length;

    console.log(`[Migration] Found ${connectionCount} connections and ${contactsCount} contact lists`);

    // Migrate connections to accounts table
    let accountsMigrated = 0;
    let contactsMigrated = 0;

    for (const [walletAddress, connection] of Object.entries(oldDb.connections || {})) {
      console.log(`[Migration] Migrating account for wallet: ${walletAddress}`);

      // Create or update account
      const account = accountsDb.createOrUpdateAccountSync({
        wallet_address: connection.wallet_address || walletAddress,
        google_email: connection.google_email,
        access_token: connection.access_token,
        refresh_token: connection.refresh_token,
        token_expiry: connection.token_expiry,
        created_at: connection.created_at,
        updated_at: connection.updated_at
      });

      accountsMigrated++;

      // Migrate contacts for this wallet if they exist
      if (oldDb.extractedContacts && oldDb.extractedContacts[walletAddress] && account.id) {
        const contacts = oldDb.extractedContacts[walletAddress];
        console.log(`[Migration] Migrating ${contacts.length} contacts for wallet: ${walletAddress}`);

        if (contacts.length > 0) {
          const inserted = contactsDb.saveContacts(
            account.id,
            contacts.map(c => ({
              email: c.email,
              name: c.name
            }))
          );

          contactsMigrated += inserted;
          console.log(`[Migration] Inserted ${inserted} contacts for account ${account.id}`);

          // Update sync time if contacts were migrated
          if (inserted > 0) {
            accountsDb.updateSyncTime(account.id);
          }
        }
      }
    }

    // Create backup of JSON file
    const backupPath = jsonFilePath + '.backup.' + Date.now();
    console.log(`[Migration] Creating backup at: ${backupPath}`);
    renameSync(jsonFilePath, backupPath);

    console.log('[Migration] ✅ Migration completed successfully!');
    console.log(`[Migration] Migrated ${accountsMigrated} accounts and ${contactsMigrated} contacts`);
    console.log(`[Migration] Original JSON file backed up to: ${backupPath}`);

  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Run migration if needed (can be called on startup)
 */
export async function runMigrationIfNeeded(): Promise<void> {
  const jsonPath = './calendar-connections.json';

  // Check if JSON file exists and SQLite is empty
  if (existsSync(jsonPath)) {
    // If SQLite seems empty (this test returns null as expected), run migration
    console.log('[Migration] JSON file found. Checking if migration is needed...');

    // Simple check: if JSON exists but we have no real data in SQLite, migrate
    try {
      const jsonData = readFileSync(jsonPath, 'utf-8');
      const oldDb = JSON.parse(jsonData);

      if (Object.keys(oldDb.connections || {}).length > 0) {
        // We have data in JSON, check if first wallet is in SQLite
        const firstWallet = Object.keys(oldDb.connections)[0];
        const existingAccount = accountsDb.getAccountByWalletSync(firstWallet);

        if (!existingAccount) {
          console.log('[Migration] Data found in JSON but not in SQLite. Running migration...');
          await migrateFromJSON(jsonPath);
        } else {
          console.log('[Migration] Data already exists in SQLite. Skipping migration.');
        }
      }
    } catch {
      console.log('[Migration] Could not read JSON file, skipping migration');
    }
  }
}

// Export for command-line execution
if (require.main === module) {
  migrateFromJSON()
    .then(() => {
      console.log('[Migration] Process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Migration] Process failed:', error);
      process.exit(1);
    });
}