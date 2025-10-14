'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { formatEther } from 'viem';
import toast, { Toaster } from 'react-hot-toast';

// Contract configuration
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const RPC_URL = process.env.NEXT_PUBLIC_NETWORK === 'local' ? 'http://127.0.0.1:8545' : '';

const MEETING_STAKE_ABI = [
  'function getMeetingInfo(string meetingId) view returns (tuple(string meetingId, string eventId, address organizer, uint256 requiredStake, uint256 startTime, uint256 endTime, uint256 checkInDeadline, string attendanceCode, uint256 codeValidUntil, bool isSettled, uint256 totalStaked, uint256 totalRefunded, uint256 totalForfeited))',
  'function getMeetingStakers(string meetingId) view returns (address[])',
  'function getStakeInfo(string meetingId, address staker) view returns (tuple(address staker, uint256 amount, uint256 stakedAt, bool hasCheckedIn, uint256 checkInTime, bool isRefunded))',
  'function hasStaked(string meetingId, address staker) view returns (bool)',
  'event MeetingCreated(string indexed meetingId, address indexed organizer, uint256 requiredStake, uint256 startTime, uint256 endTime)',
  'event StakeDeposited(string indexed meetingId, address indexed staker, uint256 amount)',
  'event AttendanceCodeGenerated(string indexed meetingId, string code, uint256 validUntil)',
  'event AttendanceConfirmed(string indexed meetingId, address indexed attendee, string code)',
  'event StakeRefunded(string indexed meetingId, address indexed attendee, uint256 amount)',
  'event MeetingSettled(string indexed meetingId, uint256 totalRefunded, uint256 totalForfeited)'
];

interface StakeInfo {
  staker: string;
  amount: string;
  stakedAt: Date;
  hasCheckedIn: boolean;
  checkInTime: Date | null;
  isRefunded: boolean;
}

interface Meeting {
  meetingId: string;
  eventId: string;
  organizer: string;
  requiredStake: string;
  startTime: Date;
  endTime: Date;
  checkInDeadline: Date;
  hasAttendanceCode: boolean;
  isSettled: boolean;
  totalStaked: string;
  totalRefunded: string;
  totalForfeited: string;
  stakers: string[];
  stakerDetails?: StakeInfo[];
  status: 'upcoming' | 'in_progress' | 'check_in' | 'pending_settlement' | 'settled';
  blockNumber?: number;
  transactionHash?: string;
  dbStatus?: string;
  source?: string;
}

interface BlockchainEvent {
  type: string;
  meetingId: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: Date;
  details: any;
}

