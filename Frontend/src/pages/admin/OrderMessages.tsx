import * as React from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  MessageSquare,
  Store,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { MessageThread } from '@/components/messages/MessageThread';
import { notificationsChanged } from '@/components/admin/AdminNotificationBell';
import {
  messageApi,
  type AdminOrderConversations,
  type ThreadPayload,
  type ThreadMessage,
} from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * /admin/orders/:orderId/messages — one conversation per (order, seller).
 * Admins can view existing conversations or start one with any APPROVED seller
 * whose products are in the order (the seller is validated server-side).
 */
export const AdminOrderMessages: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [data, setData] = React.useState<AdminOrderConversations | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [thread, setThread] = React.useState<ThreadPayload | null>(null);
  const [activeConv, setActiveConv] = React.useState<string | null>(null);
  const [threadLoading, setThreadLoading] = React.useState(false);
  const [startingSeller, setStartingSeller] = React.useState<string | null>(null);

  const loadOverview = React.useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await messageApi.adminConversations(orderId));
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const loadThread = React.useCallback(
    async (conversationId: string) => {
      setThreadLoading(true);
      try {
        // Mark inbox messages read immediately so the bell badge stays fresh.
        const [threadRes] = await Promise.all([
          messageApi.adminMessages(conversationId),
          messageApi.adminMarkRead(conversationId).catch(() => ({ updated: 0 })),
        ]);
        setThread(threadRes);
        setActiveConv(conversationId);
        notificationsChanged();
      } catch (err: any) {
        toast({
          variant: 'error',
          title: 'Failed to load messages',
          description: err.message || 'Could not load the conversation.',
        });
      } finally {
        setThreadLoading(false);
      }
    },
    [toast],
  );

  React.useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Resolve a conversation automatically once the overview loads:
  //  - one seller + existing conversation  -> open it
  //  - one seller + no conversation yet    -> get-or-create and open (empty thread)
  //  - multiple sellers + one conversation -> open that one; otherwise let the
  //    admin pick which seller to message (one conversation per order+seller).
  const autoResolvedRef = React.useRef(false);
  React.useEffect(() => {
    if (!data || !orderId || autoResolvedRef.current || thread || threadLoading) {
      return;
    }
    if (data.sellers.length === 0) {
      autoResolvedRef.current = true;
      return;
    }
    if (data.sellers.length === 1) {
      autoResolvedRef.current = true;
      const conv = data.conversations.find((c) => c.sellerId === data.sellers[0].id);
      if (conv) {
        loadThread(conv.id);
      } else {
        (async () => {
          setStartingSeller(data.sellers[0].id);
          try {
            const res = await messageApi.adminEnsureConversation(
              orderId,
              data.sellers[0].id,
            );
            await loadOverview();
            await loadThread(res.conversation.id);
          } catch (err: any) {
            toast({
              variant: 'error',
              title: 'Could not start conversation',
              description: err.message || 'Please try again.',
            });
          } finally {
            setStartingSeller(null);
          }
        })();
      }
      return;
    }
    if (data.conversations.length === 1) {
      autoResolvedRef.current = true;
      loadThread(data.conversations[0].id);
    }
  }, [data, thread, threadLoading, loadThread, loadOverview, orderId, toast]);

  const handleStart = async (sellerId: string) => {
    if (!orderId) return;
    setStartingSeller(sellerId);
    try {
      const res = await messageApi.adminEnsureConversation(orderId, sellerId);
      await loadOverview();
      await loadThread(res.conversation.id);
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Could not start conversation',
        description: err.message || 'Please try again.',
      });
    } finally {
      setStartingSeller(null);
    }
  };

  const handleSend = async (body: string): Promise<ThreadMessage> => {
    if (!activeConv) throw new Error('No conversation selected');
    const sent = await messageApi.adminSendMessage(activeConv, body);
    setThread((prev) =>
      prev ? { ...prev, messages: [...prev.messages, sent] } : prev,
    );
    notificationsChanged();
    return sent;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-semibold">Failed to Load Conversations</p>
        <p className="text-sm text-muted-foreground mt-2">{error || 'Order not found'}</p>
        <Button className="mt-4" variant="outline" onClick={() => loadOverview()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/admin/orders/${orderId}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl lg:text-3xl font-bold">
            Order {data.order.orderNumber}
          </h1>
          <p className="text-muted-foreground mt-1">
            Messaging between EMART admin and sellers on this order
          </p>
        </div>
        <Badge variant="info" className="text-sm px-3 py-1">
          {data.order.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      {data.sellers.length === 0 ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <Store className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="font-semibold">No seller stores on this order</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              This order contains no items from approved third-party sellers, so there is
              nothing to message.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
          {/* Sellers / conversations */}
          <Card className="lg:sticky lg:top-20">
            <CardContent className="p-3 space-y-1">
              <p className="px-2 pt-1 pb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Sellers on this order ({data.sellers.length})
              </p>
              {data.sellers.map((seller) => {
                const conv = data.conversations.find((c) => c.sellerId === seller.id);
                const active = conv?.id === activeConv;
                return (
                  <div
                    key={seller.id}
                    className={cn(
                      'rounded-lg p-3 transition-colors',
                      active ? 'bg-primary-50 border border-primary-200' : 'hover:bg-muted/50 border border-transparent',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                          active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <Store className="h-4 w-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{seller.storeName}</p>
                        {conv?.lastMessage ? (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {conv.lastMessage.body}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">No messages yet</p>
                        )}
                      </div>
                      {conv && conv.unreadCount > 0 && (
                        <span className="h-5 min-w-5 px-1.5 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      {conv ? (
                        <Button
                          variant={active ? 'primary' : 'outline'}
                          size="sm"
                          className="w-full"
                          disabled={threadLoading}
                          rightIcon={<ChevronRight className="h-4 w-4" />}
                          onClick={() => loadThread(conv.id)}
                        >
                          {active ? 'Viewing conversation' : 'Open conversation'}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          isLoading={startingSeller === seller.id}
                          leftIcon={<MessageSquare className="h-4 w-4" />}
                          onClick={() => handleStart(seller.id)}
                        >
                          Start conversation
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Thread */}
          <div className="space-y-4">
            {thread ? (
              <>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-muted-foreground">
                    Conversation with{' '}
                    <span className="font-semibold text-foreground">{thread.seller?.storeName}</span>
                  </p>
                  <Link
                    to={`/admin/orders/${orderId}`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    View order details
                  </Link>
                </div>
                <MessageThread
                  messages={thread.messages}
                  viewerRole="admin"
                  sendMessage={handleSend}
                />
              </>
            ) : threadLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 flex flex-col items-center justify-center text-center">
                  <MessageSquare className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="font-semibold">Select a conversation</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    Choose a seller on the left to open or start an order conversation.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrderMessages;