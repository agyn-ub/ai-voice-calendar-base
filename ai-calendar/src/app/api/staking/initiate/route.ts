import { NextRequest, NextResponse } from 'next/server';
import { postgresPendingMeetingsDb } from '@/lib/db/postgresPendingMeetings';
import { GmailNotificationService, StakeInvitationData } from '@/lib/services/gmailNotificationService';
import { postgresAccountsDb } from '@/lib/db/postgresAccountsDb';

export interface PendingEventData {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees: Array<{
    email: string;
    displayName?: string;
  }>;
  conferenceData?: any;
}

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
    const account = await postgresAccountsDb.getAccountByWallet(walletAddress);
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
    await postgresPendingMeetingsDb.createPendingMeeting({
      id: meetingId,
      organizer_wallet: walletAddress,
      event_data: JSON.stringify(eventData),
      stake_amount: stakeAmount,
      status: 'pending'
    });

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