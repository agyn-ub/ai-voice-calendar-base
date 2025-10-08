import { NextRequest, NextResponse } from 'next/server';
import { postgresPendingMeetingsDb } from '@/lib/db/postgresPendingMeetings';
import { googleCalendarService } from '@/lib/services/googleCalendar';
import { GmailNotificationService } from '@/lib/services/gmailNotificationService';
import { postgresAccountsDb } from '@/lib/db/postgresAccountsDb';

interface PendingEventData {
  summary: string;
  description?: string;
  location?: string;
  startDateTime: string;
  endDateTime: string;
  start?: {
    dateTime: string;
    timeZone: string;
  };
  end?: {
    dateTime: string;
    timeZone: string;
  };
  attendees: Array<{
    email: string;
    displayName?: string;
  }>;
}

interface ConfirmStakeRequest {
  meetingId: string;
  stakerWallet: string;
  stakerEmail?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ConfirmStakeRequest = await request.json();
    const { meetingId, stakerWallet, stakerEmail } = body;

    // Validate request
    if (!meetingId || !stakerWallet) {
      return NextResponse.json(
        { error: 'Meeting ID and staker wallet are required' },
        { status: 400 }
      );
    }

    // Get pending meeting
    const pendingMeeting = await postgresPendingMeetingsDb.getPendingMeeting(meetingId);
    if (!pendingMeeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    // Event data is already parsed from PostgreSQL
    const eventData: PendingEventData = pendingMeeting.event_data;

    // Check if calendar event already exists
    if (pendingMeeting.google_event_id) {
      console.log(`[Staking] Calendar event already created for meeting ${meetingId}`);
      return NextResponse.json({
        success: true,
        message: 'Calendar event already scheduled',
        googleEventId: pendingMeeting.google_event_id
      });
    }

    // Get organizer's account
    const organizerAccount = await postgresAccountsDb.getAccountByWallet(pendingMeeting.organizer_wallet);
    if (!organizerAccount) {
      return NextResponse.json(
        { error: 'Organizer calendar not found' },
        { status: 404 }
      );
    }

    // Use the Google Calendar service singleton
    const calendarService = googleCalendarService;

    // Prepare calendar event
    const calendarEvent = {
      summary: eventData.summary,
      description: `${eventData.description || ''}\n\n💎 This meeting requires a ${pendingMeeting.stake_amount} ETH stake.\nMeeting ID: ${meetingId}`,
      location: eventData.location,
      start: {
        dateTime: eventData.startDateTime,
        timeZone: eventData.timezone || 'America/Los_Angeles'
      },
      end: {
        dateTime: eventData.endDateTime,
        timeZone: eventData.timezone || 'America/Los_Angeles'
      },
      attendees: eventData.attendees?.map(email => ({
        email,
        responseStatus: 'needsAction'
      })) || [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email' as const, minutes: 60 },
          { method: 'popup' as const, minutes: 10 }
        ]
      }
    };

    // Create the calendar event with email notifications
    const createdEvent = await calendarService.createCalendarEvent(pendingMeeting.organizer_wallet, calendarEvent);

    if (!createdEvent || !createdEvent.id) {
      throw new Error('Failed to create calendar event');
    }

    console.log(`[Staking] Created Google Calendar event ${createdEvent.id} for meeting ${meetingId}`);

    // Update pending meeting status
    await postgresPendingMeetingsDb.updatePendingMeetingStatus(meetingId, 'stake_confirmed', createdEvent.id);

    // Send confirmation email to staker
    if (stakerEmail) {
      const gmailService = await GmailNotificationService.createFromWallet(pendingMeeting.organizer_wallet);
      if (gmailService) {
        await gmailService.sendStakeConfirmation(
          stakerEmail,
          eventData.summary,
          pendingMeeting.stake_amount
        );
      }
    }

    // After all attendees stake, mark as scheduled
    // For now, we'll mark it as scheduled immediately
    // In production, you'd check if all required attendees have staked
    await postgresPendingMeetingsDb.updatePendingMeetingStatus(meetingId, 'scheduled', createdEvent.id);

    return NextResponse.json({
      success: true,
      message: 'Calendar event created and invitations sent',
      googleEventId: createdEvent.id,
      eventLink: createdEvent.htmlLink
    });

  } catch (error) {
    console.error('[Staking] Error confirming stake and scheduling:', error);
    return NextResponse.json(
      { error: 'Failed to confirm stake and schedule event' },
      { status: 500 }
    );
  }
}