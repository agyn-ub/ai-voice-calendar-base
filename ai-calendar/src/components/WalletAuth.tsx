'use client';

import { 
  ConnectWallet,
  Wallet, 
  WalletDropdown, 
  WalletDropdownBasename, 
  WalletDropdownDisconnect,
  WalletDropdownFundLink,
  WalletDropdownLink
} from '@coinbase/onchainkit/wallet';
import {
  Address,
  Avatar,
  Badge,
  Identity,
  Name,
} from '@coinbase/onchainkit/identity';
import { useAccount } from 'wagmi';
import { useEffect } from 'react';
import { SimpleWalletAuth } from './SimpleWalletAuth';

interface WalletAuthProps {
  onWalletConnect?: (address: string) => void;
  onWalletDisconnect?: () => void;
}

export function WalletAuth({ onWalletConnect, onWalletDisconnect }: WalletAuthProps) {
  const { address, isConnected } = useAccount();
  const isLocal = process.env.NEXT_PUBLIC_NETWORK === 'local';

  useEffect(() => {
    if (isConnected && address) {
      onWalletConnect?.(address);
    } else {
      onWalletDisconnect?.();
    }
  }, [isConnected, address, onWalletConnect, onWalletDisconnect]);

  // For local development, use simple wallet connection
  if (isLocal) {
    return (
      <SimpleWalletAuth 
        onWalletConnect={onWalletConnect}
        onWalletDisconnect={onWalletDisconnect}
      />
    );
  }

  // For Base networks, use OnchainKit components
  return (
    <div className="flex items-center gap-3">
      <Wallet>
        <ConnectWallet className="!bg-blue-600 hover:!bg-blue-700">
          <Avatar className="h-6 w-6" />
          <Name />
        </ConnectWallet>
        <WalletDropdown>
          <Identity 
            className="px-4 pt-3 pb-2"
            hasCopyAddressOnClick
          >
            <Avatar />
            <Name />
            <Address />
            <Badge />
          </Identity>
          <WalletDropdownBasename />
          <WalletDropdownFundLink />
          <WalletDropdownLink
            icon="wallet"
            href="https://keys.coinbase.com"
          >
            Wallet Settings
          </WalletDropdownLink>
          <WalletDropdownDisconnect />
        </WalletDropdown>
      </Wallet>
    </div>
  );
}