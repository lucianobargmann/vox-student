'use client';

import React, { useEffect, useState } from 'react';
import { Check, X, Camera, User, AlertCircle } from 'lucide-react';

interface FeedbackMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'recognition';
  message: string;
  duration?: number;
  studentName?: string;
  confidence?: number;
}

interface FeedbackOverlayProps {
  messages: FeedbackMessage[];
  onMessageExpire: (id: string) => void;
  className?: string;
}

export function FeedbackOverlay({ messages, onMessageExpire, className = '' }: FeedbackOverlayProps) {
  const [visibleMessages, setVisibleMessages] = useState<FeedbackMessage[]>([]);

  useEffect(() => {
    setVisibleMessages(messages);

    // Auto-remove messages after their duration
    messages.forEach(message => {
      const duration = message.duration || 3000;
      setTimeout(() => {
        onMessageExpire(message.id);
      }, duration);
    });
  }, [messages, onMessageExpire]);

  const getIcon = (type: FeedbackMessage['type']) => {
    switch (type) {
      case 'success':
        return <Check className="w-6 h-6" />;
      case 'error':
        return <X className="w-6 h-6" />;
      case 'recognition':
        return <User className="w-6 h-6" />;
      case 'info':
      default:
        return <AlertCircle className="w-6 h-6" />;
    }
  };

  const getColors = (type: FeedbackMessage['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-500 text-white border-green-600';
      case 'error':
        return 'bg-red-500 text-white border-red-600';
      case 'recognition':
        return 'bg-blue-500 text-white border-blue-600';
      case 'info':
      default:
        return 'bg-gray-500 text-white border-gray-600';
    }
  };

  const getAnimation = (type: FeedbackMessage['type']) => {
    switch (type) {
      case 'success':
        return 'animate-bounce';
      case 'error':
        return 'animate-pulse';
      case 'recognition':
        return 'animate-pulse';
      default:
        return '';
    }
  };

  if (visibleMessages.length === 0) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 z-50 space-y-2 ${className}`}>
      {visibleMessages.map((message, index) => (
        <div
          key={message.id}
          className={`
            flex items-center space-x-3 px-4 py-3 rounded-lg border-2 shadow-lg
            transform transition-all duration-300 ease-in-out
            ${getColors(message.type)}
            ${getAnimation(message.type)}
          `}
          style={{
            animationDelay: `${index * 100}ms`,
            transform: `translateY(${index * 10}px)`
          }}
        >
          <div className="flex-shrink-0">
            {getIcon(message.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">
              {message.message}
            </div>
            
            {message.studentName && (
              <div className="text-xs opacity-90 mt-1">
                Aluno: {message.studentName}
                {message.confidence && (
                  <span className="ml-2">
                    ({message.confidence}% confiança)
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => onMessageExpire(message.id)}
            className="flex-shrink-0 ml-2 opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// Hook for managing feedback messages
export function useFeedbackMessages() {
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);

  const addMessage = (
    type: FeedbackMessage['type'],
    message: string,
    options?: {
      duration?: number;
      studentName?: string;
      confidence?: number;
    }
  ) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newMessage: FeedbackMessage = {
      id,
      type,
      message,
      duration: options?.duration || 3000,
      studentName: options?.studentName,
      confidence: options?.confidence
    };

    setMessages(prev => [...prev, newMessage]);
    return id;
  };

  const removeMessage = (id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const addSuccess = (message: string, options?: { duration?: number; studentName?: string; confidence?: number }) => {
    return addMessage('success', message, options);
  };

  const addError = (message: string, options?: { duration?: number }) => {
    return addMessage('error', message, options);
  };

  const addRecognition = (studentName: string, confidence: number, options?: { duration?: number }) => {
    return addMessage('recognition', 'Aluno reconhecido!', {
      ...options,
      studentName,
      confidence
    });
  };

  const addInfo = (message: string, options?: { duration?: number }) => {
    return addMessage('info', message, options);
  };

  return {
    messages,
    addMessage,
    removeMessage,
    clearMessages,
    addSuccess,
    addError,
    addRecognition,
    addInfo
  };
}

// Animated recognition indicator component
export function RecognitionIndicator({ 
  isActive, 
  faceDetected, 
  currentMatch 
}: { 
  isActive: boolean; 
  faceDetected: boolean; 
  currentMatch?: { name: string; confidence: number } | null;
}) {
  if (!isActive) return null;

  return (
    <div className="absolute top-2 left-2 z-10">
      <div className={`
        flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium
        transition-all duration-300 ease-in-out
        ${faceDetected 
          ? 'bg-green-500 text-white animate-pulse' 
          : 'bg-red-500 text-white'
        }
      `}>
        <Camera className="w-4 h-4" />
        <span>
          {currentMatch 
            ? `${currentMatch.name} (${Math.round(currentMatch.confidence * 100)}%)`
            : faceDetected 
              ? 'Rosto detectado' 
              : 'Aguardando rosto...'
          }
        </span>
      </div>
    </div>
  );
}
