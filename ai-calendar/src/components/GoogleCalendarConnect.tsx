'use client';

import { useState, useEffect, useCallback } from 'react';

interface GoogleCalendarConnectProps {
  walletAddress: string;
}

interface CalendarStatus {
  connected: boolean;
  email?: string;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
}

export default function GoogleCalendarConnect({ walletAddress }: GoogleCalendarConnectProps) {
  const [status, setStatus] = useState<CalendarStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const checkConnectionStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/calendar/status?wallet_address=${walletAddress}`);
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Error checking calendar status:', error);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  const connectCalendar = async () => {
    setConnecting(true);
    console.log('[GoogleCalendarConnect] Starting connection for wallet:', walletAddress);
    
    try {
      const response = await fetch(`/api/calendar/google/connect?wallet_address=${walletAddress}`);
      const data = await response.json();
      
      if (data.authUrl) {
        console.log('[GoogleCalendarConnect] Opening OAuth popup with URL:', data.authUrl);
        
        // Open OAuth flow in new window
        const authWindow = window.open(
          data.authUrl, 
          'google-auth', 
          'width=500,height=700,left=200,top=100'
        );
        
        if (!authWindow) {
          console.error('[GoogleCalendarConnect] Popup was blocked! Please allow popups for this site.');
          alert('Please allow popups for this site to connect Google Calendar');
          setConnecting(false);
          return;
        }
        
        console.log('[GoogleCalendarConnect] Popup opened, monitoring for completion...');
        
        // Fallback: Check if window closed manually
        const checkInterval = setInterval(() => {
          try {
            if (authWindow?.closed) {
              console.log('[GoogleCalendarConnect] Popup closed, checking connection status...');
              clearInterval(checkInterval);
              setConnecting(false);
              checkConnectionStatus();
            }
          } catch (err) {
            console.error('[GoogleCalendarConnect] Error checking window status:', err);
            clearInterval(checkInterval);
            setConnecting(false);
          }
        }, 1000);
        
        // Clear interval after 5 minutes to prevent memory leak
        setTimeout(() => {
          clearInterval(checkInterval);
          console.log('[GoogleCalendarConnect] Timeout reached, stopping window monitoring');
          setConnecting(false);
        }, 300000);
      } else {
        console.error('[GoogleCalendarConnect] No auth URL received from server:', data);
        setConnecting(false);
      }
    } catch (error) {
      console.error('[GoogleCalendarConnect] Error connecting calendar:', error);
      setConnecting(false);
    }
  };

  const disconnectCalendar = async () => {
    try {
      const response = await fetch('/api/calendar/google/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wallet_address: walletAddress }),
      });
      
      if (response.ok) {
        setStatus({ connected: false });
        setEvents([]);
      }
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
    }
  };

  const fetchCalendarEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const response = await fetch(`/api/calendar/google/events?wallet_address=${walletAddress}`);
      const data = await response.json();
      
      if (data.events) {
        setEvents(data.events.slice(0, 5)); // Show only 5 upcoming events
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoadingEvents(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    checkConnectionStatus();
    
    // Listen for messages from the OAuth popup
    const handleMessage = (event: MessageEvent) => {
      console.log('[GoogleCalendarConnect] Received message from:', event.origin, 'Data:', event.data);
      
      // Check origin matches
      if (event.origin !== window.location.origin) {
        console.warn('[GoogleCalendarConnect] Message from different origin, ignoring:', event.origin);
        return;
      }
      
      if (event.data?.type === 'calendar-auth-complete') {
        console.log('[GoogleCalendarConnect] Auth complete message received:', {
          success: event.data.success,
          message: event.data.message
        });
        
        setConnecting(false);
        if (event.data.success) {
          console.log('[GoogleCalendarConnect] Auth successful, refreshing status...');
          // Refresh status after successful connection
          setTimeout(() => {
            checkConnectionStatus();
          }, 500);
        } else {
          console.error('[GoogleCalendarConnect] Calendar connection failed:', event.data.message);
          alert(`Failed to connect Google Calendar: ${event.data.message || 'Unknown error'}`);
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    console.log('[GoogleCalendarConnect] Message listener registered');
    
    return () => {
      window.removeEventListener('message', handleMessage);
      console.log('[GoogleCalendarConnect] Message listener removed');
    };
  }, [walletAddress, checkConnectionStatus]);

  useEffect(() => {
    if (status.connected) {
      fetchCalendarEvents();
    }
  }, [status.connected, fetchCalendarEvents]);

  const formatEventTime = (event: CalendarEvent) => {
    const startDate = event.start.dateTime || event.start.date;
    if (!startDate) return '';
    
    const date = new Date(startDate);
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      hour: event.start.dateTime ? '2-digit' : undefined,
      minute: event.start.dateTime ? '2-digit' : undefined
    };
    
    return date.toLocaleString('en-US', options);
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700 animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-20 bg-gray-700 rounded"></div>
      </div>
    );
  }

  return (
    <details className="bg-gray-800 rounded-xl shadow-lg border border-gray-700">
      <summary className="px-6 py-4 cursor-pointer hover:bg-gray-700/50 transition-colors flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Google Calendar {status.connected ? '✓' : 'Setup'}
        </h2>
        {status.connected && (
          <span className="text-sm text-gray-400">{status.email}</span>
        )}
      </summary>
      <div className="p-6 border-t border-gray-700">
      
      {status.connected ? (
        <div className="space-y-6">
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
            <p className="text-sm text-gray-400 mb-2">Connected Account</p>
            <p className="text-lg font-mono text-blue-400 break-all">
              {status.email}
            </p>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">Upcoming Events</h3>
            
            {loadingEvents ? (
              <p className="text-gray-400">Loading events...</p>
            ) : events.length > 0 ? (
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="flex items-start space-x-3 text-sm">
                    <div className="text-blue-400 whitespace-nowrap">
                      {formatEventTime(event)}
                    </div>
                    <div className="text-gray-300">
                      {event.summary || 'Untitled Event'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">No upcoming events</p>
            )}
          </div>
          
          <button
            onClick={disconnectCalendar}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            Disconnect Google Calendar
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-center text-gray-400 py-8">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="mb-2">No calendar connected</p>
            <p className="text-sm">Connect your Google Calendar to manage events</p>
          </div>
          
          <button
            onClick={connectCalendar}
            disabled={connecting}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connecting ? 'Connecting...' : 'Connect Google Calendar'}
          </button>
          
          <div className="text-center text-gray-500 text-sm">
            <p>Grant access to:</p>
            <ul className="mt-2 space-y-1">
              <li>• View calendar events</li>
              <li>• Create and modify events</li>
              <li>• Automatic token refresh</li>
            </ul>
          </div>
        </div>
      )}
      </div>
    </details>
  );
}