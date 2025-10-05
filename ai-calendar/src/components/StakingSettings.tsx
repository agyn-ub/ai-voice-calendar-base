"use client";

import { useState, useEffect } from "react";
import FlowService from "@/lib/flow/flowService";
import { useFlow } from "./FlowProvider";

interface StakingSettingsProps {
  onStakingChange: (enabled: boolean, amount: string) => void;
  initialEnabled?: boolean;
  initialAmount?: string;
}

export function StakingSettings({
  onStakingChange,
  initialEnabled = false,
  initialAmount = "10.0"
}: StakingSettingsProps) {
  const { user } = useFlow();
  const [stakingEnabled, setStakingEnabled] = useState(initialEnabled);
  const [stakeAmount, setStakeAmount] = useState(initialAmount);
  const [flowBalance, setFlowBalance] = useState<string>("0.0");
  const [hasMeetingManager, setHasMeetingManager] = useState(false);
  const [settingUp, setSettingUp] = useState(false);

  useEffect(() => {
    if (user?.addr) {
      checkUserSetup();
      fetchFlowBalance();
    }
  }, [user]);

  const checkUserSetup = async () => {
    if (!user?.addr) return;

    try {
      const hasManager = await FlowService.hasMeetingManager(user.addr);
      setHasMeetingManager(hasManager);
    } catch (error) {
      console.error("Error checking meeting manager:", error);
    }
  };

  const fetchFlowBalance = async () => {
    if (!user?.addr) return;

    try {
      const balance = await FlowService.getFlowBalance(user.addr);
      setFlowBalance(balance);
    } catch (error) {
      console.error("Error fetching FLOW balance:", error);
    }
  };

  const setupMeetingManager = async () => {
    setSettingUp(true);
    try {
      await FlowService.setupMeetingManager();
      setHasMeetingManager(true);
      alert("Meeting Manager setup successful!");
    } catch (error) {
      console.error("Error setting up Meeting Manager:", error);
      alert("Failed to setup Meeting Manager. Please try again.");
    } finally {
      setSettingUp(false);
    }
  };

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

  if (!user?.addr) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <p className="text-sm text-gray-400">
          Connect your Flow wallet to enable staking features
        </p>
      </div>
    );
  }

  if (!hasMeetingManager) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <span className="text-green-400">💎</span> Enable Meeting Stakes
        </h3>
        <p className="text-sm text-gray-400 mb-3">
          Set up your Meeting Manager to enable staking for calendar events
        </p>
        <button
          onClick={setupMeetingManager}
          disabled={settingUp}
          className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50"
        >
          {settingUp ? "Setting up..." : "Setup Meeting Manager"}
        </button>
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
              Stake Amount (FLOW)
            </label>
            <div className="relative">
              <input
                type="text"
                value={stakeAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="10.0"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:border-green-500 focus:outline-none text-white"
              />
              <span className="absolute right-3 top-2.5 text-sm text-gray-500">
                FLOW
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Your balance: {parseFloat(flowBalance).toFixed(2)} FLOW
            </p>
          </div>

          <div className="bg-gray-900 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">How it works:</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Participants stake {stakeAmount} FLOW to commit</li>
              <li>• Attendees get their stake back + bonuses</li>
              <li>• No-shows forfeit their stake to attendees</li>
            </ul>
          </div>

          {parseFloat(stakeAmount) > parseFloat(flowBalance) && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-2">
              <p className="text-xs text-red-400">
                ⚠️ Stake amount exceeds your balance
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}