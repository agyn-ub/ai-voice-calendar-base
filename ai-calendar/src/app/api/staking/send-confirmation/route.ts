import { NextRequest, NextResponse } from 'next/server';
import { GmailNotificationService } from '@/lib/services/gmailNotificationService';
import { postgresAccountsDb } from '@/lib/db/postgresAccountsDb';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('[SendConfirmation] API request received', {
    method: 'POST',
    timestamp: new Date().toISOString()
  });

  try {
    const { walletAddress, meetingId, meetingTitle, stakeAmount } = await request.json();

    console.log('[SendConfirmation] Request payload', {
      walletAddress,
      meetingId,
      meetingTitle,
      stakeAmount,
      hasWalletAddress: !!walletAddress,
      hasMeetingId: !!meetingId,
      hasMeetingTitle: !!meetingTitle
    });

    if (!walletAddress || !meetingId || !meetingTitle) {
      console.error('[SendConfirmation] ❌ Missing required parameters', {
        walletAddress: !!walletAddress,
        meetingId: !!meetingId,
        meetingTitle: !!meetingTitle
      });
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Create Gmail service for the user
    console.log('[SendConfirmation] Creating Gmail service for wallet', { walletAddress });
    const gmailService = await GmailNotificationService.createFromWallet(walletAddress);

    if (!gmailService) {
      console.error('[SendConfirmation] ❌ Gmail service creation failed', {
        walletAddress,
        duration: `${Date.now() - startTime}ms`
      });
      return NextResponse.json(
        { error: 'Gmail service not available. Please reconnect your Google account.' },
        { status: 401 }
      );
    }
    console.log('[SendConfirmation] ✅ Gmail service created successfully');

    // Get user's email from the account
    console.log('[SendConfirmation] Fetching user email from database');
    const account = await postgresAccountsDb.getAccountByWallet(walletAddress);

    if (!account?.google_email) {
      console.error('[SendConfirmation] ❌ User email not found', {
        walletAddress,
        hasAccount: !!account,
        duration: `${Date.now() - startTime}ms`
      });
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 404 }
      );
    }
    console.log('[SendConfirmation] User email retrieved', {
      email: account.google_email,
      walletAddress
    });

    // Send confirmation to the user themselves
    console.log('[SendConfirmation] Sending stake confirmation email', {
      recipient: account.google_email,
      meetingTitle,
      stakeAmount: stakeAmount || 0.01
    });

    const emailSent = await gmailService.sendStakeConfirmation(
      account.google_email,
      meetingTitle,
      stakeAmount || 0.01 // Default to 0.01 ETH if not specified
    );

    const duration = Date.now() - startTime;
    
    if (emailSent) {
      console.log('[SendConfirmation] ✅ Request completed successfully', {
        recipient: account.google_email,
        meetingId,
        meetingTitle,
        stakeAmount: stakeAmount || 0.01,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json({ success: true });
    } else {
      console.error('[SendConfirmation] ❌ Email sending failed', {
        recipient: account.google_email,
        meetingId,
        meetingTitle,
        duration: `${duration}ms`
      });
      return NextResponse.json(
        { error: 'Failed to send confirmation email' },
        { status: 500 }
      );
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[SendConfirmation] ❌ Unhandled error in API', {
      error: error instanceof Error ? {
        message: error.message,
        name: error.name,
        stack: error.stack
      } : error,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    return NextResponse.json(
      { error: 'Failed to send confirmation email' },
      { status: 500 }
    );
  }
}