import { parseEther, formatEther } from 'viem';
import { useContractWrite, useContractRead, useWaitForTransaction } from 'wagmi';
import MeetingStakeABI from '../contracts/MeetingStake.json';
import { CONTRACT_ADDRESSES, CURRENT_NETWORK } from '../ethereum/config';

const CONTRACT_ADDRESS = CONTRACT_ADDRESSES[CURRENT_NETWORK].meetingStake;

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

// Contract configuration for wagmi hooks
export const contractConfig = {
  address: CONTRACT_ADDRESS as `0x${string}`,
  abi: MeetingStakeABI,
};

export class MeetingStakeContract {
  /**
   * Helper to get contract config
   */
  static getContractConfig() {
    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      throw new Error('Contract address not configured');
    }
    return contractConfig;
  }

  /**
   * Parse meeting data for contract
   */
  static parseMeetingData(
    meetingId: string,
    eventId: string,
    requiredStake: string, // in ETH
    startTime: Date,
    endTime: Date
  ) {
    return {
      meetingId,
      eventId,
      requiredStake: parseEther(requiredStake),
      startTime: BigInt(Math.floor(startTime.getTime() / 1000)),
      endTime: BigInt(Math.floor(endTime.getTime() / 1000)),
    };
  }

  /**
   * Parse stake amount for contract
   */
  static parseStakeAmount(stakeAmount: string) {
    return parseEther(stakeAmount);
  }

  /**
   * Format meeting info from contract
   */
  static formatMeetingInfo(info: any): Meeting | null {
    if (!info || info.startTime === 0n) {
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
  }

  /**
   * Format stake info from contract
   */
  static formatStakeInfo(info: any): Stake | null {
    if (!info || info.amount === 0n) {
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