import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MessageThread } from '@/components/messages/MessageThread';
import { notificationsChanged } from '@/components/admin/AdminNotificationBell';
import {
  messageApi,
  type ThreadPayload,
  type ThreadMessage,
} from '@/lib/api';

/** /seller/messages/:id — the store's own conversation with EMART admin. */
export const SellerMessageThread: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [thread, setThread] = React.useState<ThreadPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadThread = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [res] = await Promise.all([
        messageApi.sellerMessages(id),
        messageApi.sellerMarkRead(id).catch(() => ({ updated: 0 })),
      ]);
      setThread(res);
      notificationsChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to load conversation');
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    loadThread();
  }, [loadThread]);

  const handleSend = async (body: string): Promise<ThreadMessage> => {
    if (!id) throw new Error('No conversation selected');
    const sent = await messageApi.sellerSendMessage(id, body);
    setThread((prev) => (prev ? { ...prev, messages: [...prev.messages, sent] } : prev));
    notificationsChanged();
    return sent;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-destructive" />
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-semibold">Failed to Load Conversation</p>
        <p className="text-sm text-muted-foreground mt-2">{error || 'Conversation not found'}</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate('/seller/messages')}>
          Back to Messages
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/seller/messages')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-lg font-bold truncate">
            Order {thread.order?.orderNumber ?? 'Conversation'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Conversation with EMART management
            {thread.order?.status ? ` · ${thread.order.status.replace(/_/g, ' ')}` : ''}
          </p>
        </div>
        {thread.order && (
          <Badge variant="info" size="sm">
            {thread.order.status.replace(/_/g, ' ')}
          </Badge>
        )}
      </div>

      <MessageThread messages={thread.messages} viewerRole="seller" sendMessage={handleSend} />
    </div>
  );
};

export default SellerMessageThread;