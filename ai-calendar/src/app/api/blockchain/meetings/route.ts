import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    console.log('[BlockchainMeetings] Fetching all meetings from database');
    
    // Fetch from pending_meetings table
    const { data: pendingMeetings, error: pendingError } = await supabaseAdmin
      .from('pending_meetings')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (pendingError) {
      console.error('[BlockchainMeetings] Error fetching pending meetings:', pendingError);
      throw pendingError;
    }

    // Fetch from meeting_stakes table
    const { data: meetingStakes, error: stakesError } = await supabaseAdmin
      .from('meeting_stakes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (stakesError) {
      console.error('[BlockchainMeetings] Error fetching meeting stakes:', stakesError);
      throw stakesError;
    }

    // Combine and deduplicate meeting IDs
    const meetingIds = new Set<string>();
    const meetingDetails = new Map<string, any>();
    
    // Add pending meetings
    pendingMeetings?.forEach(meeting => {
      meetingIds.add(meeting.id);
      meetingDetails.set(meeting.id, {
        id: meeting.id,
        organizer: meeting.organizer_wallet,
        stakeAmount: meeting.stake_amount,
        status: meeting.status,
        createdAt: meeting.created_at,
        source: 'pending_meetings',
        eventData: typeof meeting.event_data === 'string' 
          ? JSON.parse(meeting.event_data) 
          : meeting.event_data
      });
    });
    
    // Add meeting stakes (may have additional info)
    meetingStakes?.forEach(stake => {
      const meetingId = stake.meeting_id;
      if (!meetingIds.has(meetingId)) {
        meetingIds.add(meetingId);
        meetingDetails.set(meetingId, {
          id: meetingId,
          organizer: stake.organizer,
          requiredStake: stake.required_stake,
          startTime: stake.start_time,
          endTime: stake.end_time,
          createdAt: stake.created_at,
          source: 'meeting_stakes'
        });
      } else {
        // Merge additional data if meeting already exists
        const existing = meetingDetails.get(meetingId);
        meetingDetails.set(meetingId, {
          ...existing,
          requiredStake: stake.required_stake || existing.stakeAmount,
          startTime: stake.start_time || existing.startTime,
          endTime: stake.end_time || existing.endTime,
          hasStake: true
        });
      }
    });

    // Convert to array and sort by creation date
    const meetings = Array.from(meetingDetails.values())
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA; // Newest first
      });

    console.log(`[BlockchainMeetings] Found ${meetings.length} total meetings`);

    return NextResponse.json({
      success: true,
      meetings,
      count: meetings.length,
      pendingCount: pendingMeetings?.length || 0,
      stakesCount: meetingStakes?.length || 0
    });
    
  } catch (error) {
    console.error('[BlockchainMeetings] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch meetings',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}