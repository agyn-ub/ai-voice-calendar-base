import { NextRequest, NextResponse } from 'next/server';
import { GmailContactSyncService } from '@/lib/services/gmailContactSync';
import { accountsDb } from '@/lib/db/accountsDb';
import { contactsDb } from '@/lib/db/contactsDb';
import db from '@/lib/db/sqlite';

export async function POST(request: NextRequest) {
  try {
    // Ensure database is initialized
    await db.initialize();

    const body = await request.json();
    const { wallet_address, action = 'sync', maxPages = 10 } = body;

    if (!wallet_address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    console.log(`[Sync] Starting ${action} for wallet: ${wallet_address}`);

    // Get account
    const account = accountsDb.getAccountByWalletSync(wallet_address);
    console.log('[Sync] Account lookup result:', {
      found: !!account,
      hasId: !!(account?.id),
      hasAccessToken: !!(account?.access_token),
      hasRefreshToken: !!(account?.refresh_token),
      walletAddress: wallet_address
    });

    if (!account || !account.id) {
      console.error('[Sync] No account found for wallet:', wallet_address);
      return NextResponse.json(
        { error: 'No calendar connection found. Please connect your Google Calendar first.' },
        { status: 401 }
      );
    }

    // Create service instance
    const syncService = await GmailContactSyncService.createFromWallet(wallet_address);

    if (!syncService) {
      return NextResponse.json(
        { error: 'Invalid calendar credentials. Please reconnect your Google Calendar.' },
        { status: 401 }
      );
    }

    switch (action) {
      case 'preview': {
        // Just get a summary without saving (only 1 page for preview)
        console.log('[Sync] Getting contact summary...');
        const summary = await syncService.getContactsSummary(1);
        return NextResponse.json({
          success: true,
          action: 'preview',
          summary
        });
      }

      case 'sync': {
        // Extract contacts from Gmail and save to SQLite database
        console.log(`[Sync] Extracting contacts from Gmail (up to ${maxPages} pages)...`);
        const contacts = await syncService.extractContactsFromGmail(maxPages);

        // Clear existing contacts and save new ones
        console.log(`[Sync] Saving ${contacts.length} contacts to database...`);
        await contactsDb.clearContacts(account.id);
        const inserted = await contactsDb.saveContacts(account.id, contacts);

        // Update sync timestamp
        await accountsDb.updateSyncTime(account.id);

        // Get summary statistics
        const withNames = contacts.filter(c => c.name !== null).length;
        const withoutNames = contacts.filter(c => c.name === null).length;
        const topContacts = contacts.slice(0, 10);

        console.log(`[Sync] Contact sync complete. Total: ${contacts.length}, Inserted: ${inserted}, With names: ${withNames}`);

        return NextResponse.json({
          success: true,
          action: 'sync',
          summary: {
            totalContacts: contacts.length,
            inserted,
            withNames,
            withoutNames,
            topContacts
          }
        });
      }

      case 'clear': {
        // Clear stored contacts
        console.log('[Sync] Clearing stored contacts...');
        const success = await contactsDb.clearContacts(account.id);

        return NextResponse.json({
          success: true,
          action: 'clear',
          message: 'Contacts cleared successfully',
          cleared: success
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "preview", "sync", or "clear"' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('[Sync] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync contacts' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Ensure database is initialized
  await db.initialize();
  try {
    const { searchParams } = new URL(request.url);
    const wallet_address = searchParams.get('wallet_address');

    if (!wallet_address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Get account
    const account = accountsDb.getAccountByWalletSync(wallet_address);
    if (!account || !account.id) {
      return NextResponse.json({
        success: true,
        contacts: [],
        summary: {
          totalContacts: 0,
          withNames: 0,
          withoutNames: 0,
          hasData: false
        }
      });
    }

    // Get stored contacts from SQLite database
    const contacts = await contactsDb.getContacts(account.id, 1000);

    // Calculate statistics
    const withNames = contacts.filter(c => c.name !== null).length;
    const withoutNames = contacts.filter(c => c.name === null).length;

    return NextResponse.json({
      success: true,
      contacts: contacts.map(c => ({
        email: c.email,
        name: c.name
      })),
      summary: {
        totalContacts: contacts.length,
        withNames,
        withoutNames,
        hasData: contacts.length > 0,
        lastSync: account.last_sync_at
      }
    });

  } catch (error) {
    console.error('[Sync] Error getting contacts:', error);
    return NextResponse.json(
      { error: 'Failed to get contacts' },
      { status: 500 }
    );
  }
}