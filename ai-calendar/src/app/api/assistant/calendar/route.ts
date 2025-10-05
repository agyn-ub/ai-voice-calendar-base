import { NextRequest, NextResponse } from 'next/server';
import { calendarAssistantService } from '@/lib/services/calendarAssistant';
import { accountsDb } from '@/lib/db/accountsDb';
import { AssistantRequest } from '@/types/openai';

export async function POST(request: NextRequest) {
  try {
    const body: AssistantRequest = await request.json();
    const { wallet_address, message, conversation_id, timezone } = body;
    
    // Validate request
    if (!wallet_address || !message) {
      return NextResponse.json(
        { error: 'Wallet address and message are required' },
        { status: 400 }
      );
    }
    
    // Check if calendar is connected
    const account = accountsDb.getAccountByWalletSync(wallet_address);
    if (!account) {
      return NextResponse.json(
        {
          error: 'No calendar connected',
          message: 'Please connect your Google Calendar first before using the assistant.',
          requiresConnection: true
        },
        { status: 404 }
      );
    }
    
    // Process the request through the assistant
    const response = await calendarAssistantService.processRequest({
      wallet_address,
      message,
      conversation_id,
      timezone
    });
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in calendar assistant:', error);
    
    if (error instanceof Error) {
      if (error.message === 'OPENAI_API_KEY is not configured') {
        return NextResponse.json(
          { 
            error: 'OpenAI service not configured',
            message: 'The calendar assistant is not available at this time. Please try again later.'
          },
          { status: 503 }
        );
      }
      
      if (error.message === 'Conversation belongs to a different wallet') {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        message: 'I encountered an error while processing your request. Please try again.'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const conversationId = searchParams.get('conversation_id');
  
  if (!conversationId) {
    return NextResponse.json(
      { error: 'Conversation ID is required' },
      { status: 400 }
    );
  }
  
  const conversation = calendarAssistantService.getConversation(conversationId);
  
  if (!conversation) {
    return NextResponse.json(
      { error: 'Conversation not found' },
      { status: 404 }
    );
  }
  
  return NextResponse.json({
    id: conversation.id,
    messagesCount: conversation.messages.length,
    createdAt: conversation.createdAt,
    lastActivity: conversation.lastActivity
  });
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const conversationId = searchParams.get('conversation_id');
  
  if (!conversationId) {
    return NextResponse.json(
      { error: 'Conversation ID is required' },
      { status: 400 }
    );
  }
  
  const deleted = calendarAssistantService.clearConversation(conversationId);
  
  if (!deleted) {
    return NextResponse.json(
      { error: 'Conversation not found' },
      { status: 404 }
    );
  }
  
  return NextResponse.json({ success: true, message: 'Conversation cleared' });
}