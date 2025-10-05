"use client";

import { useState } from "react";
import { StakingSettings } from "./StakingSettings";
import FlowService from "@/lib/flow/flowService";
import { useFlow } from "./FlowProvider";
import { formatDateTimeWithTimezone } from "@/lib/utils/timezone";

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateMeetingModal({
  isOpen,
  onClose,
  onSuccess
}: CreateMeetingModalProps) {
  const { user } = useFlow();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [attendees, setAttendees] = useState("");
  const [stakingEnabled, setStakingEnabled] = useState(false);
  const [stakeAmount, setStakeAmount] = useState("10.0");
  const [isCreating, setIsCreating] = useState(false);

  const handleStakingChange = (enabled: boolean, amount: string) => {
    setStakingEnabled(enabled);
    setStakeAmount(amount);
  };

  const handleCreate = async () => {
    if (!user?.addr || !title || !date || !startTime || !endTime) {
      alert("Please fill in all required fields");
      return;
    }

    setIsCreating(true);
    try {
      // Format datetime
      const startDateTime = new Date(`${date}T${startTime}`);
      const endDateTime = new Date(`${date}T${endTime}`);

      // Create calendar event first
      const calendarResponse = await fetch("/api/calendar/google/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wallet_address: user.addr,
          event: {
            summary: title,
            description,
            start: {
              dateTime: formatDateTimeWithTimezone(startDateTime),
            },
            end: {
              dateTime: formatDateTimeWithTimezone(endDateTime),
            },
            attendees: attendees.split(",").map(email => ({ email: email.trim() })).filter(e => e.email),
            stakeRequired: stakingEnabled ? parseFloat(stakeAmount) : 0,
          },
        }),
      });

      if (!calendarResponse.ok) {
        throw new Error("Failed to create calendar event");
      }

      const calendarData = await calendarResponse.json();
      const calendarEventId = calendarData.id;

      // If staking is enabled, create blockchain meeting
      if (stakingEnabled) {
        const meetingId = `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const startTimestamp = startDateTime.getTime() / 1000; // Convert to seconds
        const endTimestamp = endDateTime.getTime() / 1000;

        await FlowService.createMeeting(
          meetingId,
          calendarEventId,
          title,
          startTimestamp,
          endTimestamp,
          stakeAmount
        );

        // Store meeting ID with calendar event (you might want to implement this API)
        await fetch("/api/calendar/google/events/update-metadata", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            wallet_address: user.addr,
            event_id: calendarEventId,
            meeting_id: meetingId,
            stake_amount: stakeAmount,
          }),
        });
      }

      alert("Meeting created successfully!");
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error creating meeting:", error);
      alert("Failed to create meeting. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Create New Meeting</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:border-green-500 focus:outline-none text-white"
              placeholder="Meeting title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:border-green-500 focus:outline-none text-white"
              rows={3}
              placeholder="Meeting description"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:border-green-500 focus:outline-none text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Start Time *
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:border-green-500 focus:outline-none text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                End Time *
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:border-green-500 focus:outline-none text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Attendees (comma-separated emails)
            </label>
            <input
              type="text"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:border-green-500 focus:outline-none text-white"
              placeholder="john@example.com, jane@example.com"
            />
          </div>

          <StakingSettings
            onStakingChange={handleStakingChange}
            initialEnabled={stakingEnabled}
            initialAmount={stakeAmount}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !title || !date || !startTime || !endTime}
            className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50"
          >
            {isCreating ? "Creating..." : "Create Meeting"}
          </button>
        </div>
      </div>
    </div>
  );
}