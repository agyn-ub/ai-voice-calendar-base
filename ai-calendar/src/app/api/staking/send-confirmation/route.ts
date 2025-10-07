import { NextRequest, NextResponse } from 'next/server';
import { GmailNotificationService } from '@/lib/services/gmailNotificationService';

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, meetingId, meetingTitle, stakeAmount } = await request.json();

    if (!walletAddress || !meetingId || !meetingTitle) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Create Gmail service for the user
    const gmailService = await GmailNotificationService.createFromWallet(walletAddress);

    if (!gmailService) {
      return NextResponse.json(
        { error: 'Gmail service not available. Please reconnect your Google account.' },
        { status: 401 }
      );
    }

    // Get user's email from the account
    const account = await import('@/lib/db/accountsDb').then(m => m.accountsDb.getAccountByWallet(walletAddress));

    if (!account?.google_email) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 404 }
      );
    }

    // Send confirmation to the user themselves
    await gmailService.sendStakeConfirmation(
      account.google_email,
      meetingTitle,
      stakeAmount || 0.01 // Default to 0.01 ETH if not specified
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SendConfirmation] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send confirmation email' },
      { status: 500 }
    );
  }
}