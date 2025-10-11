import { NextRequest, NextResponse } from 'next/server';
import { googleCalendarService } from '@/lib/services/googleCalendar';
import { postgresAccountsDb } from '@/lib/db/postgresAccountsDb';
import { StakingService } from '@/lib/services/stakingService';
import { GmailNotificationService } from '@/lib/services/gmailNotificationService';
import { invitationTokensDb } from '@/lib/db/postgresInvitationTokens';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const walletAddress = searchParams.get('wallet_address');
  
  if (!walletAddress) {
    return NextResponse.json(
      { error: 'Wallet address is required' },
      { status: 400 }
    );
  }
  
  // Check if calendar is connected
  const account = await postgresAccountsDb.getAccountByWallet(walletAddress);
  if (!account) {
    return NextResponse.json(
      { error: 'No calendar connected' },
      { status: 404 }
    );
  }
  
  try {
    // Get date range from query params (optional)
    const timeMin = searchParams.get('timeMin');
    const timeMax = searchParams.get('timeMax');
    const maxResults = searchParams.get('maxResults');
    
    const events = await googleCalendarService.getCalendarEvents(
      walletAddress,
      timeMin ? new Date(timeMin) : undefined,
      timeMax ? new Date(timeMax) : undefined,
      maxResults ? parseInt(maxResults) : undefined
    );
    
    return NextResponse.json({
      events,
      connected: true,
      email: account.google_email
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    
    // If token refresh failed, indicate that reconnection is needed
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json(
        { error: 'Authentication expired. Please reconnect your calendar.' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { wallet_address, event } = await request.json();
    
    if (!wallet_address || !event) {
      return NextResponse.json(
        { error: 'Wallet address and event data are required' },
        { status: 400 }
      );
    }
    
    // Create the calendar event first
    const createdEvent = await googleCalendarService.createCalendarEvent(
      wallet_address,
      event
    );
    
    // If staking is required, create a staked meeting
    if (event.stakeRequired && event.stakeRequired > 0 && createdEvent.id) {
      try {
        // Generate a unique meeting ID based on the calendar event ID
        const meetingId = `meeting-${createdEvent.id}`;
        
        // Parse event times
        const startTime = createdEvent.start?.dateTime ? 
          new Date(createdEvent.start.dateTime) : 
          new Date(createdEvent.start?.date || '');
        const endTime = createdEvent.end?.dateTime ? 
          new Date(createdEvent.end.dateTime) : 
          new Date(createdEvent.end?.date || '');
        
        // Create staked meeting on blockchain
        await StakingService.createStakedMeeting(
          meetingId,
          createdEvent.id,
          wallet_address,
          event.stakeRequired,
          startTime,
          endTime
        );

        // Send stake invitation emails to attendees with unique tokens
        if (createdEvent.attendees && createdEvent.attendees.length > 0) {
          try {
            // Create Gmail service for the organizer
            const gmailService = await GmailNotificationService.createFromWallet(wallet_address);

            if (gmailService) {
              // Get attendee emails (excluding the organizer)
              const attendeeEmails = createdEvent.attendees
                .filter(attendee => !attendee.organizer && attendee.email)
                .map(attendee => attendee.email as string);

              if (attendeeEmails.length > 0) {
                // Generate invitation tokens for all attendees
                const tokenMap = await invitationTokensDb.createInvitationTokens(meetingId, attendeeEmails);
                
                // Send individual stake invitations with unique tokens
                for (const email of attendeeEmails) {
                  const token = tokenMap.get(email);
                  
                  await gmailService.sendStakeInvitation([email], {
                    title: createdEvent.summary || 'Meeting',
                    startTime,
                    endTime,
                    stakeAmount: event.stakeRequired,
                    meetingId,
                    organizerName: createdEvent.organizer?.displayName,
                    location: createdEvent.location || undefined,
                    invitationToken: token // Pass the unique token
                  });
                }

                console.log(`[Events] Sent stake invitations with tokens to ${attendeeEmails.length} attendees`);
              }
            } else {
              console.warn('[Events] Could not create Gmail service - user may need to reconnect');
            }
          } catch (emailError) {
            console.error('[Events] Error sending stake invitations:', emailError);
            // Don't fail the whole request if email sending fails
          }
        }

        // Update event description to include staking info
        const stakingInfo = `\n\n💰 Staking Required: ${event.stakeRequired} ETH\n` +
          `Meeting ID: ${meetingId}\n` +
          `Stake Link: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/stake/${meetingId}\n` +
          `Stake by: ${new Date(startTime.getTime() - 60 * 60 * 1000).toLocaleString()}`;

        const updatedDescription = (createdEvent.description || '') + stakingInfo;

        // Update the event with staking information
        await googleCalendarService.updateCalendarEvent(
          wallet_address,
          createdEvent.id,
          {
            description: updatedDescription
          }
        );
        
        return NextResponse.json({ 
          success: true, 
          event: { ...createdEvent, description: updatedDescription },
          staking: {
            enabled: true,
            meetingId,
            requiredStake: event.stakeRequired,
            stakingDeadline: new Date(startTime.getTime() - 60 * 60 * 1000).toISOString()
          }
        });
      } catch (stakingError) {
        console.error('Error creating staked meeting:', stakingError);
        // Event was created but staking failed - still return success but with warning
        return NextResponse.json({ 
          success: true, 
          event: createdEvent,
          warning: 'Event created but staking setup failed'
        });
      }
    }
    
    return NextResponse.json({ success: true, event: createdEvent });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar event' },
      { status: 500 }
    );
  }
}