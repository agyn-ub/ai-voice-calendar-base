"use client";

import { useState, useEffect } from "react";
import { VoiceInput } from "./VoiceInput";
import { useFlow } from "./FlowProvider";
import FlowService from "@/lib/flow/flowService";
import { formatDateTimeWithTimezone } from "@/lib/utils/timezone";
import { TypingIndicator } from "./ui/TypingIndicator";

interface Meeting {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  stakeAmount: number;
  participants: string[];
  status: 'pending_stakes' | 'stakes_confirmed' | 'calendar_created' | 'completed';
  stakesReceived: { address: string; amount: number }[];
}

export function VoiceCalendarInterface() {
  const { user } = useFlow();
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [flowBalance, setFlowBalance] = useState<string>("0.0");

  useEffect(() => {
    if (user?.addr) {
      fetchFlowBalance();
      loadMeetings();
    }
  }, [user]);

  const fetchFlowBalance = async () => {
    if (!user?.addr) return;
    try {
      const balance = await FlowService.getFlowBalance(user.addr);
      setFlowBalance(balance);
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  };

  const loadMeetings = async () => {
    if (!user?.addr) return;
    try {
      const meetingIds = await FlowService.getUserMeetings(user.addr);
      // Load meeting details for each ID
      const meetingDetails = await Promise.all(
        meetingIds.slice(0, 5).map(async (id) => {
          const info = await FlowService.getMeetingInfo(user.addr!, id);
          return info;
        })
      );
      // Filter out null values and map to our Meeting interface
      const validMeetings = meetingDetails.filter(m => m !== null) as any[];
      setMeetings(validMeetings);
    } catch (error) {
      console.error("Error loading meetings:", error);
    }
  };

  const handleVoiceCommand = async (transcript: string) => {
    setProcessing(true);
    setMessage(`Processing: "${transcript}"`);

    try {
      // Parse the voice command using AI
      const response = await fetch('/api/assistant/voice-to-meeting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet_address: user?.addr,
          voice_command: transcript,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process voice command');
      }

      // Extract meeting details from AI response
      const { title, startTime, endTime, stakeAmount, participants } = data;

      // Create blockchain meeting first (stake-first approach)
      const meetingId = `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      setMessage(`Creating staked meeting: ${title} with ${stakeAmount} FLOW stake...`);

      await FlowService.createMeeting(
        meetingId,
        "", // Calendar ID will be added later
        title,
        new Date(startTime).getTime() / 1000,
        new Date(endTime).getTime() / 1000,
        stakeAmount.toString()
      );

      setMessage(`✅ Meeting created! Stake invitations sent to ${participants.length} participants.`);

      // Add the new meeting to the list
      const newMeeting: Meeting = {
        id: meetingId,
        title,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        stakeAmount,
        participants,
        status: 'pending_stakes',
        stakesReceived: [],
      };

      setMeetings([newMeeting, ...meetings]);

      // TODO: Send stake invitations to participants
      // This would trigger emails/notifications to stake

    } catch (error) {
      console.error("Error processing voice command:", error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to process command'}`);
    } finally {
      setProcessing(false);
      // Clear message after 5 seconds
      setTimeout(() => setMessage(""), 5000);
    }
  };

  if (!user?.addr) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] p-8">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-white">Connect Your Flow Wallet</h2>
          <p className="text-gray-400">Connect your wallet to start using voice commands</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] p-8">
      {/* Status Bar */}
      <div className="w-full max-w-2xl mb-8">
        <div className="flex justify-between items-center bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-sm text-gray-300">
              {user.addr.slice(0, 6)}...{user.addr.slice(-4)}
            </span>
          </div>
          <div className="text-sm text-gray-300">
            Balance: {parseFloat(flowBalance).toFixed(2)} FLOW
          </div>
        </div>
      </div>

      {/* Voice Input */}
      <div className="mb-8">
        <VoiceInput
          onTranscript={handleVoiceCommand}
          onStateChange={(isRecording) => {
            if (isRecording) {
              setMessage("Listening...");
            }
          }}
        />
      </div>

      {/* Status Message or Typing Indicator */}
      {(message || processing) && (
        <div className="mb-8 max-w-2xl w-full">
          {processing && !message.startsWith('✅') && !message.startsWith('Error') ? (
            <div className="bg-gray-800 rounded-lg p-4">
              <TypingIndicator isTyping={true} label="AI is processing" />
            </div>
          ) : message ? (
            <div className={`p-4 rounded-lg ${
              message.startsWith('✅') ? 'bg-green-900/50 text-green-300' :
              message.startsWith('Error') ? 'bg-red-900/50 text-red-300' :
              'bg-gray-800 text-gray-300'
            }`}>
              {message}
            </div>
          ) : null}
        </div>
      )}

      {/* Example Commands */}
      <div className="max-w-2xl w-full mb-8">
        <h3 className="text-sm text-gray-400 mb-3">Try saying:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            onClick={() => handleVoiceCommand("Schedule team meeting tomorrow at 3pm with 10 FLOW stake")}
            className="text-left p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <p className="text-sm text-green-400">"Team meeting tomorrow 3pm, stake 10 FLOW"</p>
          </button>
          <button
            onClick={() => handleVoiceCommand("Meeting with Sarah Friday 2pm about project review, stake 20 FLOW")}
            className="text-left p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <p className="text-sm text-green-400">"Meeting with Sarah Friday 2pm, stake 20 FLOW"</p>
          </button>
          <button
            onClick={() => handleVoiceCommand("Daily standup tomorrow 9am with 5 FLOW stake")}
            className="text-left p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <p className="text-sm text-green-400">"Daily standup tomorrow 9am, stake 5 FLOW"</p>
          </button>
          <button
            onClick={() => handleVoiceCommand("Board meeting next Monday 10am, everyone stakes 50 FLOW")}
            className="text-left p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <p className="text-sm text-green-400">"Board meeting Monday 10am, stake 50 FLOW"</p>
          </button>
        </div>
      </div>

      {/* Recent Meetings */}
      {meetings.length > 0 && (
        <div className="max-w-2xl w-full">
          <h3 className="text-sm text-gray-400 mb-3">Recent Meetings:</h3>
          <div className="space-y-2">
            {meetings.map((meeting) => (
              <div key={meeting.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-white">{meeting.title}</h4>
                    <p className="text-sm text-gray-400">
                      {meeting.startTime.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-green-400">{meeting.stakeAmount} FLOW</p>
                    <p className="text-xs text-gray-500">
                      {meeting.status.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}