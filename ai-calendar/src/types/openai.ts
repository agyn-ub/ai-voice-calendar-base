import { calendar_v3 } from 'googleapis';

export interface CalendarToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    optional?: boolean;
  }>;
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  recurrence?: string[];
  colorId?: string;
  stakeRequired?: number; // Optional FLOW stake requirement
}

export interface GetEventsParams {
  wallet_address: string;
  timeMin?: string;
  timeMax?: string;
  searchQuery?: string;
  maxResults?: number;
}

export interface CreateEventParams {
  wallet_address: string;
  event: CalendarEventInput;
}

export interface UpdateEventParams {
  wallet_address: string;
  eventId: string;
  event: Partial<CalendarEventInput>;
}

export interface DeleteEventParams {
  wallet_address: string;
  eventId: string;
}

export interface SearchEventsParams {
  wallet_address: string;
  query: string;
  timeMin?: string;
  timeMax?: string;
}

export interface AssistantRequest {
  wallet_address: string;
  message: string;
  conversation_id?: string;
  timezone?: string;
}

export interface AssistantResponse {
  message: string;
  actions_taken?: Array<{
    type: 'get_events' | 'create_event' | 'update_event' | 'delete_event' | 'search_events';
    status: 'success' | 'error';
    details?: any;
  }>;
  events?: calendar_v3.Schema$Event[];
  conversation_id: string;
  toolResponses?: Array<{
    tool_call_id: string;
    content: string;
  }>;
  needsDisambiguation?: boolean;
  ambiguousContacts?: AmbiguousContact[];
  pendingEvent?: PendingEvent;
}

export interface AmbiguousContact {
  searchQuery: string;
  matches: ContactMatch[];
}

export interface ContactMatch {
  email: string;
  name: string;
  confidence: number;
}

export interface PendingEvent {
  summary: string;
  description?: string;
  location?: string;
  startDateTime: string;
  endDateTime: string;
  isAllDay?: boolean;
  reminderMinutes?: number;
  recurrence?: string;
  stakeRequired?: number;
  resolvedAttendees?: string[];
}

export const CALENDAR_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_calendar_events',
      description: 'Get calendar events within a specified time range',
      parameters: {
        type: 'object',
        properties: {
          timeMin: {
            type: 'string',
            description: 'Start time in ISO 8601 format (e.g., 2024-01-15T09:00:00Z)'
          },
          timeMax: {
            type: 'string',
            description: 'End time in ISO 8601 format'
          },
          searchQuery: {
            type: 'string',
            description: 'Optional search query to filter events'
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of events to return (default: 50)'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_calendar_event',
      description: 'Create a new calendar event. Extract time components separately for accurate parsing. IMPORTANT: Extract any person mentioned with "with", "and", or after "meeting" as an attendee.',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'Event title/name. Extract the PURPOSE or TYPE of event, NOT the attendees. For "meeting with Tom" use "Meeting" as title and add "Tom" to attendeeEmails. For "lunch with Sarah" use "Lunch" and add "Sarah" to attendeeEmails. Only include person names in title if they are the subject (e.g., "Tom\'s birthday party").'
          },
          description: {
            type: 'string',
            description: 'Event description'
          },
          location: {
            type: 'string',
            description: 'Event location'
          },
          startDate: {
            type: 'string',
            description: 'Start date in YYYY-MM-DD format (e.g., "2024-01-15")'
          },
          startHour: {
            type: 'number',
            description: 'Start hour (1-12 for 12-hour format, 0-23 for 24-hour format). For "2:00 PM" use 2, for "14:00" use 14'
          },
          startMinute: {
            type: 'number',
            description: 'Start minute (0-59). For "2:00 PM" use 0, for "2:30 PM" use 30'
          },
          startPeriod: {
            type: 'string',
            enum: ['AM', 'PM', 'NONE'],
            description: 'Time period: AM, PM, or NONE for 24-hour format. For "2:00 PM" use "PM", for "14:00" use "NONE"'
          },
          durationMinutes: {
            type: 'number',
            description: 'Duration of the event in minutes (default: 60). For "1 hour" use 60, for "30 minutes" use 30'
          },
          attendeeEmails: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'List of attendees - extract ANY person mentioned in the request. This includes: people after "with" (e.g., "meeting with Tom" → ["Tom"]), people after "and" (e.g., "Tom and Sarah" → ["Tom", "Sarah"]), people mentioned as participants (e.g., "schedule a call with Agyn Bolatov" → ["Agyn Bolatov"]). Can be email addresses or contact names. The system will resolve names to emails.'
          },
          reminderMinutes: {
            type: 'number',
            description: 'Reminder time in minutes before the event'
          },
          isAllDay: {
            type: 'boolean',
            description: 'Whether this is an all-day event'
          },
          recurrence: {
            type: 'string',
            description: 'Recurrence rule (e.g., "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR")'
          },
          stakeRequired: {
            type: 'number',
            description: 'Optional: Amount of FLOW tokens required to stake for attending this meeting. Attendees must stake this amount and will get it back if they attend, or lose it if they miss.'
          }
        },
        required: ['summary', 'startDate', 'startHour', 'startMinute', 'startPeriod']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_calendar_event',
      description: 'Update an existing calendar event',
      parameters: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'ID of the event to update'
          },
          summary: {
            type: 'string',
            description: 'New event title'
          },
          description: {
            type: 'string',
            description: 'New event description'
          },
          location: {
            type: 'string',
            description: 'New event location'
          },
          startDateTime: {
            type: 'string',
            description: 'New start date and time in ISO 8601 format'
          },
          endDateTime: {
            type: 'string',
            description: 'New end date and time in ISO 8601 format'
          },
          attendeeEmails: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Updated list of attendees - can be email addresses or contact names. The system will automatically resolve names to email addresses.'
          }
        },
        required: ['eventId']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_calendar_event',
      description: 'Delete a calendar event',
      parameters: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'ID of the event to delete'
          }
        },
        required: ['eventId']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_calendar_events',
      description: 'Search for calendar events by keyword or phrase',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to find events'
          },
          timeMin: {
            type: 'string',
            description: 'Start time for search range in ISO 8601 format'
          },
          timeMax: {
            type: 'string',
            description: 'End time for search range in ISO 8601 format'
          }
        },
        required: ['query']
      }
    }
  }
];