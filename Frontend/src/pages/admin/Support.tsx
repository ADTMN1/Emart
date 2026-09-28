import * as React from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Loader2,
  AlertCircle,
  MessageSquare,
  Search,
  Filter,
  ChevronRight,
  X,
  CheckCircle2,
  Clock,
  User,
  Mail,
  MoreVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { supportApi, type SupportConversationSummary, type SupportMessage, type SupportConversationPayload } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

type AdminSupportConversationSummary = SupportConversationSummary

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'OPEN':
      return <Badge variant="success" size="sm">Open</Badge>
    case 'RESOLVED':
      return <Badge variant="info" size="sm">Resolved</Badge>
    case 'CLOSED':
      return <Badge variant="secondary" size="sm">Closed</Badge>
    default:
      return <Badge variant="outline" size="sm">{status}</Badge>
  }
}

const ConversationList = ({
  conversations,
  loading,
  error,
  activeConversation,
  onOpenConversation,
  onRefresh,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
  page,
  totalPages,
  onPageChange,
}: {
  conversations: AdminSupportConversationSummary[]
  loading: boolean
  error: string | null
  activeConversation: AdminSupportConversationSummary | null
  onOpenConversation: (conv: AdminSupportConversationSummary) => void
  onRefresh: () => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) => (
  <Card className="lg:col-span-1 flex flex-col min-h-0">
    <CardContent className="p-0 flex-1 flex flex-col min-h-0">
      <div className="p-4 border-b border-border space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onPageChange(1)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => { onStatusFilterChange(e.target.value); onPageChange(1); }}
          className="w-full"
        >
          <option value="all">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <div className="flex items-center justify-center h-full p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full p-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-destructive mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={onRefresh}>Retry</Button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold text-lg mb-1">No conversations</h3>
            <p className="text-sm text-muted-foreground">No support conversations match your filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onOpenConversation(conv)}
                className={cn(
                  'w-full p-4 text-left hover:bg-muted/50 transition-colors flex flex-col gap-2',
                  activeConversation?.id === conv.id && 'bg-primary/5 border-l-2 border-primary'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{conv.subject || 'General Support'}</span>
                      <StatusBadge status={conv.status} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {conv.user?.firstName} {conv.user?.lastName} ({conv.user?.email || 'Unknown'})
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {conv.lastMessage ? conv.lastMessage.body : 'No messages yet'}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </span>
                  {conv.unreadCount > 0 && (
                    <Badge variant="primary" size="xs" className="gap-0.5">
                      <span>{conv.unreadCount}</span>
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </CardContent>
  </Card>
)

const ActiveConversation = ({
  conversation,
  messages,
  loading,
  error,
  newMessage,
  onNewMessageChange,
  sendingMessage,
  onSendMessage,
  onStatusChange,
  onClose,
  messagesEndRef,
}: {
  conversation: AdminSupportConversationSummary
  messages: SupportMessage[]
  loading: boolean
  error: string | null
  newMessage: string
  onNewMessageChange: (value: string) => void
  sendingMessage: boolean
  onSendMessage: (e: React.FormEvent) => void
  onStatusChange: (status: 'OPEN' | 'CLOSED' | 'RESOLVED') => void
  onClose: () => void
  messagesEndRef: React.RefObject<HTMLDivElement>
}) => (
  <Card className="lg:col-span-3 flex flex-col min-h-0 border-t border-primary/20">
    <CardContent className="p-0 flex-1 flex flex-col min-h-0">
      <div className="p-4 border-b border-border flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{conversation.subject || 'General Support'}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <StatusBadge status={conversation.status} />
              <span>·</span>
              <User className="h-3 w-3" />
              <span className="truncate">{conversation.user?.email || 'Unknown'}</span>
              <span>·</span>
              <span>Updated {new Date(conversation.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {conversation.status !== 'CLOSED' && (
            <Button variant="outline" size="sm" onClick={() => onStatusChange('RESOLVED')}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Resolve
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onStatusChange('CLOSED')}>
            <X className="h-3.5 w-3.5" />
            Close
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={messagesEndRef}>
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={cn('flex gap-3', msg.isOwn ? 'flex-row-reverse' : '')}>
              <div
                className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
                  msg.isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                )}
              >
                {msg.senderName.charAt(0).toUpperCase()}
              </div>
              <div
                className={cn(
                  'max-w-[70%] px-4 py-2 rounded-2xl text-sm',
                  msg.isOwn
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted rounded-bl-md'
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-medium text-xs">{msg.senderName}</span>
                  <span className="text-[10px] opacity-70">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.senderRole === 'admin' && (
                    <Badge variant="secondary" size="xs">Admin</Badge>
                  )}
                </div>
                <p className="whitespace-pre-wrap">{msg.body}</p>
                {msg.isOwn && msg.readAt && (
                  <div className="text-[10px] opacity-60 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Read
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border">
        <form onSubmit={onSendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => onNewMessageChange(e.target.value)}
            placeholder="Type your reply..."
            disabled={sendingMessage || conversation.status === 'CLOSED'}
            className="flex-1"
          />
          <Button type="submit" disabled={!newMessage.trim() || sendingMessage || conversation.status === 'CLOSED'}>
            {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Send</span>}
          </Button>
        </form>
        {conversation.status === 'CLOSED' && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            This conversation is closed. Reopen to send messages.
          </p>
        )}
      </div>
    </CardContent>
  </Card>
)

const EmptyState = () => (
  <Card className="lg:col-span-3 flex items-center justify-center">
    <CardContent className="p-8 text-center">
      <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
      <h3 className="font-display text-xl font-bold mb-2">Select a conversation</h3>
      <p className="text-muted-foreground">Choose a conversation from the list to view and reply to messages.</p>
    </CardContent>
  </Card>
)

const AdminSupport: React.FC = () => {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  /** Deep-link target: /admin/support?conversationId=… (from notifications). */
  const deepLinkConversationId = searchParams.get('conversationId')

  const [conversations, setConversations] = React.useState<AdminSupportConversationSummary[]>([])
  const [activeConversation, setActiveConversation] = React.useState<AdminSupportConversationSummary | null>(null)
  const [messages, setMessages] = React.useState<SupportMessage[]>([])
  const [loadingConversations, setLoadingConversations] = React.useState(false)
  const [loadingMessages, setLoadingMessages] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [newMessage, setNewMessage] = React.useState('')
  const [sendingMessage, setSendingMessage] = React.useState(false)
  const [statusFilter, setStatusFilter] = React.useState<string>('all')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  const fetchConversations = React.useCallback(async () => {
    try {
      setLoadingConversations(true)
      setError(null)
      const res = await supportApi.adminListConversations({
        page,
        limit: 20,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchQuery || undefined,
      })
      setConversations(res.conversations || [])
      setTotalPages(res.pagination.totalPages || 1)
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations')
    } finally {
      setLoadingConversations(false)
    }
  }, [page, statusFilter, searchQuery])

  React.useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  /** Shared tail of both entry points (list click and notification deep link). */
  const loadConversationMessages = React.useCallback(async (conversation: AdminSupportConversationSummary) => {
    setActiveConversation(conversation)
    setMessages([])
    setError(null)
    try {
      setLoadingMessages(true)
      const res = await supportApi.adminGetMessages(conversation.id)
      setMessages(res.messages || [])
      if (res.unreadCount > 0) {
        await supportApi.adminMarkRead(conversation.id)
        setConversations((prev) =>
          prev.map((c) => (c.id === conversation.id ? { ...c, unreadCount: 0 } : c))
        )
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load messages')
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  const openConversation = React.useCallback(
    async (conversation: AdminSupportConversationSummary) => {
      await loadConversationMessages(conversation)
    },
    [loadConversationMessages],
  )

  /**
   * Open a conversation addressed only by id. The target may not be on the
   * current page of the (filtered, paginated) list, so when it isn't, the
   * summary is reconstructed from the messages payload itself. `user` stays
   * undefined in that case and renders as 'Unknown' via the existing
   * optional-chained fallback in the header.
   */
  const openConversationById = React.useCallback(
    async (conversationId: string) => {
      const known = conversations.find((c) => c.id === conversationId)
      if (known) {
        await loadConversationMessages(known)
        return
      }
      try {
        setLoadingMessages(true)
        const res = await supportApi.adminGetMessages(conversationId)
        const messages = res.messages || []
        setMessages(messages)
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
        )
        setActiveConversation({
          id: conversationId,
          subject: res.conversation?.subject || 'General Support',
          status: res.conversation?.status || 'OPEN',
          createdAt: res.conversation?.createdAt || new Date().toISOString(),
          updatedAt: res.conversation?.updatedAt || new Date().toISOString(),
          lastMessage: messages.length
            ? (() => {
                const last = messages[messages.length - 1]
                return {
                  id: last.id,
                  body: last.body,
                  fromAdmin: last.senderRole === 'admin',
                  createdAt: last.createdAt,
                  readAt: last.readAt,
                }
              })()
            : null,
          unreadCount: 0,
        })
      } catch (err: any) {
        setError(err.message || 'Failed to load conversation')
      } finally {
        setLoadingMessages(false)
      }
    },
    [conversations, loadConversationMessages],
  )

  // Honour ?conversationId= once the list has settled, then drop the param so a
  // refresh doesn't force the thread open again and the URL reflects the view.
  React.useEffect(() => {
    if (!deepLinkConversationId || loadingConversations) return
    let cancelled = false
    void openConversationById(deepLinkConversationId).finally(() => {
      if (!cancelled) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('conversationId')
            return next
          },
          { replace: true },
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [deepLinkConversationId, loadingConversations, openConversationById, setSearchParams])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !activeConversation || sendingMessage) return
    const body = newMessage.trim()
    setNewMessage('')
    setSendingMessage(true)
    try {
      const message = await supportApi.adminSendMessage(activeConversation.id, body)
      setMessages((prev) => [...prev, message])
    } catch (err: any) {
      setError(err.message || 'Failed to send message')
      setNewMessage(body)
    } finally {
      setSendingMessage(false)
    }
  }

  const handleStatusChange = async (status: 'OPEN' | 'CLOSED' | 'RESOLVED') => {
    if (!activeConversation) return
    try {
      await supportApi.adminUpdateStatus(activeConversation.id, status)
      setActiveConversation((prev) => (prev ? { ...prev, status } : null))
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversation.id ? { ...c, status } : c))
      )
      toast({ variant: 'success', title: 'Status updated', description: `Conversation marked as ${status}` })
    } catch (err: any) {
      toast({ variant: 'error', title: 'Failed to update status', description: err.message })
    }
  }

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  React.useEffect(() => {
    if (!activeConversation) return
    const interval = setInterval(async () => {
      try {
        const res = await supportApi.adminGetMessages(activeConversation.id)
        setMessages(res.messages || [])
      } catch {
        // ignore polling errors
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [activeConversation])

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Support Center</h1>
          <p className="text-muted-foreground mt-1">Manage customer support conversations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchConversations} disabled={loadingConversations}>
            <Loader2 className={cn('h-4 w-4 mr-2', loadingConversations && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6 h-[calc(100vh-280px)] min-h-[600px]">
        <ConversationList
          conversations={conversations}
          loading={loadingConversations}
          error={error}
          activeConversation={activeConversation}
          onOpenConversation={openConversation}
          onRefresh={fetchConversations}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
        {activeConversation ? (
          <ActiveConversation
            conversation={activeConversation}
            messages={messages}
            loading={loadingMessages}
            error={error}
            newMessage={newMessage}
            onNewMessageChange={setNewMessage}
            sendingMessage={sendingMessage}
            onSendMessage={handleSendMessage}
            onStatusChange={handleStatusChange}
            onClose={() => setActiveConversation(null)}
            messagesEndRef={messagesEndRef}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}

export { AdminSupport }