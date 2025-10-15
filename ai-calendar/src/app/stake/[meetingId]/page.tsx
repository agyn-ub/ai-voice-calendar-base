'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { MeetingStakeData } from '@/lib/services/stakingService';
import { WalletAuth } from '@/components/WalletAuth';
import { MeetingStakeContract } from '@/lib/ethereum/meetingStakeContract';
import { formatEther } from 'viem';
import { CONTRACT_ADDRESSES, CURRENT_NETWORK, NETWORK_CONFIG } from '@/lib/ethereum/config';

export default function StakePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const meetingId = params.meetingId as string;
  const token = searchParams.get('token');

  const { address: walletAddress, isConnected } = useAccount();
  const [meetingInfo, setMeetingInfo] = useState<MeetingStakeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [staking, setStaking] = useState(false);
  const [hasStaked, setHasStaked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contractInstance, setContractInstance] = useState<MeetingStakeContract | null>(null);
  
  // Blockchain data state
  const [blockchainData, setBlockchainData] = useState<any>(null);
  const [blockchainStakers, setBlockchainStakers] = useState<string[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [showBlockchainDetails, setShowBlockchainDetails] = useState(false);
  const [lastBlockUpdate, setLastBlockUpdate] = useState<Date>(new Date());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setContractInstance(new MeetingStakeContract());
      setIsPolling(true); // Start polling by default
    }
  }, []);
  
  // Fetch blockchain data
  const fetchBlockchainData = useCallback(async () => {
    if (!contractInstance || !meetingId) return;
    
    try {
      const info = await contractInstance.getMeetingInfo(meetingId);
      const stakers = await contractInstance.getMeetingStakers(meetingId);
      
      // Check if meeting exists on blockchain (organizer is not zero address)
      if (info.organizer !== '0x0000000000000000000000000000000000000000') {
        setBlockchainData({
          exists: true,
          meetingId: info.meetingId,
          eventId: info.eventId,
          organizer: info.organizer,
          requiredStake: formatEther(info.requiredStake),
          startTime: new Date(Number(info.startTime) * 1000),
          endTime: new Date(Number(info.endTime) * 1000),
          checkInDeadline: new Date(Number(info.checkInDeadline) * 1000),
          hasAttendanceCode: info.attendanceCode !== '',
          isSettled: info.isSettled,
          totalStaked: formatEther(info.totalStaked),
          totalRefunded: formatEther(info.totalRefunded),
          totalForfeited: formatEther(info.totalForfeited)
        });
        setBlockchainStakers(stakers);
      } else {
        setBlockchainData({ exists: false });
      }
      setLastBlockUpdate(new Date());
    } catch (error) {
      console.error('Error fetching blockchain data:', error);
      setBlockchainData({ exists: false, error: error });
    }
  }, [contractInstance, meetingId]);
  
  // Polling effect for blockchain data
  useEffect(() => {
    if (isPolling && contractInstance) {
      fetchBlockchainData();
      const interval = setInterval(fetchBlockchainData, 3000); // Poll every 3 seconds
      return () => clearInterval(interval);
    }
  }, [isPolling, contractInstance, fetchBlockchainData]);


  const fetchMeetingInfo = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/staking/status?meetingId=${meetingId}`);

      if (!response.ok) {
        throw new Error('Meeting not found');
      }

      const data = await response.json();
      setMeetingInfo(data.meeting);

      // Check if current user has already staked
      if (walletAddress) {
        const userStake = data.meeting.stakes.find(
          (s: { walletAddress: string }) => s.walletAddress.toLowerCase() === walletAddress.toLowerCase()
        );
        setHasStaked(!!userStake);
      }
    } catch (err) {
      console.error('Error fetching meeting info:', err);
      setError(err instanceof Error ? err.message : 'Failed to load meeting');
    } finally {
      setLoading(false);
    }
  }, [meetingId, walletAddress]);

  // Fetch meeting information
  useEffect(() => {
    fetchMeetingInfo();
  }, [fetchMeetingInfo, walletAddress]);
  
  // Function to verify blockchain status
  const verifyBlockchainStatus = async () => {
    try {
      const response = await fetch('/api/staking/verify-blockchain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId, walletAddress })
      });
      const data = await response.json();
      console.log('Blockchain verification:', data);
      return data;
    } catch (error) {
      console.error('Failed to verify blockchain status:', error);
    }
  };

  const handleStake = async () => {
    if (!walletAddress || !meetingInfo || !contractInstance) return;

    setStaking(true);
    setError(null);

    try {
      // First stake on blockchain
      const receipt = await contractInstance.stakeForMeeting(
        meetingId,
        meetingInfo.requiredStake.toString()
      );

      // Then record in database with token if provided
      const response = await fetch('/api/staking/stake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingId,
          walletAddress,
          amount: meetingInfo.requiredStake,
          transactionHash: receipt.transactionHash,
          token: token || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to record stake');
      }

      // Send Google Calendar invitation to this staker
      const calendarResponse = await fetch('/api/staking/confirm-and-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingId,
          stakerWallet: walletAddress,
        }),
      });

      if (!calendarResponse.ok) {
        console.error('Failed to send calendar invitation, but stake was recorded successfully');
      }

      setHasStaked(true);
      await fetchMeetingInfo(); // Refresh meeting info
    } catch (err) {
      console.error('Error staking:', err);
      setError(err instanceof Error ? err.message : 'Failed to stake');
    } finally {
      setStaking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white text-xl">Loading meeting details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-red-400 text-xl">{error}</div>
      </div>
    );
  }

  if (!meetingInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-gray-400 text-xl">Meeting not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gray-800 rounded-2xl shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-8 rounded-t-2xl">
              <h1 className="text-3xl font-bold mb-2">Stake for Meeting</h1>
              <p className="text-green-100">
                Commit your attendance with ETH stake
              </p>
            </div>

            {/* Meeting Details */}
            <div className="p-8">
              <div className="space-y-6">
                <div className="min-w-0">
                  <h2 className="text-2xl font-semibold mb-4 break-all">
                    Meeting {meetingInfo.meetingId}
                  </h2>
                </div>

                {/* Meeting Info Grid */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gray-900 p-4 rounded-lg">
                    <p className="text-sm text-gray-400 mb-1">Date & Time</p>
                    <p className="font-semibold">
                      {new Date(meetingInfo.startTime).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-gray-900 p-4 rounded-lg">
                    <p className="text-sm text-gray-400 mb-1">Duration</p>
                    <p className="font-semibold">
                      {Math.round(
                        (new Date(meetingInfo.endTime).getTime() -
                          new Date(meetingInfo.startTime).getTime()) /
                          (1000 * 60)
                      )}{' '}
                      minutes
                    </p>
                  </div>
                  {/* Location field removed - not in MeetingStakeData */}
                  <div className="bg-gray-900 p-4 rounded-lg min-w-0">
                    <p className="text-sm text-gray-400 mb-1">Organizer</p>
                    <p className="font-semibold break-all">
                      {meetingInfo.organizer}
                    </p>
                  </div>
                </div>

                {/* Stake Info */}
                <div className="bg-gradient-to-r from-blue-900 to-purple-900 p-6 rounded-lg">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Staking Details</h3>
                    <div className="text-right">
                      <p className="text-sm text-gray-300">Required Stake</p>
                      <p className="text-2xl font-bold">
                        {meetingInfo.requiredStake} ETH
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Total Staked</span>
                      <span className="font-semibold">
                        {meetingInfo.stakes.reduce(
                          (sum, s) => sum + s.amount,
                          0
                        )}{' '}
                        ETH
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Participants</span>
                      <span className="font-semibold">
                        {meetingInfo.stakes.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Wallet Connection */}
                {!isConnected ? (
                  <div className="bg-gray-900 p-6 rounded-lg text-center relative overflow-visible">
                    <p className="text-gray-400 mb-4">
                      Connect your wallet to stake for this meeting
                    </p>
                    <div className="flex justify-center">
                      <WalletAuth />
                    </div>
                  </div>
                ) : hasStaked ? (
                  <div className="bg-green-900 p-6 rounded-lg">
                    <div className="flex items-center gap-3">
                      <svg
                        className="w-6 h-6 text-green-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div>
                        <p className="font-semibold">
                          You have already staked for this meeting
                        </p>
                        <p className="text-sm text-green-400 mt-1">
                          Remember to attend and submit the attendance code to
                          reclaim your stake
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <button
                      onClick={handleStake}
                      disabled={staking}
                      className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold text-lg transition-all"
                    >
                      {staking
                        ? 'Processing...'
                        : `Stake ${meetingInfo.requiredStake} ETH`}
                    </button>
                    <p className="text-xs text-gray-400 text-center">
                      By staking, you commit to attending this meeting. Your
                      stake will be refunded upon attendance confirmation.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-900 p-4 rounded-lg">
                    <p className="text-red-400">{error}</p>
                  </div>
                )}

                {/* Blockchain Data Section */}
                <div className="border-t border-gray-700 pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      ⛓️ Blockchain Data
                      {blockchainData?.exists && (
                        <span className="text-xs px-2 py-1 bg-green-600/20 text-green-400 rounded">
                          ON-CHAIN
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsPolling(!isPolling)}
                        className={`text-xs px-2 py-1 rounded ${
                          isPolling 
                            ? 'bg-green-600/20 text-green-400' 
                            : 'bg-gray-600/20 text-gray-400'
                        }`}
                      >
                        {isPolling ? '● Live' : '○ Paused'}
                      </button>
                      <button
                        onClick={() => setShowBlockchainDetails(!showBlockchainDetails)}
                        className="text-gray-400 hover:text-white"
                      >
                        {showBlockchainDetails ? '▼' : '▶'}
                      </button>
                    </div>
                  </div>

                  {/* Quick Blockchain Status */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-900 p-3 rounded">
                      <p className="text-xs text-gray-400">Network</p>
                      <p className="font-semibold text-sm">
                        {CURRENT_NETWORK === 'local' ? '🟢 Anvil (Local)' : 
                         CURRENT_NETWORK === 'baseSepolia' ? '🔵 Base Sepolia' : 
                         '🔷 Base Mainnet'}
                      </p>
                    </div>
                    <div className="bg-gray-900 p-3 rounded">
                      <p className="text-xs text-gray-400">Contract</p>
                      <p className="font-mono text-xs">
                        {CONTRACT_ADDRESSES[CURRENT_NETWORK].meetingStake.slice(0, 6)}...
                        {CONTRACT_ADDRESSES[CURRENT_NETWORK].meetingStake.slice(-4)}
                      </p>
                    </div>
                  </div>

                  {blockchainData && blockchainData.exists ? (
                    <>
                      <div className="bg-gray-900 p-4 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Blockchain Total Staked</span>
                          <span className="font-semibold text-green-400">
                            {blockchainData.totalStaked} ETH
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">On-Chain Stakers</span>
                          <span className="font-semibold">
                            {blockchainStakers.length}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Settlement Status</span>
                          <span className={`text-sm ${blockchainData.isSettled ? 'text-green-400' : 'text-yellow-400'}`}>
                            {blockchainData.isSettled ? 'Settled' : 'Pending'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Last Update</span>
                          <span className="text-xs text-gray-500">
                            {lastBlockUpdate.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      {/* Detailed Blockchain Data (Collapsible) */}
                      {showBlockchainDetails && (
                        <div className="mt-4 bg-gray-900 p-4 rounded-lg space-y-3">
                          <h4 className="font-semibold text-sm mb-2">Full Blockchain Data</h4>
                          
                          <div className="text-xs space-y-2">
                            <div className="overflow-hidden">
                              <span className="text-gray-400">Meeting ID: </span>
                              <span className="font-mono break-all">{blockchainData.meetingId}</span>
                            </div>
                            <div className="overflow-hidden">
                              <span className="text-gray-400">Organizer: </span>
                              <span className="font-mono break-all">{blockchainData.organizer}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Required Stake: </span>
                              <span>{blockchainData.requiredStake} ETH</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Start Time: </span>
                              <span>{blockchainData.startTime.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Check-in Deadline: </span>
                              <span>{blockchainData.checkInDeadline.toLocaleString()}</span>
                            </div>
                            {blockchainData.hasAttendanceCode && (
                              <div>
                                <span className="text-gray-400">Attendance Code: </span>
                                <span className="text-green-400">Generated ✓</span>
                              </div>
                            )}
                          </div>

                          {/* Stakers List */}
                          {blockchainStakers.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-800">
                              <p className="text-sm font-semibold mb-2">On-Chain Stakers</p>
                              <div className="space-y-1">
                                {blockchainStakers.map((staker, i) => (
                                  <div key={i} className="flex justify-between items-center gap-2">
                                    <span className="font-mono text-xs text-gray-400 truncate" title={staker}>
                                      {staker.slice(0, 6)}...{staker.slice(-4)}
                                    </span>
                                    {staker.toLowerCase() === walletAddress?.toLowerCase() && (
                                      <span className="text-xs text-green-400 flex-shrink-0">You</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Sync Status */}
                      <div className="mt-4 p-3 bg-gray-900 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">Database vs Blockchain</span>
                          {meetingInfo && blockchainData && (
                            <span className={`text-sm ${
                              meetingInfo.stakes.length === blockchainStakers.length 
                                ? 'text-green-400' 
                                : 'text-yellow-400'
                            }`}>
                              {meetingInfo.stakes.length === blockchainStakers.length 
                                ? '✓ Synced' 
                                : `⚠ DB: ${meetingInfo.stakes.length} | Chain: ${blockchainStakers.length}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* View on Explorer Button */}
                      <div className="mt-4">
                        <a
                          href={`/blockchain-explorer?meeting=${meetingId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded transition-colors"
                        >
                          🔍 View on Blockchain Explorer
                        </a>
                      </div>
                    </>
                  ) : blockchainData && !blockchainData.exists ? (
                    <div className="bg-gray-900 p-4 rounded-lg">
                      <p className="text-yellow-400 text-sm">
                        ⚠️ Meeting not found on blockchain yet
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        The meeting may still be pending or needs to be created on-chain
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gray-900 p-4 rounded-lg">
                      <p className="text-gray-400 text-sm">Loading blockchain data...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}