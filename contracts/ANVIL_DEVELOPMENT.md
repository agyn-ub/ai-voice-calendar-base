# Anvil Local Development Guide

This guide covers local blockchain development using Anvil (Foundry's local Ethereum node) for testing the MeetingStake smart contract.

## Table of Contents
- [Quick Start](#quick-start)
- [Test Accounts](#test-accounts)
- [MetaMask Setup](#metamask-setup)
- [Development Workflow](#development-workflow)
- [Testing Scenarios](#testing-scenarios)
- [Time Manipulation](#time-manipulation)
- [Troubleshooting](#troubleshooting)

## Quick Start

### 1. Start Anvil
```bash
# Start Anvil with default settings
anvil


# Or with custom settings for more consistency
anvil --accounts 10 --balance 10000 --block-time 1 --host 0.0.0.0
```

**Default Configuration:**
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- 10 accounts with 10,000 ETH each
- Auto-mining enabled

### 2. Deploy Contracts
```bash
# In a new terminal, deploy to Anvil
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# Note the deployed contract address from output
# Example: MeetingStake deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### 3. Run Tests Locally
```bash
# Run all tests against Anvil
forge test --rpc-url http://127.0.0.1:8545

# Run with gas report
forge test --gas-report

# Run specific test
forge test --match-test testCreateMeeting
```

## Test Accounts

Anvil provides deterministic accounts that are the same every time you start it:

### Available Accounts with 10,000 ETH each:

| Account | Address | Private Key |
|---------|---------|-------------|
| Account #0 (Organizer) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| Account #1 (Attendee 1) | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| Account #2 (Attendee 2) | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| Account #3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |
| Account #4 | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a` |

**⚠️ Security Note:** These private keys are publicly known and should ONLY be used for local development. Never send real funds to these addresses on any real network!

## MetaMask Setup

### Adding Anvil Network to MetaMask

1. Open MetaMask
2. Click the network dropdown
3. Click "Add Network" → "Add a network manually"
4. Enter the following details:

| Field | Value |
|-------|-------|
| Network Name | `Anvil Local` |
| New RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency Symbol | `ETH` |
| Block Explorer URL | (leave blank) |

5. Click "Save"

### Importing Test Accounts

1. Click the account icon in MetaMask
2. Select "Import Account"
3. Choose "Private Key" as the type
4. Paste one of the private keys from the table above
5. Click "Import"

**Recommended Setup for Testing:**
- Import Account #0 as "Organizer"
- Import Account #1 as "Attendee 1"
- Import Account #2 as "Attendee 2"

## Development Workflow

### Standard Development Cycle

```bash
# Terminal 1: Keep Anvil running
anvil

# Terminal 2: Deploy and watch for changes
forge build --watch

# Terminal 3: Run your Next.js app
npm run dev
```

### Environment Variables (.env)
```env
# For local Anvil development
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337

# Contract address (update after deployment)
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_CHAIN_ID=31337
```

### Resetting State

To reset the blockchain state:
```bash
# Stop Anvil (Ctrl+C)
# Start it again
anvil

# Redeploy contracts
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

## Testing Scenarios

### Complete Meeting Lifecycle Test

```javascript
// 1. Create Meeting (as Organizer - Account #0)
const meetingId = "test-meeting-001";
await contract.createMeeting(
    meetingId,
    "event-001",
    ethers.parseEther("0.01"),  // 0.01 ETH stake
    Math.floor(Date.now() / 1000) + 3600,  // Start in 1 hour
    Math.floor(Date.now() / 1000) + 7200   // End in 2 hours
);

// 2. Stake (as Attendees - Switch accounts in MetaMask)
await contract.stake(meetingId, { 
    value: ethers.parseEther("0.01") 
});

// 3. Fast-forward time to meeting start (see Time Manipulation)

// 4. Generate Attendance Code (as Organizer)
await contract.generateAttendanceCode(meetingId, "SECRET123");

// 5. Submit Code (as Attendees)
await contract.submitAttendanceCode(meetingId, "SECRET123");

// 6. Fast-forward past check-in deadline

// 7. Settle Meeting (anyone can call)
await contract.settleMeeting(meetingId);
```

### Multi-User Testing

**Option 1: Multiple Browser Profiles**
1. Open Chrome/Brave with different profiles
2. Each profile has MetaMask with different test account
3. Test interactions between users

**Option 2: Account Switching**
1. Use MetaMask account switcher
2. Perform actions as different users
3. Note: Need to refresh page after switching

## Time Manipulation

Anvil allows you to manipulate blockchain time for testing time-dependent functions:

### Skip Time Forward
```bash
# Skip ahead 2 hours (7200 seconds)
cast rpc evm_increaseTime 7200 --rpc-url http://127.0.0.1:8545

# Mine a block to apply the time change
cast rpc evm_mine --rpc-url http://127.0.0.1:8545
```

### JavaScript Helper Functions
```javascript
// Add to your test utils
async function skipTime(seconds) {
    await fetch("http://127.0.0.1:8545", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [seconds],
            id: 1
        })
    });
    
    // Mine a block
    await fetch("http://127.0.0.1:8545", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "evm_mine",
            params: [],
            id: 2
        })
    });
}

// Usage
await skipTime(3600); // Skip 1 hour
```

### Testing Time-Dependent Functions
```javascript
// Test staking deadline
await skipTime(3000); // Skip 50 minutes (still can stake)
await contract.stake(meetingId, { value: stake }); // ✅ Works

await skipTime(1800); // Skip another 30 minutes (past deadline)
await contract.stake(meetingId, { value: stake }); // ❌ Fails: "Staking deadline passed"
```

## Troubleshooting

### Common Issues and Solutions

#### 1. MetaMask Connection Issues
**Problem:** MetaMask can't connect to Anvil
**Solution:** 
- Ensure Anvil is running (`anvil` in terminal)
- Check RPC URL is `http://127.0.0.1:8545` (not https)
- Try `http://localhost:8545` if 127.0.0.1 doesn't work

#### 2. Nonce Too High
**Problem:** "Nonce too high" error in MetaMask
**Solution:** 
- Reset account in MetaMask: Settings → Advanced → Reset Account
- This clears transaction history but keeps the account

#### 3. Insufficient Funds
**Problem:** Test account has no ETH
**Solution:**
- Ensure you're using one of Anvil's funded accounts
- Check you're on the Anvil network in MetaMask
- Restart Anvil if needed (resets all balances)

#### 4. Contract Not Found
**Problem:** Contract calls fail with "contract not found"
**Solution:**
- Redeploy contract after restarting Anvil
- Update contract address in your .env file
- Ensure you're connected to the right network

#### 5. Time-Dependent Tests Failing
**Problem:** Tests fail due to timing issues
**Solution:**
```javascript
// Always get current block timestamp first
const block = await provider.getBlock('latest');
const currentTime = block.timestamp;

// Calculate times relative to current block
const meetingStart = currentTime + 3600;
const meetingEnd = currentTime + 7200;
```

## Useful Commands Reference

```bash
# Start Anvil with specific settings
anvil --accounts 5 --balance 1000 --block-time 2

# Deploy contract
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# Run tests
forge test --rpc-url http://127.0.0.1:8545 -vvv

# Get current block number
cast block-number --rpc-url http://127.0.0.1:8545

# Get account balance
cast balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --rpc-url http://127.0.0.1:8545

# Send ETH between accounts
cast send --private-key 0xac09... --value 1ether 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

# Call contract function (read)
cast call 0x5FbDB... "getMeetingInfo(string)" "meeting-001" --rpc-url http://127.0.0.1:8545

# Time manipulation
cast rpc evm_increaseTime 3600 --rpc-url http://127.0.0.1:8545
cast rpc evm_mine --rpc-url http://127.0.0.1:8545
```

## Next Steps

1. **Local Development** ✅ Use this guide
2. **Base Sepolia Testing** → Deploy to testnet when ready
3. **Base Mainnet** → Production deployment

## Additional Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [Anvil Reference](https://book.getfoundry.sh/reference/anvil/)
- [Base Documentation](https://docs.base.org/)
- [MetaMask Documentation](https://docs.metamask.io/)

---

**Remember:** Anvil is perfect for rapid development and testing. Use it to iterate quickly before deploying to Base Sepolia for the hackathon demo!