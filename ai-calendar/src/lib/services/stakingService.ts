import { meetingStakesDb, type MeetingStakeData as MeetingStakeDataDb, type StakeRecord as StakeRecordDb } from '@/lib/db/postgresMeetingStakes';

export interface MeetingStakeData extends MeetingStakeDataDb {}
export interface StakeRecord extends StakeRecordDb {}

export class StakingService {
  private static CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MEETING_STAKE_CONTRACT || '0x01';

  /**
   * Create a new meeting with staking requirements (database only)
   */
  static async createStakedMeeting(
    meetingId: string,
    eventId: string,
    organizer: string,
    requiredStake: number,
    startTime: Date,
    endTime: Date
  ): Promise<string> {
    try {
      // Store meeting stake data in database
      const stakeData: MeetingStakeData = {
        meetingId,
        eventId,
        organizer,
        requiredStake,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        isSettled: false,
        stakes: [],
      };

      await this.saveMeetingStakeData(stakeData);

      // Note: The actual blockchain transaction will be executed on the client side
      return meetingId;
    } catch (error) {
      console.error('[Staking] Error creating staked meeting:', error);
      throw error;
    }
  }

  /**
   * Record stake for a meeting (database only)
   */
  static async stakeForMeeting(
    meetingId: string,
    amount: number,
    stakerAddress: string
  ): Promise<boolean> {
    try {
      // Update database with stake record
      const stakeData = await this.getMeetingStakeData(meetingId);
      if (stakeData) {
        stakeData.stakes.push({
          walletAddress: stakerAddress,
          amount,
          stakedAt: new Date().toISOString(),
          hasCheckedIn: false,
          isRefunded: false,
        });
        await this.saveMeetingStakeData(stakeData);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Staking] Error recording stake for meeting:', error);
      throw error;
    }
  }

  /**
   * Generate attendance code (for meeting organizer)
   */
  static async generateAttendanceCode(meetingId: string): Promise<string> {
    try {
      // Generate a random 6-character code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Update database with generated code
      const stakeData = await this.getMeetingStakeData(meetingId);
      if (stakeData) {
        stakeData.attendanceCode = code;
        stakeData.codeGeneratedAt = new Date().toISOString();
        await this.saveMeetingStakeData(stakeData);
      }

      return code;
    } catch (error) {
      console.error('[Staking] Error generating attendance code:', error);
      throw error;
    }
  }

  /**
   * Submit attendance code (for meeting attendees)
   */
  static async submitAttendanceCode(
    meetingId: string,
    code: string,
    attendeeAddress: string
  ): Promise<boolean> {
    try {
      // First verify code in database
      const stakeData = await this.getMeetingStakeData(meetingId);
      if (!stakeData || stakeData.attendanceCode !== code) {
        throw new Error('Invalid attendance code');
      }

      // Check if code is still valid (within meeting time + buffer)
      const now = new Date();
      const bufferMinutes = 15;
      const endTime = typeof stakeData.endTime === 'string' ? 
        new Date(stakeData.endTime) : stakeData.endTime;
      const deadline = new Date(endTime.getTime() + bufferMinutes * 60 * 1000);
      if (now > deadline) {
        throw new Error('Attendance code has expired');
      }

      // Update database with check-in
      const stake = stakeData.stakes.find(s => s.walletAddress === attendeeAddress);
      if (stake) {
        stake.hasCheckedIn = true;
        stake.checkInTime = new Date().toISOString();
        await this.saveMeetingStakeData(stakeData);
      }

      return true;
    } catch (error) {
      console.error('[Staking] Error submitting attendance code:', error);
      throw error;
    }
  }

  /**
   * Settle meeting and distribute stakes (database only)
   */
  static async settleMeeting(meetingId: string): Promise<{ refunded: number; forfeited: number }> {
    try {
      // Update database
      const stakeData = await this.getMeetingStakeData(meetingId);
      if (stakeData) {
        stakeData.isSettled = true;
        
        let refunded = 0;
        let forfeited = 0;
        
        stakeData.stakes.forEach(stake => {
          if (stake.hasCheckedIn) {
            stake.isRefunded = true;
            refunded += stake.amount;
          } else {
            forfeited += stake.amount;
          }
        });

        await this.saveMeetingStakeData(stakeData);
        
        return { refunded, forfeited };
      }

      return { refunded: 0, forfeited: 0 };
    } catch (error) {
      console.error('[Staking] Error settling meeting:', error);
      throw error;
    }
  }

  /**
   * Get meeting info from database
   */
  static async getMeetingInfo(meetingId: string): Promise<MeetingStakeData | null> {
    try {
      return await this.getMeetingStakeData(meetingId);
    } catch (error) {
      console.error('[Staking] Error getting meeting info:', error);
      throw error;
    }
  }

  /**
   * Get stake info for a specific address
   */
  static async getStakeInfo(meetingId: string, stakerAddress: string): Promise<StakeRecord | null> {
    try {
      const stakeData = await this.getMeetingStakeData(meetingId);
      if (stakeData) {
        const stake = stakeData.stakes.find(s => s.walletAddress === stakerAddress);
        return stake || null;
      }
      return null;
    } catch (error) {
      console.error('[Staking] Error getting stake info:', error);
      throw error;
    }
  }

  /**
   * Save meeting stake data to database
   */
  private static async saveMeetingStakeData(data: MeetingStakeData): Promise<void> {
    await meetingStakesDb.saveMeetingStakeData(data);
  }

  /**
   * Get meeting stake data from database
   */
  private static async getMeetingStakeData(meetingId: string): Promise<MeetingStakeData | null> {
    return await meetingStakesDb.getMeetingStakeData(meetingId);
  }

  /**
   * Get all meeting stakes for a wallet address
   */
  static async getStakesForWallet(walletAddress: string): Promise<MeetingStakeData[]> {
    return await meetingStakesDb.getStakesForWallet(walletAddress);
  }

  /**
   * Check if a wallet has staked for a meeting
   */
  static async hasStaked(meetingId: string, walletAddress: string): Promise<boolean> {
    const stakeData = await this.getMeetingStakeData(meetingId);
    if (!stakeData) return false;
    return stakeData.stakes.some(s => s.walletAddress === walletAddress);
  }
}