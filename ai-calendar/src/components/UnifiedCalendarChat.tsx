"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { UnifiedChatInput } from "./ui/UnifiedChatInput";
import { TypingIndicator } from "./ui/TypingIndicator";
import { AmbiguousContact, PendingEvent } from '@/types/openai';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  needsDisambiguation?: boolean;
  ambiguousContacts?: AmbiguousContact[];
  pendingEvent?: PendingEvent;
}

export function UnifiedCalendarChat() {
  const { address: walletAddress } = useAccount();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
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
            const stakeAmount = data.pendingEvent.stakeRequired || 10;

            // Note: Blockchain meeting creation will be handled on-chain
            // when users actually stake through the smart contract
            console.log(`[UnifiedCalendarChat] Meeting ID generated: ${meetingId}`);

            // Then call API to store in database and send emails
            const stakeResponse = await fetch('/api/staking/initiate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                walletAddress: walletAddress,
                eventData: {
                  summary: data.pendingEvent.summary,
                  description: data.pendingEvent.description,
                  location: data.pendingEvent.location,
                  startDateTime: data.pendingEvent.startDateTime,
                  endDateTime: data.pendingEvent.endDateTime,
                  attendees: data.pendingEvent.resolvedAttendees,
                  timezone: timezone,
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
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
          </span>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Connected
        </div>
      </div>

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
                          className="w-full text-left p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-gray-100">{match.name}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{match.email}</p>
                            </div>
                            <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
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