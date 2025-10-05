import { Contract, parseEther, formatEther, BrowserProvider } from 'ethers';
import MeetingStakeABI from '../contracts/MeetingStake.json';
import { WalletService } from './wallet';

// This will be set from environment variable after deployment
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MEETING_STAKE_ADDRESS || '';

export interface Meeting {
  meetingId: string;
  eventId: string;
  organizer: string;
  requiredStake: bigint;
  startTime: bigint;
  endTime: bigint;
  checkInDeadline: bigint;
  attendanceCode: string;
  codeValidUntil: bigint;
  isSettled: boolean;
  totalStaked: bigint;
  totalRefunded: bigint;
  totalForfeited: bigint;
}

export interface Stake {
  staker: string;
  amount: bigint;
  stakedAt: bigint;
  hasCheckedIn: boolean;
  checkInTime: bigint;
  isRefunded: boolean;
}

export class MeetingStakeContract {
  private static contract: Contract | null = null;

  /**
   * Get contract instance
   */
  static async getContract(signer?: boolean): Promise<Contract> {
    if (!CONTRACT_ADDRESS) {
      throw new Error('Contract address not configured');
    }

    const provider = WalletService.getProvider();
    
    if (signer) {
      const signer = await provider.getSigner();
      return new Contract(CONTRACT_ADDRESS, MeetingStakeABI, signer);
    }
    
    return new Contract(CONTRACT_ADDRESS, MeetingStakeABI, provider);
  }

  /**
   * Create a new meeting with staking requirement
   */
  static async createMeeting(
    meetingId: string,
    eventId: string,
    requiredStake: string, // in FLOW
    startTime: Date,
    endTime: Date
  ): Promise<string> {
    try {
      const contract = await this.getContract(true);
      
      const tx = await contract.createMeeting(
        meetingId,
        eventId,
        parseEther(requiredStake),
        Math.floor(startTime.getTime() / 1000),
        Math.floor(endTime.getTime() / 1000)
      );
      
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error('Error creating meeting:', error);
      throw error;
    }
  }

  /**
   * Stake FLOW for a meeting
   */
  static async stakeForMeeting(
    meetingId: string,
    stakeAmount: string // in FLOW
  ): Promise<string> {
    try {
      const contract = await this.getContract(true);
      
      const tx = await contract.stake(meetingId, {
        value: parseEther(stakeAmount)
      });
      
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error('Error staking for meeting:', error);
      throw error;
    }
  }

  /**
   * Generate attendance code (for organizers)
   */
  static async generateAttendanceCode(
    meetingId: string,
    code: string
  ): Promise<string> {
    try {
      const contract = await this.getContract(true);
      
      const tx = await contract.generateAttendanceCode(meetingId, code);
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error('Error generating attendance code:', error);
      throw error;
    }
  }

  /**
   * Submit attendance code (for attendees)
   */
  static async submitAttendanceCode(
    meetingId: string,
    code: string
  ): Promise<string> {
    try {
      const contract = await this.getContract(true);
      
      const tx = await contract.submitAttendanceCode(meetingId, code);
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error('Error submitting attendance code:', error);
      throw error;
    }
  }

  /**
   * Settle meeting and distribute stakes
   */
  static async settleMeeting(meetingId: string): Promise<string> {
    try {
      const contract = await this.getContract(true);
      
      const tx = await contract.settleMeeting(meetingId);
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error('Error settling meeting:', error);
      throw error;
    }
  }

  /**
   * Get meeting info
   */
  static async getMeetingInfo(meetingId: string): Promise<Meeting | null> {
    try {
      const contract = await this.getContract(false);
      const info = await contract.getMeetingInfo(meetingId);
      
      // Check if meeting exists
      if (info.startTime === 0n) {
        return null;
      }
      
      return {
        meetingId: info.meetingId,
        eventId: info.eventId,
        organizer: info.organizer,
        requiredStake: info.requiredStake,
        startTime: info.startTime,
        endTime: info.endTime,
        checkInDeadline: info.checkInDeadline,
        attendanceCode: info.attendanceCode,
        codeValidUntil: info.codeValidUntil,
        isSettled: info.isSettled,
        totalStaked: info.totalStaked,
        totalRefunded: info.totalRefunded,
        totalForfeited: info.totalForfeited,
      };
    } catch (error) {
      console.error('Error getting meeting info:', error);
      return null;
    }
  }

  /**
   * Get stake info for a specific address
   */
  static async getStakeInfo(
    meetingId: string,
    address: string
  ): Promise<Stake | null> {
    try {
      const contract = await this.getContract(false);
      const info = await contract.getStakeInfo(meetingId, address);
      
      // Check if stake exists
      if (info.amount === 0n) {
        return null;
      }
      
      return {
        staker: info.staker,
        amount: info.amount,
        stakedAt: info.stakedAt,
        hasCheckedIn: info.hasCheckedIn,
        checkInTime: info.checkInTime,
        isRefunded: info.isRefunded,
      };
    } catch (error) {
      console.error('Error getting stake info:', error);
      return null;
    }
  }

  /**
   * Check if address has staked for meeting
   */
  static async hasStaked(
    meetingId: string,
    address: string
  ): Promise<boolean> {
    try {
      const contract = await this.getContract(false);
      return await contract.hasStaked(meetingId, address);
    } catch (error) {
      console.error('Error checking stake status:', error);
      return false;
    }
  }

  /**
   * Get all stakers for a meeting
   */
  static async getMeetingStakers(meetingId: string): Promise<string[]> {
    try {
      const contract = await this.getContract(false);
      return await contract.getMeetingStakers(meetingId);
    } catch (error) {
      console.error('Error getting meeting stakers:', error);
      return [];
    }
  }

  /**
   * Format stake amount for display
   */
  static formatStakeAmount(amount: bigint): string {
    return formatEther(amount);
  }

  /**
   * Parse stake amount from user input
   */
  static parseStakeAmount(amount: string): bigint {
    return parseEther(amount);
  }
}