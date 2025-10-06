import { NextRequest, NextResponse } from 'next/server';
import { pendingMeetingsDb, PendingEventData } from '@/lib/db/pendingMeetings';
import { GmailNotificationService, StakeInvitationData } from '@/lib/services/gmailNotificationService';
import { accountsDb } from '@/lib/db/accountsDb';

interface InitiateStakeRequest {
  walletAddress: string;
  eventData: PendingEventData;
  stakeAmount: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: InitiateStakeRequest = await request.json();
    const { walletAddress, eventData, stakeAmount } = body;

    // Validate request
    if (!walletAddress || !eventData || !stakeAmount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get organizer's account for email
    const account = await accountsDb.getAccountByWallet(walletAddress);
    if (!account) {
      return NextResponse.json(
        { error: 'No calendar connected for this wallet' },
        { status: 404 }
      );
    }

    // Generate unique meeting ID
    const meetingId = `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Note: Blockchain meeting creation must happen on client-side where wallet is connected
    // This endpoint only handles database and email operations

    // Store pending meeting in database
    await pendingMeetingsDb.createPendingMeeting(
      meetingId,
      walletAddress,
      eventData,
      stakeAmount,
      account.google_email || undefined
    );

    // Send stake invitation emails
    if (eventData.attendees && eventData.attendees.length > 0) {
      const gmailService = await GmailNotificationService.createFromWallet(walletAddress);

      if (gmailService) {
        const invitationData: StakeInvitationData = {
          title: eventData.summary,
          startTime: new Date(eventData.startDateTime),
          endTime: new Date(eventData.endDateTime),
          stakeAmount: stakeAmount,
          meetingId: meetingId,
          organizerName: account.google_email?.split('@')[0],
          location: eventData.location
        };

        const emailsSent = await gmailService.sendStakeInvitation(
          eventData.attendees,
          invitationData
        );

        if (!emailsSent) {
          console.warn('[Staking] Failed to send some stake invitation emails');
        } else {
          console.log(`[Staking] Sent stake invitations to ${eventData.attendees.length} attendees`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      meetingId,
      message: `Stake invitations sent to ${eventData.attendees?.length || 0} attendees`,
      stakeLink: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/stake/${meetingId}`
    });

  } catch (error) {
    console.error('[Staking] Error initiating stake:', error);
    return NextResponse.json(
      { error: 'Failed to initiate staking process' },
      { status: 500 }
    );
  }
}