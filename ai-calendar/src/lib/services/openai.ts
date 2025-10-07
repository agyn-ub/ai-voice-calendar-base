import OpenAI from 'openai';
import { CALENDAR_TOOLS, CalendarEventInput } from '@/types/openai';
import { googleCalendarService } from './googleCalendar';
import { localContactsService } from './localContacts';
import { calendar_v3 } from 'googleapis';
import { formatDateTimeWithTimezone, addDurationToDateTime, assembleDateTime } from '@/lib/utils/timezone';

export class OpenAIService {
  private client: OpenAI;
  private userTimezone: string = 'UTC';

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async processCalendarRequest(
    message: string,
    walletAddress: string,
    conversationHistory: OpenAI.Chat.ChatCompletionMessageParam[] = [],
    timezone?: string
  ) {
    // Store timezone for use in tool execution
    if (timezone) {
      this.userTimezone = timezone;
    }
    const systemPrompt = `You are a helpful calendar assistant. You can help users manage their Google Calendar by:
- Viewing upcoming events
- Creating new events
- Updating existing events
- Deleting events
- Searching for specific events

When users ask about their schedule, use the appropriate calendar tools to help them.
Parse natural language dates and times accurately. Today's date is ${new Date().toLocaleDateString()}.
The user's timezone is ${this.userTimezone}.

ATTENDEE HANDLING:
When users mention people to invite to events, you can use either:
1. Email addresses (e.g., "john@example.com")
2. Contact names (e.g., "John", "John Smith", "Tom")

For the attendeeEmails parameter, pass EXACTLY what the user provides:
- If they give an email address, pass the email address
- If they give a name, pass the name as-is
- The system will automatically look up contacts by name and resolve them to email addresses

Examples:
- "Schedule a meeting with Tom" → attendeeEmails: ["Tom"]
- "Invite Sarah and Mike to lunch" → attendeeEmails: ["Sarah", "Mike"]
- "Meeting with john@example.com" → attendeeEmails: ["john@example.com"]
- "Call with Tom Smith and sarah@work.com" → attendeeEmails: ["Tom Smith", "sarah@work.com"]

RESPONSE FORMATTING RULES:
- When confirming calendar actions, provide ONLY the essential details
- Do NOT include Google Calendar links or URLs in responses
- Do NOT say "You can view it here" or provide any viewing links
- Simply confirm what was done with the event details
- Example response: "I've scheduled your event 'Team Meeting' on January 15, 2025, at 2 PM for 1 hour."

CRITICAL RULES for create_calendar_event:

1. TITLE EXTRACTION (summary field):
Extract the most descriptive title from the user's message:
- "Schedule a meeting titled 'Visit Bank'" → summary: "Visit Bank"
- "Doctor appointment at 3pm" → summary: "Doctor appointment"
- "Lunch with Sarah tomorrow" → summary: "Lunch with Sarah"
- "Team standup at 10am" → summary: "Team standup"
- "Call with client about project" → summary: "Call with client about project"
- "Dinner at Italian restaurant" → summary: "Dinner at Italian restaurant"
- "Birthday party for John" → summary: "Birthday party for John"
- "Dentist appointment" → summary: "Dentist appointment"
- "Meeting with investors" → summary: "Meeting with investors"
- "Yoga class" → summary: "Yoga class"
- "Flight to New York" → summary: "Flight to New York"

Only use "Meeting" as the title when NO other descriptive information is available.
Always prefer specific, descriptive titles over generic ones.

2. TIME PARSING:
When extracting time components, follow these rules EXACTLY:

For 12-hour format (AM/PM):
- "2:00 PM" or "2 PM" → startHour: 2, startMinute: 0, startPeriod: "PM"
- "2:30 AM" → startHour: 2, startMinute: 30, startPeriod: "AM"
- "12:00 PM" (noon) → startHour: 12, startMinute: 0, startPeriod: "PM"
- "12:00 AM" (midnight) → startHour: 12, startMinute: 0, startPeriod: "AM"

For 24-hour format:
- "14:00" → startHour: 14, startMinute: 0, startPeriod: "NONE"
- "02:00" → startHour: 2, startMinute: 0, startPeriod: "NONE"
- "00:00" → startHour: 0, startMinute: 0, startPeriod: "NONE"

Context-based assumptions:
- "Meeting at 2" (business context) → assume 2 PM (startHour: 2, startPeriod: "PM")
- "Call at 9" (morning context) → assume 9 AM (startHour: 9, startPeriod: "AM")
- "Dinner at 7" → assume 7 PM (startHour: 7, startPeriod: "PM")
- "Breakfast at 8" → assume 8 AM (startHour: 8, startPeriod: "AM")

3. DURATION:
- If no duration specified, use durationMinutes: 60
- "for 1 hour" → durationMinutes: 60
- "for 30 minutes" → durationMinutes: 30
- "for 2 hours" → durationMinutes: 120

Be concise and helpful in your responses.`;

    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: message }
      ];

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools: CALENDAR_TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 1000
      });

      const assistantMessage = response.choices[0].message;
      const toolCalls = assistantMessage.tool_calls;

      const actionsExecuted: Array<{
        type: string;
        status: 'success' | 'error';
        details: unknown;
      }> = [];
      const toolResponses: Array<{
        tool_call_id: string;
        content: string;
      }> = [];
      let events: calendar_v3.Schema$Event[] = [];

      if (toolCalls && toolCalls.length > 0) {
        // Create a messages array for the follow-up call if we have tool calls
        const messagesWithTools: OpenAI.Chat.ChatCompletionMessageParam[] = [
          ...messages,
          assistantMessage as OpenAI.Chat.ChatCompletionMessageParam
        ];
        
        for (const toolCall of toolCalls) {
          if (!('function' in toolCall)) continue;
          const functionName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);

          let toolResult;
          let toolError = null;
          
          try {
            toolResult = await this.executeToolCall(
              functionName,
              args,
              walletAddress
            );

            actionsExecuted.push({
              type: functionName,
              status: 'success',
              details: toolResult
            });

            if (functionName === 'get_calendar_events' || functionName === 'search_calendar_events') {
              events = toolResult as calendar_v3.Schema$Event[];
            }
          } catch (error) {
            toolError = error instanceof Error ? error.message : 'Unknown error';
            toolResult = { error: toolError };
            actionsExecuted.push({
              type: functionName,
              status: 'error',
              details: toolError
            });
          }
          
          // Create tool response message
          const toolResponse: OpenAI.Chat.ChatCompletionToolMessageParam = {
            role: 'tool',
            content: JSON.stringify(toolResult),
            tool_call_id: toolCall.id
          };
          
          messagesWithTools.push(toolResponse);
          toolResponses.push({
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        }
        
        // Make a follow-up call to get the final response after tool execution
        const finalResponse = await this.client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: messagesWithTools,
          temperature: 0.7,
          max_tokens: 1000
        });
        
        const finalMessage = finalResponse.choices[0].message;
        
        // Parse tool responses to check for disambiguation or stake flow
        let needsDisambiguation = false;
        let ambiguousContacts = undefined;
        let pendingEvent = undefined;
        let needsStake = false;

        for (const response of toolResponses) {
          try {
            const parsed = JSON.parse(response.content);
            if (parsed.needsDisambiguation) {
              needsDisambiguation = true;
              ambiguousContacts = parsed.ambiguousContacts;
              pendingEvent = parsed.pendingEvent;
              console.log('[OpenAI] Disambiguation detected in tool response');
              break;
            }
            if (parsed.needsStake) {
              needsStake = true;
              pendingEvent = parsed.pendingEvent;
              console.log('[OpenAI] Stake flow needed with', parsed.pendingEvent?.stakeRequired, 'ETH');
            }
          } catch {
            // Ignore parse errors for non-disambiguation responses
          }
        }

        return {
          message: finalMessage.content || '',
          actions_taken: actionsExecuted,
          events,
          toolCalls,
          toolResponses,
          needsDisambiguation,
          ambiguousContacts,
          pendingEvent,
          needsStake
        };
      }

      return {
        message: assistantMessage.content || '',
        actions_taken: actionsExecuted,
        events,
        toolCalls
      };
    } catch (error) {
      console.error('Error processing calendar request:', error);
      throw new Error('Failed to process calendar request');
    }
  }

  private async executeToolCall(
    functionName: string,
    args: Record<string, unknown>,
    walletAddress: string
  ): Promise<calendar_v3.Schema$Event[] | calendar_v3.Schema$Event | { error: string } | unknown> {
    switch (functionName) {
      case 'get_calendar_events':
        return await this.getCalendarEvents(walletAddress, args);

      case 'create_calendar_event':
        return await this.createCalendarEvent(walletAddress, args);

      case 'update_calendar_event':
        return await this.updateCalendarEvent(walletAddress, args);

      case 'delete_calendar_event':
        return await this.deleteCalendarEvent(walletAddress, args);

      case 'search_calendar_events':
        return await this.searchCalendarEvents(walletAddress, args);

      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  }

  private async getCalendarEvents(walletAddress: string, args: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
  }) {
    const { timeMin, timeMax, maxResults = 50 } = args;

    const events = await googleCalendarService.getCalendarEvents(
      walletAddress,
      timeMin ? new Date(timeMin) : new Date(),
      timeMax ? new Date(timeMax) : undefined
    );

    return events.slice(0, maxResults);
  }

  private async createCalendarEvent(walletAddress: string, args: {
    summary: string;
    description?: string;
    location?: string;
    startDate: string;
    startHour: number;
    startMinute: number;
    startPeriod: 'AM' | 'PM' | 'NONE';
    durationMinutes?: number;
    attendeeEmails?: string[];
    reminderMinutes?: number;
    isAllDay?: boolean;
    recurrence?: string;
    stakeRequired?: number;
  }) {
    const {
      summary,
      description,
      location,
      startDate,
      startHour,
      startMinute,
      startPeriod,
      durationMinutes = 60,
      attendeeEmails,
      reminderMinutes,
      isAllDay,
      recurrence,
      stakeRequired
    } = args;

    console.log('[OpenAI] Raw arguments from OpenAI:', JSON.stringify(args, null, 2));
    console.log('[OpenAI] Attendees array:', attendeeEmails);

    console.log('Creating event with time components:', {
      startDate,
      startHour,
      startMinute,
      startPeriod,
      durationMinutes
    });

    let formattedStartDateTime: string;
    let formattedEndDateTime: string;
    
    if (isAllDay) {
      // For all-day events, use date format
      formattedStartDateTime = startDate;
      // Add one day for all-day events
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      formattedEndDateTime = endDate.toISOString().split('T')[0];
    } else {
      // Use structured components to assemble datetime
      try {
        formattedStartDateTime = assembleDateTime(
          startDate,
          startHour,
          startMinute,
          startPeriod,
          this.userTimezone
        );
        
        // Calculate end time based on duration
        formattedEndDateTime = addDurationToDateTime(
          formattedStartDateTime,
          durationMinutes,
          this.userTimezone
        );

        console.log('Assembled datetime:', {
          start: formattedStartDateTime,
          end: formattedEndDateTime
        });
      } catch (error) {
        console.error('Error assembling datetime:', error);
        throw new Error('Failed to parse event time. Please check the time format.');
      }
    }

    const event: CalendarEventInput = {
      summary,
      description,
      location,
      start: isAllDay
        ? { date: formattedStartDateTime }
        : { dateTime: formattedStartDateTime },
      end: isAllDay
        ? { date: formattedEndDateTime }
        : { dateTime: formattedEndDateTime }
    };

    if (attendeeEmails && attendeeEmails.length > 0) {
      console.log('[OpenAI] Processing attendees for event creation:', JSON.stringify(attendeeEmails));

      // Resolve attendee names to email addresses if needed
      const { resolved, details, ambiguous } = await localContactsService.resolveAttendees(
        walletAddress,
        attendeeEmails
      );

      console.log('[OpenAI] Attendee resolution summary:');
      details.forEach(detail => console.log(`  ${detail}`));

      // Check if we have ambiguous contacts that need disambiguation
      if (ambiguous && ambiguous.length > 0) {
        console.log('[OpenAI] Disambiguation needed for contacts:',
          ambiguous.map(a => ({
            query: a.searchQuery,
            matches: a.matches.length,
            contacts: a.matches.map(m => `${m.name} (${m.email})`)
          })));
        // Return special response indicating disambiguation is needed
        return {
          needsDisambiguation: true,
          ambiguousContacts: ambiguous,
          pendingEvent: {
            summary,
            description,
            location,
            startDateTime: formattedStartDateTime,
            endDateTime: formattedEndDateTime,
            isAllDay,
            reminderMinutes,
            recurrence,
            stakeRequired,
            resolvedAttendees: resolved // Keep any that were resolved
          },
          message: `I found multiple contacts matching some of the names. Please clarify which ones you meant.`
        };
      }

      if (resolved.length > 0) {
        event.attendees = resolved.map((email: string) => ({ email }));
        console.log(`[OpenAI] Added ${resolved.length} attendees to event`);
      } else {
        console.warn('[OpenAI] No attendees could be resolved');
      }
    }

    if (reminderMinutes) {
      event.reminders = {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: reminderMinutes }
        ]
      };
    }

    if (recurrence) {
      event.recurrence = [recurrence];
    }

    // Apply default stake if attendees are present and no stake specified
    const DEFAULT_STAKE_AMOUNT = 0.01; // Default 0.01 ETH for meetings with attendees
    const effectiveStakeAmount = stakeRequired || (event.attendees && event.attendees.length > 0 ? DEFAULT_STAKE_AMOUNT : 0);

    if (effectiveStakeAmount > 0) {
      event.stakeRequired = effectiveStakeAmount;

      // If there are attendees and stake is required, don't create calendar event yet
      // Return the event details for the stake flow
      if (event.attendees && event.attendees.length > 0) {
        console.log('[OpenAI] Meeting with attendees - using stake flow with', effectiveStakeAmount, 'ETH');
        return {
          success: true,
          message: 'Event details prepared for stake flow',
          pendingEvent: {
            summary: event.summary,
            description: event.description,
            location: event.location,
            startDateTime: event.start.dateTime || event.start.date,
            endDateTime: event.end.dateTime || event.end.date,
            isAllDay: isAllDay,
            reminderMinutes: reminderMinutes,
            recurrence: recurrence,
            stakeRequired: effectiveStakeAmount,
            resolvedAttendees: event.attendees.map((a: { email: string }) => a.email)
          },
          needsStake: true
        };
      }
    }

    // Create calendar event immediately if no stake or no attendees
    return await googleCalendarService.createCalendarEvent(walletAddress, event);
  }

  private async updateCalendarEvent(walletAddress: string, args: {
    eventId: string;
    summary?: string;
    description?: string;
    location?: string;
    startDateTime?: string;
    endDateTime?: string;
    attendeeEmails?: string[];
  }) {
    const { eventId, ...updateFields } = args;

    const event: Partial<CalendarEventInput> = {};

    if (updateFields.summary) event.summary = updateFields.summary;
    if (updateFields.description) event.description = updateFields.description;
    if (updateFields.location) event.location = updateFields.location;

    if (updateFields.startDateTime) {
      // Format with timezone if not already formatted
      let formattedDateTime = updateFields.startDateTime;
      if (!formattedDateTime.match(/[+-]\d{2}:\d{2}$/) && !formattedDateTime.endsWith('Z')) {
        formattedDateTime = formatDateTimeWithTimezone(formattedDateTime, this.userTimezone);
      }
      event.start = { dateTime: formattedDateTime };
    }

    if (updateFields.endDateTime) {
      // Format with timezone if not already formatted
      let formattedDateTime = updateFields.endDateTime;
      if (!formattedDateTime.match(/[+-]\d{2}:\d{2}$/) && !formattedDateTime.endsWith('Z')) {
        formattedDateTime = formatDateTimeWithTimezone(formattedDateTime, this.userTimezone);
      }
      event.end = { dateTime: formattedDateTime };
    }

    if (updateFields.attendeeEmails) {
      console.log('[OpenAI] Processing attendees for event update:', updateFields.attendeeEmails);

      // Resolve attendee names to email addresses if needed
      const { resolved, details } = await localContactsService.resolveAttendees(
        walletAddress,
        updateFields.attendeeEmails
      );

      console.log('[OpenAI] Attendee resolution summary for update:');
      details.forEach(detail => console.log(`  ${detail}`));

      if (resolved.length > 0) {
        event.attendees = resolved.map((email: string) => ({ email }));
        console.log(`[OpenAI] Updated event with ${resolved.length} attendees`);
      } else {
        console.warn('[OpenAI] No attendees could be resolved for update');
      }
    }

    return await googleCalendarService.updateCalendarEvent(walletAddress, eventId, event);
  }

  private async deleteCalendarEvent(walletAddress: string, args: {
    eventId: string;
  }) {
    const { eventId } = args;
    return await googleCalendarService.deleteCalendarEvent(walletAddress, eventId);
  }

  private async searchCalendarEvents(walletAddress: string, args: {
    query: string;
    timeMin?: string;
    timeMax?: string;
  }) {
    const { query, timeMin, timeMax } = args;

    const events = await googleCalendarService.getCalendarEvents(
      walletAddress,
      timeMin ? new Date(timeMin) : new Date(),
      timeMax ? new Date(timeMax) : undefined
    );

    const searchLower = query.toLowerCase();
    return events.filter((event: calendar_v3.Schema$Event) => {
      const summary = event.summary?.toLowerCase() || '';
      const description = event.description?.toLowerCase() || '';
      const location = event.location?.toLowerCase() || '';

      return summary.includes(searchLower) ||
        description.includes(searchLower) ||
        location.includes(searchLower);
    });
  }

  parseNaturalLanguageDate(input: string): Date {
    const now = new Date();
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('today')) {
      return now;
    }

    if (lowerInput.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }

    if (lowerInput.includes('next week')) {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek;
    }

    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < daysOfWeek.length; i++) {
      if (lowerInput.includes(daysOfWeek[i])) {
        const targetDay = i;
        const currentDay = now.getDay();
        let daysToAdd = targetDay - currentDay;

        if (daysToAdd <= 0) {
          daysToAdd += 7;
        }

        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + daysToAdd);
        return targetDate;
      }
    }

    try {
      return new Date(input);
    } catch {
      return now;
    }
  }
}

export const openAIService = new OpenAIService();