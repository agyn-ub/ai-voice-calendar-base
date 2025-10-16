"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { UnifiedChatInput } from "./ui/UnifiedChatInput";
import { TypingIndicator } from "./ui/TypingIndicator";
import { AmbiguousContact, PendingEvent } from '@/types/openai';
import { MEETING_STAKE_ABI } from '@/lib/contracts/MeetingStakeABI';
import { parseEther } from 'viem';

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  needsDisambiguation?: boolean;
  ambiguousContacts?: AmbiguousContact[];
  pendingEvent?: PendingEvent;
}

interface UnifiedCalendarChatProps {
  messages?: Message[];
  setMessages?: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  conversationId?: string;
  setConversationId?: (id: string | undefined) => void;
}

export function UnifiedCalendarChat({ 
  messages: propMessages, 
  setMessages: propSetMessages,
  conversationId: propConversationId,
  setConversationId: propSetConversationId
}: UnifiedCalendarChatProps = {}) {
  const { address: walletAddress } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  // Use props if provided, otherwise use local state
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [localConversationId, setLocalConversationId] = useState<string | undefined>();
  
  const messages = propMessages !== undefined ? propMessages : localMessages;
  const setMessages = propSetMessages || setLocalMessages;
  const conversationId = propConversationId !== undefined ? propConversationId : localConversationId;
  const setConversationId = propSetConversationId || setLocalConversationId;
  
  const [isProcessing, setIsProcessing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [pendingEventData, setPendingEventData] = useState<PendingEvent | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (walletAddress) {
      // Balance is fetched via useBalance hook in other components
      // For now we'll leave this as placeholder
    }
  }, [walletAddress]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Balance fetching handled by wagmi useBalance hook

  const handleMessage = async (text: string) => {
    if (!walletAddress) {
      alert("Please connect your wallet first");
      return;
    }

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: text,
      timestamp: new Date(),
      status: 'sent'
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      // Get user timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Process with calendar assistant API (which has disambiguation)
      const response = await fetch('/api/assistant/calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet_address: walletAddress,
          message: text,
          conversation_id: conversationId,
          timezone
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process command');
      }

      // Update conversation ID if provided
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      // Check if disambiguation is needed
      if (data.needsDisambiguation) {
        console.log('[UnifiedCalendarChat] Disambiguation needed:', data.ambiguousContacts);
        setPendingEventData(data.pendingEvent);

        // Create disambiguation message
        const disambiguationMessage: Message = {
          id: `assistant-${Date.now()}`,
          type: 'assistant',
          content: data.message,
          timestamp: new Date(),
          status: 'sent',
          needsDisambiguation: true,
          ambiguousContacts: data.ambiguousContacts,
          pendingEvent: data.pendingEvent
        };
        setMessages(prev => [...prev, disambiguationMessage]);
      } else {
        // Check if stake flow is needed
        if (data.needsStake && data.pendingEvent) {
          console.log('[UnifiedCalendarChat] Stake flow needed, initiating stake invitations');

          // Show message that event will be created with stake
          const assistantMessage: Message = {
            id: `assistant-${Date.now()}`,
            type: 'assistant',
            content: `I'll schedule your meeting with a ${data.pendingEvent.stakeRequired || 0.01} ETH stake requirement. Sending stake invitation to attendees...`,
            timestamp: new Date(),
            status: 'sent'
          };
          setMessages(prev => [...prev, assistantMessage]);

          // Initiate stake flow
          try {
            // First, create blockchain meeting on client-side where wallet is connected
            const meetingId = `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const stakeAmount = data.pendingEvent.stakeRequired || 0.01;
            
            console.log('[UnifiedCalendarChat] Generated meeting ID for blockchain:', meetingId);
            
            // Show blockchain transaction pending message
            const blockchainMessage: Message = {
              id: `assistant-${Date.now()}-blockchain`,
              type: 'assistant',
              content: '🔗 Creating meeting on blockchain... Please confirm the transaction in your wallet.',
              timestamp: new Date(),
              status: 'sent'
            };
            setMessages(prev => [...prev, blockchainMessage]);

            // Create meeting on blockchain
            console.log(`[UnifiedCalendarChat] Creating meeting on blockchain: ${meetingId}`);
            
            // Check wallet connection and network
            if (!walletAddress) {
              const walletError: Message = {
                id: `assistant-${Date.now()}-wallet-error`,
                type: 'assistant',
                content: '⚠️ Wallet not connected! Please connect your wallet first.',
                timestamp: new Date(),
                status: 'error'
              };
              setMessages(prev => [...prev, walletError]);
              setPendingEventData(undefined);
              return;
            }

            if (typeof window !== 'undefined' && window.ethereum) {
              // Check if we have access to accounts
              const accounts = await window.ethereum.request({ method: 'eth_accounts' });
              console.log('[UnifiedCalendarChat] Connected accounts:', accounts);
              
              if (!accounts || accounts.length === 0) {
                const accountError: Message = {
                  id: `assistant-${Date.now()}-account-error`,
                  type: 'assistant',
                  content: '⚠️ No accounts available. Please unlock MetaMask and connect to this site.',
                  timestamp: new Date(),
                  status: 'error'
                };
                setMessages(prev => [...prev, accountError]);
                setPendingEventData(undefined);
                return;
              }

              const chainId = await window.ethereum.request({ method: 'eth_chainId' });
              console.log('[UnifiedCalendarChat] Current chain ID:', chainId);
              
              if (chainId !== '0x7a69') { // 0x7a69 = 31337 in hex
                const networkError: Message = {
                  id: `assistant-${Date.now()}-network-error`,
                  type: 'assistant',
                  content: `⚠️ Wrong network! Please switch MetaMask to:\n\n1. Open MetaMask\n2. Click the network dropdown\n3. Select "Localhost 8545"\n4. If not available, add it manually:\n   - Network Name: Anvil\n   - RPC URL: http://127.0.0.1:8545\n   - Chain ID: 31337\n   - Currency Symbol: ETH`,
                  timestamp: new Date(),
                  status: 'error'
                };
                setMessages(prev => [...prev, networkError]);
                setPendingEventData(undefined);
                return;
              }
            } else {
              console.error('[UnifiedCalendarChat] window.ethereum not available');
            }
            
            try {
              if (!walletClient) {
                throw new Error('Wallet not connected properly. Please reconnect your wallet.');
              }

              // Parse datetime strings to Unix timestamps
              const startTime = Math.floor(new Date(data.pendingEvent.startDateTime).getTime() / 1000);
              const endTime = Math.floor(new Date(data.pendingEvent.endDateTime).getTime() / 1000);
              
              // Import contract ABI and address
              const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

              console.log('[UnifiedCalendarChat] Sending transaction with walletClient...');
              
              // Send transaction using walletClient
              const hash = await walletClient.writeContract({
                address: CONTRACT_ADDRESS,
                abi: MEETING_STAKE_ABI,
                functionName: 'createMeeting',
                args: [
                  meetingId,
                  data.pendingEvent.summary || 'Meeting',
                  parseEther(stakeAmount.toString()),
                  BigInt(startTime),
                  BigInt(endTime)
                ]
              });
              
              console.log('[UnifiedCalendarChat] Transaction sent! Hash:', hash);
              console.log('[UnifiedCalendarChat] Meeting ID used in transaction:', meetingId);
              
              // Update message with success
              setMessages(prev => prev.map(msg => 
                msg.id === blockchainMessage.id 
                  ? { ...msg, content: `✅ Meeting created on blockchain! Transaction: ${hash}` }
                  : msg
              ));
              
              // Optional: Verify the meeting exists on blockchain
              console.log('[UnifiedCalendarChat] Verifying meeting on blockchain...');
              try {
                const verifyResponse = await fetch('/api/staking/verify-blockchain', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ meetingId })
                });
                const verifyData = await verifyResponse.json();
                console.log('[UnifiedCalendarChat] Blockchain verification:', verifyData.blockchain.exists ? '✅ Meeting verified' : '❌ Meeting not found');
              } catch (verifyError) {
                console.warn('[UnifiedCalendarChat] Could not verify meeting:', verifyError);
              }
            } catch (blockchainError) {
              console.error('[UnifiedCalendarChat] Blockchain transaction failed:', blockchainError);
              
              // Update message with error
              const errorMsg = blockchainError instanceof Error ? blockchainError.message : 'Unknown error';
              setMessages(prev => prev.map(msg => 
                msg.id === blockchainMessage.id 
                  ? { ...msg, content: `❌ Blockchain transaction failed: ${errorMsg}\n\nPlease ensure:\n1. MetaMask is connected to Localhost 8545\n2. You have ETH in your account\n3. You confirmed the transaction`, status: 'error' as const }
                  : msg
              ));
              
              // STOP HERE - Don't continue without blockchain
              setPendingEventData(undefined);
              return;
            }

            // Then call API to store in database and send emails (only if blockchain succeeded)
            const stakeResponse = await fetch('/api/staking/initiate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                meetingId: meetingId,  // IMPORTANT: Use the same meeting ID from blockchain!
                walletAddress: walletAddress,
                eventData: {
                  summary: data.pendingEvent.summary,
                  description: data.pendingEvent.description,
                  location: data.pendingEvent.location,
                  start: {
                    dateTime: data.pendingEvent.startDateTime,
                    timeZone: timezone
                  },
                  end: {
                    dateTime: data.pendingEvent.endDateTime,
                    timeZone: timezone
                  },
                  attendees: data.pendingEvent.resolvedAttendees ? 
                    data.pendingEvent.resolvedAttendees.map((email: string) => ({ email })) : 
                    [],
                  stakeRequired: stakeAmount
                },
                stakeAmount: stakeAmount
              })
            });

            if (stakeResponse.ok) {
              const stakeData = await stakeResponse.json();
              const stakeMessage: Message = {
                id: `assistant-${Date.now()}-stake`,
                type: 'assistant',
                content: `✅ Stake invitations sent!\n\n• Required stake: ${data.pendingEvent.stakeRequired || 0.01} ETH\n• Attendees: ${data.pendingEvent.resolvedAttendees?.join(', ')}\n• Calendar invitations will be sent after they stake\n• Meeting ID: ${stakeData.meetingId}`,
                timestamp: new Date(),
                status: 'sent'
              };
              setMessages(prev => [...prev, stakeMessage]);
            }
          } catch (error) {
            console.error('Error initiating stake flow:', error);
            const errorMessage: Message = {
              id: `assistant-${Date.now()}-error`,
              type: 'assistant',
              content: 'Failed to send stake invitations. Please try again.',
              timestamp: new Date(),
              status: 'error'
            };
            setMessages(prev => [...prev, errorMessage]);
          }

          // Clear pending event data
          setPendingEventData(undefined);
          return; // Exit early for stake flow
        }

        // Normal response (no stake flow needed)
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          type: 'assistant',
          content: data.message,
          timestamp: new Date(),
          status: 'sent'
        };
        setMessages(prev => [...prev, assistantMessage]);

        // For meetings without attendees, this might still trigger
        // But with our new logic, meetings with attendees will use stake flow above

        // Clear pending event data
        setPendingEventData(undefined);
      }

    } catch (error) {
      const errorMessage: Message = {
        id: `assistant-${Date.now()}-error`,
        type: 'assistant',
        content: `Sorry, I couldn't process that: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        status: 'error'
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContactSelection = async (email: string) => {
    // Send a follow-up message with just the email address to avoid re-disambiguation
    const resolvedMessage = `Please use email ${email} for the meeting`;
    await handleMessage(resolvedMessage);
  };

  if (!walletAddress) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Connect Your Wallet</h2>
          <p className="text-gray-600 dark:text-gray-400">Connect your wallet to start creating meetings with voice or text</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400 truncate" title={walletAddress}>
            {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
          </span>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 flex-shrink-0">
          Connected
        </div>
      </div>

      {/* Blockchain Status Bar */}
      {process.env.NEXT_PUBLIC_NETWORK === 'local' && (
        <div className="bg-purple-900/20 border-y border-purple-600/30 px-4 py-2 overflow-hidden">
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm text-purple-400 flex-shrink-0">⛓️ Blockchain: Anvil</span>
              <span className="text-xs text-gray-400 truncate">Contract: 0x5FbDB...0aa3</span>
            </div>
            <a
              href="/blockchain-explorer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2 py-1 bg-purple-600/30 text-purple-300 rounded hover:bg-purple-600/40 transition-colors flex-shrink-0"
            >
              View Explorer →
            </a>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="space-y-6 max-w-2xl">
              <div className="space-y-2">
                <h3 className="text-2xl font-light text-gray-700 dark:text-gray-300">
                  Hi! I can help you create meetings
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Just type or speak naturally, like:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => handleMessage("Schedule team meeting tomorrow at 3pm with 0.01 ETH stake")}
                  className="text-left p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                >
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    &quot;Team meeting tomorrow 3pm, stake 0.01 ETH&quot;
                  </p>
                </button>
                <button
                  onClick={() => handleMessage("Meeting with Sarah Friday 2pm, 0.02 ETH stake")}
                  className="text-left p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                >
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    &quot;Meeting with Sarah Friday 2pm, stake 0.02 ETH&quot;
                  </p>
                </button>
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id}>
            <div
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                  message.type === 'user'
                    ? 'bg-blue-500 text-white'
                    : message.status === 'error'
                    ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <p className={`text-xs mt-1 ${
                  message.type === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>

            {/* Disambiguation UI */}
            {message.needsDisambiguation && message.ambiguousContacts && (
              <div className="mt-4 ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Please select the correct contact:</p>
                <div className="space-y-2">
                  {message.ambiguousContacts.map((ambiguous) => (
                    <div key={ambiguous.searchQuery} className="space-y-1">
                      <p className="text-xs text-gray-500 dark:text-gray-500">For &quot;{ambiguous.searchQuery}&quot;:</p>
                      {ambiguous.matches.map((match, idx) => (
                        <button
                          key={`${match.email}-${idx}`}
                          onClick={() => handleContactSelection(match.email)}
                          className="w-full text-left p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors overflow-hidden"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{match.name}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{match.email}</p>
                            </div>
                            <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded flex-shrink-0">
                              {(match.confidence * 100).toFixed(0)}% match
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2">
              <TypingIndicator isTyping={true} label="AI is thinking" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <UnifiedChatInput
          onSendMessage={handleMessage}
          placeholder="Type or speak to create a meeting..."
          disabled={isProcessing}
        />
      </div>
    </div>
  );
}