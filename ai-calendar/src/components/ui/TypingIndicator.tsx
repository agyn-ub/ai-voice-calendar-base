"use client";

import { useEffect, useState } from "react";

interface TypingIndicatorProps {
  isTyping: boolean;
  label?: string;
  className?: string;
}

export function TypingIndicator({ isTyping, label = "AI is typing", className = "" }: TypingIndicatorProps) {
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    if (isTyping) {
      // Small delay before showing to prevent flashing on quick responses
      const timer = setTimeout(() => setShowIndicator(true), 100);
      return () => clearTimeout(timer);
    } else {
      setShowIndicator(false);
    }
  }, [isTyping]);

  if (!showIndicator) return null;

  return (
    <div className={`flex items-center gap-2 p-3 animate-fadeIn ${className}`}>
      <div className="flex items-center gap-1">
        <span className="text-sm text-gray-400">{label}</span>
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing-dot animation-delay-0"></span>
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing-dot animation-delay-200"></span>
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing-dot animation-delay-400"></span>
        </div>
      </div>
    </div>
  );
}

export function WhatsAppTypingIndicator({ isTyping }: { isTyping: boolean }) {
  if (!isTyping) return null;

  return (
    <div className="flex items-start gap-3 p-2 animate-fadeIn">
      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
        <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="flex-1">
        <div className="bg-gray-800 rounded-lg rounded-tl-none p-3 max-w-xs">
          <div className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-pulse-dot animation-delay-0"></span>
            <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-pulse-dot animation-delay-150"></span>
            <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-pulse-dot animation-delay-300"></span>
          </div>
        </div>
      </div>
    </div>
  );
}