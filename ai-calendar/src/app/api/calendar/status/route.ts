import { NextRequest, NextResponse } from 'next/server';
import { postgresAccountsDb } from '@/lib/db/postgresAccountsDb';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const walletAddress = searchParams.get('wallet_address');
  
  if (!walletAddress) {
    return NextResponse.json(
      { error: 'Wallet address is required' },
      { status: 400 }
    );
  }
  
  console.log('[Calendar Status] Checking connection for wallet:', walletAddress);
  console.log('[Calendar Status] Using lowercase:', walletAddress.toLowerCase());
  
  // Ensure consistent case handling - PostgreSQL saves as lowercase
  const account = await postgresAccountsDb.getAccountByWallet(walletAddress.toLowerCase());

  if (!account) {
    console.log('[Calendar Status] No account found for wallet:', walletAddress.toLowerCase());
    return NextResponse.json({
      connected: false,
      email: null
    });
  }

  console.log('[Calendar Status] Account found:', {
    id: account.id,
    wallet: account.wallet_address,
    email: account.google_email,
    hasTokens: !!(account.access_token && account.refresh_token)
  });

  return NextResponse.json({
    connected: true,
    email: account.google_email,
    provider: 'google'
  });
}