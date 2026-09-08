import { Bot } from 'lucide-react';

const TypingIndicator = () => {
  return (
    <div className="flex gap-3 px-4 py-3 animate-slide-up">
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-primary">
        <Bot className="h-5 w-5" />
      </div>

      {/* Typing Animation */}
      <div className="flex max-w-[85%] flex-col gap-1">
        <div className="rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3 shadow-sm">
          <div className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
              style={{ animationDelay: '0ms', animationDuration: '1s' }}
            />
            <div
              className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
              style={{ animationDelay: '150ms', animationDuration: '1s' }}
            />
            <div
              className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
              style={{ animationDelay: '300ms', animationDuration: '1s' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
