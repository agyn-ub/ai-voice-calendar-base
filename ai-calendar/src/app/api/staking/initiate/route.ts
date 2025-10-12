import { NextRequest, NextResponse } from 'next/server';
import { postgresPendingMeetingsDb } from '@/lib/db/postgresPendingMeetings';
import { GmailNotificationService, StakeInvitationData } from '@/lib/services/gmailNotificationService';
import { postgresAccountsDb } from '@/lib/db/postgresAccountsDb';
import { invitationTokensDb } from '@/lib/db/postgresInvitationTokens';

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
  meetingId?: string; // Optional for backwards compatibility
  walletAddress: string;
  eventData: PendingEventData;
  stakeAmount: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('[StakingInitiate] API request received', {
    method: 'POST',
    timestamp: new Date().toISOString()
  });

  try {
    const body: InitiateStakeRequest = await request.json();
    const { meetingId: providedMeetingId, walletAddress, eventData, stakeAmount } = body;

    console.log('[StakingInitiate] Request payload', {
      providedMeetingId,
      walletAddress,
      stakeAmount,
      eventTitle: eventData?.summary,
      attendeesCount: eventData?.attendees?.length || 0,
      startTime: eventData?.start?.dateTime,
      endTime: eventData?.end?.dateTime
    });

    // Validate request
    if (!walletAddress || !eventData || !stakeAmount) {
      console.error('[StakingInitiate] ❌ Missing required fields', {
        hasWalletAddress: !!walletAddress,
        hasEventData: !!eventData,
        hasStakeAmount: !!stakeAmount
      });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get organizer's account for email
    console.log('[StakingInitiate] Fetching organizer account from database');
    const account = await postgresAccountsDb.getAccountByWallet(walletAddress);
    if (!account) {
      console.error('[StakingInitiate] ❌ No account found for wallet', {
        walletAddress,
        duration: `${Date.now() - startTime}ms`
      });
      return NextResponse.json(
        { error: 'No calendar connected for this wallet' },
        { status: 404 }
      );
    }
    console.log('[StakingInitiate] ✅ Organizer account retrieved', {
      organizerEmail: account.google_email
    });

    // Use provided meeting ID if available, otherwise generate a new one
    const meetingId = providedMeetingId || `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('[StakingInitiate] Using meeting ID', { 
      meetingId,
      wasProvided: !!providedMeetingId 
    });

    // Note: Blockchain meeting creation must happen on client-side where wallet is connected
    // This endpoint only handles database and email operations

    // Store pending meeting in database
    console.log('[StakingInitiate] Storing pending meeting in database');
    await postgresPendingMeetingsDb.createPendingMeeting({
      id: meetingId,
      organizer_wallet: walletAddress,
      event_data: JSON.stringify(eventData),
      stake_amount: stakeAmount,
      status: 'pending'
    });
    console.log('[StakingInitiate] ✅ Pending meeting stored', { meetingId });

    // Generate invitation tokens for attendees
    let tokenMap = new Map<string, string>();
    if (eventData.attendees && eventData.attendees.length > 0) {
      const attendeeEmails = eventData.attendees
        .filter(a => a.email) // Filter out attendees without emails
        .map(a => a.email);
      
      console.log('[StakingInitiate] Generating invitation tokens', {
        attendeeCount: attendeeEmails.length,
        attendees: attendeeEmails
      });
      
      if (attendeeEmails.length > 0) {
        tokenMap = await invitationTokensDb.createInvitationTokens(meetingId, attendeeEmails);
        console.log('[StakingInitiate] ✅ Invitation tokens generated', {
          tokenCount: tokenMap.size
        });
      }
    }

    // Send stake invitation emails with unique tokens
    let emailsSentCount = 0;
    let emailsFailedCount = 0;
    const emailResults: Array<{email: string, success: boolean, error?: string}> = [];

    if (eventData.attendees && eventData.attendees.length > 0) {
      console.log('[StakingInitiate] Creating Gmail service for sending invitations');
      const gmailService = await GmailNotificationService.createFromWallet(walletAddress);

      if (gmailService) {
        // Filter attendees with valid emails and send individual emails with unique tokens
        const attendeesWithEmail = eventData.attendees.filter(
          a => a.email && typeof a.email === 'string' && a.email.trim() !== ''
        );
        
        console.log('[StakingInitiate] Starting email send process', {
          totalAttendees: attendeesWithEmail.length,
          emails: attendeesWithEmail.map(a => a.email)
        });
        
        for (const attendee of attendeesWithEmail) {
          const normalizedEmail = attendee.email.trim().toLowerCase();
          const token = tokenMap.get(normalizedEmail);
          
          if (!token) {
            console.warn(`[StakingInitiate] ⚠️ No token generated for attendee`, {
              email: attendee.email,
              normalizedEmail
            });
            emailResults.push({
              email: attendee.email,
              success: false,
              error: 'No invitation token generated'
            });
            emailsFailedCount++;
            continue;
          }
          
          const invitationData: StakeInvitationData = {
            title: eventData.summary,
            startTime: new Date(eventData.start.dateTime),
            endTime: new Date(eventData.end.dateTime),
            stakeAmount: stakeAmount,
            meetingId: meetingId,
            organizerName: account.google_email?.split('@')[0],
            location: eventData.location,
            invitationToken: token // Pass the unique token
          };

          console.log('[StakingInitiate] Sending invitation to attendee', {
            email: attendee.email,
            hasToken: true,
            meetingId
          });

          const emailSent = await gmailService.sendStakeInvitation(
            [attendee.email], // Send to one attendee at a time with their unique token
            invitationData
          );

          if (emailSent) {
            emailsSentCount++;
            emailResults.push({
              email: attendee.email,
              success: true
            });
            console.log('[StakingInitiate] ✅ Invitation sent successfully', {
              email: attendee.email,
              token: token.substring(0, 8) + '...'
            });
          } else {
            emailsFailedCount++;
            emailResults.push({
              email: attendee.email,
              success: false,
              error: 'Failed to send email'
            });
            console.error(`[StakingInitiate] ❌ Failed to send invitation`, {
              email: attendee.email
            });
          }
        }
        
        console.log('[StakingInitiate] Email send process completed', {
          totalAttempted: attendeesWithEmail.length,
          successful: emailsSentCount,
          failed: emailsFailedCount,
          results: emailResults
        });
      } else {
        console.error('[StakingInitiate] ❌ Gmail service not available');
      }
    }

    const duration = Date.now() - startTime;
    console.log('[StakingInitiate] ✅ Request completed successfully', {
      meetingId,
      totalAttendees: eventData.attendees?.length || 0,
      emailsSent: emailsSentCount,
      emailsFailed: emailsFailedCount,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      meetingId,
      message: `Stake invitations sent to ${emailsSentCount} attendees`,
      emailsSent: emailsSentCount,
      emailsFailed: emailsFailedCount,
      emailResults,
      stakeLink: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/stake/${meetingId}`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[StakingInitiate] ❌ Unhandled error in API', {
      error: error instanceof Error ? {
        message: error.message,
        name: error.name,
        stack: error.stack
      } : error,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    return NextResponse.json(
      { error: 'Failed to initiate staking process' },
      { status: 500 }
    );
  }
}