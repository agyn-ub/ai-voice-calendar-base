import { supabaseAdmin } from '@/lib/supabase/admin';

export interface PendingEventData {
  summary: string;
  description?: string;
  location?: string;
  startDateTime: string;
  endDateTime: string;
  attendees?: string[];
  timezone?: string;
  colorId?: string;
}

export interface PendingMeeting {
  id: string;
  organizer_wallet: string;
  event_data: string | PendingEventData;
  stake_amount: number;
  status: 'pending' | 'stake_confirmed' | 'scheduled' | 'cancelled';
  google_event_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

class SupabasePendingMeetingsDatabase {
  /**
   * Create a new pending meeting
   */
  public async createPendingMeeting(
    meetingId: string,
    organizerWallet: string,
    eventData: PendingEventData,
    stakeAmount: number
  ): Promise<PendingMeeting> {
    const { data, error } = await supabaseAdmin
      .from('pending_meetings')
      .insert({
        id: meetingId,
        organizer_wallet: organizerWallet,
        event_data: eventData, // Supabase automatically handles JSONB conversion
        stake_amount: stakeAmount,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('[PendingMeetings] Error creating pending meeting:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get a pending meeting by ID
   */
  public async getPendingMeeting(meetingId: string): Promise<PendingMeeting | null> {
    const { data, error } = await supabaseAdmin
      .from('pending_meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (error || !data) return null;
    return data;
  }

  /**
   * Get all pending meetings for an organizer
   */
  public async getPendingMeetingsByOrganizer(
    organizerWallet: string
  ): Promise<PendingMeeting[]> {
    const { data, error } = await supabaseAdmin
      .from('pending_meetings')
      .select('*')
      .eq('organizer_wallet', organizerWallet)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data;
  }

  /**
   * Update meeting status
   */
  public async updateMeetingStatus(
    meetingId: string,
    status: 'pending' | 'stake_confirmed' | 'scheduled' | 'cancelled',
    googleEventId?: string
  ): Promise<boolean> {
    const updateData: any = { status };
    if (googleEventId !== undefined) {
      updateData.google_event_id = googleEventId;
    }

    const { error } = await supabaseAdmin
      .from('pending_meetings')
      .update(updateData)
      .eq('id', meetingId);

    if (error) {
      console.error('[PendingMeetings] Error updating status:', error);
      return false;
    }

    return true;
  }

  /**
   * Mark a meeting as scheduled with Google Calendar event ID
   */
  public async markAsScheduled(
    meetingId: string,
    googleEventId: string
  ): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('pending_meetings')
      .update({
        status: 'scheduled',
        google_event_id: googleEventId
      })
      .eq('id', meetingId);

    if (error) {
      console.error('[PendingMeetings] Error marking as scheduled:', error);
      return false;
    }

    return true;
  }

  /**
   * Cancel a pending meeting
   */
  public async cancelMeeting(meetingId: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('pending_meetings')
      .update({ status: 'cancelled' })
      .eq('id', meetingId);

    if (error) {
      console.error('[PendingMeetings] Error cancelling meeting:', error);
      return false;
    }

    return true;
  }

  /**
   * Delete a pending meeting
   */
  public async deletePendingMeeting(meetingId: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('pending_meetings')
      .delete()
      .eq('id', meetingId);

    if (error) {
      console.error('[PendingMeetings] Error deleting meeting:', error);
      return false;
    }

    return true;
  }

  /**
   * Get meetings by status
   */
  public async getMeetingsByStatus(
    status: 'pending' | 'stake_confirmed' | 'scheduled' | 'cancelled'
  ): Promise<PendingMeeting[]> {
    const { data, error } = await supabaseAdmin
      .from('pending_meetings')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data;
  }

  /**
   * Clean up old cancelled or scheduled meetings (older than 30 days)
   */
  public async cleanupOldMeetings(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabaseAdmin
      .from('pending_meetings')
      .delete()
      .in('status', ['scheduled', 'cancelled'])
      .lt('updated_at', thirtyDaysAgo.toISOString())
      .select();

    if (error) {
      console.error('[PendingMeetings] Error cleaning up old meetings:', error);
      return 0;
    }

    return data?.length || 0;
  }

  /**
   * Get meeting statistics
   */
  public async getMeetingStats(organizerWallet?: string): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    scheduled: number;
    cancelled: number;
  }> {
    let query = supabaseAdmin
      .from('pending_meetings')
      .select('status', { count: 'exact' });

    if (organizerWallet) {
      query = query.eq('organizer_wallet', organizerWallet);
    }

    const { data, error } = await query;

    if (error || !data) {
      return { total: 0, pending: 0, confirmed: 0, scheduled: 0, cancelled: 0 };
    }

    const stats = {
      total: data.length,
      pending: 0,
      confirmed: 0,
      scheduled: 0,
      cancelled: 0,
    };

    data.forEach((meeting: any) => {
      switch (meeting.status) {
        case 'pending':
          stats.pending++;
          break;
        case 'stake_confirmed':
          stats.confirmed++;
          break;
        case 'scheduled':
          stats.scheduled++;
          break;
        case 'cancelled':
          stats.cancelled++;
          break;
      }
    });

    return stats;
  }
}

// Export singleton instance
export const pendingMeetingsDb = new SupabasePendingMeetingsDatabase();
export default pendingMeetingsDb;