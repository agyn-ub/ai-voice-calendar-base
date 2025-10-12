# Testing Meeting Staking on Anvil

This guide explains how to test the complete meeting staking flow when a user says something like:
> "Schedule an event with Agyn tomorrow 2:30 am, stake 0.01 ETH"

## Prerequisites

1. **Anvil Running**: Make sure Anvil is running on port 8545
   ```bash
   anvil
   ```

2. **Contract Deployed**: The MeetingStake contract should be deployed at:
   ```
   0x5FbDB2315678afecb367f032d93F642f64180aa3
   ```

3. **MetaMask Setup**:
   - Add Localhost 8545 network to MetaMask
   - Import one of Anvil's test accounts (see below)

## Anvil Test Accounts

Import one of these private keys into MetaMask (each has 10,000 ETH):

```
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

Account #2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
Private Key: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
```

## Step-by-Step Testing Flow

### 1. Using the Debug Page

Navigate to: http://localhost:3000/debug/staking

#### Quick Test:
1. Click "Generate IDs" to auto-generate meeting and event IDs
2. Ensure stake amount is set (default: 0.01 ETH)
3. Click "Create Meeting"
4. Watch the console for transaction details
5. Meeting will be automatically verified after creation

### 2. Via Chat Interface

1. Connect your wallet (with imported Anvil account)
2. Type in chat: "Schedule an event with Agyn tomorrow 2:30 am, stake 0.01 ETH"
3. The system will:
   - Parse the natural language
   - Create a meeting ID
   - Send blockchain transaction via MetaMask
   - Store in database
   - Send invitation emails

### 3. Verify on Blockchain

#### Using Node.js Script:
```bash
node scripts/verify-anvil-meeting.js "meeting-1234567890-abc123xyz"
```

This will show:
- Meeting details (ID, organizer, stake amount, times)
- List of stakers
- Recent blockchain events
- Transaction hashes

#### Using Cast (Foundry):
```bash
# Get meeting info
cast call 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  "getMeetingInfo(string)" "meeting-1234567890-abc123xyz" \
  --rpc-url http://127.0.0.1:8545

# Get stakers
cast call 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  "getMeetingStakers(string)" "meeting-1234567890-abc123xyz" \
  --rpc-url http://127.0.0.1:8545
```

#### Using API Endpoint:
```bash
curl -X POST http://localhost:3000/api/staking/verify-blockchain \
  -H "Content-Type: application/json" \
  -d '{"meetingId": "meeting-1234567890-abc123xyz"}'
```

### 4. Monitor in Real-Time

On the debug page:
1. Click "Start Monitoring" to enable real-time updates
2. The page will poll every 2 seconds showing:
   - Current block number
   - Meeting status updates
   - Stake amounts

## What Happens Behind the Scenes

When you create a staking meeting:

1. **Natural Language Processing**:
   - OpenAI parses the message
   - Extracts: participants, time, stake amount
   - Resolves contact names to emails

2. **Blockchain Transaction**:
   - Creates meeting on smart contract
   - Sets required stake amount
   - Defines start/end times
   - Emits MeetingCreated event

3. **Database Storage**:
   - Stores in `pending_meetings` table
   - Links wallet address to meeting
   - Saves event details

4. **Email Invitations**:
   - Generates unique invitation tokens
   - Sends stake invitation emails
   - Includes meeting details and stake amount

## Console Logs to Watch

Look for these prefixes in browser console:

- `[UnifiedCalendarChat]` - Chat processing and blockchain calls
- `[MeetingStakeContract]` - Smart contract interactions
- `[StakingInterface]` - UI stake operations
- `[StakingVerify]` - Verification API calls
- `[Debug]` - Debug page operations

Example successful flow:
```
[UnifiedCalendarChat] Creating meeting on blockchain...
[UnifiedCalendarChat] Meeting ID: meeting-1737066249725-abc123xyz
[MeetingStakeContract] createMeeting called with: {meetingId: "...", requiredStake: "0.01", ...}
[MeetingStakeContract] Transaction sent: 0x123abc...
[MeetingStakeContract] Transaction confirmed: {blockNumber: 42, ...}
[MeetingStakeContract] ✅ Meeting verified on blockchain
```

## Troubleshooting

### Meeting Not Found on Blockchain
- Check if transaction was confirmed in MetaMask
- Verify Anvil is running
- Ensure contract is deployed at correct address
- Check wallet has ETH for gas

### Transaction Fails
- Make sure MetaMask is on Localhost:8545 network
- Verify you have ETH in account (import Anvil account)
- Check contract address matches environment variable

### Verification Script Errors
- Ensure meeting ID is correct (case-sensitive)
- Check Anvil is accessible at http://127.0.0.1:8545
- Verify ethers.js is installed: `npm install ethers`

## Testing Different Scenarios

### Test Multiple Stakers
1. Create meeting with Account #0
2. Switch to Account #1 in MetaMask
3. Stake for the same meeting
4. Verify both stakes appear

### Test Attendance Flow
1. Create and stake for meeting
2. Wait for meeting start time
3. Generate attendance code (organizer)
4. Submit code (attendees)
5. Settle meeting after deadline

### Test Edge Cases
- Create meeting with 0 ETH stake
- Try staking more than required
- Attempt double-staking with same account
- Create meeting with past timestamps

## Useful Commands

```bash
# Watch Anvil logs in real-time
anvil --block-time 1  # Mine new block every second

# Reset Anvil state
anvil --fork-url <RPC_URL>  # Or just restart anvil

# Check all meetings in database
psql $DATABASE_URL -c "SELECT id, organizer_wallet, stake_amount FROM pending_meetings;"

# Monitor contract events
cast events --address 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  --from-block 0 --rpc-url http://127.0.0.1:8545
```