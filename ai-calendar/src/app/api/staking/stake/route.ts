import { NextRequest, NextResponse } from 'next/server';
import { StakingService } from '@/lib/services/stakingService';
import { invitationTokensDb } from '@/lib/db/postgresInvitationTokens';
import { walletEmailAssociationsDb } from '@/lib/db/postgresWalletEmailAssociations';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { meetingId, amount, walletAddress, token } = body;

    if (!meetingId || !amount || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: meetingId, amount, walletAddress' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Stake amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Check if already staked
    const hasStaked = await StakingService.hasStaked(meetingId, walletAddress);
    if (hasStaked) {
      return NextResponse.json(
        { error: 'Already staked for this meeting' },
        { status: 400 }
      );
    }

    // Process invitation token if provided
    let userEmail: string | undefined;
    if (token) {
      const tokenData = await invitationTokensDb.useToken(token, walletAddress);
      if (tokenData && tokenData.email) {
        userEmail = tokenData.email;
        // Create wallet-email association
        await walletEmailAssociationsDb.createAssociation(
          walletAddress,
          userEmail,
          true // created_from_stake = true
        );
        console.log(`[Staking] Created wallet-email association: ${walletAddress} <-> ${userEmail}`);
      } else {
        console.warn(`[Staking] Invalid or expired token provided: ${token}`);
      }
    }

    // Record stake in database (with email if available)
    const success = await StakingService.stakeForMeeting(
      meetingId,
      amount,
      walletAddress,
      userEmail
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to record stake' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully staked for meeting'
    });
  } catch (error) {
    console.error('[API] Error staking for meeting:', error);
    return NextResponse.json(
      { error: 'Failed to stake for meeting', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}