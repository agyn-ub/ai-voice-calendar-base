import { NextRequest, NextResponse } from 'next/server';
import { StakingService } from '@/lib/services/stakingService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, meetingId, organizer, requiredStake, startTime, endTime } = body;

    if (!eventId || !meetingId || !organizer || !requiredStake || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields: eventId, meetingId, organizer, requiredStake, startTime, endTime' },
        { status: 400 }
      );
    }

    if (requiredStake <= 0) {
      return NextResponse.json(
        { error: 'Required stake must be greater than 0' },
        { status: 400 }
      );
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();

    if (start <= now) {
      return NextResponse.json(
        { error: 'Start time must be in the future' },
        { status: 400 }
      );
    }

    if (end <= start) {
      return NextResponse.json(
        { error: 'End time must be after start time' },
        { status: 400 }
      );
    }

    // Create staked meeting on blockchain and in database
    const transactionId = await StakingService.createStakedMeeting(
      meetingId,
      eventId,
      organizer,
      requiredStake,
      start,
      end
    );

    return NextResponse.json({
      success: true,
      transactionId,
      meetingId,
      message: 'Staked meeting created successfully',
      stakingDeadline: new Date(start.getTime() - 60 * 60 * 1000).toISOString(), // 1 hour before start
      checkInDeadline: new Date(end.getTime() + 15 * 60 * 1000).toISOString() // 15 minutes after end
    });
  } catch (error) {
    console.error('[API] Error creating staked meeting:', error);
    return NextResponse.json(
      { error: 'Failed to create staked meeting', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}