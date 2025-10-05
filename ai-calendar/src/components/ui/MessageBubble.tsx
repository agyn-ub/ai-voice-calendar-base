'use client';

import { useState } from 'react';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  actions?: Array<{
    type: string;
    status: 'success' | 'error';
    details?: any;
  }>;
  onCopy?: () => void;
}

export default function MessageBubble({ 
  role, 
  content, 
  timestamp, 
  actions,
  onCopy 
}: MessageBubbleProps) {
  const [showTimestamp, setShowTimestamp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showActionDetails, setShowActionDetails] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatContent = (text: string) => {
    // Basic markdown-like formatting
    return text
      .split('\n')
      .map((line, i) => {
        // Bold text
        line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic text
        line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Code blocks
        line = line.replace(/`(.*?)`/g, '<code class="bg-gray-800 px-1 rounded">$1</code>');
        // Lists
        if (line.startsWith('• ') || line.startsWith('- ')) {
          return `<li class="ml-4">${line.substring(2)}</li>`;
        }
        return line;
      })
      .join('<br />');
  };

  return (
    <div 
      className={`flex gap-3 ${role === 'user' ? 'flex-row-reverse' : 'flex-row'} group`}
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
    >
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        role === 'user' 
          ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
          : 'bg-gradient-to-br from-purple-500 to-purple-600'
      }`}>
        {role === 'user' ? (
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[70%] ${role === 'user' ? 'items-end' : 'items-start'}`}>
        <div className={`relative rounded-2xl px-4 py-3 ${
          role === 'user'
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
            : 'bg-gray-700 text-gray-100 border border-gray-600'
        }`}>
          {/* Message Text */}
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: formatContent(content) }}
          />

          {/* Actions Display */}
          {actions && actions.length > 0 && (
            <div className={`mt-3 pt-3 border-t ${
              role === 'user' ? 'border-blue-400' : 'border-gray-600'
            }`}>
              <button
                onClick={() => setShowActionDetails(!showActionDetails)}
                className={`text-xs font-medium flex items-center gap-1 ${
                  role === 'user' ? 'text-blue-100' : 'text-gray-400'
                } hover:underline`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d={showActionDetails ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} />
                </svg>
                {actions.length} action{actions.length > 1 ? 's' : ''} performed
              </button>
              
              {showActionDetails && (
                <div className="mt-2 space-y-1">
                  {actions.map((action, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className={`flex-shrink-0 ${
                        action.status === 'success' 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {action.status === 'success' ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </span>
                      <span className={role === 'user' ? 'text-blue-100' : 'text-gray-400'}>
                        {action.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Copy Button for Assistant Messages */}
          {role === 'assistant' && (
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-gray-600"
              title="Copy message"
            >
              {copied ? (
                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Timestamp */}
        {timestamp && showTimestamp && (
          <div className={`text-xs text-gray-500 mt-1 ${
            role === 'user' ? 'text-right' : 'text-left'
          }`}>
            {new Date(timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
        )}
      </div>
    </div>
  );
}