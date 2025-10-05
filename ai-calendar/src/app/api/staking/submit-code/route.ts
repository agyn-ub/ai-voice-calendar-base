import { NextRequest, NextResponse } from 'next/server';
import { StakingService } from '@/lib/services/stakingService';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { meetingId, code, walletAddress } = body;

    if (!meetingId || !code || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: meetingId, code, walletAddress' },
        { status: 400 }
      );
    }

    // Verify the user has staked for this meeting
    const hasStaked = await StakingService.hasStaked(meetingId, walletAddress);
    if (!hasStaked) {
      return NextResponse.json(
        { error: 'You have not staked for this meeting' },
        { status: 403 }
      );
    }

    // Check if already checked in
    const database = await db.read();
    const meetingStake = database.meetingStakes?.[meetingId];
    
    if (!meetingStake) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    const userStake = meetingStake.stakes.find(s => s.walletAddress === walletAddress);
    if (userStake?.hasCheckedIn) {
      return NextResponse.json(
        { error: 'You have already checked in for this meeting' },
        { status: 400 }
      );
    }

    // Submit attendance code
    const success = await StakingService.submitAttendanceCode(
      meetingId,
      code,
      walletAddress
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to submit attendance code' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Attendance confirmed successfully'
    });
  } catch (error) {
    console.error('[API] Error submitting attendance code:', error);
    
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('Invalid attendance code')) {
        return NextResponse.json(
          { error: 'Invalid attendance code' },
          { status: 400 }
        );
      }
      if (error.message.includes('expired')) {
        return NextResponse.json(
          { error: 'Attendance code has expired' },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to submit attendance code', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}