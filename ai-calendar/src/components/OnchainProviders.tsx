'use client';

import { ReactNode } from 'react';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base, baseSepolia } from 'viem/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { getConfig } from '@/lib/wagmi/config';
import '@coinbase/onchainkit/styles.css';

// Choose the network based on environment
const chain = process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? base : baseSepolia;

// Create a client
const queryClient = new QueryClient();

export function OnchainProviders({ children }: { children: ReactNode }) {
  const wagmiConfig = getConfig();

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
          schemaId="0x4c5dacbc-111c-4215-b585-235f5eb87dc9" // Base mainnet schema ID
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}