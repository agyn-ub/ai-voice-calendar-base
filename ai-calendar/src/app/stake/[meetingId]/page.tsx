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
  const [hasGoogleAuth, setHasGoogleAuth] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contractInstance, setContractInstance] = useState<MeetingStakeContract | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setContractInstance(new MeetingStakeContract());
    }
  }, []);

  // Check if user has connected Google Calendar
  useEffect(() => {
    const checkGoogleAuth = async () => {
      if (walletAddress) {
        setCheckingAuth(true);
        try {
          const response = await fetch(`/api/calendar/status?walletAddress=${walletAddress}`);
          const data = await response.json();
          setHasGoogleAuth(data.isConnected || false);
        } catch (err) {
          console.error('Error checking Google auth status:', err);
          setHasGoogleAuth(false);
        } finally {
          setCheckingAuth(false);
        }
      }
    };

    checkGoogleAuth();
  }, [walletAddress]);

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
          amount: meetingInfo.requiredStake,
          transactionHash: receipt.transactionHash,
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
                  <div className="bg-gray-900 p-6 rounded-lg text-center relative overflow-visible">
                    <p className="text-gray-400 mb-4">
                      Connect your wallet to stake for this meeting
                    </p>
                    <div className="flex justify-center">
                      <WalletAuth />
                    </div>
                  </div>
                ) : !hasGoogleAuth ? (
                  <div className="bg-yellow-900 p-6 rounded-lg text-center">
                    <svg
                      className="w-12 h-12 text-yellow-400 mx-auto mb-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <p className="text-yellow-300 font-semibold mb-2">
                      Google Calendar Required
                    </p>
                    <p className="text-sm text-gray-300 mb-4">
                      Connect your Google Calendar to stake for this meeting and receive calendar invitations
                    </p>
                    {checkingAuth ? (
                      <p className="text-gray-400">Checking authentication...</p>
                    ) : (
                      <a
                        href={`/api/calendar/google/connect?wallet_address=${walletAddress}&redirect=/stake/${meetingId}`}
                        className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
                      >
                        Connect Google Calendar
                      </a>
                    )}
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