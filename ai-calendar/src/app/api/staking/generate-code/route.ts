import { NextRequest, NextResponse } from 'next/server';
import { StakingService } from '@/lib/services/stakingService';
import { meetingStakesDb } from '@/lib/db/postgresMeetingStakes';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { meetingId, walletAddress } = body;

    if (!meetingId || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: meetingId, walletAddress' },
        { status: 400 }
      );
    }

    // Verify the requester is the meeting organizer
    const meetingStake = await meetingStakesDb.getMeetingStakeData(meetingId);
    
    if (!meetingStake) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    if (meetingStake.organizer !== walletAddress) {
      return NextResponse.json(
        { error: 'Only the meeting organizer can generate attendance codes' },
        { status: 403 }
      );
    }

    // Check if meeting is active
    const now = new Date();
    const startTime = new Date(meetingStake.startTime);
    const endTime = new Date(meetingStake.endTime);

    if (now < startTime) {
      return NextResponse.json(
        { error: 'Meeting has not started yet' },
        { status: 400 }
      );
    }

    if (now > endTime) {
      return NextResponse.json(
        { error: 'Meeting has already ended' },
        { status: 400 }
      );
    }

    // Generate attendance code
    const code = await StakingService.generateAttendanceCode(meetingId);

    return NextResponse.json({
      success: true,
      code,
      validUntil: new Date(endTime.getTime() + 15 * 60 * 1000).toISOString(), // 15 minutes after meeting end
      message: 'Attendance code generated successfully'
    });
  } catch (error) {
    console.error('[API] Error generating attendance code:', error);
    return NextResponse.json(
      { error: 'Failed to generate attendance code', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}