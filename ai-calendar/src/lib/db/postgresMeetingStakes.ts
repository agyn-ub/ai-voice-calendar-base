import { supabaseAdmin } from '@/lib/supabase/admin';

export interface MeetingStakeData {
  meetingId: string;
  eventId: string;
  organizer: string;
  requiredStake: number;
  startTime: string;
  endTime: string;
  attendanceCode?: string;
  codeGeneratedAt?: string;
  isSettled: boolean;
  stakes: StakeRecord[];
}

export interface StakeRecord {
  walletAddress: string;
  email?: string;
  amount: number;
  stakedAt: string;
  hasCheckedIn: boolean;
  checkInTime?: string;
  isRefunded: boolean;
}

class MeetingStakesDatabase {
  private tableName = 'meeting_stakes';

  /**
   * Save meeting stake data
   */
  public async saveMeetingStakeData(data: MeetingStakeData): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from(this.tableName)
        .upsert({
          meeting_id: data.meetingId,
          event_id: data.eventId,
          organizer: data.organizer,
          required_stake: data.requiredStake,
          start_time: data.startTime,
          end_time: data.endTime,
          attendance_code: data.attendanceCode,
          code_generated_at: data.codeGeneratedAt,
          is_settled: data.isSettled,
          stakes: JSON.stringify(data.stakes)
        });

      if (error) {
        console.error('[MeetingStakes] Error saving meeting stake data:', error);
        throw error;
      }
    } catch (error) {
      console.error('[MeetingStakes] Failed to save meeting stake data:', error);
      throw error;
    }
  }

  /**
   * Get meeting stake data
   */
  public async getMeetingStakeData(meetingId: string): Promise<MeetingStakeData | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from(this.tableName)
        .select('*')
        .eq('meeting_id', meetingId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('[MeetingStakes] Error fetching meeting stake data:', error);
        throw error;
      }

      if (!data) return null;

      return {
        meetingId: data.meeting_id,
        eventId: data.event_id,
        organizer: data.organizer,
        requiredStake: data.required_stake,
        startTime: data.start_time,
        endTime: data.end_time,
        attendanceCode: data.attendance_code,
        codeGeneratedAt: data.code_generated_at,
        isSettled: data.is_settled,
        stakes: typeof data.stakes === 'string' ? JSON.parse(data.stakes) : data.stakes
      };
    } catch (error) {
      console.error('[MeetingStakes] Failed to get meeting stake data:', error);
      return null;
    }
  }

  /**
   * Get all meeting stakes for a wallet
   */
  public async getStakesForWallet(walletAddress: string): Promise<MeetingStakeData[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from(this.tableName)
        .select('*')
        .or(`organizer.eq.${walletAddress},stakes.cs.${walletAddress}`);

      if (error) {
        console.error('[MeetingStakes] Error fetching stakes for wallet:', error);
        throw error;
      }

      return (data || []).map(row => ({
        meetingId: row.meeting_id,
        eventId: row.event_id,
        organizer: row.organizer,
        requiredStake: row.required_stake,
        startTime: row.start_time,
        endTime: row.end_time,
        attendanceCode: row.attendance_code,
        codeGeneratedAt: row.code_generated_at,
        isSettled: row.is_settled,
        stakes: typeof row.stakes === 'string' ? JSON.parse(row.stakes) : row.stakes
      }));
    } catch (error) {
      console.error('[MeetingStakes] Failed to get stakes for wallet:', error);
      return [];
    }
  }
}

// Export singleton instance
export const meetingStakesDb = new MeetingStakesDatabase();
export default meetingStakesDb;