import { NextRequest, NextResponse } from 'next/server';
import { StakingService } from '@/lib/services/stakingService';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get('meetingId');
    const walletAddress = searchParams.get('walletAddress');

    if (!meetingId) {
      return NextResponse.json(
        { error: 'Missing required parameter: meetingId' },
        { status: 400 }
      );
    }

    // Get meeting stake data
    const database = await db.read();
    const meetingStake = database.meetingStakes?.[meetingId];
    
    if (!meetingStake) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    // Calculate meeting status
    const now = new Date();
    const startTime = new Date(meetingStake.startTime);
    const endTime = new Date(meetingStake.endTime);
    const checkInDeadline = new Date(endTime.getTime() + 15 * 60 * 1000); // 15 minutes after end
    const stakingDeadline = new Date(startTime.getTime() - 60 * 60 * 1000); // 1 hour before start

    let status = 'upcoming';
    if (now > checkInDeadline) {
      status = meetingStake.isSettled ? 'settled' : 'pending_settlement';
    } else if (now > endTime) {
      status = 'check_in_period';
    } else if (now >= startTime) {
      status = 'in_progress';
    } else if (now > stakingDeadline) {
      status = 'staking_closed';
    }

    // Get user-specific stake info if wallet address provided
    let userStake = null;
    if (walletAddress) {
      userStake = meetingStake.stakes.find(s => s.walletAddress === walletAddress);
    }

    // Calculate totals
    const totalStaked = meetingStake.stakes.reduce((sum, s) => sum + s.amount, 0);
    const totalAttended = meetingStake.stakes.filter(s => s.hasCheckedIn).length;
    const totalStakers = meetingStake.stakes.length;

    return NextResponse.json({
      meeting: {
        meetingId: meetingStake.meetingId,
        eventId: meetingStake.eventId,
        organizer: meetingStake.organizer,
        requiredStake: meetingStake.requiredStake,
        startTime: meetingStake.startTime,
        endTime: meetingStake.endTime,
        status,
        isSettled: meetingStake.isSettled,
        hasAttendanceCode: !!meetingStake.attendanceCode,
        stakingDeadline: stakingDeadline.toISOString(),
        checkInDeadline: checkInDeadline.toISOString()
      },
      stats: {
        totalStaked,
        totalStakers,
        totalAttended,
        totalAbsent: totalStakers - totalAttended
      },
      userStake: userStake ? {
        amount: userStake.amount,
        stakedAt: userStake.stakedAt,
        hasCheckedIn: userStake.hasCheckedIn,
        checkInTime: userStake.checkInTime,
        isRefunded: userStake.isRefunded
      } : null,
      participants: meetingStake.stakes.map(s => ({
        walletAddress: s.walletAddress.slice(0, 6) + '...' + s.walletAddress.slice(-4),
        hasCheckedIn: s.hasCheckedIn,
        isRefunded: s.isRefunded
      }))
    });
  } catch (error) {
    console.error('[API] Error getting stake status:', error);
    return NextResponse.json(
      { error: 'Failed to get stake status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}