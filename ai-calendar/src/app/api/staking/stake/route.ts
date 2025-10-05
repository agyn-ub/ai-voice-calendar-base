import { NextRequest, NextResponse } from 'next/server';
import { StakingService } from '@/lib/services/stakingService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { meetingId, amount, walletAddress } = body;

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

    // Record stake in database
    const success = await StakingService.stakeForMeeting(
      meetingId,
      amount,
      walletAddress
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