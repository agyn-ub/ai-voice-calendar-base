'use client';

import { ReactNode } from 'react';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base, baseSepolia, localhost } from 'viem/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { getConfig } from '@/lib/wagmi/config';
import '@coinbase/onchainkit/styles.css';

// Define Anvil chain for local development
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

// Choose the network based on environment
function getChain() {
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

const chain = getChain();

// Create a client
const queryClient = new QueryClient();

export function OnchainProviders({ children }: { children: ReactNode }) {
  const wagmiConfig = getConfig();
  const isLocal = process.env.NEXT_PUBLIC_NETWORK === 'local';

  // For local development, skip OnchainKit as it's primarily for Base chains
  if (isLocal) {
    return (
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    );
  }

  // For Base networks, use OnchainKit
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          chain={chain}
          config={{
            appearance: {
              mode: 'auto', // Automatically match system theme
              theme: 'base', // Use Base theme
            },
          }}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}