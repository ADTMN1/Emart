import * as React from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { ThreadMessage } from '@/lib/api';

interface MessageThreadProps {
  messages: ThreadMessage[];
  viewerRole: 'admin' | 'seller';
  sendMessage: (body: string) => Promise<ThreadMessage>;
  disabled?: boolean;
}

const MESSAGE_MAX_LENGTH = 2000;

function formatTimestamp(value: string) {
  const date = new Date(value);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Shared bubble-thread + composer used by both the Admin conversation page and
 * the Seller conversation page. It deliberately renders plain text only — user
 * input never reaches the DOM as HTML (the backend stores/strips accordingly),
 * so `body` is always shown through React text nodes.
 */
export const MessageThread: React.FC<MessageThreadProps> = ({
  messages,
  viewerRole,
  sendMessage,
  disabled = false,
}) => {
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending || disabled) return;
    setSending(true);
    try {
      const sent = await sendMessage(body);
      if (sent) setDraft('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[480px] max-h-[calc(100vh-16rem)] rounded-xl border border-border bg-card overflow-hidden">
      {/* Thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 lg:p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-16">
            <p className="font-semibold text-foreground">No messages yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Send the first message to start the conversation.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const isSelf = message.senderRole === viewerRole;
            return (
              <div
                key={message.id}
                className={cn('flex flex-col max-w-[85%] lg:max-w-[70%]', isSelf ? 'items-end ml-auto' : 'items-start mr-auto')}
              >
                {!isSelf && (
                  <span className="text-[11px] font-semibold text-muted-foreground mb-1 px-1">
                    {message.senderName}
                  </span>
                )}
                <div
                  className={cn(
                    'px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words',
                    isSelf
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md'
                  )}
                >
                  {message.body}
                </div>
                <span
                  className={cn(
                    'mt-1 text-[10px] text-muted-foreground px-1',
                    isSelf && 'text-right'
                  )}
                >
                  {formatTimestamp(message.createdAt)}
                  {isSelf && message.readAt ? ' · Read' : ''}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3 lg:p-4">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value.slice(0, MESSAGE_MAX_LENGTH))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            placeholder={disabled ? 'Messaging is unavailable' : 'Write a message…'}
            className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 disabled:opacity-60"
          />
          <Button
            size="icon"
            className="h-10 w-10"
            disabled={!draft.trim() || sending || disabled}
            onClick={handleSend}
            aria-label="Send message"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Enter to send · Shift+Enter for a new line</span>
          <span>
            {draft.length}/{MESSAGE_MAX_LENGTH}
          </span>
        </div>
      </div>
    </div>
  );
};