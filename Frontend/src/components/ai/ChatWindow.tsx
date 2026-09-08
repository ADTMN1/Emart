import { useEffect, useRef } from 'react';
import { X, Bot, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import { useAIChat } from '@/hooks/useAIChat';

interface ChatWindowProps {
  onClose: () => void;
  isFirstVisit: boolean;
}

const SUGGESTED_QUESTIONS = [
  'How does EMART work?',
  'What are your proxy fees?',
  'How does international shipping work?',
  'What payment methods do you accept?',
];

const ChatWindow = ({ onClose, isFirstVisit }: ChatWindowProps) => {
  const { messages, isLoading, error, sendMessage, clearError } = useAIChat(isFirstVisit);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question);
  };

  const handleSendMessage = (message: string) => {
    if (error) clearError();
    sendMessage(message);
  };

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl bg-background shadow-2xl',
        'w-[calc(100vw-2rem)] max-w-md',
        'h-[calc(100vh-6rem)] max-h-[650px]',
        'sm:w-[420px]',
        'md:h-[600px]',
        'border border-border'
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-primary px-4 py-3.5 text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/10">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-none">EMART AI Assistant</h3>
            <p className="mt-1 text-xs opacity-90">Always here to help</p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close chat"
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-primary-foreground/10 focus:outline-none focus:ring-2 focus:ring-primary-foreground/30"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto bg-surface/30 scrollbar-thin"
      >
        <div className="flex flex-col gap-0.5 py-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isLoading && <TypingIndicator />}

          {/* Suggested Questions - Show when chat is empty and not loading */}
          {messages.length === 1 && !isLoading && messages[0].role === 'assistant' && (
            <div className="px-4 py-2">
              <div className="flex items-center gap-2 mb-3 px-1">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">
                  Try asking:
                </span>
              </div>
              <div className="grid gap-2">
                {SUGGESTED_QUESTIONS.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestedQuestion(question)}
                    className={cn(
                      'group rounded-xl border border-border bg-background px-4 py-3 text-left text-sm transition-all duration-200',
                      'hover:border-primary hover:bg-primary/5 hover:shadow-sm',
                      'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-surface'
                    )}
                  >
                    <span className="text-foreground group-hover:text-primary transition-colors">
                      {question}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mx-4 mb-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive animate-slide-up">
              <p className="font-medium">Error</p>
              <p className="mt-1 text-xs opacity-90">{error}</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="shrink-0">
        <ChatInput onSend={handleSendMessage} disabled={isLoading} />
      </div>
    </div>
  );
};

export default ChatWindow;
