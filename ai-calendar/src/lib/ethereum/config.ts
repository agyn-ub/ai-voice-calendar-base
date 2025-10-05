// Base Network Configuration
export const NETWORK_CONFIG = {
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
};

// Contract addresses - update these after deployment
export const CONTRACT_ADDRESSES = {
  baseSepolia: {
    meetingStake: process.env.NEXT_PUBLIC_MEETING_STAKE_CONTRACT || '0x0000000000000000000000000000000000000000',
  },
  base: {
    meetingStake: process.env.NEXT_PUBLIC_MEETING_STAKE_CONTRACT_MAINNET || '0x0000000000000000000000000000000000000000',
  },
};

// Get current network from environment
export const CURRENT_NETWORK = process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? 'base' : 'baseSepolia';
export const CURRENT_CHAIN_ID = NETWORK_CONFIG[CURRENT_NETWORK].chainId;