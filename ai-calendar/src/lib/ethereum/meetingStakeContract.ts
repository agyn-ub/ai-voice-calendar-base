import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, CURRENT_NETWORK, NETWORK_CONFIG } from './config';

// ABI for MeetingStake contract - simplified version
const MEETING_STAKE_ABI = [
  'function createMeeting(string meetingId, string eventId, uint256 requiredStake, uint256 startTime, uint256 endTime) external',
  'function stake(string meetingId) external payable',
  'function generateAttendanceCode(string meetingId, string code) external',
  'function submitAttendanceCode(string meetingId, string code) external',
  'function settleMeeting(string meetingId) external',
  'function getMeetingInfo(string meetingId) external view returns (tuple(string meetingId, string eventId, address organizer, uint256 requiredStake, uint256 startTime, uint256 endTime, uint256 checkInDeadline, string attendanceCode, uint256 codeValidUntil, bool isSettled, uint256 totalStaked, uint256 totalRefunded, uint256 totalForfeited))',
  'function getStakeInfo(string meetingId, address staker) external view returns (tuple(address staker, uint256 amount, uint256 stakedAt, bool hasCheckedIn, uint256 checkInTime, bool isRefunded))',
  'function hasStaked(string meetingId, address staker) external view returns (bool)',
  'function getMeetingStakers(string meetingId) external view returns (address[])',
  'event MeetingCreated(string indexed meetingId, address indexed organizer, uint256 requiredStake, uint256 startTime, uint256 endTime)',
  'event StakeDeposited(string indexed meetingId, address indexed staker, uint256 amount)',
  'event AttendanceCodeGenerated(string indexed meetingId, string code, uint256 validUntil)',
  'event AttendanceConfirmed(string indexed meetingId, address indexed attendee, string code)',
  'event StakeRefunded(string indexed meetingId, address indexed attendee, uint256 amount)',
  'event StakeForfeited(string indexed meetingId, address indexed absentee, uint256 amount)',
  'event MeetingSettled(string indexed meetingId, uint256 totalRefunded, uint256 totalForfeited)',
];

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
    if (!this.contract) throw new Error('Contract not initialized');
    const signer = await this.getSigner();
    const contractWithSigner = this.contract.connect(signer);
    
    const tx = await contractWithSigner.createMeeting(
      meetingId,
      eventId,
      ethers.parseEther(requiredStake),
      startTime,
      endTime
    );
    
    return await tx.wait();
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
    return await this.contract.getMeetingInfo(meetingId);
  }

  async getStakeInfo(meetingId: string, stakerAddress: string) {
    if (!this.contract) throw new Error('Contract not initialized');
    return await this.contract.getStakeInfo(meetingId, stakerAddress);
  }

  async hasStaked(meetingId: string, stakerAddress: string): Promise<boolean> {
    if (!this.contract) throw new Error('Contract not initialized');
    return await this.contract.hasStaked(meetingId, stakerAddress);
  }

  async getMeetingStakers(meetingId: string): Promise<string[]> {
    if (!this.contract) throw new Error('Contract not initialized');
    return await this.contract.getMeetingStakers(meetingId);
  }

  getExplorerUrl(txHash: string): string {
    return `${NETWORK_CONFIG[CURRENT_NETWORK].explorerUrl}/tx/${txHash}`;
  }
}