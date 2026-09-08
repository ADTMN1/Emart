import { useState, useRef, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const ChatInput = ({
  onSend,
  disabled = false,
  placeholder = 'Ask me anything about EMART...',
}: ChatInputProps) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !disabled) {
      onSend(trimmedMessage);
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120); // Max height ~5 lines
    textarea.style.height = `${newHeight}px`;
  };

  return (
    <div className="border-t border-border bg-background p-4">
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            aria-label="Chat message input"
            className={cn(
              'w-full resize-none rounded-xl border border-input bg-background px-4 py-3 pr-12 text-sm leading-relaxed placeholder:text-muted-foreground',
              'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-colors duration-200',
              'scrollbar-thin'
            )}
            style={{
              maxHeight: '120px',
              minHeight: '44px',
            }}
          />
          
          {/* Character hint */}
          {message.length > 1800 && (
            <div className="absolute bottom-2 right-12 text-xxs text-muted-foreground">
              {message.length}/2000
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={disabled || !message.trim()}
          aria-label="Send message"
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
            message.trim() && !disabled
              ? 'bg-primary text-primary-foreground hover:bg-primary-700 active:scale-95 shadow-sm'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          <Send className="h-5 w-5" />
        </button>
      </div>

      {/* Helper text */}
      <div className="mt-2 px-1 text-xxs text-muted-foreground">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
};

export default ChatInput;
