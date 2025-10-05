"use client";

import { useState, useEffect, useRef } from "react";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onStateChange?: (isRecording: boolean) => void;
  className?: string;
}

export function VoiceInput({ onTranscript, onStateChange, className = "" }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check if browser supports speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
        onStateChange?.(true);
        setTranscript("");
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        const currentTranscript = finalTranscript || interimTranscript;
        setTranscript(currentTranscript);

        if (finalTranscript) {
          onTranscript(finalTranscript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        onStateChange?.(false);

        if (event.error === 'no-speech') {
          setTranscript("No speech detected. Please try again.");
        } else if (event.error === 'audio-capture') {
          setTranscript("No microphone found. Please check your settings.");
        } else {
          setTranscript("Error occurred in recognition: " + event.error);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
        onStateChange?.(false);
      };

      recognitionRef.current = recognition;
    } else {
      console.log("Speech recognition not supported");
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onTranscript, onStateChange]);

  const startRecording = () => {
    if (recognitionRef.current && !isRecording) {
      recognitionRef.current.start();
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Handle spacebar for push-to-talk
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if the target is an input or textarea element
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // Only handle spacebar for recording if not in an input field
      if (e.code === 'Space' && !isInputField && !e.repeat && !isRecording) {
        e.preventDefault();
        e.stopPropagation();
        startRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Check if the target is an input or textarea element
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // Only handle spacebar for recording if not in an input field
      if (e.code === 'Space' && !isInputField && isRecording) {
        e.preventDefault();
        e.stopPropagation();
        stopRecording();
      }
    };

    if (isSupported) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRecording, isSupported]);

  if (!isSupported) {
    return (
      <div className="text-center text-gray-500 p-4">
        <p>Speech recognition is not supported in your browser.</p>
        <p className="text-sm mt-2">Please use Chrome, Edge, or Safari.</p>
      </div>
    );
  }

  return (
    <div className={`voice-input-container ${className}`}>
      <button
        onClick={toggleRecording}
        className={`voice-button ${
          isRecording
            ? "bg-red-600 hover:bg-red-700 animate-pulse"
            : "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
        } text-white rounded-full p-8 transition-all shadow-2xl hover:shadow-3xl transform hover:scale-105`}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
      >
        <svg
          className="w-12 h-12"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isRecording ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          )}
        </svg>
      </button>

      <div className="mt-4 text-center">
        {isRecording ? (
          <div>
            <p className="text-sm text-gray-400 mb-2">Listening...</p>
            {transcript && (
              <p className="text-white bg-gray-800 rounded-lg p-3 max-w-md mx-auto">
                {transcript}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            Click the mic or hold <kbd className="px-2 py-1 bg-gray-700 rounded">Space</kbd> to speak
          </p>
        )}
      </div>
    </div>
  );
}