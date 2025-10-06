'use client';

import { 
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusAction,
  TransactionStatusLabel
} from '@coinbase/onchainkit/transaction';
import { parseEther } from 'viem';
import { CONTRACT_ADDRESSES, CURRENT_NETWORK } from '@/lib/ethereum/config';
import MeetingStakeABI from '@/lib/contracts/MeetingStake.json';

interface CreateMeetingTransactionProps {
  meetingId: string;
  eventId: string;
  requiredStake: string;
  startTime: Date;
  endTime: Date;
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
  children?: React.ReactNode;
}

export function CreateMeetingTransaction({ 
  meetingId,
  eventId,
  requiredStake,
  startTime,
  endTime,
  onSuccess,
  onError,
  children
}: CreateMeetingTransactionProps) {
  const contractAddress = CONTRACT_ADDRESSES[CURRENT_NETWORK].meetingStake;

  if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
    return (
      <div className="text-yellow-400 text-sm bg-yellow-900/20 p-3 rounded-lg">
        ⚠️ Smart contract not deployed yet. Meeting will be created off-chain only.
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contracts: any = [
    {
      address: contractAddress as `0x${string}`,
      abi: MeetingStakeABI,
      functionName: 'createMeeting',
      args: [
        meetingId,
        eventId,
        parseEther(requiredStake),
        BigInt(Math.floor(startTime.getTime() / 1000)),
        BigInt(Math.floor(endTime.getTime() / 1000))
      ],
    },
  ];

  const handleError = (e: { name?: string; message?: string }) => {
    const error = new Error(e.message || 'Transaction failed');
    console.error('Transaction error:', error);
    onError?.(error);
  };

  const handleSuccess = (response: { transactionReceipts?: Array<{ transactionHash: string }> }) => {
    console.log('Transaction success:', response);
    if (response?.transactionReceipts?.[0]?.transactionHash) {
      onSuccess?.(response.transactionReceipts[0].transactionHash);
    }
  };

  return (
    <Transaction
      calls={contracts}
      onError={handleError}
      onSuccess={handleSuccess}
      className="w-full"
    >
      {children || (
        <TransactionButton 
          text={`Create Meeting with ${requiredStake} ETH Stake`}
          className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-semibold transition-all"
        />
      )}
      <TransactionStatus>
        <TransactionStatusLabel />
        <TransactionStatusAction />
      </TransactionStatus>
    </Transaction>
  );
}