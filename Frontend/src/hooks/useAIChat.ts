import { useState, useCallback, useEffect } from 'react';
import type { Message } from '@/components/ai/ChatMessage';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const CHAT_ENDPOINT = `${API_BASE_URL}/api/v1/ai/chat`;

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: `Hello! 👋 I'm the EMART AI assistant. I'm here to help you with:

• Understanding how EMART works
• Information about proxy fees and shipping
• Payment methods and policies
• Warehouse services and storage
• Returns and refunds
• Any questions about our platform

How can I help you today?`,
  timestamp: new Date(),
};

export const useAIChat = (isFirstVisit: boolean) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load messages from session storage
  useEffect(() => {
    const savedMessages = sessionStorage.getItem('emart-chat-messages');
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        // Restore Date objects
        const restored = parsed.map((msg: Message) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(restored);
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
        // Show welcome message if we can't restore
        setMessages([WELCOME_MESSAGE]);
      }
    } else {
      // First time - show welcome message
      setMessages([WELCOME_MESSAGE]);
    }
  }, []);

  // Save messages to session storage
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem('emart-chat-messages', JSON.stringify(messages));
    }
  }, [messages]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    // Add user message immediately
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: content.trim() }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        } else if (response.status >= 500) {
          throw new Error('Our AI service is temporarily unavailable. Please try again later.');
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to get a response. Please try again.');
        }
      }

      const data = await response.json();

      if (!data.success || !data.data?.message) {
        throw new Error('Invalid response from server. Please try again.');
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      
      let errorMessage = 'Something went wrong. Please try again.';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      // Check for network errors
      if (err instanceof TypeError && err.message.includes('fetch')) {
        errorMessage = 'Unable to connect to the AI service. Please check your internet connection and try again.';
      }

      setError(errorMessage);

      // Remove the user message if there was an error
      setMessages((prev) => prev.filter((msg) => msg.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    sessionStorage.removeItem('emart-chat-messages');
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearError,
    clearMessages,
  };
};
