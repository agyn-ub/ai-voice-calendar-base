'use client';

import { useState, useRef, useEffect } from 'react';
import { AssistantResponse, AmbiguousContact, PendingEvent } from '@/types/openai';
import MessageBubble from './ui/MessageBubble';
import ChatInput from './ui/ChatInput';
import { getUserTimezone } from '@/lib/utils/timezone';
import { WhatsAppTypingIndicator } from './ui/TypingIndicator';

interface CalendarAssistantProps {
  walletAddress: string | null;
  onCalendarUpdate?: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: Array<{
    type: string;
    status: 'success' | 'error';
    details?: unknown;
  }>;
  needsDisambiguation?: boolean;
  ambiguousContacts?: AmbiguousContact[];
  pendingEvent?: PendingEvent;
}

export default function CalendarAssistant({ walletAddress, onCalendarUpdate }: CalendarAssistantProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userTimezone, setUserTimezone] = useState<string>('UTC');
  const [pendingEventData, setPendingEventData] = useState<PendingEvent | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Detect user timezone on mount
  useEffect(() => {
    const tz = getUserTimezone();
    setUserTimezone(tz);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async () => {
    if (!message.trim() || !walletAddress || isLoading) return;
    
    const userMessage = message.trim();
    setMessage('');
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage,
      timestamp: new Date()
    }]);
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/assistant/calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet_address: walletAddress,
          message: userMessage,
          conversation_id: conversationId,
          timezone: userTimezone
        }),
      });
      
      const data: AssistantResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to process request');
      }
      
      // Check if disambiguation is needed
      if (data.needsDisambiguation && data.ambiguousContacts) {
        setPendingEventData(data.pendingEvent || null);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
          actions: data.actions_taken,
          needsDisambiguation: true,
          ambiguousContacts: data.ambiguousContacts,
          pendingEvent: data.pendingEvent
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
          actions: data.actions_taken
        }]);

        if (data.actions_taken && data.actions_taken.length > 0 && onCalendarUpdate) {
          onCalendarUpdate();
        }
      }

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactSelection = async (selectedEmail: string, searchQuery: string) => {
    if (!walletAddress || !pendingEventData) return;

    setIsLoading(true);

    // Create a message to complete the event creation with the selected contact
    const disambiguationMessage = `Use ${selectedEmail} for ${searchQuery}`;

    try {
      // Send the selected contact back to complete event creation
      const response = await fetch('/api/assistant/calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet_address: walletAddress,
          message: disambiguationMessage,
          conversation_id: conversationId,
          timezone: userTimezone,
          pendingEvent: {
            ...pendingEventData,
            disambiguationResolution: {
              [searchQuery]: selectedEmail
            }
          }
        }),
      });

      const data: AssistantResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to process request');
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        actions: data.actions_taken
      }]);

      setPendingEventData(null);

      if (data.actions_taken && data.actions_taken.length > 0 && onCalendarUpdate) {
        onCalendarUpdate();
      }
    } catch (error) {
      console.error('Error handling contact selection:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, there was an error creating the event. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = async () => {
    if (conversationId) {
      try {
        await fetch(`/api/assistant/calendar?conversation_id=${conversationId}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.error('Error clearing conversation:', error);
      }
    }
    
    setMessages([]);
    setConversationId(null);
    setMessage('');
  };

  const examplePrompts = [
    {
      icon: "📅",
      text: "What's on my calendar today?",
      category: "view"
    },
    {
      icon: "➕",
      text: "Schedule a meeting tomorrow at 2pm",
      category: "create"
    },
    {
      icon: "🗑️",
      text: "Clear my calendar for next Monday",
      category: "delete"
    },
    {
      icon: "🔍",
      text: "Find all meetings with John",
      category: "search"
    },
    {
      icon: "✏️",
      text: "Move my 3pm meeting to 4pm",
      category: "update"
    }
  ];

  if (!walletAddress) {
    return (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Calendar Assistant
          </h2>
        </div>
        <div className="p-6">
          <p className="text-gray-600 text-center">Please connect your wallet to use the calendar assistant.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700 flex flex-col" style={{ minHeight: '70vh', maxHeight: '80vh' }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          AI Calendar Assistant
        </h2>
        {messages.length > 0 && (
          <button
            onClick={clearConversation}
            className="text-white/80 hover:text-white transition-colors flex items-center gap-1 text-sm"
            title="Clear conversation"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear
          </button>
        )}
      </div>
      
      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-gray-900/50"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full animate-fadeIn">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full mb-4">
                <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-200 mb-2">How can I help you manage your calendar?</h3>
              <p className="text-sm text-gray-400">I can create, view, update, and delete your events</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-2xl">
              {examplePrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => setMessage(prompt.text)}
                  className="flex items-start gap-3 p-4 text-left bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl transition-all hover:shadow-lg hover:border-gray-500 group"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">{prompt.icon}</span>
                  <span className="text-sm text-gray-300 group-hover:text-gray-100">{prompt.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div key={index}>
            <MessageBubble
              role={msg.role}
              content={msg.content}
              timestamp={msg.timestamp}
              actions={msg.actions}
            />

            {/* Show disambiguation options if needed */}
            {msg.needsDisambiguation && msg.ambiguousContacts && (
              <div className="ml-12 mt-3 space-y-3">
                {msg.ambiguousContacts.map((ambiguous, ambIdx) => (
                  <div key={ambIdx} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <p className="text-sm text-gray-400 mb-3">
                      Which <span className="font-semibold text-gray-200">&quot;{ambiguous.searchQuery}&quot;</span> did you mean?
                    </p>
                    <div className="space-y-2">
                      {ambiguous.matches.map((match, matchIdx) => (
                        <button
                          key={matchIdx}
                          onClick={() => handleContactSelection(match.email, ambiguous.searchQuery)}
                          disabled={isLoading}
                          className="w-full text-left p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex justify-between items-center group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div>
                            <div className="font-medium text-gray-200 group-hover:text-white">
                              {match.name}
                            </div>
                            <div className="text-sm text-gray-400">
                              {match.email}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                            {Math.round(match.confidence * 100)}% match
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        
        <WhatsAppTypingIndicator isTyping={isLoading} />
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <div className="border-t border-gray-600 p-4 bg-gray-800">
        <ChatInput
          value={message}
          onChange={setMessage}
          onSubmit={handleSubmit}
          disabled={isLoading}
          placeholder="Ask me about your calendar..."
        />
      </div>
    </div>
  );
}