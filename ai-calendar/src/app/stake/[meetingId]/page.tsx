'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import * as fcl from '@onflow/fcl';
import { MeetingStakeData } from '@/lib/services/stakingService';

export default function StakePage() {
  const params = useParams();
  const meetingId = params.meetingId as string;

  const [user, setUser] = useState<any>(null);
  const [meetingInfo, setMeetingInfo] = useState<MeetingStakeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [staking, setStaking] = useState(false);
  const [hasStaked, setHasStaked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to Flow user authentication
  useEffect(() => {
    fcl.currentUser.subscribe(setUser);
  }, []);

  // Fetch meeting information
  useEffect(() => {
    fetchMeetingInfo();
  }, [meetingId, user]);

  const fetchMeetingInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/staking/status?meetingId=${meetingId}`);

      if (!response.ok) {
        throw new Error('Meeting not found');
      }

      const data = await response.json();
      setMeetingInfo(data.meeting);

      // Check if current user has already staked
      if (user?.addr) {
        const userStake = data.meeting.stakes.find(
          (s: any) => s.walletAddress.toLowerCase() === user.addr.toLowerCase()
        );
        setHasStaked(!!userStake);
      }
    } catch (err) {
      console.error('Error fetching meeting info:', err);
      setError(err instanceof Error ? err.message : 'Failed to load meeting');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectWallet = async () => {
    try {
      await fcl.authenticate();
    } catch (err) {
      console.error('Error connecting wallet:', err);
      setError('Failed to connect wallet');
    }
  };

  const handleStake = async () => {
    if (!user?.addr || !meetingInfo) return;

    try {
      setStaking(true);
      setError(null);

      const response = await fetch('/api/staking/stake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId,
          amount: meetingInfo.requiredStake,
          walletAddress: user.addr
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to stake');
      }

      // Refresh meeting info to show updated stake
      await fetchMeetingInfo();
      setHasStaked(true);

      // Trigger calendar event creation after successful staking
      try {
        const scheduleResponse = await fetch('/api/staking/confirm-and-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meetingId,
            stakerWallet: user.addr,
            stakerEmail: user.email // If available from Flow account
          })
        });

        if (scheduleResponse.ok) {
          const scheduleData = await scheduleResponse.json();
          console.log('[Stake] Calendar event created:', scheduleData.googleEventId);
        }
      } catch (err) {
        console.error('[Stake] Error creating calendar event:', err);
      }

    } catch (err) {
      console.error('Error staking:', err);
      setError(err instanceof Error ? err.message : 'Failed to stake');
    } finally {
      setStaking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading meeting details...</p>
        </div>
      </div>
    );
  }

  if (error && !meetingInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Meeting Not Found</h2>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!meetingInfo) return null;

  const startTime = new Date(meetingInfo.startTime);
  const endTime = new Date(meetingInfo.endTime);
  const stakeDeadline = new Date(startTime.getTime() - 60 * 60 * 1000); // 1 hour before
  const isPastDeadline = new Date() > stakeDeadline;
  const totalStaked = meetingInfo.stakes.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-xl p-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Meeting Stake Required</h1>
          <p className="opacity-90">Confirm your attendance by staking FLOW tokens</p>
        </div>

        {/* Main Card */}
        <div className="bg-white shadow-xl rounded-b-xl">
          {/* Meeting Details */}
          <div className="p-8 border-b">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Meeting Details</h2>

            <div className="space-y-4">
              <div className="flex items-start">
                <span className="text-2xl mr-3">📅</span>
                <div>
                  <p className="font-medium text-gray-900">Date & Time</p>
                  <p className="text-gray-600">
                    {startTime.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                  <p className="text-gray-600">
                    {startTime.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit'
                    })} - {endTime.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZoneName: 'short'
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <span className="text-2xl mr-3">👤</span>
                <div>
                  <p className="font-medium text-gray-900">Organizer</p>
                  <p className="text-gray-600">{meetingInfo.organizer}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Staking Info */}
          <div className="p-8 bg-gray-50">
            <div className="bg-white rounded-lg p-6 border-2 border-indigo-200">
              <div className="text-center">
                <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Required Stake</p>
                <p className="text-4xl font-bold text-gray-900 mt-2">{meetingInfo.requiredStake} FLOW</p>

                {!isPastDeadline ? (
                  <p className="text-gray-600 mt-2">
                    Deadline: {stakeDeadline.toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </p>
                ) : (
                  <p className="text-red-600 mt-2 font-medium">⚠️ Staking deadline has passed</p>
                )}
              </div>

              {/* Progress Bar */}
              <div className="mt-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>{meetingInfo.stakes.length} participants staked</span>
                  <span>{totalStaked} FLOW total</span>
                </div>
                <div className="bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all"
                    style={{ width: `${Math.min((meetingInfo.stakes.length / 10) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Section */}
          <div className="p-8">
            {!user?.addr ? (
              <div className="text-center">
                <p className="text-gray-600 mb-4">Connect your Flow wallet to stake</p>
                <button
                  onClick={handleConnectWallet}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105"
                >
                  Connect Wallet
                </button>
              </div>
            ) : hasStaked ? (
              <div className="text-center">
                <div className="text-green-500 text-5xl mb-4">✅</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">You're all set!</h3>
                <p className="text-gray-600">Your stake has been confirmed. See you at the meeting!</p>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Remember to get the attendance code from the organizer during the meeting to reclaim your stake.
                  </p>
                </div>
              </div>
            ) : isPastDeadline ? (
              <div className="text-center">
                <div className="text-red-500 text-5xl mb-4">⏰</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Staking Closed</h3>
                <p className="text-gray-600">The deadline for staking has passed.</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-600 mb-6">
                  Connected as: <span className="font-mono text-sm">{user.addr}</span>
                </p>
                <button
                  onClick={handleStake}
                  disabled={staking}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {staking ? 'Processing...' : `Stake ${meetingInfo.requiredStake} FLOW`}
                </button>
                {error && (
                  <p className="mt-4 text-red-600 text-sm">{error}</p>
                )}
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="p-8 bg-gray-50 border-t">
            <h3 className="font-semibold text-gray-900 mb-3">How it works:</h3>
            <ol className="space-y-2 text-gray-600">
              <li className="flex">
                <span className="font-semibold mr-2">1.</span>
                <span>Stake {meetingInfo.requiredStake} FLOW to confirm your attendance</span>
              </li>
              <li className="flex">
                <span className="font-semibold mr-2">2.</span>
                <span>Attend the meeting and receive an attendance code from the organizer</span>
              </li>
              <li className="flex">
                <span className="font-semibold mr-2">3.</span>
                <span>Submit the code within 15 minutes after the meeting ends</span>
              </li>
              <li className="flex">
                <span className="font-semibold mr-2">4.</span>
                <span>Get your stake refunded automatically</span>
              </li>
            </ol>
            <p className="mt-4 text-sm text-gray-500">
              Note: If you miss the meeting without submitting the attendance code, your stake will be forfeited and distributed among attendees.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-8">
          Powered by AI Voice Calendar • Built on Flow Blockchain
        </p>
      </div>
    </div>
  );
}