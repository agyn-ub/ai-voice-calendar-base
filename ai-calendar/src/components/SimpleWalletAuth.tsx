'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useEffect, useState } from 'react';

interface SimpleWalletAuthProps {
  onWalletConnect?: (address: string) => void;
  onWalletDisconnect?: () => void;
}

export function SimpleWalletAuth({ onWalletConnect, onWalletDisconnect }: SimpleWalletAuthProps) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      onWalletConnect?.(address);
    } else {
      onWalletDisconnect?.();
    }
  }, [isConnected, address, onWalletConnect, onWalletDisconnect]);

  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <div className="w-2 h-2 bg-green-400 rounded-full" />
          <span className="text-sm font-medium">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </button>
        
        {showDropdown && (
          <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50">
            <div className="p-3 border-b border-gray-700">
              <p className="text-xs text-gray-400">Connected to</p>
              <p className="text-xs font-mono mt-1 break-all">{address}</p>
            </div>
            <button
              onClick={() => {
                disconnect();
                setShowDropdown(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={isPending}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg text-white font-medium transition-colors"
      >
        {isPending ? 'Connecting...' : 'Connect Wallet'}
      </button>
      
      {showDropdown && !isPending && (
        <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50">
          <p className="px-3 py-2 text-xs text-gray-400 border-b border-gray-700">
            Select Wallet
          </p>
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => {
                connect({ connector });
                setShowDropdown(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors"
            >
              {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}