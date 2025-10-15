import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, CURRENT_NETWORK, NETWORK_CONFIG } from './config';
import { MEETING_STAKE_ABI } from '../contracts/MeetingStakeABI';

export class MeetingStakeContract {
  private contract: ethers.Contract | null = null;
  private provider: ethers.BrowserProvider | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.ethereum) {
      this.provider = new ethers.BrowserProvider(window.ethereum);
      const contractAddress = CONTRACT_ADDRESSES[CURRENT_NETWORK].meetingStake;
      this.contract = new ethers.Contract(contractAddress, MEETING_STAKE_ABI, this.provider);
    }
  }

  async getSigner() {
    if (!this.provider) throw new Error('No provider available');
    return await this.provider.getSigner();
  }

  async createMeeting(
    meetingId: string,
    eventId: string,
    requiredStake: string,
    startTime: number,
    endTime: number
  ) {
    console.log('[MeetingStakeContract] createMeeting called with:', {
      meetingId,
      eventId,
      requiredStake,
      startTime: new Date(startTime * 1000).toISOString(),
      endTime: new Date(endTime * 1000).toISOString()
    });

    if (!this.contract) throw new Error('Contract not initialized');
    
    console.log('[MeetingStakeContract] Getting signer...');
    const signer = await this.getSigner();
    const signerAddress = await signer.getAddress();
    console.log('[MeetingStakeContract] Signer address:', signerAddress);
    
    const contractWithSigner = this.contract.connect(signer);
    
    console.log('[MeetingStakeContract] Sending transaction...');
    try {
      const tx = await contractWithSigner.createMeeting(
        meetingId,
        eventId,
        ethers.parseEther(requiredStake),
        startTime,
        endTime
      );
      
      console.log('[MeetingStakeContract] Transaction sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('[MeetingStakeContract] Transaction confirmed:', receipt);
      
      return receipt;
    } catch (error) {
      console.error('[MeetingStakeContract] Transaction failed:', error);
      throw error;
    }
  }

  async stakeForMeeting(meetingId: string, stakeAmount: string) {
    if (!this.contract) throw new Error('Contract not initialized');
    const signer = await this.getSigner();
    const contractWithSigner = this.contract.connect(signer);
    
    const tx = await contractWithSigner.stake(meetingId, {
      value: ethers.parseEther(stakeAmount),
    });
    
    return await tx.wait();
  }

  async generateAttendanceCode(meetingId: string, code: string) {
    if (!this.contract) throw new Error('Contract not initialized');
    const signer = await this.getSigner();
    const contractWithSigner = this.contract.connect(signer);
    
    const tx = await contractWithSigner.generateAttendanceCode(meetingId, code);
    return await tx.wait();
  }

  async submitAttendanceCode(meetingId: string, code: string) {
    if (!this.contract) throw new Error('Contract not initialized');
    const signer = await this.getSigner();
    const contractWithSigner = this.contract.connect(signer);
    
    const tx = await contractWithSigner.submitAttendanceCode(meetingId, code);
    return await tx.wait();
  }

  async settleMeeting(meetingId: string) {
    if (!this.contract) throw new Error('Contract not initialized');
    const signer = await this.getSigner();
    const contractWithSigner = this.contract.connect(signer);
    
    const tx = await contractWithSigner.settleMeeting(meetingId);
    return await tx.wait();
  }

  async getMeetingInfo(meetingId: string) {
    if (!this.contract) throw new Error('Contract not initialized');
    console.log('[MeetingStakeContract] Fetching meeting info for:', meetingId);
    
    try {
      const info = await this.contract.getMeetingInfo(meetingId);
      console.log('[MeetingStakeContract] Meeting info retrieved:', {
        meetingId: info.meetingId,
        eventId: info.eventId,
        organizer: info.organizer,
        requiredStake: ethers.formatEther(info.requiredStake) + ' ETH',
        startTime: new Date(Number(info.startTime) * 1000).toISOString(),
        endTime: new Date(Number(info.endTime) * 1000).toISOString(),
        isSettled: info.isSettled,
        totalStaked: ethers.formatEther(info.totalStaked) + ' ETH',
        hasAttendanceCode: info.attendanceCode !== ''
      });
      return info;
    } catch (error) {
      console.error('[MeetingStakeContract] Error fetching meeting info:', error);
      throw error;
    }
  }

  async getStakeInfo(meetingId: string, stakerAddress: string) {
    if (!this.contract) throw new Error('Contract not initialized');
    return await this.contract.getStakeInfo(meetingId, stakerAddress);
  }

  async hasStaked(meetingId: string, stakerAddress: string): Promise<boolean> {
    if (!this.contract) throw new Error('Contract not initialized');
    const result = await this.contract.hasStaked(meetingId, stakerAddress);
    console.log('[MeetingStakeContract] Has staked check:', { meetingId, stakerAddress, hasStaked: result });
    return result;
  }

  async getMeetingStakers(meetingId: string): Promise<string[]> {
    if (!this.contract) throw new Error('Contract not initialized');
    return await this.contract.getMeetingStakers(meetingId);
  }

  async verifyMeetingOnChain(meetingId: string): Promise<{
    exists: boolean;
    details?: any;
    error?: string;
  }> {
    try {
      console.log('[MeetingStakeContract] Verifying meeting on-chain:', meetingId);
      
      if (!this.contract) {
        return { exists: false, error: 'Contract not initialized' };
      }

      const info = await this.getMeetingInfo(meetingId);
      
      // Check if meeting actually exists (organizer address should not be zero)
      const exists = info.organizer !== '0x0000000000000000000000000000000000000000';
      
      if (exists) {
        console.log('[MeetingStakeContract] ✅ Meeting verified on blockchain');
        return {
          exists: true,
          details: {
            meetingId: info.meetingId,
            eventId: info.eventId,
            organizer: info.organizer,
            requiredStake: ethers.formatEther(info.requiredStake),
            startTime: new Date(Number(info.startTime) * 1000).toISOString(),
            endTime: new Date(Number(info.endTime) * 1000).toISOString(),
            totalStaked: ethers.formatEther(info.totalStaked),
            isSettled: info.isSettled,
            network: CURRENT_NETWORK,
            contractAddress: CONTRACT_ADDRESSES[CURRENT_NETWORK].meetingStake
          }
        };
      } else {
        console.log('[MeetingStakeContract] ❌ Meeting not found on blockchain');
        return {
          exists: false,
          error: 'Meeting not found on blockchain'
        };
      }
    } catch (error) {
      console.error('[MeetingStakeContract] Error verifying meeting:', error);
      return {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  getExplorerUrl(txHash: string): string {
    return `${NETWORK_CONFIG[CURRENT_NETWORK].explorerUrl}/tx/${txHash}`;
  }

  async waitForTransaction(txHash: string, confirmations: number = 1) {
    if (!this.provider) throw new Error('No provider available');
    console.log(`[MeetingStakeContract] Waiting for transaction ${txHash} with ${confirmations} confirmations...`);
    const receipt = await this.provider.waitForTransaction(txHash, confirmations);
    console.log('[MeetingStakeContract] Transaction confirmed:', receipt);
    return receipt;
  }
}