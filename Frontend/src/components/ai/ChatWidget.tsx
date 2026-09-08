import { useState, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';
import ChatWindow from './ChatWindow';
import { cn } from '@/lib/utils';

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    // Check if user has opened chat before
    const chatOpened = sessionStorage.getItem('emart-chat-opened');
    if (chatOpened) {
      setHasOpened(true);
    }
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!hasOpened && !isOpen) {
      setHasOpened(true);
      sessionStorage.setItem('emart-chat-opened', 'true');
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  return (
    <>
      {/* Chat Window */}
      <div
        className={cn(
          'fixed bottom-20 right-4 z-50 transition-all duration-300 ease-in-out md:bottom-24 md:right-6',
          isOpen
            ? 'translate-y-0 opacity-100 scale-100'
            : 'translate-y-4 opacity-0 scale-95 pointer-events-none'
        )}
        style={{
          transformOrigin: 'bottom right',
        }}
      >
        <ChatWindow onClose={() => setIsOpen(false)} isFirstVisit={!hasOpened} />
      </div>

      {/* Toggle Button */}
      <button
        onClick={handleToggle}
        aria-label={isOpen ? 'Close AI chat' : 'Open AI chat'}
        aria-expanded={isOpen}
        className={cn(
          'fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-300 ease-in-out md:bottom-6 md:right-6 md:h-16 md:w-16',
          'bg-primary text-primary-foreground hover:bg-primary-700 hover:shadow-2xl',
          'focus:outline-none focus:ring-4 focus:ring-primary-300 focus:ring-offset-2 focus:ring-offset-background',
          'active:scale-95',
          isOpen && 'rotate-90 scale-90'
        )}
      >
        {isOpen ? (
          <X className="h-6 w-6 md:h-7 md:w-7" />
        ) : (
          <MessageCircle className="h-6 w-6 md:h-7 md:w-7" />
        )}
        
        {/* Notification dot for first-time users */}
        {!hasOpened && !isOpen && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-secondary" />
          </span>
        )}
      </button>
    </>
  );
};

export default ChatWidget;
