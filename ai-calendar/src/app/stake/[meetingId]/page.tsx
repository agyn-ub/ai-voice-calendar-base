'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { MeetingStakeData } from '@/lib/services/stakingService';
import { WalletAuth } from '@/components/WalletAuth';
import { MeetingStakeContract } from '@/lib/ethereum/meetingStakeContract';

export default function StakePage() {
  const params = useParams();
  const meetingId = params.meetingId as string;

  const { address: walletAddress, isConnected } = useAccount();
  const [meetingInfo, setMeetingInfo] = useState<MeetingStakeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [staking, setStaking] = useState(false);
  const [hasStaked, setHasStaked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contractInstance, setContractInstance] = useState<MeetingStakeContract | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setContractInstance(new MeetingStakeContract());
    }
  }, []);

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

      // Then record in database
      const response = await fetch('/api/staking/stake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingId,
          walletAddress,
          transactionHash: receipt.transactionHash,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to record stake');
      }

      // Send confirmation email
      await fetch('/api/staking/send-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingId,
          walletAddress,
        }),
      });

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
          <div className="bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-8">
              <h1 className="text-3xl font-bold mb-2">Stake for Meeting</h1>
              <p className="text-green-100">
                Commit your attendance with ETH stake
              </p>
            </div>

            {/* Meeting Details */}
            <div className="p-8">
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold mb-4">
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
                  <div className="bg-gray-900 p-4 rounded-lg">
                    <p className="text-sm text-gray-400 mb-1">Organizer</p>
                    <p className="font-semibold">
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
                  <div className="bg-gray-900 p-6 rounded-lg text-center">
                    <p className="text-gray-400 mb-4">
                      Connect your wallet to stake for this meeting
                    </p>
                    <WalletAuth />
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}