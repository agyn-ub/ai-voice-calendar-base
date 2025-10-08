import { NextRequest, NextResponse } from 'next/server';
import { postgresAccountsDb } from '@/lib/db/postgresAccountsDb';
import { accountsDb } from '@/lib/db/accountsDb';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const walletAddress = searchParams.get('wallet_address');
  
  if (!walletAddress) {
    return NextResponse.json(
      { error: 'Wallet address is required' },
      { status: 400 }
    );
  }
  
  // First try PostgreSQL (new system)
  let account = await postgresAccountsDb.getAccountByWallet(walletAddress);
  
  // If not found in PostgreSQL, check SQLite/JSON fallback (old system)
  if (!account) {
    account = accountsDb.getAccountByWalletSync(walletAddress);
    
    // If found in old system, migrate to new system
    if (account && account.google_email && account.access_token && account.refresh_token) {
      console.log('[Status] Migrating account from SQLite to PostgreSQL:', walletAddress);
      await postgresAccountsDb.saveAccount({
        wallet_address: account.wallet_address,
        google_email: account.google_email,
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        token_expiry: account.token_expiry,
        scopes: account.scopes
      });
    }
  }

  if (!account) {
    return NextResponse.json({
      connected: false,
      email: null
    });
  }

  return NextResponse.json({
    connected: true,
    email: account.google_email,
    provider: 'google'
  });
}