import { NextRequest, NextResponse } from 'next/server';
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
  
  const account = accountsDb.getAccountByWalletSync(walletAddress);

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