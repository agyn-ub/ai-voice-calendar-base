import { createConfig, http } from 'wagmi';
import { base, baseSepolia, localhost } from 'wagmi/chains';
import { coinbaseWallet, injected } from 'wagmi/connectors';

// Define Anvil localhost chain
const anvil = {
  ...localhost,
  id: 31337,
  name: 'Anvil',
  network: 'anvil',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
    public: { http: ['http://127.0.0.1:8545'] },
  },
};

// Get network configuration based on environment
function getNetworkConfig() {
  const network = process.env.NEXT_PUBLIC_NETWORK || 'testnet';
  
  switch (network) {
    case 'local':
      return {
        chains: [anvil],
        transports: {
          [anvil.id]: http('http://127.0.0.1:8545'),
        },
      };
    case 'mainnet':
      return {
        chains: [base],
        transports: {
          [base.id]: http('https://mainnet.base.org'),
        },
      };
    case 'testnet':
    default:
      return {
        chains: [baseSepolia],
        transports: {
          [baseSepolia.id]: http('https://sepolia.base.org'),
        },
      };
  }
}

export function getConfig() {
  const { chains, transports } = getNetworkConfig();
  
  return createConfig({
    chains,
    connectors: [
      coinbaseWallet({
        appName: 'AI Voice Calendar',
        preference: 'all', // 'all' | 'smartWalletOnly' | 'eoaOnly'
      }),
      injected({
        shimDisconnect: true,
      }),
    ],
    transports,
    ssr: true,
  });
}

export const config = getConfig();

// Export current chain for use in other parts of the app
export function getCurrentChain() {
  const network = process.env.NEXT_PUBLIC_NETWORK || 'testnet';
  switch (network) {
    case 'local':
      return anvil;
    case 'mainnet':
      return base;
    case 'testnet':
    default:
      return baseSepolia;
  }
}