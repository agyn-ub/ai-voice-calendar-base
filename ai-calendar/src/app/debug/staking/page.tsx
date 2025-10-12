'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { MeetingStakeContract } from '@/lib/ethereum/meetingStakeContract';
import { formatEther } from 'viem';
import toast, { Toaster } from 'react-hot-toast';

// Anvil test accounts (first 5)
const ANVIL_ACCOUNTS = [
  { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', key: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' },
  { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', key: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' },
  { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', key: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' },
  { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', key: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6' },
  { address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', key: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a' }
];

export default function StakingDebugPage() {
  const { address: walletAddress, isConnected } = useAccount();
  const [meetingId, setMeetingId] = useState('');
  const [eventId, setEventId] = useState('');
  const [stakeAmount, setStakeAmount] = useState('0.01');
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [blockchainInfo, setBlockchainInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [contractInstance, setContractInstance] = useState<MeetingStakeContract | null>(null);
  const [testFlow, setTestFlow] = useState<'idle' | 'creating' | 'verifying' | 'complete'>('idle');
  const [anvilBalance, setAnvilBalance] = useState<string>('0');
  const [blockNumber, setBlockNumber] = useState<number>(0);
  const [showAnvilInfo, setShowAnvilInfo] = useState(true);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setContractInstance(new MeetingStakeContract());
      // Fetch Anvil info if on local network
      if (process.env.NEXT_PUBLIC_NETWORK === 'local') {
        fetchAnvilInfo();
      }
    }
  }, [walletAddress]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isMonitoring && process.env.NEXT_PUBLIC_NETWORK === 'local') {
      // Poll every 2 seconds
      interval = setInterval(() => {
        fetchAnvilInfo();
        if (meetingId) {
          verifyMeeting(meetingId);
        }
      }, 2000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMonitoring, meetingId]);

  const fetchAnvilInfo = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8545', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 },
          walletAddress ? { jsonrpc: '2.0', method: 'eth_getBalance', params: [walletAddress, 'latest'], id: 2 } : null
        ].filter(Boolean))
      });
      
      const results = await response.json();
      if (Array.isArray(results)) {
        results.forEach(result => {
          if (result.id === 1 && result.result) {
            setBlockNumber(parseInt(result.result, 16));
          }
          if (result.id === 2 && result.result) {
            const wei = BigInt(result.result);
            setAnvilBalance(formatEther(wei));
          }
        });
      }
    } catch (error) {
      console.error('Failed to fetch Anvil info:', error);
    }
  };

  const generateTestMeetingId = () => {
    const id = `test-meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setMeetingId(id);
    setEventId(`event-${Date.now()}`);
    return id;
  };

  const createMeetingOnBlockchain = async () => {
    if (!contractInstance || !walletAddress) {
      toast.error('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setTestFlow('creating');
    
    try {
      const testMeetingId = meetingId || generateTestMeetingId();
      const testEventId = eventId || `event-${Date.now()}`;
      
      // Set times for a meeting starting in 1 hour
      const startTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const endTime = startTime + 3600; // 1 hour duration

      console.log('[Debug] Creating meeting with:', {
        meetingId: testMeetingId,
        eventId: testEventId,
        stakeAmount,
        startTime: new Date(startTime * 1000).toISOString(),
        endTime: new Date(endTime * 1000).toISOString()
      });

      const receipt = await contractInstance.createMeeting(
        testMeetingId,
        testEventId,
        stakeAmount,
        startTime,
        endTime
      );

      toast.success(`Meeting created! Tx: ${receipt.transactionHash.slice(0, 10)}...`);
      
      // Automatically verify after creation
      setTimeout(() => verifyMeeting(testMeetingId), 2000);
      
    } catch (error) {
      console.error('[Debug] Error creating meeting:', error);
      toast.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTestFlow('idle');
    } finally {
      setLoading(false);
    }
  };

  const verifyMeeting = async (meetingIdToVerify?: string) => {
    const id = meetingIdToVerify || meetingId;
    
    if (!id) {
      toast.error('Please enter a meeting ID');
      return;
    }

    setLoading(true);
    setTestFlow('verifying');
    
    try {
      // Call the verify API
      const response = await fetch('/api/staking/verify-blockchain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: id, walletAddress })
      });

      const data = await response.json();
      setVerificationResult(data);

      // Also get direct blockchain info if contract is available
      if (contractInstance) {
        try {
          const meetingInfo = await contractInstance.getMeetingInfo(id);
          setBlockchainInfo({
            raw: meetingInfo,
            formatted: {
              meetingId: meetingInfo.meetingId,
              organizer: meetingInfo.organizer,
              requiredStake: formatEther(meetingInfo.requiredStake),
              totalStaked: formatEther(meetingInfo.totalStaked),
              startTime: new Date(Number(meetingInfo.startTime) * 1000).toISOString(),
              endTime: new Date(Number(meetingInfo.endTime) * 1000).toISOString(),
              isSettled: meetingInfo.isSettled
            }
          });
        } catch (error) {
          console.error('[Debug] Direct blockchain query failed:', error);
        }
      }

      if (data.blockchain.exists) {
        toast.success('✅ Meeting verified on blockchain!');
        setTestFlow('complete');
      } else {
        toast.error('❌ Meeting not found on blockchain');
      }

    } catch (error) {
      console.error('[Debug] Verification error:', error);
      toast.error('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const stakeForMeeting = async () => {
    if (!contractInstance || !walletAddress || !meetingId) {
      toast.error('Please create a meeting first');
      return;
    }

    setLoading(true);
    
    try {
      const receipt = await contractInstance.stakeForMeeting(meetingId, stakeAmount);
      toast.success(`Staked successfully! Tx: ${receipt.transactionHash.slice(0, 10)}...`);
      
      // Re-verify to see updated state
      setTimeout(() => verifyMeeting(meetingId), 2000);
      
    } catch (error) {
      console.error('[Debug] Staking error:', error);
      toast.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <Toaster position="top-right" />
      
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Staking Debug Page</h1>
            <p className="text-gray-400">Test meeting creation and blockchain verification on {process.env.NEXT_PUBLIC_NETWORK === 'local' ? 'Anvil (Local)' : 'Base'}</p>
          </div>
          {process.env.NEXT_PUBLIC_NETWORK === 'local' && (
            <div className="flex items-center gap-4">
              <a
                href="/blockchain-explorer"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
              >
                🔍 Open Blockchain Explorer
              </a>
              <div className="text-right">
                <p className="text-sm text-gray-400">Anvil Block #{blockNumber}</p>
                <button
                  onClick={fetchAnvilInfo}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Refresh
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Connection Status */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-xl font-semibold mb-2">Wallet Status</h2>
          {isConnected ? (
            <div className="space-y-1">
              <p className="text-green-400">✅ Connected</p>
              <p className="text-sm font-mono text-gray-400">{walletAddress}</p>
              {process.env.NEXT_PUBLIC_NETWORK === 'local' && (
                <p className="text-sm text-gray-300">Balance: {anvilBalance} ETH</p>
              )}
            </div>
          ) : (
            <p className="text-red-400">❌ Not connected - Please connect your wallet</p>
          )}
        </div>

        {/* Anvil Test Accounts */}
        {process.env.NEXT_PUBLIC_NETWORK === 'local' && showAnvilInfo && (
          <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
            <div className="flex justify-between items-start mb-3">
              <h2 className="text-lg font-semibold text-blue-400">🧪 Anvil Test Accounts</h2>
              <button
                onClick={() => setShowAnvilInfo(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-3">Import these into MetaMask for testing:</p>
            <div className="space-y-2">
              {ANVIL_ACCOUNTS.slice(0, 3).map((account, i) => (
                <div key={i} className="bg-gray-900 rounded p-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Account #{i}:</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(account.key);
                        toast.success(`Private key ${i} copied!`);
                      }}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      Copy Private Key
                    </button>
                  </div>
                  <p className="font-mono text-gray-300 mt-1">{account.address}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Each account has 10,000 ETH for testing
            </p>
          </div>
        )}

        {/* Test Flow Status */}
        {testFlow !== 'idle' && (
          <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
            <h3 className="text-blue-400 font-semibold mb-2">Test Flow Progress</h3>
            <div className="flex gap-4">
              <div className={`text-sm ${testFlow === 'creating' ? 'text-yellow-400' : testFlow === 'complete' ? 'text-green-400' : 'text-gray-400'}`}>
                {testFlow === 'creating' && '⏳'} Creating Meeting
              </div>
              <div className={`text-sm ${testFlow === 'verifying' ? 'text-yellow-400' : testFlow === 'complete' ? 'text-green-400' : 'text-gray-400'}`}>
                {testFlow === 'verifying' && '⏳'} Verifying
              </div>
              <div className={`text-sm ${testFlow === 'complete' ? 'text-green-400' : 'text-gray-400'}`}>
                {testFlow === 'complete' && '✅'} Complete
              </div>
            </div>
          </div>
        )}

        {/* Meeting Creation */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-4">
          <h2 className="text-xl font-semibold">1. Create Meeting on Blockchain</h2>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Meeting ID</label>
              <input
                type="text"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                placeholder="auto-generate"
                className="w-full px-3 py-2 bg-gray-900 rounded border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Event ID</label>
              <input
                type="text"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                placeholder="auto-generate"
                className="w-full px-3 py-2 bg-gray-900 rounded border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Stake Amount (ETH)</label>
              <input
                type="text"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 rounded border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={createMeetingOnBlockchain}
              disabled={loading || !isConnected}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && testFlow === 'creating' ? 'Creating...' : 'Create Meeting'}
            </button>
            <button
              onClick={() => generateTestMeetingId()}
              className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
            >
              Generate IDs
            </button>
          </div>
        </div>

        {/* Verification */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-4">
          <h2 className="text-xl font-semibold">2. Verify Meeting</h2>
          
          <div className="flex gap-4">
            <input
              type="text"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
              placeholder="Enter meeting ID"
              className="flex-1 px-3 py-2 bg-gray-900 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={() => verifyMeeting()}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading && testFlow === 'verifying' ? 'Verifying...' : 'Verify'}
            </button>
          </div>

          {verificationResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className={`p-3 rounded ${verificationResult.summary.isFullySetup ? 'bg-green-900/20 border border-green-600' : 'bg-red-900/20 border border-red-600'}`}>
                <p className="font-semibold mb-1">
                  {verificationResult.summary.isFullySetup ? '✅ Meeting fully setup' : '⚠️ Setup incomplete'}
                </p>
                {verificationResult.summary.issues.length > 0 && (
                  <ul className="text-sm text-yellow-400 space-y-1">
                    {verificationResult.summary.issues.map((issue: string, i: number) => (
                      <li key={i}>• {issue}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Database Status */}
              <div className="bg-gray-900 rounded p-3">
                <h3 className="font-semibold text-sm mb-2">📊 Database Status</h3>
                <pre className="text-xs text-gray-400 overflow-x-auto">
                  {JSON.stringify(verificationResult.database, null, 2)}
                </pre>
              </div>

              {/* Blockchain Status */}
              <div className="bg-gray-900 rounded p-3">
                <h3 className="font-semibold text-sm mb-2">⛓️ Blockchain Status</h3>
                <pre className="text-xs text-gray-400 overflow-x-auto">
                  {JSON.stringify(verificationResult.blockchain, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Staking */}
        {blockchainInfo && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-4">
            <h2 className="text-xl font-semibold">3. Stake for Meeting</h2>
            
            <div className="bg-gray-900 rounded p-3">
              <p className="text-sm text-gray-400 mb-1">Required Stake: {blockchainInfo.formatted.requiredStake} ETH</p>
              <p className="text-sm text-gray-400">Total Staked: {blockchainInfo.formatted.totalStaked} ETH</p>
            </div>

            <button
              onClick={stakeForMeeting}
              disabled={loading || !isConnected}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? 'Staking...' : `Stake ${stakeAmount} ETH`}
            </button>
          </div>
        )}

        {/* Raw Blockchain Data */}
        {blockchainInfo && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h2 className="text-xl font-semibold mb-2">Raw Blockchain Data</h2>
            <pre className="text-xs text-gray-400 overflow-x-auto bg-gray-900 rounded p-3">
              {JSON.stringify(blockchainInfo.formatted, null, 2)}
            </pre>
          </div>
        )}

        {/* Real-Time Monitoring */}
        {process.env.NEXT_PUBLIC_NETWORK === 'local' && (
          <div className="bg-purple-900/20 border border-purple-600 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-purple-400">📡 Real-Time Monitoring</h2>
              <button
                onClick={() => setIsMonitoring(!isMonitoring)}
                className={`px-3 py-1 rounded text-sm ${
                  isMonitoring 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
              </button>
            </div>
            
            {isMonitoring && (
              <div className="space-y-2">
                <p className="text-sm text-gray-400">
                  🔄 Auto-refreshing every 2 seconds...
                </p>
                <div className="bg-gray-900 rounded p-2">
                  <p className="text-xs text-gray-400">Current Block: #{blockNumber}</p>
                  {meetingId && (
                    <p className="text-xs text-gray-400">Monitoring Meeting: {meetingId}</p>
                  )}
                </div>
              </div>
            )}
            
            {!isMonitoring && (
              <p className="text-sm text-gray-400">
                Click "Start Monitoring" to poll blockchain every 2 seconds
              </p>
            )}
          </div>
        )}

        {/* Verification Commands */}
        {meetingId && process.env.NEXT_PUBLIC_NETWORK === 'local' && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-3">
            <h2 className="text-xl font-semibold">🔍 Manual Verification Commands</h2>
            <p className="text-sm text-gray-400">Run these commands to manually verify on Anvil:</p>
            
            <div className="space-y-3">
              <div className="bg-gray-900 rounded p-3">
                <p className="text-xs text-gray-400 mb-1">Using Node.js script:</p>
                <code className="text-xs text-green-400 font-mono block">
                  node scripts/verify-anvil-meeting.js "{meetingId}"
                </code>
              </div>

              <div className="bg-gray-900 rounded p-3">
                <p className="text-xs text-gray-400 mb-1">Using cast (Foundry):</p>
                <code className="text-xs text-green-400 font-mono block">
                  cast call 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
                  "getMeetingInfo(string)(string,string,address,uint256,uint256,uint256,uint256,string,uint256,bool,uint256,uint256,uint256)" \
                  "{meetingId}" --rpc-url http://127.0.0.1:8545
                </code>
              </div>

              <div className="bg-gray-900 rounded p-3">
                <p className="text-xs text-gray-400 mb-1">Check contract logs:</p>
                <code className="text-xs text-green-400 font-mono block">
                  cast logs --from-block 0 --address 0x5FbDB2315678afecb367f032d93F642f64180aa3 --rpc-url http://127.0.0.1:8545
                </code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}