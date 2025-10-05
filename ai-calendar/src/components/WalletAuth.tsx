'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect } from 'wagmi';
import { useEffect } from 'react';

interface WalletAuthProps {
  onWalletConnect?: (address: string) => void;
  onWalletDisconnect?: () => void;
}

export function WalletAuth({ onWalletConnect, onWalletDisconnect }: WalletAuthProps) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (isConnected && address) {
      onWalletConnect?.(address);
    } else {
      onWalletDisconnect?.();
    }
  }, [isConnected, address, onWalletConnect, onWalletDisconnect]);

  return (
    <div className="flex items-center gap-4">
      <ConnectButton 
        showBalance={false}
        accountStatus={{
          smallScreen: 'avatar',
          largeScreen: 'full',
        }}
      />
    </div>
  );
}