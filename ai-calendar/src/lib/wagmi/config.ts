import { createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { coinbaseWallet, injected } from 'wagmi/connectors';

export function getConfig() {
  return createConfig({
    chains: [base, baseSepolia],
    connectors: [
      coinbaseWallet({
        appName: 'AI Voice Calendar',
        preference: 'all', // 'all' | 'smartWalletOnly' | 'eoaOnly'
      }),
      injected({
        shimDisconnect: true,
      }),
    ],
    transports: {
      [base.id]: http('https://mainnet.base.org'),
      [baseSepolia.id]: http('https://sepolia.base.org'),
    },
    ssr: true,
  });
}

export const config = getConfig();