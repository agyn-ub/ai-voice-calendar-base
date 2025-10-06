'use client';

import { 
  useContractWrite, 
  useContractRead, 
  useWaitForTransaction,
  usePrepareContractWrite,
  useAccount 
} from 'wagmi';
import { parseEther } from 'viem';
import { contractConfig } from '@/lib/web3/contract';
import { toast } from 'react-hot-toast';

// Hook for creating a meeting
export function useCreateMeeting() {
  const { config } = usePrepareContractWrite({
    ...contractConfig,
    functionName: 'createMeeting',
  });

  const { data, write, isLoading, isError, error } = useContractWrite(config);
  
  const { isLoading: isWaiting, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  return {
    createMeeting: write,
    isLoading: isLoading || isWaiting,
    isSuccess,
    isError,
    error,
    txHash: data?.hash,
  };
}

// Hook for staking on a meeting
export function useStakeForMeeting(meetingId: string, stakeAmount: string) {
  const { config } = usePrepareContractWrite({
    ...contractConfig,
    functionName: 'stake',
    args: [meetingId],
    value: parseEther(stakeAmount || '0'),
    enabled: !!meetingId && !!stakeAmount,
  });

  const { data, write, isLoading, isError, error } = useContractWrite(config);
  
  const { isLoading: isWaiting, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
    onSuccess() {
      toast.success('Successfully staked for the meeting!');
    },
    onError() {
      toast.error('Failed to stake for the meeting');
    },
  });

  return {
    stake: write,
    isLoading: isLoading || isWaiting,
    isSuccess,
    isError,
    error,
    txHash: data?.hash,
  };
}

// Hook for generating attendance code
export function useGenerateAttendanceCode() {
  const { config } = usePrepareContractWrite({
    ...contractConfig,
    functionName: 'generateAttendanceCode',
  });

  const { data, write, isLoading, isError, error } = useContractWrite(config);
  
  const { isLoading: isWaiting, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  return {
    generateCode: write,
    isLoading: isLoading || isWaiting,
    isSuccess,
    isError,
    error,
    txHash: data?.hash,
  };
}

// Hook for submitting attendance code
export function useSubmitAttendanceCode(meetingId: string) {
  const { config } = usePrepareContractWrite({
    ...contractConfig,
    functionName: 'submitAttendanceCode',
    enabled: !!meetingId,
  });

  const { data, write, isLoading, isError, error } = useContractWrite(config);
  
  const { isLoading: isWaiting, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
    onSuccess() {
      toast.success('Attendance confirmed!');
    },
    onError() {
      toast.error('Failed to confirm attendance');
    },
  });

  return {
    submitCode: write,
    isLoading: isLoading || isWaiting,
    isSuccess,
    isError,
    error,
    txHash: data?.hash,
  };
}

// Hook for settling a meeting
export function useSettleMeeting(meetingId: string) {
  const { config } = usePrepareContractWrite({
    ...contractConfig,
    functionName: 'settleMeeting',
    args: [meetingId],
    enabled: !!meetingId,
  });

  const { data, write, isLoading, isError, error } = useContractWrite(config);
  
  const { isLoading: isWaiting, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
    onSuccess() {
      toast.success('Meeting settled successfully!');
    },
    onError() {
      toast.error('Failed to settle meeting');
    },
  });

  return {
    settleMeeting: write,
    isLoading: isLoading || isWaiting,
    isSuccess,
    isError,
    error,
    txHash: data?.hash,
  };
}

// Hook for reading meeting info
export function useMeetingInfo(meetingId: string) {
  const { data, isError, isLoading, refetch } = useContractRead({
    ...contractConfig,
    functionName: 'getMeetingInfo',
    args: [meetingId],
    enabled: !!meetingId,
  });

  return {
    meetingInfo: data,
    isLoading,
    isError,
    refetch,
  };
}

// Hook for reading stake info
export function useStakeInfo(meetingId: string, address?: string) {
  const { address: connectedAddress } = useAccount();
  const stakerAddress = address || connectedAddress;

  const { data, isError, isLoading, refetch } = useContractRead({
    ...contractConfig,
    functionName: 'getStakeInfo',
    args: [meetingId, stakerAddress],
    enabled: !!meetingId && !!stakerAddress,
  });

  return {
    stakeInfo: data,
    isLoading,
    isError,
    refetch,
  };
}

// Hook for checking if user has staked
export function useHasStaked(meetingId: string, address?: string) {
  const { address: connectedAddress } = useAccount();
  const stakerAddress = address || connectedAddress;

  const { data, isError, isLoading } = useContractRead({
    ...contractConfig,
    functionName: 'hasStaked',
    args: [meetingId, stakerAddress],
    enabled: !!meetingId && !!stakerAddress,
  });

  return {
    hasStaked: data as boolean | undefined,
    isLoading,
    isError,
  };
}

// Hook for getting all stakers
export function useMeetingStakers(meetingId: string) {
  const { data, isError, isLoading, refetch } = useContractRead({
    ...contractConfig,
    functionName: 'getMeetingStakers',
    args: [meetingId],
    enabled: !!meetingId,
  });

  return {
    stakers: data as string[] | undefined,
    isLoading,
    isError,
    refetch,
  };
}