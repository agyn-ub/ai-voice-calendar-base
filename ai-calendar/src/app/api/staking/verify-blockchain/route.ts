import { NextRequest, NextResponse } from 'next/server';
import { MeetingStakeContract } from '@/lib/ethereum/meetingStakeContract';
import { postgresPendingMeetingsDb } from '@/lib/db/postgresPendingMeetings';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, CURRENT_NETWORK, NETWORK_CONFIG } from '@/lib/ethereum/config';
import { MEETING_STAKE_ABI } from '@/lib/contracts/MeetingStakeABI';

interface VerifyRequest {
  meetingId: string;
  walletAddress?: string;
}

export async function POST(request: NextRequest) {
  console.log('[StakingVerify] Verification request received');
  
  try {
    const body: VerifyRequest = await request.json();
    const { meetingId, walletAddress } = body;

    if (!meetingId) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      );
    }

    console.log('[StakingVerify] Checking meeting:', meetingId);

    // First check database
    const dbMeeting = await postgresPendingMeetingsDb.getPendingMeeting(meetingId);
    console.log('[StakingVerify] Database status:', {
      exists: !!dbMeeting,
      status: dbMeeting?.status,
      googleEventId: dbMeeting?.google_event_id
    });

    // Then check blockchain using provider (doesn't require wallet connection)
    const provider = new ethers.JsonRpcProvider(NETWORK_CONFIG[CURRENT_NETWORK].rpcUrl);
    const contractAddress = CONTRACT_ADDRESSES[CURRENT_NETWORK].meetingStake;
    

    const contract = new ethers.Contract(contractAddress, MEETING_STAKE_ABI, provider);

    let blockchainData = null;
    let userHasStaked = false;
    let stakers: string[] = [];

    try {
      const info = await contract.getMeetingInfo(meetingId);
      
      // Check if meeting exists (organizer is not zero address)
      if (info.organizer !== '0x0000000000000000000000000000000000000000') {
        blockchainData = {
          meetingId: info.meetingId,
          eventId: info.eventId,
          organizer: info.organizer,
          requiredStake: ethers.formatEther(info.requiredStake),
          startTime: new Date(Number(info.startTime) * 1000).toISOString(),
          endTime: new Date(Number(info.endTime) * 1000).toISOString(),
          checkInDeadline: new Date(Number(info.checkInDeadline) * 1000).toISOString(),
          hasAttendanceCode: info.attendanceCode !== '',
          isSettled: info.isSettled,
          totalStaked: ethers.formatEther(info.totalStaked),
          totalRefunded: ethers.formatEther(info.totalRefunded),
          totalForfeited: ethers.formatEther(info.totalForfeited)
        };

        // Get stakers list
        stakers = await contract.getMeetingStakers(meetingId);
        console.log('[StakingVerify] Stakers:', stakers);

        // Check if specific wallet has staked
        if (walletAddress) {
          userHasStaked = await contract.hasStaked(meetingId, walletAddress);
        }
      }
    } catch (error) {
      console.error('[StakingVerify] Blockchain query error:', error);
    }

    const response = {
      meetingId,
      database: {
        exists: !!dbMeeting,
        status: dbMeeting?.status,
        stakeAmount: dbMeeting?.stake_amount,
        organizerWallet: dbMeeting?.organizer_wallet,
        googleEventId: dbMeeting?.google_event_id,
        createdAt: dbMeeting?.created_at
      },
      blockchain: {
        exists: !!blockchainData,
        network: CURRENT_NETWORK,
        contractAddress,
        explorerUrl: NETWORK_CONFIG[CURRENT_NETWORK].explorerUrl 
          ? `${NETWORK_CONFIG[CURRENT_NETWORK].explorerUrl}/address/${contractAddress}` 
          : null,
        data: blockchainData,
        stakers: stakers,
        userHasStaked: walletAddress ? userHasStaked : null
      },
      summary: {
        isFullySetup: !!dbMeeting && !!blockchainData,
        issues: []
      }
    };

    // Identify any issues
    if (!dbMeeting) {
      response.summary.issues.push('Meeting not found in database');
    }
    if (!blockchainData) {
      response.summary.issues.push('Meeting not found on blockchain');
    }
    if (dbMeeting && !dbMeeting.google_event_id) {
      response.summary.issues.push('Google Calendar event not created yet');
    }
    if (blockchainData && Number(blockchainData.totalStaked) === 0) {
      response.summary.issues.push('No one has staked yet');
    }

    console.log('[StakingVerify] Verification complete:', {
      meetingId,
      dbExists: !!dbMeeting,
      blockchainExists: !!blockchainData,
      issues: response.summary.issues
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('[StakingVerify] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify meeting status' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const meetingId = searchParams.get('meetingId');
  
  if (!meetingId) {
    return NextResponse.json(
      { error: 'Meeting ID is required' },
      { status: 400 }
    );
  }

  // Forward to POST handler
  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ meetingId }),
    headers: { 'Content-Type': 'application/json' }
  }));
}