export default function BlockchainExplorerPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [events, setEvents] = useState<BlockchainEvent[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [blockNumber, setBlockNumber] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [provider, setProvider] = useState<ethers.JsonRpcProvider | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [searchMeetingId, setSearchMeetingId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedMeetings, setExpandedMeetings] = useState<Set<string>>(new Set());

  // Check for meeting ID in URL params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const meetingParam = urlParams.get('meeting');
      if (meetingParam) {
        setSearchMeetingId(meetingParam);
        // Auto-search after contract is initialized
        setTimeout(() => {
          if (contract) {
            searchMeeting();
          }
        }, 1000);
      }
    }
  }, []);

  // Initialize provider and contract
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_NETWORK === 'local' && RPC_URL) {
      const prov = new ethers.JsonRpcProvider(RPC_URL);
      const contr = new ethers.Contract(CONTRACT_ADDRESS, MEETING_STAKE_ABI, prov);
      setProvider(prov);
      setContract(contr);
    }
  }, []);

  // Fetch all meetings from database and verify on blockchain
  const fetchMeetings = useCallback(async () => {
    if (!contract || !provider) return;
    
    try {
      const currentBlock = await provider.getBlockNumber();
      setBlockNumber(currentBlock);
      
      // Fetch meeting IDs from database
      const response = await fetch('/api/blockchain/meetings');
      const dbData = await response.json();
      
      if (!dbData.success || !dbData.meetings) {
        console.error('Failed to fetch meetings from database');
        return;
      }
      
      console.log(`Fetched ${dbData.meetings.length} meetings from database`);
      
      // For each meeting ID, verify on blockchain
      const meetingPromises = dbData.meetings.map(async (dbMeeting: any) => {
        const meetingId = dbMeeting.id;
        try {
          const info = await contract.getMeetingInfo(meetingId);
          
          // Check if meeting exists on blockchain (organizer is not zero address)
          if (info.organizer === '0x0000000000000000000000000000000000000000') {
            console.log(`Meeting ${meetingId} not found on blockchain`);
            return null;
          }
          
          const stakers = await contract.getMeetingStakers(meetingId);
          
          // Fetch detailed stake info for each staker
          const stakerDetails: StakeInfo[] = [];
          for (const stakerAddress of stakers) {
            try {
              const stakeInfo = await contract.getStakeInfo(meetingId, stakerAddress);
              stakerDetails.push({
                staker: stakeInfo.staker,
                amount: formatEther(stakeInfo.amount),
                stakedAt: new Date(Number(stakeInfo.stakedAt) * 1000),
                hasCheckedIn: stakeInfo.hasCheckedIn,
                checkInTime: stakeInfo.checkInTime > 0 ? new Date(Number(stakeInfo.checkInTime) * 1000) : null,
                isRefunded: stakeInfo.isRefunded
              });
            } catch (error) {
              console.error(`Failed to fetch stake info for ${stakerAddress}:`, error);
            }
          }
          
          // Determine status
          const now = Math.floor(Date.now() / 1000);
          const startTime = Number(info.startTime);
          const endTime = Number(info.endTime);
          const checkInDeadline = Number(info.checkInDeadline);
          
          let status: Meeting['status'] = 'upcoming';
          if (info.isSettled) {
            status = 'settled';
          } else if (now > checkInDeadline) {
            status = 'pending_settlement';
          } else if (now > endTime) {
            status = 'check_in';
          } else if (now >= startTime) {
            status = 'in_progress';
          }
          
          return {
            meetingId: info.meetingId,
            eventId: info.eventId,
            organizer: info.organizer,
            requiredStake: formatEther(info.requiredStake),
            startTime: new Date(startTime * 1000),
            endTime: new Date(endTime * 1000),
            checkInDeadline: new Date(checkInDeadline * 1000),
            hasAttendanceCode: info.attendanceCode !== '',
            isSettled: info.isSettled,
            totalStaked: formatEther(info.totalStaked),
            totalRefunded: formatEther(info.totalRefunded),
            totalForfeited: formatEther(info.totalForfeited),
            stakers: stakers,
            stakerDetails: stakerDetails,
            status,
            // Additional DB info
            dbStatus: dbMeeting.status,
            source: dbMeeting.source
          } as Meeting;
        } catch (error) {
          console.error(`Failed to fetch meeting ${meetingId} from blockchain:`, error);
          return null;
        }
      });
      
      const meetingList = (await Promise.all(meetingPromises)).filter(Boolean) as Meeting[];
      setMeetings(meetingList.reverse()); // Show newest first
      setLastUpdate(new Date());
      
      console.log(`Successfully loaded ${meetingList.length} meetings from blockchain`);
      
    } catch (error) {
      console.error('Failed to fetch meetings:', error);
    }
  }, [contract, provider]);

  // Fetch recent events (for activity feed, not for meeting discovery)
  const fetchEvents = useCallback(async () => {
    if (!contract || !provider) return;
    
    try {
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 100); // Last 100 blocks
      
      // Fetch all event types
      const eventTypes = [
        { name: 'MeetingCreated', filter: contract.filters.MeetingCreated() },
        { name: 'StakeDeposited', filter: contract.filters.StakeDeposited() },
        { name: 'AttendanceCodeGenerated', filter: contract.filters.AttendanceCodeGenerated() },
        { name: 'AttendanceConfirmed', filter: contract.filters.AttendanceConfirmed() },
        { name: 'StakeRefunded', filter: contract.filters.StakeRefunded() },
        { name: 'MeetingSettled', filter: contract.filters.MeetingSettled() }
      ];
      
      const allEvents: BlockchainEvent[] = [];
      
      for (const eventType of eventTypes) {
        const events = await contract.queryFilter(eventType.filter, fromBlock, currentBlock);
        
        for (const event of events) {
          const block = await provider.getBlock(event.blockNumber);
          
          // Handle indexed string parameters (they come as hashes)
          // We can't decode the meetingId, but we can show other data
          let displayData: any = {
            type: eventType.name,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            timestamp: new Date((block?.timestamp || 0) * 1000)
          };
          
          // Parse non-indexed parameters based on event type
          const args = (event as any).args;
          if (args) {
            switch (eventType.name) {
              case 'MeetingCreated':
                // args: [meetingId (indexed), organizer (indexed), requiredStake, startTime, endTime]
                displayData.organizer = args[1];
                displayData.requiredStake = args[2] ? formatEther(args[2]) : '0';
                displayData.startTime = args[3] ? new Date(Number(args[3]) * 1000) : null;
                displayData.endTime = args[4] ? new Date(Number(args[4]) * 1000) : null;
                break;
              case 'StakeDeposited':
                // args: [meetingId (indexed), staker (indexed), amount]
                displayData.staker = args[1];
                displayData.amount = args[2] ? formatEther(args[2]) : '0';
                break;
              case 'AttendanceCodeGenerated':
                // args: [meetingId (indexed), code, validUntil]
                displayData.code = args[1];
                displayData.validUntil = args[2] ? new Date(Number(args[2]) * 1000) : null;
                break;
              case 'AttendanceConfirmed':
                // args: [meetingId (indexed), attendee (indexed), code]
                displayData.attendee = args[1];
                displayData.code = args[2];
                break;
              case 'StakeRefunded':
              case 'StakeForfeited':
                // args: [meetingId (indexed), attendee/absentee (indexed), amount]
                displayData.participant = args[1];
                displayData.amount = args[2] ? formatEther(args[2]) : '0';
                break;
              case 'MeetingSettled':
                // args: [meetingId (indexed), totalRefunded, totalForfeited]
                displayData.totalRefunded = args[1] ? formatEther(args[1]) : '0';
                displayData.totalForfeited = args[2] ? formatEther(args[2]) : '0';
                break;
            }
          }
          
          allEvents.push({
            ...displayData,
            meetingId: 'Hashed', // Can't decode indexed strings
            details: displayData
          });
        }
      }
      
      // Sort by block number (newest first)
      allEvents.sort((a, b) => b.blockNumber - a.blockNumber);
      setEvents(allEvents.slice(0, 50)); // Keep last 50 events
      
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  }, [contract, provider]);

  // Search for specific meeting
  const searchMeeting = async () => {
    if (!contract || !searchMeetingId) return;
    
    setIsLoading(true);
    try {
      const info = await contract.getMeetingInfo(searchMeetingId);
      
      if (info.organizer === '0x0000000000000000000000000000000000000000') {
        toast.error('Meeting not found on blockchain');
        return;
      }
      
      const stakers = await contract.getMeetingStakers(searchMeetingId);
      
      // Fetch detailed stake info for each staker
      const stakerDetails: StakeInfo[] = [];
      for (const stakerAddress of stakers) {
        try {
          const stakeInfo = await contract.getStakeInfo(searchMeetingId, stakerAddress);
          stakerDetails.push({
            staker: stakeInfo.staker,
            amount: formatEther(stakeInfo.amount),
            stakedAt: new Date(Number(stakeInfo.stakedAt) * 1000),
            hasCheckedIn: stakeInfo.hasCheckedIn,
            checkInTime: stakeInfo.checkInTime > 0 ? new Date(Number(stakeInfo.checkInTime) * 1000) : null,
            isRefunded: stakeInfo.isRefunded
          });
        } catch (error) {
          console.error(`Failed to fetch stake info for ${stakerAddress}:`, error);
        }
      }
      
      // Determine status
      const now = Math.floor(Date.now() / 1000);
      const startTime = Number(info.startTime);
      const endTime = Number(info.endTime);
      const checkInDeadline = Number(info.checkInDeadline);
      
      let status: Meeting['status'] = 'upcoming';
      if (info.isSettled) {
        status = 'settled';
      } else if (now > checkInDeadline) {
        status = 'pending_settlement';
      } else if (now > endTime) {
        status = 'check_in';
      } else if (now >= startTime) {
        status = 'in_progress';
      }
      
      const meeting: Meeting = {
        meetingId: info.meetingId,
        eventId: info.eventId,
        organizer: info.organizer,
        requiredStake: formatEther(info.requiredStake),
        startTime: new Date(startTime * 1000),
        endTime: new Date(endTime * 1000),
        checkInDeadline: new Date(checkInDeadline * 1000),
        hasAttendanceCode: info.attendanceCode !== '',
        isSettled: info.isSettled,
        totalStaked: formatEther(info.totalStaked),
        totalRefunded: formatEther(info.totalRefunded),
        totalForfeited: formatEther(info.totalForfeited),
        stakers: stakers,
        stakerDetails: stakerDetails,
        status
      };
      
      setSelectedMeeting(meeting);
      toast.success('Meeting found!');
      
      // Add to meetings list if not already there
      setMeetings(prev => {
        const exists = prev.find(m => m.meetingId === meeting.meetingId);
        if (!exists) {
          return [meeting, ...prev];
        }
        return prev;
      });
      
    } catch (error) {
      console.error('Search failed:', error);
      toast.error('Failed to fetch meeting');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh when monitoring
  useEffect(() => {
    if (isMonitoring && contract && provider) {
      fetchMeetings();
      fetchEvents();
      
      const interval = setInterval(() => {
        fetchMeetings();
        fetchEvents();
      }, 2000); // Refresh every 2 seconds
      
      return () => clearInterval(interval);
    }
  }, [isMonitoring, contract, provider, fetchMeetings, fetchEvents]);

  const toggleMeetingExpanded = (meetingId: string) => {
    setExpandedMeetings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(meetingId)) {
        newSet.delete(meetingId);
      } else {
        newSet.add(meetingId);
      }
      return newSet;
    });
  };

  const getStatusColor = (status: Meeting['status']) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-600/20 text-blue-400 border-blue-600';
      case 'in_progress': return 'bg-green-600/20 text-green-400 border-green-600';
      case 'check_in': return 'bg-yellow-600/20 text-yellow-400 border-yellow-600';
      case 'pending_settlement': return 'bg-purple-600/20 text-purple-400 border-purple-600';
      case 'settled': return 'bg-gray-600/20 text-gray-400 border-gray-600';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'MeetingCreated': return '🎯';
      case 'StakeDeposited': return '💰';
      case 'AttendanceCodeGenerated': return '🔑';
      case 'AttendanceConfirmed': return '✅';
      case 'StakeRefunded': return '💸';
      case 'MeetingSettled': return '🏁';
      default: return '📌';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">⛓️ Blockchain Explorer</h1>
            <p className="text-sm text-gray-400 mt-1">
              Live view of meetings on {process.env.NEXT_PUBLIC_NETWORK === 'local' ? 'Anvil' : 'Base'}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-400">Block #{blockNumber}</p>
              <p className="text-xs text-gray-400">Last update: {lastUpdate.toLocaleTimeString()}</p>
            </div>
            
            <button
              onClick={() => setIsMonitoring(!isMonitoring)}
              className={`px-4 py-2 rounded font-medium ${
                isMonitoring 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isMonitoring ? '⏸ Pause' : '▶ Resume'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        {/* Search Bar */}
        <div className="mb-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchMeetingId}
              onChange={(e) => setSearchMeetingId(e.target.value)}
              placeholder="Enter meeting ID to search..."
              className="flex-1 px-3 py-2 bg-gray-900 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={searchMeeting}
              disabled={isLoading || !searchMeetingId}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Searching...' : '🔍 Search'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Meetings List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold">📋 Meetings on Blockchain</h2>
            
            {meetings.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 text-center">
                <p className="text-gray-400">No meetings found on blockchain</p>
                <p className="text-sm text-gray-500 mt-2">Create a meeting to see it here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {meetings.map((meeting) => (
                  <div
                    key={meeting.meetingId}
                    onClick={() => setSelectedMeeting(meeting)}
                    className={`bg-gray-800 rounded-lg p-4 border cursor-pointer transition-all hover:bg-gray-750 ${
                      selectedMeeting?.meetingId === meeting.meetingId 
                        ? 'border-blue-500 ring-2 ring-blue-500/20' 
                        : 'border-gray-700'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{meeting.meetingId}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Organizer: {meeting.organizer.slice(0, 6)}...{meeting.organizer.slice(-4)}
                        </p>
                        {meeting.source && (
                          <p className="text-xs text-gray-500 mt-1">
                            Source: {meeting.source === 'pending_meetings' ? '🗎️ DB' : '⛓️ Chain'}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(meeting.status)}`}>
                          {meeting.status.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="text-xs px-2 py-1 bg-green-600/20 text-green-400 rounded">
                          ON-CHAIN
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-400">Required</p>
                        <p className="font-semibold">{meeting.requiredStake} ETH</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Staked</p>
                        <p className="font-semibold text-green-400">{meeting.totalStaked} ETH</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Stakers</p>
                        <p className="font-semibold">{meeting.stakers.length}</p>
                      </div>
                    </div>
                    
                    {/* Expandable Staker Details Button */}
                    {meeting.stakers.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMeetingExpanded(meeting.meetingId);
                        }}
                        className="mt-3 w-full flex items-center justify-between px-3 py-2 bg-gray-900 hover:bg-gray-750 rounded text-sm transition-colors"
                      >
                        <span className="text-gray-300">
                          {expandedMeetings.has(meeting.meetingId) ? '▼' : '▶'} View {meeting.stakers.length} Staker{meeting.stakers.length !== 1 ? 's' : ''} Details
                        </span>
                        <span className="text-xs text-gray-500">From Blockchain</span>
                      </button>
                    )}
                    
                    {/* Expanded Staker Details */}
                    {expandedMeetings.has(meeting.meetingId) && meeting.stakerDetails && (
                      <div className="mt-2 space-y-2 bg-gray-900 rounded p-3">
                        <p className="text-xs font-semibold text-gray-300 mb-2">⛓️ Blockchain Staker Information:</p>
                        {meeting.stakerDetails.map((stake, idx) => (
                          <div key={idx} className="bg-gray-800 rounded p-2 text-xs space-y-1">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-mono text-blue-400">
                                  {stake.staker.slice(0, 6)}...{stake.staker.slice(-4)}
                                </p>
                                <p className="text-gray-400 mt-1">
                                  Amount: <span className="text-green-400 font-semibold">{stake.amount} ETH</span>
                                </p>
                              </div>
                              <div className="text-right">
                                {stake.hasCheckedIn ? (
                                  <span className="text-green-400">✅ Checked In</span>
                                ) : (
                                  <span className="text-yellow-400">⏰ Not Checked In</span>
                                )}
                                {stake.isRefunded && (
                                  <span className="block text-blue-400 mt-1">💸 Refunded</span>
                                )}
                              </div>
                            </div>
                            <div className="text-gray-500 mt-1">
                              <p>Staked: {stake.stakedAt.toLocaleString()}</p>
                              {stake.checkInTime && (
                                <p>Checked In: {stake.checkInTime.toLocaleString()}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {meeting.blockNumber && (
                      <p className="text-xs text-gray-500 mt-2">
                        Created at block #{meeting.blockNumber}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Events Stream */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">📡 Event Stream</h2>
            
            <div className="bg-gray-800 rounded-lg border border-gray-700 max-h-[600px] overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-gray-400 text-center p-8">No recent events</p>
              ) : (
                <div className="divide-y divide-gray-700">
                  {events.map((event, index) => (
                    <div key={index} className="p-3 hover:bg-gray-750">
                      <div className="flex items-start gap-2">
                        <span className="text-xl">{getEventIcon(event.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{event.type}</p>
                          
                          {/* Show event-specific details */}
                          {event.type === 'MeetingCreated' && event.details.organizer && (
                            <div className="text-xs text-gray-400 mt-1">
                              <p>Organizer: {event.details.organizer.slice(0, 6)}...{event.details.organizer.slice(-4)}</p>
                              <p>Stake: {event.details.requiredStake} ETH</p>
                              {event.details.startTime && (
                                <p>Start: {event.details.startTime.toLocaleString()}</p>
                              )}
                            </div>
                          )}
                          
                          {event.type === 'StakeDeposited' && event.details.staker && (
                            <div className="text-xs text-gray-400 mt-1">
                              <p>Staker: {event.details.staker.slice(0, 6)}...{event.details.staker.slice(-4)}</p>
                              <p>Amount: {event.details.amount} ETH</p>
                            </div>
                          )}
                          
                          {event.type === 'AttendanceCodeGenerated' && event.details.code && (
                            <div className="text-xs text-gray-400 mt-1">
                              <p>Code: {event.details.code.slice(0, 8)}...</p>
                              {event.details.validUntil && (
                                <p>Valid until: {event.details.validUntil.toLocaleTimeString()}</p>
                              )}
                            </div>
                          )}
                          
                          {event.type === 'AttendanceConfirmed' && event.details.attendee && (
                            <div className="text-xs text-gray-400 mt-1">
                              <p>Attendee: {event.details.attendee.slice(0, 6)}...{event.details.attendee.slice(-4)}</p>
                            </div>
                          )}
                          
                          {(event.type === 'StakeRefunded' || event.type === 'StakeForfeited') && event.details.participant && (
                            <div className="text-xs text-gray-400 mt-1">
                              <p>Participant: {event.details.participant.slice(0, 6)}...{event.details.participant.slice(-4)}</p>
                              <p>Amount: {event.details.amount} ETH</p>
                            </div>
                          )}
                          
                          {event.type === 'MeetingSettled' && (
                            <div className="text-xs text-gray-400 mt-1">
                              <p>Refunded: {event.details.totalRefunded} ETH</p>
                              <p>Forfeited: {event.details.totalForfeited} ETH</p>
                            </div>
                          )}
                          
                          <p className="text-xs text-gray-500 mt-1">
                            Block #{event.blockNumber} • {event.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Selected Meeting Details */}
        {selectedMeeting && (
          <div className="mt-6 bg-gray-800 rounded-lg p-6 border border-blue-500">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">Meeting Details</h3>
              <button
                onClick={() => setSelectedMeeting(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-400">Meeting ID</p>
                <p className="text-sm font-mono">{selectedMeeting.meetingId}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Event ID</p>
                <p className="text-sm font-mono">{selectedMeeting.eventId || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Organizer</p>
                <p className="text-sm font-mono">{selectedMeeting.organizer}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Required Stake</p>
                <p className="text-sm font-semibold">{selectedMeeting.requiredStake} ETH</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Total Staked</p>
                <p className="text-sm font-semibold text-green-400">{selectedMeeting.totalStaked} ETH</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Status</p>
                <span className={`inline-block px-2 py-1 rounded text-xs border ${getStatusColor(selectedMeeting.status)}`}>
                  {selectedMeeting.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-400">Start Time</p>
                <p className="text-sm">{selectedMeeting.startTime.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">End Time</p>
                <p className="text-sm">{selectedMeeting.endTime.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Check-in Deadline</p>
                <p className="text-sm">{selectedMeeting.checkInDeadline.toLocaleString()}</p>
              </div>
            </div>
            
            {selectedMeeting.stakers.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold mb-2">
                  ⛓️ Stakers from Blockchain ({selectedMeeting.stakers.length})
                </p>
                
                {/* Show detailed staker info if available */}
                {selectedMeeting.stakerDetails && selectedMeeting.stakerDetails.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedMeeting.stakerDetails.map((stake, idx) => (
                      <div key={idx} className="bg-gray-900 rounded p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-sm font-mono text-blue-400">
                              {stake.staker}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Staked: {stake.stakedAt.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-green-400">
                              {stake.amount} ETH
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500">Check-in Status:</span>
                            <p className="mt-1">
                              {stake.hasCheckedIn ? (
                                <span className="text-green-400">✅ Checked In</span>
                              ) : (
                                <span className="text-yellow-400">⏰ Not Checked In</span>
                              )}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Refund Status:</span>
                            <p className="mt-1">
                              {stake.isRefunded ? (
                                <span className="text-blue-400">💸 Refunded</span>
                              ) : (
                                <span className="text-gray-400">Not Refunded</span>
                              )}
                            </p>
                          </div>
                        </div>
                        
                        {stake.checkInTime && (
                          <p className="text-xs text-gray-500 mt-2">
                            Checked in at: {stake.checkInTime.toLocaleString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-900 rounded p-3 max-h-32 overflow-y-auto">
                    {selectedMeeting.stakers.map((staker, i) => (
                      <p key={i} className="text-xs font-mono text-gray-400">
                        {staker}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {selectedMeeting.transactionHash && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-400">Transaction Hash</p>
                <p className="text-xs font-mono text-blue-400">{selectedMeeting.transactionHash}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}