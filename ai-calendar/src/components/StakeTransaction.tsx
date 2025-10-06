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

interface StakeTransactionProps {
  meetingId: string;
  stakeAmount: string;
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
}

export function StakeTransaction({ 
  meetingId, 
  stakeAmount,
  onSuccess,
  onError
}: StakeTransactionProps) {
  const contractAddress = CONTRACT_ADDRESSES[CURRENT_NETWORK].meetingStake;

  if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
    return (
      <div className="text-red-400 text-sm">
        Smart contract not deployed yet. Please deploy the contract first.
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contracts: any = [
    {
      address: contractAddress as `0x${string}`,
      abi: MeetingStakeABI,
      functionName: 'stake',
      args: [meetingId],
      value: parseEther(stakeAmount),
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
      <TransactionButton 
        text={`Stake ${stakeAmount} ETH`}
        className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold transition-all"
      />
      <TransactionStatus>
        <TransactionStatusLabel />
        <TransactionStatusAction />
      </TransactionStatus>
    </Transaction>
  );
}