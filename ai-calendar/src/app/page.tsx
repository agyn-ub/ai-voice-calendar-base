'use client';

import Image from 'next/image';
import { useState } from 'react';
import GoogleCalendarConnect from '@/components/GoogleCalendarConnect';
import CalendarAssistant from '@/components/CalendarAssistant';
import CalendarView from '@/components/CalendarView';
import { WalletAuth } from '@/components/WalletAuth';
import { useAccount } from 'wagmi';
import { CreateMeetingModal } from '@/components/CreateMeetingModal';
import { UnifiedCalendarChat } from '@/components/UnifiedCalendarChat';

export default function Home() {
  const { address: walletAddress } = useAccount();
  const [calendarUpdateTrigger, setCalendarUpdateTrigger] = useState(0);
  const [showWalletDetails, setShowWalletDetails] = useState(false);
  const [showCreateMeeting, setShowCreateMeeting] = useState(false);

  // Wallet address is now directly from useAccount hook

  const handleCalendarUpdate = () => {
    setCalendarUpdateTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      {/* Compact Header */}
      <header className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-700">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo and Title */}
            <div className="flex items-center gap-3">
              <Image
                src="/next.svg"
                alt="AI Calendar Logo"
                width={32}
                height={32}
                className="dark:invert"
                priority
              />
              <h1 className="text-xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
                AI Calendar
              </h1>
            </div>

            {/* Wallet Status */}
            <div className="flex items-center gap-3">
              {walletAddress && (
                <button
                  onClick={() => setShowWalletDetails(!showWalletDetails)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      showWalletDetails ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
              <WalletAuth />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <main className="max-w-4xl mx-auto">
          {/* Collapsible Wallet Details */}
          {showWalletDetails && walletAddress && (
            <div className="mb-6 bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700 animate-in slide-in-from-top-2">
              <div className="space-y-4">
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <p className="text-xs text-gray-400 mb-1">Full Wallet Address</p>
                  <p className="text-sm font-mono text-green-400 break-all">
                    {walletAddress}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                    <p className="text-xs text-gray-400 mb-1">Network</p>
                    <p className="text-sm font-semibold">
                      Base Sepolia
                    </p>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                    <p className="text-xs text-gray-400 mb-1">Status</p>
                    <p className="text-sm font-semibold text-green-400">
                      Connected
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Main Content Area */}
          {walletAddress ? (
            <div className="space-y-6">
              {/* Unified Calendar Chat - Primary Focus */}
              <div className="min-h-[600px] bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden">
                <UnifiedCalendarChat />
              </div>

              {/* Toggle for Classic View */}
              <details className="bg-gray-800 rounded-lg p-4">
                <summary className="cursor-pointer text-gray-400 hover:text-white transition-colors">
                  Advanced Options & Classic View
                </summary>
                <div className="mt-4 space-y-4">
                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCreateMeeting(true)}
                      className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Create Meeting (Form)
                    </button>
                  </div>

                  {/* Calendar Assistant */}
                  <CalendarAssistant
                    walletAddress={walletAddress}
                    onCalendarUpdate={handleCalendarUpdate}
                  />
                </div>
              </details>
              
              {/* Google Calendar Integration - Settings */}
              <div>
                <GoogleCalendarConnect walletAddress={walletAddress} key={calendarUpdateTrigger} />
              </div>

              {/* Calendar View - Visual Calendar Grid */}
              <div>
                <CalendarView
                  walletAddress={walletAddress}
                  refreshTrigger={calendarUpdateTrigger}
                />
              </div>
            </div>
          ) : (
            /* Wallet Connection Prompt - Centered */
            <div className="flex items-center justify-center min-h-[500px]">
              <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700 max-w-md w-full">
                <div className="text-center space-y-6">
                  <svg
                    className="w-16 h-16 mx-auto text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
                    <p className="text-gray-400">
                      Connect your Base wallet to access your AI Calendar
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-4">
                    <p className="text-sm text-gray-300">
                      Click the Connect Wallet button in the header to get started
                    </p>
                    <svg
                      className="w-8 h-8 text-gray-500 animate-bounce"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 10l7-7m0 0l7 7m-7-7v18"
                      />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-500">
                    Supports MetaMask, Coinbase Wallet, and other EVM-compatible wallets
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Create Meeting Modal */}
      <CreateMeetingModal
        isOpen={showCreateMeeting}
        onClose={() => setShowCreateMeeting(false)}
        onSuccess={handleCalendarUpdate}
      />
    </div>
  );
}