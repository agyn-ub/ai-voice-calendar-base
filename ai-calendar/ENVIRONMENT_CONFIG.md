# Environment Configuration Guide

This application supports three different blockchain environments that can be easily switched using environment variables.

## Supported Environments

### 1. Local Development (Anvil)
- **Network**: Anvil local blockchain
- **Chain ID**: 31337
- **RPC URL**: http://127.0.0.1:8545
- **Use Case**: Rapid development and testing

### 2. Testnet (Base Sepolia)
- **Network**: Base Sepolia testnet
- **Chain ID**: 84532
- **RPC URL**: https://sepolia.base.org
- **Use Case**: Testing with testnet ETH before mainnet

### 3. Production (Base Mainnet)
- **Network**: Base mainnet
- **Chain ID**: 8453
- **RPC URL**: https://mainnet.base.org
- **Use Case**: Production deployment

## Configuration

### Environment Variables

Set the following in your `.env.local` file:

```bash
# Network Selection (local, testnet, or mainnet)
NEXT_PUBLIC_NETWORK=local

# Contract Addresses for each environment
NEXT_PUBLIC_MEETING_STAKE_CONTRACT_LOCAL=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_MEETING_STAKE_CONTRACT_TESTNET=0x... # Deploy and update
NEXT_PUBLIC_MEETING_STAKE_CONTRACT_MAINNET=0x... # Deploy and update
```

### Switching Environments

1. **For Local Development (Anvil)**:
   ```bash
   NEXT_PUBLIC_NETWORK=local
   ```

2. **For Testnet Deployment**:
   ```bash
   NEXT_PUBLIC_NETWORK=testnet
   ```

3. **For Production**:
   ```bash
   NEXT_PUBLIC_NETWORK=mainnet
   ```

## Local Development with Anvil

### 1. Start Anvil
```bash
# In a separate terminal
anvil

# Or with custom settings
anvil --accounts 10 --balance 10000 --block-time 1
```

### 2. Deploy Contract
```bash
# Navigate to contracts directory
cd ../contracts

# Deploy to Anvil
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# Note the deployed contract address and update .env.local
```

### 3. Configure MetaMask

Add Anvil network to MetaMask:
- **Network Name**: Anvil Local
- **RPC URL**: http://127.0.0.1:8545
- **Chain ID**: 31337
- **Currency Symbol**: ETH

Import test accounts (from Anvil output):
- Account #0: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- Account #1: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`

### 4. Run the Application
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Testing Workflow

### With Anvil (Recommended for Development)
1. Start Anvil: `anvil`
2. Deploy contract: `forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast`
3. Update `NEXT_PUBLIC_MEETING_STAKE_CONTRACT_LOCAL` in `.env.local`
4. Set `NEXT_PUBLIC_NETWORK=local`
5. Run app: `pnpm dev`
6. Connect MetaMask to Anvil network
7. Use test accounts with 10,000 ETH balance

### With Base Sepolia
1. Get testnet ETH from [Base Sepolia Faucet](https://docs.base.org/docs/tools/faucets/)
2. Deploy contract to Base Sepolia
3. Update `NEXT_PUBLIC_MEETING_STAKE_CONTRACT_TESTNET` in `.env.local`
4. Set `NEXT_PUBLIC_NETWORK=testnet`
5. Run app: `pnpm dev`
6. Connect MetaMask to Base Sepolia network

## Time Manipulation (Anvil Only)

For testing time-dependent functions in Anvil:

```bash
# Skip ahead 1 hour
cast rpc evm_increaseTime 3600 --rpc-url http://127.0.0.1:8545

# Mine a block to apply the time change
cast rpc evm_mine --rpc-url http://127.0.0.1:8545
```

## Troubleshooting

### MetaMask Issues
- **Nonce too high**: Reset account in MetaMask (Settings → Advanced → Reset Account)
- **Connection failed**: Ensure Anvil is running and RPC URL is correct

### Contract Not Found
- Redeploy contract after restarting Anvil
- Update contract address in `.env.local`
- Ensure correct network is selected in MetaMask

### Wrong Network
- Check `NEXT_PUBLIC_NETWORK` value in `.env.local`
- Verify MetaMask is connected to the matching network
- Restart development server after changing environment variables

## Benefits of Dynamic Configuration

1. **Single Codebase**: No code changes needed to switch environments
2. **Easy Testing**: Quick switch between local, testnet, and mainnet
3. **MetaMask Support**: Works with MetaMask and other injected wallets
4. **Rapid Development**: Use Anvil for fast iteration without testnet delays
5. **Cost Effective**: Test with free local ETH before using real testnet/mainnet ETH