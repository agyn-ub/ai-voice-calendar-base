import OpenAI from 'openai';
import { openAIService } from './openai';
import { AssistantRequest, AssistantResponse } from '@/types/openai';

interface ConversationContext {
  id: string;
  walletAddress: string;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  createdAt: Date;
  lastActivity: Date;
}

export class CalendarAssistantService {
  private conversations: Map<string, ConversationContext> = new Map();
  private readonly CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  
  constructor() {
    // Clean up old conversations periodically
    setInterval(() => this.cleanupOldConversations(), 5 * 60 * 1000); // Every 5 minutes
  }
  
  async processRequest(request: AssistantRequest): Promise<AssistantResponse> {
    const { wallet_address, message, conversation_id, timezone } = request;
    
    // Get or create conversation context
    const conversationId = conversation_id || this.generateConversationId();
    let context = this.conversations.get(conversationId);
    
    if (!context) {
      context = {
        id: conversationId,
        walletAddress: wallet_address,
        messages: [],
        createdAt: new Date(),
        lastActivity: new Date()
      };
      this.conversations.set(conversationId, context);
    } else {
      // Validate wallet address matches
      if (context.walletAddress !== wallet_address) {
        throw new Error('Conversation belongs to a different wallet');
      }
      context.lastActivity = new Date();
    }
    
    try {
      // Process the request with OpenAI
      const result = await openAIService.processCalendarRequest(
        message,
        wallet_address,
        context.messages,
        timezone
      );

      // Log disambiguation status
      if (result.needsDisambiguation) {
        console.log('[CalendarAssistant] Disambiguation required, passing through to frontend');
      }
      
      // Update conversation history with proper message sequence
      context.messages.push({ role: 'user', content: message });
      
      // If there were tool calls, add them to history with responses
      if (result.toolCalls && result.toolCalls.length > 0) {
        // Add the assistant message with tool calls
        context.messages.push({ 
          role: 'assistant',
          content: null,
          tool_calls: result.toolCalls
        } as OpenAI.Chat.ChatCompletionMessageParam);
        
        // Add tool response messages
        if (result.toolResponses) {
          for (const toolResponse of result.toolResponses) {
            context.messages.push({
              role: 'tool',
              content: toolResponse.content,
              tool_call_id: toolResponse.tool_call_id
            } as OpenAI.Chat.ChatCompletionToolMessageParam);
          }
        }
      }
      
      // Add the final assistant message
      context.messages.push({ 
        role: 'assistant', 
        content: result.message
      });
      
      // Keep conversation history manageable (last 20 messages)
      if (context.messages.length > 20) {
        context.messages = context.messages.slice(-20);
      }
      
      return {
        message: result.message,
        actions_taken: result.actions_taken,
        events: result.events,
        conversation_id: conversationId,
        needsDisambiguation: result.needsDisambiguation,
        ambiguousContacts: result.ambiguousContacts,
        pendingEvent: result.pendingEvent,
        needsStakeFlow: result.needsStakeFlow
      };
    } catch (error) {
      console.error('Error processing assistant request:', error);
      
      // Return a helpful error message
      return {
        message: 'I encountered an error while processing your request. Please make sure your calendar is connected and try again.',
        conversation_id: conversationId
      };
    }
  }
  
  getConversation(conversationId: string): ConversationContext | undefined {
    return this.conversations.get(conversationId);
  }
  
  clearConversation(conversationId: string): boolean {
    return this.conversations.delete(conversationId);
  }
  
  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private cleanupOldConversations(): void {
    const now = Date.now();
    
    for (const [id, context] of this.conversations.entries()) {
      if (now - context.lastActivity.getTime() > this.CONVERSATION_TIMEOUT) {
        this.conversations.delete(id);
      }
    }
  }
  
  // Helper method to format events for display
  formatEventsForDisplay(events: any[]): string {
    if (!events || events.length === 0) {
      return 'No events found.';
    }
    
    const formattedEvents = events.map(event => {
      const start = event.start?.dateTime || event.start?.date;
      const end = event.end?.dateTime || event.end?.date;
      const startDate = new Date(start);
      const endDate = new Date(end);
      
      const dateStr = startDate.toLocaleDateString();
      const startTime = event.start?.dateTime 
        ? startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'All day';
      const endTime = event.end?.dateTime
        ? endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
      
      let eventStr = `• ${event.summary || 'Untitled Event'}\n`;
      eventStr += `  ${dateStr} ${startTime}`;
      if (endTime) eventStr += ` - ${endTime}`;
      if (event.location) eventStr += `\n  📍 ${event.location}`;
      
      return eventStr;
    }).join('\n\n');
    
    return formattedEvents;
  }
  
  // Helper method to suggest next actions
  suggestNextActions(lastAction: string): string[] {
    const suggestions: string[] = [];
    
    switch (lastAction) {
      case 'get_calendar_events':
        suggestions.push(
          'Would you like to create a new event?',
          'Should I search for a specific event?',
          'Do you want to see events for a different date range?'
        );
        break;
        
      case 'create_calendar_event':
        suggestions.push(
          'Would you like to add attendees to this event?',
          'Should I set a reminder for this event?',
          'Do you want to create another event?'
        );
        break;
        
      case 'update_calendar_event':
        suggestions.push(
          'Would you like to update another event?',
          'Should I show you the updated event details?',
          'Do you want to invite more people to this event?'
        );
        break;
        
      case 'delete_calendar_event':
        suggestions.push(
          'Would you like to see your remaining events?',
          'Should I help you reschedule instead?',
          'Do you want to delete another event?'
        );
        break;
        
      default:
        suggestions.push(
          'What would you like to do with your calendar?',
          'I can help you view, create, update, or delete events.',
          'Just tell me what you need!'
        );
    }
    
    return suggestions;
  }
}

export const calendarAssistantService = new CalendarAssistantService();