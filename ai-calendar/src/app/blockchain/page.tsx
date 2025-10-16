'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { MeetingStakeContract } from '@/lib/ethereum/meetingStakeContract';
import { useAccount } from 'wagmi';

interface MeetingData {
  meetingId: string;
  organizer: string;
  requiredStake: string;
  startTime: Date;
  endTime: Date;
  isSettled: boolean;
  totalStaked: string;
  attendanceCode?: string;
}

export default function BlockchainExplorer() {
  const { address: walletAddress } = useAccount();
  const [meetings, setMeetings] = useState<MeetingData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null);
  const [stakers, setStakers] = useState<string[]>([]);
  const [testMeetingId, setTestMeetingId] = useState('');
  const [contractInstance, setContractInstance] = useState<MeetingStakeContract | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setContractInstance(new MeetingStakeContract());
    }
  }, []);

  // Check a specific meeting
  const checkMeeting = async () => {
    if (!contractInstance || !testMeetingId) return;
    
    setLoading(true);
    try {
      const info = await contractInstance.getMeetingInfo(testMeetingId);
      console.log('Meeting info from blockchain:', info);
      
      if (info && info.organizer !== '0x0000000000000000000000000000000000000000') {
        const meetingData: MeetingData = {
          meetingId: info.meetingId || testMeetingId,
          organizer: info.organizer,
          requiredStake: (Number(info.requiredStake) / 1e18).toString(),
          startTime: new Date(Number(info.startTime) * 1000),
          endTime: new Date(Number(info.endTime) * 1000),
          isSettled: info.isSettled,
          totalStaked: (Number(info.totalStaked || 0) / 1e18).toString(),
          attendanceCode: info.attendanceCode
        };
        
        setMeetings([meetingData]);
        
        // Get stakers for this meeting
        const stakersList = await contractInstance.getMeetingStakers(testMeetingId);
        setStakers(stakersList);
      } else {
        alert('Meeting not found on blockchain');
      }
    } catch (error) {
      console.error('Error fetching meeting:', error);
      alert('Error: Meeting might not exist on blockchain');
    } finally {
      setLoading(false);
    }
  };

  // Check if user has staked
  const checkUserStake = async (meetingId: string) => {
    if (!contractInstance || !walletAddress) return;
    
    try {
      const hasStaked = await contractInstance.hasStaked(meetingId, walletAddress);
      const stakeInfo = await contractInstance.getStakeInfo(meetingId, walletAddress);
      
      console.log(`User ${walletAddress} staked:`, hasStaked);
      console.log('Stake details:', stakeInfo);
      
      alert(`You ${hasStaked ? 'have' : 'have not'} staked for this meeting`);
    } catch (error) {
      console.error('Error checking stake:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🔗 Blockchain Explorer</h1>
        
        {/* Quick Check Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Check Meeting on Blockchain</h2>
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Enter meeting ID (e.g., meeting-1234567890-abc123)"
              className="flex-1 px-4 py-2 bg-gray-700 rounded-lg text-white"
              value={testMeetingId}
              onChange={(e) => setTestMeetingId(e.target.value)}
            />
            <button
              onClick={checkMeeting}
              disabled={loading || !testMeetingId}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Check Meeting'}
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            Tip: Create a meeting with stakes in the Chat tab, then copy the meeting ID from the success message
          </p>
        </div>

        {/* Manual Test Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">🧪 Test Contract Directly</h2>
          <button
            onClick={async () => {
              if (!contractInstance || !walletAddress) {
                alert('Please connect your wallet first');
                return;
              }
              
              const testId = `test-${Date.now()}`;
              const now = Math.floor(Date.now() / 1000);
              
              try {
                console.log('Testing createMeeting with:', {
                  meetingId: testId,
                  eventId: 'Test Event',
                  stakeAmount: '0.001',
                  startTime: now + 3600, // 1 hour from now
                  endTime: now + 7200 // 2 hours from now
                });
                
                const receipt = await contractInstance.createMeeting(
                  testId,
                  'Test Event',
                  '0.001', // 0.001 ETH
                  now + 3600, // Start in 1 hour
                  now + 7200  // End in 2 hours
                );
                
                console.log('Test meeting created!', receipt);
                alert(`Success! Test meeting created with ID: ${testId}\nTransaction: ${receipt.hash}`);
                setTestMeetingId(testId);
              } catch (error) {
                console.error('Test failed:', error);
                alert(`Failed to create test meeting: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium"
          >
            Create Test Meeting (0.001 ETH stake)
          </button>
          <p className="text-sm text-gray-400 mt-2">
            This will create a test meeting directly on the blockchain to verify everything is working
          </p>
        </div>

        {/* Contract Info */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Contract Information</h2>
          <div className="space-y-2 font-mono text-sm">
            <p>Network: <span className="text-green-400">Anvil (Local)</span></p>
            <p>Contract Address: <span className="text-blue-400">0x5FbDB2315678afecb367f032d93F642f64180aa3</span></p>
            <p>Your Wallet: <span className="text-yellow-400">{walletAddress || 'Not connected'}</span></p>
          </div>
        </div>

        {/* Meetings Table */}
        {meetings.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Meetings on Blockchain</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2">Meeting ID</th>
                    <th className="text-left py-2">Organizer</th>
                    <th className="text-left py-2">Required Stake</th>
                    <th className="text-left py-2">Total Staked</th>
                    <th className="text-left py-2">Start Time</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.map((meeting) => (
                    <tr key={meeting.meetingId} className="border-b border-gray-700">
                      <td className="py-2 font-mono text-xs">{meeting.meetingId.slice(0, 20)}...</td>
                      <td className="py-2 font-mono text-xs">{meeting.organizer.slice(0, 10)}...</td>
                      <td className="py-2">{meeting.requiredStake} ETH</td>
                      <td className="py-2">{meeting.totalStaked} ETH</td>
                      <td className="py-2">{meeting.startTime.toLocaleString()}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          meeting.isSettled ? 'bg-gray-600' : 'bg-green-600'
                        }`}>
                          {meeting.isSettled ? 'Settled' : 'Active'}
                        </span>
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => checkUserStake(meeting.meetingId)}
                          className="text-blue-400 hover:underline text-sm"
                        >
                          Check My Stake
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Stakers List */}
            {stakers.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Stakers for Selected Meeting</h3>
                <div className="bg-gray-700 rounded p-4">
                  {stakers.map((staker, i) => (
                    <div key={i} className="font-mono text-sm">
                      {staker}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">How to Use</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Go to the Chat tab and create a meeting with stakes (e.g., "Schedule meeting with John tomorrow at 3pm, stake 0.01 ETH")</li>
            <li>Copy the meeting ID from the success message</li>
            <li>Paste the meeting ID above and click "Check Meeting"</li>
            <li>You'll see all the blockchain data for that meeting</li>
          </ol>
        </div>
      </div>
    </div>
  );
}