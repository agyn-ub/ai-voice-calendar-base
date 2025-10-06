"use client";

import { useState, useEffect } from "react";
import { useAccount, useBalance } from "wagmi";
import { formatEther } from "viem";

interface StakingSettingsProps {
  onStakingChange: (enabled: boolean, amount: string) => void;
  initialEnabled?: boolean;
  initialAmount?: string;
}

export function StakingSettings({
  onStakingChange,
  initialEnabled = false,
  initialAmount = "0.01"
}: StakingSettingsProps) {
  const { address, isConnected } = useAccount();
  const [stakingEnabled, setStakingEnabled] = useState(initialEnabled);
  const [stakeAmount, setStakeAmount] = useState(initialAmount);
  
  // Get ETH balance
  const { data: balance } = useBalance({
    address,
  });

  const ethBalance = balance ? formatEther(balance.value) : "0.0";

  useEffect(() => {
    onStakingChange(stakingEnabled, stakeAmount);
  }, [stakingEnabled, stakeAmount, onStakingChange]);

  const handleToggle = (enabled: boolean) => {
    setStakingEnabled(enabled);
    onStakingChange(enabled, stakeAmount);
  };

  const handleAmountChange = (amount: string) => {
    // Only allow valid decimal numbers
    if (/^\d*\.?\d*$/.test(amount)) {
      setStakeAmount(amount);
      if (stakingEnabled) {
        onStakingChange(true, amount);
      }
    }
  };

  if (!isConnected || !address) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <p className="text-sm text-gray-400">
          Connect your wallet to enable staking features
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="text-green-400">💎</span> Meeting Stakes
        </h3>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={stakingEnabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
        </label>
      </div>

      {stakingEnabled && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Stake Amount (ETH)
            </label>
            <div className="relative">
              <input
                type="text"
                value={stakeAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.01"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:border-green-500 focus:outline-none text-white"
              />
              <span className="absolute right-3 top-2.5 text-sm text-gray-500">
                ETH
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Your balance: {parseFloat(ethBalance).toFixed(4)} ETH
            </p>
          </div>

          <div className="bg-gray-900 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">How it works:</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Participants stake {stakeAmount} ETH to commit</li>
              <li>• Attendees get their stake back after attendance</li>
              <li>• No-shows forfeit their stake to attendees</li>
            </ul>
          </div>

          {parseFloat(stakeAmount) > parseFloat(ethBalance) && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-2">
              <p className="text-xs text-red-400">
                ⚠️ Stake amount exceeds your balance
              </p>
            </div>
          )}

          <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-2">
            <p className="text-xs text-blue-400">
              ℹ️ Network: Base Sepolia Testnet
            </p>
          </div>
        </div>
      )}
    </div>
  );
}