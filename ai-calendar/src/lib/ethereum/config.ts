// Network Configuration
export const NETWORK_CONFIG = {
  local: {
    chainId: 31337,
    name: 'Anvil (Local)',
    rpcUrl: 'http://127.0.0.1:8545',
    explorerUrl: '',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  baseSepolia: {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  base: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
};

// Contract addresses - update these after deployment
export const CONTRACT_ADDRESSES = {
  local: {
    meetingStake: process.env.NEXT_PUBLIC_MEETING_STAKE_CONTRACT_LOCAL || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  },
  baseSepolia: {
    meetingStake: process.env.NEXT_PUBLIC_MEETING_STAKE_CONTRACT_TESTNET || '0x0000000000000000000000000000000000000000',
  },
  base: {
    meetingStake: process.env.NEXT_PUBLIC_MEETING_STAKE_CONTRACT_MAINNET || '0x0000000000000000000000000000000000000000',
  },
};

// Get current network from environment
function getCurrentNetwork() {
  const network = process.env.NEXT_PUBLIC_NETWORK || 'testnet';
  switch (network) {
    case 'local':
      return 'local';
    case 'mainnet':
      return 'base';
    case 'testnet':
    default:
      return 'baseSepolia';
  }
}

export const CURRENT_NETWORK = getCurrentNetwork() as keyof typeof NETWORK_CONFIG;
export const CURRENT_CHAIN_ID = NETWORK_CONFIG[CURRENT_NETWORK].chainId;