'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import GoogleCalendarConnect from '@/components/GoogleCalendarConnect';
import CalendarView from '@/components/CalendarView';
import { WalletAuth } from '@/components/WalletAuth';
import { useAccount } from 'wagmi';
import { UnifiedCalendarChat, type Message } from '@/components/UnifiedCalendarChat';

const CHAT_STORAGE_KEY = 'ai-calendar-chat-history';
const CONVERSATION_STORAGE_KEY = 'ai-calendar-conversation-id';

export default function Home() {
  const { address: walletAddress } = useAccount();
  const [calendarUpdateTrigger, setCalendarUpdateTrigger] = useState(0);
  const [showWalletDetails, setShowWalletDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'calendar' | 'settings' | 'blockchain'>('chat');
  
  // Chat state lifted up to persist across tab switches
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatConversationId, setChatConversationId] = useState<string | undefined>();
  
  // Load chat history from localStorage on mount
  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem(CHAT_STORAGE_KEY);
      const savedConversationId = localStorage.getItem(CONVERSATION_STORAGE_KEY);
      
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        // Convert timestamp strings back to Date objects
        const messagesWithDates = parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setChatMessages(messagesWithDates);
      }
      
      if (savedConversationId) {
        setChatConversationId(savedConversationId);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }, []);
  
  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    try {
      if (chatMessages.length > 0) {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatMessages));
      }
      if (chatConversationId) {
        localStorage.setItem(CONVERSATION_STORAGE_KEY, chatConversationId);
      }
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  }, [chatMessages, chatConversationId]);

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
            <div className="space-y-4">
              {/* Tab Navigation */}
              <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg p-1">
                <div className="flex space-x-1">
                  {/* Chat Tab */}
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                      activeTab === 'chat'
                        ? 'bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <span>Chat</span>
                  </button>

                  {/* Calendar Tab */}
                  <button
                    onClick={() => setActiveTab('calendar')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                      activeTab === 'calendar'
                        ? 'bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Calendar</span>
                  </button>

                  {/* Settings Tab */}
                  <button
                    onClick={() => setActiveTab('settings')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                      activeTab === 'settings'
                        ? 'bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Settings</span>
                  </button>

                  {/* Blockchain Tab */}
                  <button
                    onClick={() => setActiveTab('blockchain')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                      activeTab === 'blockchain'
                        ? 'bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Blockchain</span>
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              <div className="min-h-[600px] bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden">
                {activeTab === 'chat' && (
                  <div className="relative h-full">
                    <UnifiedCalendarChat 
                      messages={chatMessages}
                      setMessages={setChatMessages}
                      conversationId={chatConversationId}
                      setConversationId={setChatConversationId}
                    />
                    {chatMessages.length > 0 && (
                      <button
                        onClick={() => {
                          setChatMessages([]);
                          setChatConversationId(undefined);
                          localStorage.removeItem(CHAT_STORAGE_KEY);
                          localStorage.removeItem(CONVERSATION_STORAGE_KEY);
                        }}
                        className="absolute top-4 right-4 px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors z-10"
                        title="Clear chat history"
                      >
                        Clear Chat
                      </button>
                    )}
                  </div>
                )}
                {activeTab === 'calendar' && (
                  <CalendarView
                    walletAddress={walletAddress}
                    refreshTrigger={calendarUpdateTrigger}
                  />
                )}
                {activeTab === 'settings' && (
                  <div className="p-6">
                    <GoogleCalendarConnect walletAddress={walletAddress} key={calendarUpdateTrigger} />
                  </div>
                )}
                {activeTab === 'blockchain' && (
                  <iframe
                    src="/blockchain"
                    className="w-full h-full min-h-[600px]"
                    style={{ border: 'none' }}
                  />
                )}
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

    </div>
  );
}