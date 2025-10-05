'use client';

import { useState, useEffect } from 'react';

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
  location?: string;
  description?: string;
}

interface CalendarViewProps {
  walletAddress: string;
  refreshTrigger?: number;
}

type ViewMode = 'month' | 'week';

export default function CalendarView({ walletAddress, refreshTrigger }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Fetch events when component mounts or refreshTrigger changes
  useEffect(() => {
    fetchEvents();
  }, [walletAddress, currentDate, refreshTrigger]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      // Calculate date range based on view mode
      const startDate = getStartDate();
      const endDate = getEndDate();
      
      const params = new URLSearchParams({
        wallet_address: walletAddress,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        maxResults: '100'
      });

      const response = await fetch(`/api/calendar/google/events?${params}`);
      const data = await response.json();
      
      if (data.events) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStartDate = () => {
    if (viewMode === 'month') {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      // Get the Sunday before the first day of the month
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      return start;
    } else {
      // Week view - start from Sunday of current week
      const start = new Date(currentDate);
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      return start;
    }
  };

  const getEndDate = () => {
    if (viewMode === 'month') {
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      // Get the Saturday after the last day of the month
      const day = end.getDay();
      if (day < 6) {
        end.setDate(end.getDate() + (6 - day));
      }
      end.setHours(23, 59, 59, 999);
      return end;
    } else {
      // Week view - end on Saturday
      const end = new Date(currentDate);
      const day = end.getDay();
      end.setDate(end.getDate() + (6 - day));
      end.setHours(23, 59, 59, 999);
      return end;
    }
  };

  const navigatePrevious = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 7);
      setCurrentDate(newDate);
    }
  };

  const navigateNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 7);
      setCurrentDate(newDate);
    }
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  const getMonthYear = () => {
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getWeekRange = () => {
    const start = getStartDate();
    const end = getEndDate();
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const getDaysInView = () => {
    const days = [];
    const start = getStartDate();
    const end = getEndDate();
    const current = new Date(start);
    
    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start.dateTime || event.start.date || '');
      return eventDate.toDateString() === day.toDateString();
    });
  };

  const formatEventTime = (event: CalendarEvent) => {
    if (event.start.dateTime) {
      const date = new Date(event.start.dateTime);
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return 'All day';
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const renderMonthView = () => {
    const days = getDaysInView();
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="grid grid-cols-7 gap-px bg-gray-700">
        {/* Week day headers */}
        {weekDays.map(day => (
          <div key={day} className="bg-gray-800 p-2 text-center text-xs font-semibold text-gray-400">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {days.map((day, index) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonthDay = isCurrentMonth(day);
          const isTodayDay = isToday(day);
          
          return (
            <div
              key={index}
              className={`bg-gray-800 min-h-[100px] p-2 relative ${
                !isCurrentMonthDay ? 'opacity-50' : ''
              } ${isTodayDay ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className={`text-sm font-medium mb-1 ${
                isTodayDay ? 'text-blue-400' : 'text-gray-300'
              }`}>
                {day.getDate()}
              </div>
              
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(event => (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className="w-full text-left bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded px-1 py-0.5 text-xs truncate border border-blue-600/30"
                  >
                    <span className="font-medium">{formatEventTime(event)}</span>
                    <span className="ml-1">{event.summary}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 text-center">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeekView = () => {
    const days = getDaysInView();
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    return (
      <div className="flex flex-col">
        {/* Day headers */}
        <div className="grid grid-cols-8 gap-px bg-gray-700 sticky top-0 z-10">
          <div className="bg-gray-800 p-2"></div>
          {days.map((day, index) => (
            <div
              key={index}
              className={`bg-gray-800 p-2 text-center ${
                isToday(day) ? 'bg-blue-900/30' : ''
              }`}
            >
              <div className="text-xs font-semibold text-gray-400">
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className={`text-lg font-bold ${
                isToday(day) ? 'text-blue-400' : 'text-gray-300'
              }`}>
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>
        
        {/* Hour rows */}
        <div className="grid grid-cols-8 gap-px bg-gray-700">
          {hours.map(hour => (
            <>
              <div key={`hour-${hour}`} className="bg-gray-800 p-2 text-xs text-gray-500 text-right">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
              {days.map((day, dayIndex) => {
                const hourEvents = events.filter(event => {
                  if (!event.start.dateTime) return false;
                  const eventDate = new Date(event.start.dateTime);
                  return eventDate.toDateString() === day.toDateString() && 
                         eventDate.getHours() === hour;
                });
                
                return (
                  <div
                    key={`${hour}-${dayIndex}`}
                    className="bg-gray-800 min-h-[50px] p-1 border-t border-gray-700"
                  >
                    {hourEvents.map(event => (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="w-full text-left bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded px-1 py-0.5 text-xs truncate border border-purple-600/30"
                      >
                        {event.summary}
                      </button>
                    ))}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Calendar View
          </h2>
          
          {/* View mode toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                viewMode === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                viewMode === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              Week
            </button>
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={navigatePrevious}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={navigateToday}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={navigateNext}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          <h3 className="text-lg font-semibold text-gray-200">
            {viewMode === 'month' ? getMonthYear() : getWeekRange()}
          </h3>
        </div>
      </div>
      
      {/* Calendar Grid */}
      <div className="p-4 overflow-auto max-h-[600px]">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Loading events...</div>
          </div>
        ) : viewMode === 'month' ? (
          renderMonthView()
        ) : (
          renderWeekView()
        )}
      </div>
      
      {/* Event Details Modal */}
      {selectedEvent && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedEvent(null)}
        >
          <div 
            className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 border border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-4">{selectedEvent.summary}</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div className="text-gray-400">Time</div>
                  <div className="text-gray-200">
                    {selectedEvent.start.dateTime ? (
                      <>
                        {new Date(selectedEvent.start.dateTime).toLocaleString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                        {selectedEvent.end.dateTime && (
                          <> - {new Date(selectedEvent.end.dateTime).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit'
                          })}</>
                        )}
                      </>
                    ) : (
                      'All day event'
                    )}
                  </div>
                </div>
              </div>
              
              {selectedEvent.location && (
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div>
                    <div className="text-gray-400">Location</div>
                    <div className="text-gray-200">{selectedEvent.location}</div>
                  </div>
                </div>
              )}
              
              {selectedEvent.description && (
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  <div>
                    <div className="text-gray-400">Description</div>
                    <div className="text-gray-200 whitespace-pre-wrap">{selectedEvent.description}</div>
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={() => setSelectedEvent(null)}
              className="mt-6 w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}