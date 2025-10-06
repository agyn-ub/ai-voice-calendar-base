import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a meeting scheduler assistant. Extract meeting details from voice commands.

Extract the following information:
1. Meeting title/purpose
2. Date and time (convert relative dates like "tomorrow" to actual dates)
3. Duration (default 1 hour if not specified)
4. Stake amount in FLOW (default 10 if not specified)
5. Participants (names or emails)

Return a JSON object with this structure:
{
  "title": "Meeting title",
  "startTime": "ISO datetime string",
  "endTime": "ISO datetime string",
  "stakeAmount": number,
  "participants": ["email1", "email2"],
  "description": "Optional description"
}

Current date/time for reference: ${new Date().toISOString()}

Examples:
- "Team meeting tomorrow 3pm, stake 10 FLOW" -> Extract title: "Team meeting", time: tomorrow 3pm, stake: 10
- "Meeting with Sarah about project, 20 FLOW stake" -> Extract title: "Meeting with Sarah", participants: ["Sarah"], stake: 20
- "Daily standup 9am" -> Extract title: "Daily standup", time: today 9am if before 9am else tomorrow 9am, stake: 10 (default)
`;

export async function POST(request: NextRequest) {
  try {
    const { wallet_address, voice_command } = await request.json();

    if (!wallet_address || !voice_command) {
      return NextResponse.json(
        { error: 'Wallet address and voice command are required' },
        { status: 400 }
      );
    }

    // Use OpenAI to parse the voice command
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: voice_command }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const parsedData = JSON.parse(completion.choices[0].message.content || '{}');

    // Validate required fields
    if (!parsedData.title || !parsedData.startTime) {
      return NextResponse.json(
        { error: 'Could not extract meeting details from command' },
        { status: 400 }
      );
    }

    // Ensure endTime exists (add 1 hour if not specified)
    if (!parsedData.endTime) {
      const startDate = new Date(parsedData.startTime);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Add 1 hour
      parsedData.endTime = endDate.toISOString();
    }

    // Set default stake if not specified and ensure it's a number
    if (!parsedData.stakeAmount) {
      parsedData.stakeAmount = 10.0;
    } else {
      // Ensure stakeAmount is a number with decimal
      parsedData.stakeAmount = parseFloat(parsedData.stakeAmount);
    }

    // Set default participants if not specified
    if (!parsedData.participants || parsedData.participants.length === 0) {
      parsedData.participants = [];
    }

    return NextResponse.json({
      success: true,
      ...parsedData,
      original_command: voice_command,
    });

  } catch (error) {
    console.error('Error processing voice command:', error);
    return NextResponse.json(
      { error: 'Failed to process voice command' },
      { status: 500 }
    );
  }
}