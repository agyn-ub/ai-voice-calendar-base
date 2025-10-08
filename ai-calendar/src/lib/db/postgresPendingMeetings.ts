import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/types';

type PendingMeetingRow = Database['public']['Tables']['pending_meetings']['Row'];
type PendingMeetingInsert = Database['public']['Tables']['pending_meetings']['Insert'];
type PendingMeetingUpdate = Database['public']['Tables']['pending_meetings']['Update'];

export interface PendingMeeting {
  id: string;
  organizer_wallet: string;
  event_data: any;
  stake_amount: number;
  status: 'pending' | 'stake_confirmed' | 'scheduled' | 'cancelled';
  google_event_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

class PendingMeetingsDatabase {
  /**
   * Create a new pending meeting
   */
  public async createPendingMeeting(meeting: PendingMeetingInsert): Promise<PendingMeeting | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('pending_meetings')
        .insert(meeting)
        .select()
        .single();

      if (error) {
        console.error('[PendingMeetings] Error creating pending meeting:', error);
        throw error;
      }

      // Parse event_data if it's a string
      if (data && typeof data.event_data === 'string') {
        data.event_data = JSON.parse(data.event_data);
      }

      return data as PendingMeeting;
    } catch (error) {
      console.error('[PendingMeetings] Failed to create pending meeting:', error);
      return null;
    }
  }

  /**
   * Get a pending meeting by ID
   */
  public async getPendingMeeting(meetingId: string): Promise<PendingMeeting | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('pending_meetings')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        console.error('[PendingMeetings] Error fetching pending meeting:', error);
        throw error;
      }

      // Parse event_data if it's a string
      if (data && typeof data.event_data === 'string') {
        data.event_data = JSON.parse(data.event_data);
      }

      return data as PendingMeeting;
    } catch (error) {
      console.error('[PendingMeetings] Failed to get pending meeting:', error);
      return null;
    }
  }

  /**
   * Get pending meetings by organizer wallet
   */
  public async getPendingMeetingsByOrganizer(organizerWallet: string): Promise<PendingMeeting[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('pending_meetings')
        .select('*')
        .eq('organizer_wallet', organizerWallet)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[PendingMeetings] Error fetching meetings by organizer:', error);
        throw error;
      }

      // Parse event_data for each meeting
      return (data || []).map(meeting => {
        if (typeof meeting.event_data === 'string') {
          meeting.event_data = JSON.parse(meeting.event_data);
        }
        return meeting as PendingMeeting;
      });
    } catch (error) {
      console.error('[PendingMeetings] Failed to get meetings by organizer:', error);
      return [];
    }
  }

  /**
   * Update pending meeting status
   */
  public async updatePendingMeetingStatus(
    meetingId: string, 
    status: 'pending' | 'stake_confirmed' | 'scheduled' | 'cancelled',
    googleEventId?: string
  ): Promise<boolean> {
    try {
      const updateData: PendingMeetingUpdate = { status };
      
      if (googleEventId) {
        updateData.google_event_id = googleEventId;
      }

      const { error } = await supabaseAdmin
        .from('pending_meetings')
        .update(updateData)
        .eq('id', meetingId);

      if (error) {
        console.error('[PendingMeetings] Error updating meeting status:', error);
        throw error;
      }

      console.log(`[PendingMeetings] Updated meeting ${meetingId} status to ${status}`);
      return true;
    } catch (error) {
      console.error('[PendingMeetings] Failed to update meeting status:', error);
      return false;
    }
  }

  /**
   * Update pending meeting
   */
  public async updatePendingMeeting(meetingId: string, updates: PendingMeetingUpdate): Promise<boolean> {
    try {
      // If event_data is an object, stringify it
      if (updates.event_data && typeof updates.event_data === 'object') {
        updates.event_data = JSON.stringify(updates.event_data);
      }

      const { error } = await supabaseAdmin
        .from('pending_meetings')
        .update(updates)
        .eq('id', meetingId);

      if (error) {
        console.error('[PendingMeetings] Error updating meeting:', error);
        throw error;
      }

      console.log(`[PendingMeetings] Updated meeting ${meetingId}`);
      return true;
    } catch (error) {
      console.error('[PendingMeetings] Failed to update meeting:', error);
      return false;
    }
  }

  /**
   * Delete a pending meeting
   */
  public async deletePendingMeeting(meetingId: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('pending_meetings')
        .delete()
        .eq('id', meetingId);

      if (error) {
        console.error('[PendingMeetings] Error deleting meeting:', error);
        throw error;
      }

      console.log(`[PendingMeetings] Deleted meeting ${meetingId}`);
      return true;
    } catch (error) {
      console.error('[PendingMeetings] Failed to delete meeting:', error);
      return false;
    }
  }

  /**
   * Get all pending meetings (for admin/debugging)
   */
  public async getAllPendingMeetings(limit: number = 100): Promise<PendingMeeting[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('pending_meetings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[PendingMeetings] Error fetching all meetings:', error);
        throw error;
      }

      // Parse event_data for each meeting
      return (data || []).map(meeting => {
        if (typeof meeting.event_data === 'string') {
          meeting.event_data = JSON.parse(meeting.event_data);
        }
        return meeting as PendingMeeting;
      });
    } catch (error) {
      console.error('[PendingMeetings] Failed to get all meetings:', error);
      return [];
    }
  }
}

// Export singleton instance
export const postgresPendingMeetingsDb = new PendingMeetingsDatabase();
export default postgresPendingMeetingsDb;