import { NextRequest, NextResponse } from 'next/server';
import { accountsDb } from '@/lib/db/accountsDb';
import { postgresAccountsDb } from '@/lib/db/postgresAccountsDb';
import fs from 'fs';
import path from 'path';

interface CalendarConnection {
  wallet_address: string;
  google_email?: string;
  access_token?: string;
  refresh_token?: string;
  token_expiry?: number;
  scopes?: string;
  created_at?: number;
  updated_at?: number;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Migration] Starting account migration from SQLite/JSON to PostgreSQL...');
    
    const migrationResults = {
      totalFound: 0,
      migrated: 0,
      alreadyExists: 0,
      failed: 0,
      accounts: [] as any[]
    };

    // Try to read from JSON file directly
    const dbPath = path.join(process.cwd(), 'calendar-connections.json');
    let jsonAccounts: CalendarConnection[] = [];
    
    if (fs.existsSync(dbPath)) {
      try {
        const fileContent = fs.readFileSync(dbPath, 'utf-8');
        const data = JSON.parse(fileContent);
        
        // Handle both array and object formats
        if (Array.isArray(data.connections)) {
          jsonAccounts = data.connections;
        } else if (typeof data.connections === 'object') {
          // Convert object to array
          jsonAccounts = Object.values(data.connections);
        }
        
        console.log(`[Migration] Found ${jsonAccounts.length} accounts in JSON file`);
      } catch (error) {
        console.error('[Migration] Error reading JSON file:', error);
      }
    }

    migrationResults.totalFound = jsonAccounts.length;

    // Migrate each account
    for (const account of jsonAccounts) {
      try {
        // Check if already exists in PostgreSQL
        const existing = await postgresAccountsDb.getAccountByWallet(account.wallet_address);
        
        if (existing) {
          console.log(`[Migration] Account already exists in PostgreSQL: ${account.wallet_address}`);
          migrationResults.alreadyExists++;
          migrationResults.accounts.push({
            wallet: account.wallet_address,
            status: 'already_exists',
            email: existing.google_email
          });
          continue;
        }

        // Migrate to PostgreSQL
        const migrated = await postgresAccountsDb.saveAccount({
          wallet_address: account.wallet_address,
          google_email: account.google_email,
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          token_expiry: account.token_expiry,
          scopes: account.scopes
        });

        if (migrated) {
          console.log(`[Migration] Successfully migrated: ${account.wallet_address}`);
          migrationResults.migrated++;
          migrationResults.accounts.push({
            wallet: account.wallet_address,
            status: 'migrated',
            email: account.google_email
          });
        } else {
          console.error(`[Migration] Failed to migrate: ${account.wallet_address}`);
          migrationResults.failed++;
          migrationResults.accounts.push({
            wallet: account.wallet_address,
            status: 'failed',
            email: account.google_email
          });
        }
      } catch (error) {
        console.error(`[Migration] Error migrating account ${account.wallet_address}:`, error);
        migrationResults.failed++;
        migrationResults.accounts.push({
          wallet: account.wallet_address,
          status: 'error',
          email: account.google_email,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log('[Migration] Migration complete:', migrationResults);

    return NextResponse.json({
      success: true,
      message: `Migration complete. Migrated ${migrationResults.migrated} accounts.`,
      results: migrationResults
    });

  } catch (error) {
    console.error('[Migration] Fatal error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Migration failed' 
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check migration status
export async function GET(request: NextRequest) {
  try {
    // Check if JSON file exists
    const dbPath = path.join(process.cwd(), 'calendar-connections.json');
    const jsonExists = fs.existsSync(dbPath);
    
    let jsonCount = 0;
    if (jsonExists) {
      try {
        const fileContent = fs.readFileSync(dbPath, 'utf-8');
        const data = JSON.parse(fileContent);
        
        // Handle both array and object formats
        if (Array.isArray(data.connections)) {
          jsonCount = data.connections.length;
        } else if (typeof data.connections === 'object') {
          jsonCount = Object.keys(data.connections).length;
        }
      } catch (error) {
        console.error('[Migration] Error reading JSON file:', error);
      }
    }

    // Get PostgreSQL count (this is an estimate - would need a proper count method)
    const pgCount = 'Check individual accounts';

    return NextResponse.json({
      jsonFile: {
        exists: jsonExists,
        path: dbPath,
        accountCount: jsonCount
      },
      postgresql: {
        status: 'connected',
        accountCount: pgCount
      },
      needsMigration: jsonCount > 0
    });
  } catch (error) {
    console.error('[Migration] Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check migration status' },
      { status: 500 }
    );
  }
}