import { NextRequest, NextResponse } from 'next/server';
import { StakingService } from '@/lib/services/stakingService';
import { meetingStakesDb } from '@/lib/db/postgresMeetingStakes';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { meetingId, walletAddress } = body;

    if (!meetingId) {
      return NextResponse.json(
        { error: 'Missing required field: meetingId' },
        { status: 400 }
      );
    }

    // Get meeting stake data
    const meetingStake = await meetingStakesDb.getMeetingStakeData(meetingId);
    
    if (!meetingStake) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    // Check if already settled
    if (meetingStake.isSettled) {
      return NextResponse.json(
        { error: 'Meeting has already been settled' },
        { status: 400 }
      );
    }

    // Check if check-in period has ended
    const now = new Date();
    const endTime = new Date(meetingStake.endTime);
    const checkInDeadline = new Date(endTime.getTime() + 15 * 60 * 1000); // 15 minutes after end

    if (now <= checkInDeadline) {
      return NextResponse.json(
        { error: 'Check-in period has not ended yet. Please wait until ' + checkInDeadline.toISOString() },
        { status: 400 }
      );
    }

    // Optionally verify the caller is authorized (organizer or admin)
    if (walletAddress && walletAddress !== meetingStake.organizer) {
      // In production, you might want to restrict who can settle meetings
      // For now, we'll allow anyone to trigger settlement after deadline
    }

    // Settle the meeting
    const result = await StakingService.settleMeeting(meetingId);

    return NextResponse.json({
      success: true,
      message: 'Meeting settled successfully',
      result: {
        totalRefunded: result.refunded,
        totalForfeited: result.forfeited,
        refundedCount: meetingStake.stakes.filter(s => s.hasCheckedIn).length,
        forfeitedCount: meetingStake.stakes.filter(s => !s.hasCheckedIn).length
      }
    });
  } catch (error) {
    console.error('[API] Error settling meeting:', error);
    return NextResponse.json(
      { error: 'Failed to settle meeting', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}