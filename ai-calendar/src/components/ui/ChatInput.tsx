'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Message Calendar Assistant...",
  maxLength = 2000
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [rows, setRows] = useState(1);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const lineHeight = 24;
      const maxRows = 5;
      const newRows = Math.min(Math.max(Math.floor(scrollHeight / lineHeight), 1), maxRows);
      setRows(newRows);
      textareaRef.current.style.height = `${scrollHeight}px`;
    }
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit();
      }
    }
  };

  const characterCount = value.length;
  const isNearLimit = characterCount > maxLength * 0.9;

  return (
    <div className="relative flex items-end gap-2 p-3 bg-gray-700 border border-gray-600 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
          className="w-full px-3 py-2 resize-none border-none outline-none bg-transparent text-gray-100 placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ 
            minHeight: '40px',
            maxHeight: '120px',
            overflowY: rows >= 5 ? 'auto' : 'hidden'
          }}
        />
        
        {/* Character count */}
        {value.length > 0 && (
          <div className={`absolute right-2 bottom-2 text-xs ${
            isNearLimit ? 'text-orange-400' : 'text-gray-500'
          }`}>
            {characterCount}/{maxLength}
          </div>
        )}
      </div>

      {/* Submit button */}
      <button
        onClick={onSubmit}
        disabled={!value.trim() || disabled}
        className={`flex-shrink-0 p-2 rounded-lg transition-all ${
          value.trim() && !disabled
            ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-sm hover:shadow-md'
            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
        }`}
        title="Send message (Enter)"
      >
        <svg 
          className="w-5 h-5" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" 
          />
        </svg>
      </button>

    </div>
  );
}