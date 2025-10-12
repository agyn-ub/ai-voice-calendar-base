#!/usr/bin/env node

/**
 * Script to verify meeting creation on Anvil blockchain
 * Usage: node scripts/verify-anvil-meeting.js <meetingId>
 */

const { ethers } = require('ethers');

// Anvil RPC URL
const ANVIL_RPC = 'http://127.0.0.1:8545';

// Contract address (from .env.local)
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

// Simplified ABI for reading
const ABI = [
  'function getMeetingInfo(string meetingId) view returns (tuple(string meetingId, string eventId, address organizer, uint256 requiredStake, uint256 startTime, uint256 endTime, uint256 checkInDeadline, string attendanceCode, uint256 codeValidUntil, bool isSettled, uint256 totalStaked, uint256 totalRefunded, uint256 totalForfeited))',
  'function getMeetingStakers(string meetingId) view returns (address[])',
  'function hasStaked(string meetingId, address staker) view returns (bool)',
  'event MeetingCreated(string indexed meetingId, address indexed organizer, uint256 requiredStake, uint256 startTime, uint256 endTime)',
  'event StakeDeposited(string indexed meetingId, address indexed staker, uint256 amount)'
];

async function verifyMeeting(meetingId) {
  console.log('='.repeat(60));
  console.log('🔍 ANVIL BLOCKCHAIN VERIFICATION');
  console.log('='.repeat(60));
  console.log(`Meeting ID: ${meetingId}`);
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`RPC: ${ANVIL_RPC}`);
  console.log('-'.repeat(60));

  try {
    // Connect to Anvil
    const provider = new ethers.JsonRpcProvider(ANVIL_RPC);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    // Get current block
    const blockNumber = await provider.getBlockNumber();
    console.log(`\n📦 Current Block: ${blockNumber}`);

    // Get meeting info
    console.log('\n📄 Fetching meeting info...');
    const meetingInfo = await contract.getMeetingInfo(meetingId);
    
    // Check if meeting exists (organizer is not zero address)
    if (meetingInfo.organizer === '0x0000000000000000000000000000000000000000') {
      console.log('\n❌ Meeting NOT found on blockchain!');
      console.log('This meeting has not been created yet.');
      return;
    }

    console.log('\n✅ Meeting FOUND on blockchain!');
    console.log('\n📊 Meeting Details:');
    console.log(`  • Meeting ID: ${meetingInfo.meetingId}`);
    console.log(`  • Event ID: ${meetingInfo.eventId}`);
    console.log(`  • Organizer: ${meetingInfo.organizer}`);
    console.log(`  • Required Stake: ${ethers.formatEther(meetingInfo.requiredStake)} ETH`);
    console.log(`  • Start Time: ${new Date(Number(meetingInfo.startTime) * 1000).toLocaleString()}`);
    console.log(`  • End Time: ${new Date(Number(meetingInfo.endTime) * 1000).toLocaleString()}`);
    console.log(`  • Check-in Deadline: ${new Date(Number(meetingInfo.checkInDeadline) * 1000).toLocaleString()}`);
    console.log(`  • Total Staked: ${ethers.formatEther(meetingInfo.totalStaked)} ETH`);
    console.log(`  • Is Settled: ${meetingInfo.isSettled}`);
    console.log(`  • Has Attendance Code: ${meetingInfo.attendanceCode !== ''}`);

    // Get stakers
    console.log('\n👥 Fetching stakers...');
    const stakers = await contract.getMeetingStakers(meetingId);
    
    if (stakers.length > 0) {
      console.log(`Found ${stakers.length} staker(s):`);
      for (const staker of stakers) {
        console.log(`  • ${staker}`);
      }
    } else {
      console.log('No stakers yet.');
    }

    // Query recent events
    console.log('\n📜 Querying recent events...');
    
    // Get MeetingCreated events
    const createdFilter = contract.filters.MeetingCreated(meetingId);
    const createdEvents = await contract.queryFilter(createdFilter, -100); // Last 100 blocks
    
    if (createdEvents.length > 0) {
      console.log(`\nFound ${createdEvents.length} MeetingCreated event(s):`);
      for (const event of createdEvents) {
        console.log(`  • Block ${event.blockNumber}: Organizer ${event.args[1]}`);
        console.log(`    Stake: ${ethers.formatEther(event.args[2])} ETH`);
        console.log(`    Tx Hash: ${event.transactionHash}`);
      }
    }

    // Get StakeDeposited events
    const stakeFilter = contract.filters.StakeDeposited(meetingId);
    const stakeEvents = await contract.queryFilter(stakeFilter, -100);
    
    if (stakeEvents.length > 0) {
      console.log(`\nFound ${stakeEvents.length} StakeDeposited event(s):`);
      for (const event of stakeEvents) {
        console.log(`  • Block ${event.blockNumber}: Staker ${event.args[1]}`);
        console.log(`    Amount: ${ethers.formatEther(event.args[2])} ETH`);
        console.log(`    Tx Hash: ${event.transactionHash}`);
      }
    } else {
      console.log('\nNo stake events found yet.');
    }

    // Get organizer balance
    const balance = await provider.getBalance(meetingInfo.organizer);
    console.log(`\n💰 Organizer Balance: ${ethers.formatEther(balance)} ETH`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Verification complete!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('invalid BigNumber string')) {
      console.log('\n💡 Tip: This usually means the meeting doesn\'t exist on the blockchain.');
    }
  }
}

// Get meeting ID from command line
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node scripts/verify-anvil-meeting.js <meetingId>');
  console.log('\nExample meeting IDs to try:');
  console.log('  • meeting-1234567890-abc123xyz');
  console.log('  • test-meeting-1234567890-abc123xyz');
  process.exit(1);
}

const meetingId = args[0];
verifyMeeting(meetingId).catch(console.error);