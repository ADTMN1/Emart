import * as React from 'react'
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import type { AccountOutletContext } from '@/components/account/AccountLayout'
import {
  ChevronRight,
  User,
  Mail,
  MapPin,
  CreditCard,
  Package,
  Bell,
  Globe2,
  Pencil,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ChevronDown,
  Gift,
  Clock,
  BookOpen,
  FileText,
  Headphones,
  Building,
  Phone,
  CalendarDays,
  Wallet as WalletIcon,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  TrendingUp,
  Store,
  XCircle,
  Ban,
  Truck,
  MessageSquare,
  Inbox,
  CheckCheck,
  Loader2,
  Upload,
  Trash2,
  ArrowLeft,
  Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'
import { cn, formatCurrency } from '@/lib/utils'
import { ApiError, api, notificationApi, sellerAgreementApi, sellerApplicationApi, orderApi, supportApi, loanApi, type NotificationItem, type SellerAgreement, type SupportConversationSummary, type SupportMessage, type SupportConversationPayload } from '@/lib/api'
import { prepareIdentityDocument, type PreparedIdentityDocument } from '@/lib/identityDocument'
import {
  notificationsChanged,
  formatRelativeTime,
} from '@/components/admin/AdminNotificationBell'

interface SellerApplicationState {
  id: string
  storeName: string
  storeDescription: string
  email?: string
  emergencyContact?: string | null
  address?: string
  hasIdDocument?: boolean
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'
  rejectionReason?: string | null
  submittedAt?: string
  reviewedAt?: string | null
}

// Identity-document constraints — mirrored from the backend (Multer + the
// private storage service) so invalid files are rejected before any request.
const ID_DOCUMENT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'
const ID_DOCUMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const ID_DOCUMENT_MAX_BYTES = 8 * 1024 * 1024 // 8 MB

const ID_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'application/pdf': 'PDF',
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const statusVariant = (status: string): 'warning' | 'success' | 'destructive' | 'default' => {
  const map: Record<string, any> = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'destructive',
  };
  return map[status] || 'default';
};

const Account: React.FC = () => {
  const { user, updateProfile } = useAuth()
  const { toast } = useToast()
  const [isEditing, setIsEditing] = React.useState(false)
  const [firstName, setFirstName] = React.useState(user?.firstName || '')
  const [lastName, setLastName] = React.useState(user?.lastName || '')
  const [phone, setPhone] = React.useState(user?.phone || '')
  const [isSaving, setIsSaving] = React.useState(false)
  
  // Wallet states
  const [walletBalance, setWalletBalance] = React.useState<number>(0)
  const [transactions, setTransactions] = React.useState<any[]>([])
  const [loadingWallet, setLoadingWallet] = React.useState<boolean>(false)
  const [showDepositModal, setShowDepositModal] = React.useState(false)
  const [depositAmount, setDepositAmount] = React.useState('')
  const [paymentMethod, setPaymentMethod] = React.useState('credit_card')

  // Seller application/profiles are provided by the persistent AccountLayout
  // shell (shared with the sidebar's "Store" label), so this page only keeps
  // the application form + submit logic.
  const { sellerApp, sellerProfile, sellerLoading, refreshSeller } = useOutletContext<AccountOutletContext>()
  const [shopName, setShopName] = React.useState('')
  const [applicantEmail, setApplicantEmail] = React.useState(user?.email || '')
  const [emergencyContact, setEmergencyContact] = React.useState('')
  const [address, setAddress] = React.useState('')
  const [idDocument, setIdDocument] = React.useState<File | null>(null)
  const [idDocumentError, setIdDocumentError] = React.useState<string | null>(null)
  const idDocumentInputRef = React.useRef<HTMLInputElement>(null)

  // Submission progress — distinct, honest stages instead of a generic spinner.
  // `preparing` → browser-side ID compression; `uploading` → real % from XHR;
  // `creating` → upload complete, server is validating + persisting;
  // `done` → success response received.
  type SellerSubmitStage = 'idle' | 'preparing' | 'uploading' | 'creating' | 'done'
  const [submitStage, setSubmitStageState] = React.useState<SellerSubmitStage>('idle')
  const submitStageRef = React.useRef<SellerSubmitStage>('idle')
  const setSubmitStage = (stage: SellerSubmitStage) => {
    submitStageRef.current = stage
    setSubmitStageState(stage)
  }
  const sellerSubmitting = submitStage !== 'idle'
  const [uploadPercent, setUploadPercent] = React.useState(0)
  const [preparedDocument, setPreparedDocument] = React.useState<PreparedIdentityDocument | null>(null)

  // Phase 8: Marcari23 Seller Agreement. The version/text come from the server;
  // acceptance is recorded server-side and gates application submission.
  const [agreement, setAgreement] = React.useState<SellerAgreement | null>(null)
  const [agreementLoading, setAgreementLoading] = React.useState(true)
  const [agreementError, setAgreementError] = React.useState<string | null>(null)
  const [sellerAgreed, setSellerAgreed] = React.useState(false)
  const [agreementOpen, setAgreementOpen] = React.useState(false)
  const [agreementViewed, setAgreementViewed] = React.useState(false)
  const [acceptingAgreement, setAcceptingAgreement] = React.useState(false)

  // Notifications tab (Phase 7)
  const navigate = useNavigate()
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([])
  const [notificationsPage, setNotificationsPage] = React.useState(1)
  const [notifTotalPages, setNotifTotalPages] = React.useState(1)
  const [notifTotal, setNotifTotal] = React.useState(0)
  const [notifLoading, setNotifLoading] = React.useState(false)
  const [notifError, setNotifError] = React.useState<string | null>(null)

  const location = useLocation()
  const accountPath = location.pathname
  const tab =
    accountPath.startsWith('/account/wallet')
      ? 'wallet'
      : accountPath.startsWith('/account/addresses')
        ? 'addresses'
        : accountPath.startsWith('/account/payments')
          ? 'payments'
          : accountPath.startsWith('/account/seller')
            ? 'seller'
            : accountPath.startsWith('/account/notifications')
              ? 'notifications'
              : accountPath.startsWith('/account/usdc-policy')
                ? 'usdc-policy'
                : accountPath.startsWith('/account/support')
                  ? 'support'
                  : accountPath.startsWith('/account/loans')
                    ? 'loans'
                    : 'overview'

  const fetchWallet = React.useCallback(async () => {
    try {
      setLoadingWallet(true)
      const [walletRes, txRes] = await Promise.all([
        api.get<{ balance: number }>('/wallet').catch(() => ({ balance: 0 })),
        api.get<{ transactions: any[] }>('/wallet/transactions').catch(() => ({ transactions: [] })),
      ])
      setWalletBalance(walletRes?.balance ?? 0)
      setTransactions(txRes?.transactions || (Array.isArray(txRes) ? txRes : []))
    } catch {
      // keep default
    } finally {
      setLoadingWallet(false)
    }
  }, [])

  // Wallet data is only needed on the wallet tab — fetching it on every
  // account section (profile, addresses, notifications, seller, …) was
  // unnecessary. Prefer route-specific loading.
  React.useEffect(() => {
    if (tab !== 'wallet') return
    fetchWallet()
  }, [tab, fetchWallet])

  // Order stats for overview tab
  const [orderStats, setOrderStats] = React.useState<{
    totalOrders: number
    inWarehouseOrders: number
    inTransitOrders: number
    totalSpent: number
    estimatedSavings: number
  } | null>(null)
  const [loadingOrderStats, setLoadingOrderStats] = React.useState(false)

  const fetchOrderStats = React.useCallback(async () => {
    try {
      setLoadingOrderStats(true)
      const stats = await orderApi.getStats()
      setOrderStats(stats)
    } catch {
      // keep defaults
    } finally {
      setLoadingOrderStats(false)
    }
  }, [])

  React.useEffect(() => {
    if (tab !== 'overview') return
    fetchOrderStats()
  }, [tab, fetchOrderStats])

  // Support chat state
  const [supportConversations, setSupportConversations] = React.useState<SupportConversationSummary[]>([])
  const [activeSupportConversation, setActiveSupportConversation] = React.useState<SupportConversationSummary | null>(null)
  const [supportMessages, setSupportMessages] = React.useState<SupportMessage[]>([])
  const [supportLoading, setSupportLoading] = React.useState(false)
  const [supportError, setSupportError] = React.useState<string | null>(null)
  const [newMessage, setNewMessage] = React.useState('')
  const [sendingMessage, setSendingMessage] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  const fetchSupportConversations = React.useCallback(async () => {
    try {
      setSupportLoading(true)
      setSupportError(null)
      const res = await supportApi.listConversations()
      setSupportConversations(res.conversations || [])
    } catch (err: any) {
      setSupportError(err.message || 'Failed to load conversations')
    } finally {
      setSupportLoading(false)
    }
  }, [])

  const openSupportConversation = React.useCallback(async (conversation: SupportConversationSummary) => {
    setActiveSupportConversation(conversation)
    setSupportMessages([])
    setSupportError(null)
    try {
      setSupportLoading(true)
      const res = await supportApi.getMessages(conversation.id)
      setSupportMessages(res.messages || [])
      // Mark as read
      if (res.unreadCount > 0) {
        await supportApi.markRead(conversation.id)
        // Update local unread count
        setSupportConversations((prev) =>
          prev.map((c) => (c.id === conversation.id ? { ...c, unreadCount: 0 } : c))
        )
      }
    } catch (err: any) {
      setSupportError(err.message || 'Failed to load messages')
    } finally {
      setSupportLoading(false)
    }
  }, [])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !activeSupportConversation || sendingMessage) return
    const body = newMessage.trim()
    setNewMessage('')
    setSendingMessage(true)
    try {
      const message = await supportApi.sendMessage(activeSupportConversation.id, body)
      setSupportMessages((prev) => [...prev, message])
    } catch (err: any) {
      setSupportError(err.message || 'Failed to send message')
      setNewMessage(body)
    } finally {
      setSendingMessage(false)
    }
  }

  React.useEffect(() => {
    if (tab !== 'support') return
    fetchSupportConversations()
  }, [tab, fetchSupportConversations])

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [supportMessages])

  // Poll for new messages when a conversation is open
  React.useEffect(() => {
    if (!activeSupportConversation) return
    const interval = setInterval(async () => {
      try {
        const res = await supportApi.getMessages(activeSupportConversation.id)
        setSupportMessages(res.messages || [])
      } catch {
        // ignore polling errors
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [activeSupportConversation])

  // Loan Requests tab
  const [loanRequests, setLoanRequests] = React.useState<any[]>([])
  const [loanRequestsPage, setLoanRequestsPage] = React.useState(1)
  const [loanRequestsTotalPages, setLoanRequestsTotalPages] = React.useState(1)
  const [loanRequestsTotal, setLoanRequestsTotal] = React.useState(0)
  const [loanRequestsLoading, setLoanRequestsLoading] = React.useState(false)
  const [loanRequestsError, setLoanRequestsError] = React.useState<string | null>(null)
  const [showLoanRequestModal, setShowLoanRequestModal] = React.useState(false)
  const [showLoanDetailModal, setShowLoanDetailModal] = React.useState<any | null>(null)
  const [loanAmount, setLoanAmount] = React.useState('')
  const [loanPurpose, setLoanPurpose] = React.useState('')
  const [repaymentPeriod, setRepaymentPeriod] = React.useState('')
  const [submittingLoanRequest, setSubmittingLoanRequest] = React.useState(false)
  const [repayingLoanId, setRepayingLoanId] = React.useState<string | null>(null)
  const [repayAmount, setRepayAmount] = React.useState('')

  const fetchLoanRequests = React.useCallback(async () => {
    try {
      setLoanRequestsLoading(true)
      setLoanRequestsError(null)
      const res = await loanApi.list({ page: loanRequestsPage, limit: 10 })
      setLoanRequests(res.loanRequests || [])
      setLoanRequestsTotal(res.pagination?.total ?? 0)
      setLoanRequestsTotalPages(res.pagination?.totalPages || 1)
    } catch (err: any) {
      setLoanRequestsError(err.message || 'Failed to load loan requests')
    } finally {
      setLoanRequestsLoading(false)
    }
  }, [loanRequestsPage])

  React.useEffect(() => {
    if (tab !== 'loans') return
    fetchLoanRequests()
  }, [tab, fetchLoanRequests])

  const handleSubmitLoanRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(loanAmount)
    if (isNaN(amount) || amount < 1) {
      toast({ variant: 'error', title: 'Invalid Amount', description: 'Please enter a valid amount (minimum $1)' })
      return
    }
    if (!loanPurpose.trim()) {
      toast({ variant: 'error', title: 'Missing Purpose', description: 'Please provide a loan purpose' })
      return
    }

    try {
      setSubmittingLoanRequest(true)
      await loanApi.submit({
        requestedAmount: amount,
        loanPurpose: loanPurpose.trim(),
        repaymentPeriod: repaymentPeriod ? parseInt(repaymentPeriod, 10) : undefined,
      })
      toast({
        variant: 'success',
        title: 'Loan Request Submitted',
        description: 'Your loan request has been submitted and is pending review.',
      })
      setShowLoanRequestModal(false)
      setLoanAmount('')
      setLoanPurpose('')
      setRepaymentPeriod('')
      await fetchLoanRequests()
    } catch (err: any) {
      toast({ variant: 'error', title: 'Submission Failed', description: err.message || 'Unable to submit loan request.' })
    } finally {
      setSubmittingLoanRequest(false)
    }
  }

  const handleViewLoanDetails = async (loan: any) => {
    try {
      const detail = await loanApi.get(loan.id)
      setShowLoanDetailModal(detail)
    } catch (err: any) {
      toast({ variant: 'error', title: 'Failed to load details', description: err.message })
    }
  }

  const handleRepayLoan = async (loan: any) => {
    setRepayingLoanId(loan.id)
    setRepayAmount('')
  }

  const handleSubmitRepayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!repayingLoanId) return
    const amount = parseFloat(repayAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({ variant: 'error', title: 'Invalid Amount', description: 'Please enter a valid repayment amount' })
      return
    }
    try {
      await loanApi.repay(repayingLoanId, { amount })
      toast({ variant: 'success', title: 'Repayment Recorded', description: 'Your repayment has been processed.' })
      setRepayingLoanId(null)
      setRepayAmount('')
      await fetchLoanRequests()
    } catch (err: any) {
      toast({ variant: 'error', title: 'Repayment Failed', description: err.message || 'Unable to process repayment.' })
    }
  }

  const formatETB = (amount: number) => formatCurrency(amount, 'ETB')

  // Open the hidden native file input from a type="button" trigger. File inputs
  // cannot be programmatically re-filled, so selection is validated into React
  // state immediately and the native input's value is only used for opening.
  const openIdDocumentPicker = () => {
    idDocumentInputRef.current?.click()
  }

  const clearIdDocument = () => {
    setIdDocument(null)
    setIdDocumentError(null)
    if (idDocumentInputRef.current) idDocumentInputRef.current.value = ''
  }

  const handleIdDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null

    if (!file) {
      setIdDocument(null)
      return
    }

    if (!ID_DOCUMENT_MIME_TYPES.includes(file.type)) {
      const message = 'Unsupported file type. Upload a JPG, PNG, WEBP or PDF.'
      setIdDocument(null)
      setIdDocumentError(message)
      toast({ variant: 'error', title: 'Invalid ID document', description: message })
      if (idDocumentInputRef.current) idDocumentInputRef.current.value = ''
      return
    }

    if (file.size > ID_DOCUMENT_MAX_BYTES) {
      const message = 'File is too large. The maximum size is 8 MB.'
      setIdDocument(null)
      setIdDocumentError(message)
      toast({ variant: 'error', title: 'Invalid ID document', description: message })
      if (idDocumentInputRef.current) idDocumentInputRef.current.value = ''
      return
    }

    setIdDocument(file)
    setIdDocumentError(null)
  }

  const handleSellerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sellerAgreed) {
      toast({
        variant: 'error',
        title: 'Seller Agreement required',
        description: 'Please read and accept the current Marcari23 Seller Agreement first.',
      })
      return
    }
    if (!shopName.trim() || !applicantEmail.trim() || !address.trim()) {
      toast({
        variant: 'error',
        title: 'Missing details',
        description: 'Shop name, email address and address are required.',
      })
      return
    }
    if (!idDocument) {
      toast({
        variant: 'error',
        title: 'ID document required',
        description: 'Upload a photo or scan of your ID, passport, or driver\'s license.',
      })
      return
    }

    setUploadPercent(0)
    setPreparedDocument(null)

    try {
      // 1. Prepare an upload copy of the ID document in the browser. Images are
      //    compressed/resized in memory; PDFs and unsupported files pass through
      //    untouched. The user's original file is never modified.
      setSubmitStage('preparing')
      let documentFile = idDocument
      try {
        const prepared = await prepareIdentityDocument(idDocument)
        documentFile = prepared.file
        setPreparedDocument(prepared)
      } catch {
        // Compression is best-effort — fall through with the original file.
        // The backend still validates whatever arrives, independently.
      }

      // 2. Upload with REAL progress (XHR). The %. Once the bytes are sent the
      //    server is validating + persisting, so switch to the "creating" stage.
      const payload = {
        shopName: shopName.trim(),
        email: applicantEmail.trim(),
        emergencyContact: emergencyContact.trim() || undefined,
        address: address.trim(),
        idDocument: documentFile,
      }

      setSubmitStage('uploading')
      const onProgress = (percent: number) => {
        setUploadPercent(percent)
        if (percent >= 100 && submitStageRef.current === 'uploading') {
          setSubmitStage('creating')
        }
      }

      if (sellerApp?.status === 'REJECTED') {
        await sellerApplicationApi.resubmit(payload, onProgress)
      } else {
        await sellerApplicationApi.submit(payload, onProgress)
      }

      setSubmitStage('done')
      toast({
        variant: 'success',
        title: 'Application submitted successfully',
        description: 'Your seller application is now under review.',
      })
      setShopName('')
      setEmergencyContact('')
      setAddress('')
      clearIdDocument()
      setPreparedDocument(null)
      // Force so the just-submitted PENDING status is not masked by the
      // login-phase seller-status cache.
      await refreshSeller({ force: true })
      setSubmitStage('idle')
    } catch (err: any) {
      // A network-level failure (ApiError with status 0) means the document
      // never reached the server. Server rejections carry a meaningful message.
      const networkError = !(err instanceof ApiError) || err.status === 0
      setSubmitStage('idle')
      setPreparedDocument(null)
      toast({
        variant: 'error',
        title: networkError
          ? "We couldn't upload your ID document."
          : 'Your application could not be submitted.',
        description: networkError
          ? 'Please check your connection and try again.'
          : err?.message || 'Please try again.',
      })
    }
  }

  const loadAgreement = React.useCallback(async () => {
    try {
      setAgreementLoading(true)
      setAgreementError(null)
      const res = await sellerAgreementApi.get()
      setAgreement(res)
      setSellerAgreed(res.accepted)
    } catch (err: any) {
      setAgreementError(err.message || 'Could not load the Seller Agreement.')
    } finally {
      setAgreementLoading(false)
    }
  }, [])

  // The Seller Agreement is only consumed by the seller tab — don't fetch it
  // while browsing other account sections.
  React.useEffect(() => {
    if (tab !== 'seller') return
    loadAgreement()
  }, [tab, loadAgreement])

  const handleAgreementScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) {
      setAgreementViewed(true)
    }
  }

  const handleAgree = async () => {
    try {
      setAcceptingAgreement(true)
      const res = await sellerAgreementApi.accept()
      setSellerAgreed(true)
      setAgreement((prev) =>
        prev
          ? { ...prev, accepted: true, acceptedVersion: res.version, acceptedAt: res.acceptedAt }
          : prev,
      )
      setAgreementOpen(false)
      toast({
        variant: 'success',
        title: 'Agreement accepted',
        description: `You accepted the Marcari23 Seller Agreement (v${res.version}).`,
      })
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Could not record acceptance',
        description: err.message || 'Please try again.',
      })
    } finally {
      setAcceptingAgreement(false)
    }
  }

  // Seller Agreement section — reused by both the first application and the
  // resubmission form. Reading the agreement (scrolling to the end) reveals
  // the Agree button; acceptance is recorded server-side.
  const sellerAgreementSection = (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">Seller Agreement</span>
            {agreement && <Badge variant="outline" size="xs">v{agreement.version}</Badge>}
            {sellerAgreed && <Badge variant="success" size="xs">Accepted</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {sellerAgreed
              ? 'You have accepted the current Marcari23 Seller Agreement.'
              : 'Read and accept the Marcari23 Seller Agreement to enable submission.'}
          </p>
        </div>
      </div>

      {agreementLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading agreement…
        </div>
      ) : agreementError ? (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" /> {agreementError}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={loadAgreement}>
            Retry
          </Button>
        </div>
      ) : sellerAgreed ? (
        <div className="flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 className="h-4 w-4" />
          Accepted{agreement?.acceptedAt ? ` ${formatRelativeTime(agreement.acceptedAt)}` : ''}
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<FileText className="h-4 w-4" />}
            onClick={() => setAgreementOpen(true)}
          >
            Read Seller Agreement
          </Button>
          {agreementViewed && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              isLoading={acceptingAgreement}
              leftIcon={<ShieldCheck className="h-4 w-4" />}
              onClick={handleAgree}
            >
              Agree to Seller Agreement
            </Button>
          )}
        </div>
      )}
    </div>
  )

  // Honest submission progress, shown only while a submission is in flight.
  // "uploading" reports a REAL percentage (XHR upload progress); the other
  // stages are named and never faked.
  const sellerSubmitProgress = submitStage === 'idle' ? null : (
    <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {submitStage === 'done' && <CheckCircle2 className="h-4 w-4 text-success" />}
          {submitStage === 'preparing' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {submitStage === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {submitStage === 'creating' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {submitStage === 'preparing' && 'Preparing ID document…'}
          {submitStage === 'uploading' &&
            (uploadPercent > 0 ? `Uploading ID document… ${uploadPercent}%` : 'Uploading ID document…')}
          {submitStage === 'creating' && 'Creating your application…'}
          {submitStage === 'done' && 'Application submitted successfully.'}
        </p>
        {submitStage === 'done' && (
          <Badge variant="success" size="sm">
            Done
          </Badge>
        )}
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {submitStage === 'uploading' && uploadPercent > 0 && uploadPercent < 100 ? (
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-150"
            style={{ width: `${uploadPercent}%` }}
          />
        ) : submitStage === 'done' ? (
          <div className="h-full w-full rounded-full bg-success" />
        ) : (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
        )}
      </div>

      {preparedDocument && submitStage !== 'preparing' && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
          {preparedDocument.wasCompressed ? (
            <>
              ID image prepared: {formatFileSize(preparedDocument.originalBytes)} →{' '}
              {formatFileSize(preparedDocument.uploadedBytes)}
            </>
          ) : (
            <>ID document ready (sent as-is)</>
          )}
        </p>
      )}
    </div>
  )

  // "Become a Seller" application fields — reused by the first application
  // and the rejected-resubmission form. The identity document is uploaded as
  // multipart/form-data and stored privately by the backend.
  const sellerApplicationFields = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Shop Name <span className="text-destructive">*</span>
        </label>
        <Input
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          placeholder="e.g. Nati's Tech Deals"
          required
          minLength={3}
          maxLength={80}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Email Address <span className="text-destructive">*</span>
        </label>
        <Input
          type="email"
          value={applicantEmail}
          onChange={(e) => setApplicantEmail(e.target.value)}
          placeholder="you@example.com"
          required
          maxLength={254}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Emergency Contact
        </label>
        <Input
          value={emergencyContact}
          onChange={(e) => setEmergencyContact(e.target.value)}
          placeholder="Name and phone number (optional)"
          maxLength={120}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Address <span className="text-destructive">*</span>
        </label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street, city, country"
          required
          minLength={5}
          maxLength={300}
          rows={3}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          ID Document <span className="text-destructive">*</span>
        </label>
        <p className="text-xs text-muted-foreground">
          Upload your government ID, passport, or driver&apos;s license.
        </p>

        {/* Hidden native input, opened only by a type="button" trigger. It has no
            `required` so it can never block the JS-validated application submit,
            and it is never unmounted while the picker is open. `sr-only` keeps
            the input visually hidden; the inline style guarantees it stays
            invisible even if the stylesheet has not loaded. */}
        <input
          ref={idDocumentInputRef}
          type="file"
          accept={ID_DOCUMENT_ACCEPT}
          onChange={handleIdDocumentChange}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            borderWidth: 0,
          }}
        />

        {idDocument ? (
          <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold">{idDocument.name}</p>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              </div>
              <p className="text-xs text-muted-foreground">
                {ID_DOCUMENT_TYPE_LABELS[idDocument.type] || 'FILE'} · {formatFileSize(idDocument.size)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openIdDocumentPicker}
                disabled={sellerSubmitting}
              >
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/5"
                leftIcon={<Trash2 className="h-4 w-4" />}
                onClick={clearIdDocument}
                disabled={sellerSubmitting}
              >
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={openIdDocumentPicker}
            disabled={sellerSubmitting}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border border-dashed p-4 text-left transition-colors',
              idDocumentError
                ? 'border-destructive/40 bg-destructive/5 hover:bg-destructive/10'
                : 'border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40',
              sellerSubmitting && 'cursor-not-allowed opacity-60',
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Upload className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Upload ID document</p>
              <p className="text-xs text-muted-foreground">JPG, PNG, WEBP or PDF · Max 8 MB</p>
            </div>
          </button>
        )}

        {idDocumentError && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> {idDocumentError}
          </p>
        )}
      </div>
    </div>
  )

  // Notifications tab (Phase 7)
  const notifUnread = notifications.filter((n) => !n.readAt).length

  React.useEffect(() => {
    // The notifications list is only rendered on the notifications tab; the
    // effect must not fire for unrelated account sections.
    if (tab !== 'notifications') return
    let cancelled = false
    setNotifLoading(true)
    notificationApi
      .list({ page: notificationsPage, limit: 10 })
      .then((res) => {
        if (cancelled) return
        setNotifications(res.notifications || [])
        setNotifTotal(res.pagination?.total ?? 0)
        setNotifTotalPages(res.pagination?.totalPages || 1)
        setNotifError(null)
      })
      .catch((err: any) => {
        if (!cancelled) setNotifError(err.message || 'Failed to load notifications')
      })
      .finally(() => {
        if (!cancelled) setNotifLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [notificationsPage, tab])

  const handleOpenNotification = async (n: NotificationItem) => {
    try {
      if (!n.readAt) {
        await notificationApi.markRead(n.id)
        notificationsChanged()
        setNotifications((prev) =>
          prev.map((i) =>
            i.id === n.id ? { ...i, readAt: new Date().toISOString() } : i,
          ),
        )
      }
      if (n.conversationId) {
        navigate(`/seller/messages/${n.conversationId}`)
      } else if (n.orderId) {
        navigate(`/orders/${n.orderId}`)
      }
    } catch {
      // Keep the tab stable on failure.
    }
  }

  const handleMarkAllNotifications = async () => {
    try {
      await notificationApi.markAllRead()
      notificationsChanged()
      setNotifications((prev) =>
        prev.map((i) => (i.readAt ? i : { ...i, readAt: new Date().toISOString() })),
      )
    } catch (err: any) {
      setNotifError(err.message || 'Could not mark notifications as read')
    }
  }

  React.useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '')
      setLastName(user.lastName || '')
      setPhone(user.phone || '')
    }
  }, [user])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsSaving(true)
      await updateProfile({ firstName, lastName, phone })
      toast({ variant: 'success', title: 'Profile updated', description: 'Your profile details have been saved.' })
      setIsEditing(false)
    } catch (err: any) {
      toast({ variant: 'error', title: 'Update failed', description: err.message || 'Could not update profile.' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount)
    if (isNaN(amount) || amount < 1) {
      toast({ variant: 'error', title: 'Invalid Amount', description: 'Please enter a valid amount (minimum $1)' })
      return
    }

    try {
      setIsSaving(true)
      await api.post('/wallet/deposit', { amount, paymentMethod })
      toast({
        variant: 'success',
        title: 'Deposit Successful',
        description: `Successfully added ${formatCurrency(amount, 'USD')} to your wallet.`,
      })
      setShowDepositModal(false)
      setDepositAmount('')
      await fetchWallet()
    } catch (err: any) {
      toast({ variant: 'error', title: 'Deposit Failed', description: err.message || 'Unable to process deposit.' })
    } finally {
      setIsSaving(false)
    }
  }

  const userDisplayName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Customer'
    : 'Valued Customer'
  const userInitials = user
    ? (user.firstName ? user.firstName[0] : user.email[0]).toUpperCase()
    : 'U'

  return (
    <div className="space-y-6">
      {tab === 'overview' && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    l: 'Total Orders',
                    v: orderStats?.totalOrders ?? 0,
                    s: loadingOrderStats ? 'Loading...' : '+3 this month',
                    icon: Package,
                    c: 'text-primary',
                    b: 'bg-primary/10',
                  },
                  {
                    l: 'In Warehouse',
                    v: orderStats?.inWarehouseOrders ?? 0,
                    s: loadingOrderStats ? 'Loading...' : 'Ready to ship',
                    icon: Building,
                    c: 'text-secondary',
                    b: 'bg-secondary/10',
                  },
                  {
                    l: 'In Transit',
                    v: orderStats?.inTransitOrders ?? 0,
                    s: loadingOrderStats ? 'Loading...' : 'ETA Sep 12',
                    icon: Truck,
                    c: 'text-info',
                    b: 'bg-info/10',
                  },
                  {
                    l: 'Savings This Year',
                    v: orderStats ? formatCurrency(orderStats.estimatedSavings, 'USD') : '$0',
                    s: loadingOrderStats ? 'Loading...' : 'vs individual shipping',
                    icon: Gift,
                    c: 'text-success',
                    b: 'bg-success/10',
                  },
                ].map((s) => (
                  <Card key={s.l}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', s.b)}>
                          <s.icon className={cn('h-5 w-5', s.c)} />
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="mt-4">
                        <div className="font-display text-2xl font-extrabold">{s.v}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{s.l}</div>
                        <div className="text-[10px] text-success font-semibold mt-1 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {s.s}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid md:grid-cols-3 gap-5">
                {/* Profile */}
                <Card className="md:col-span-2">
                  <CardContent className="p-5 lg:p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="font-display text-lg font-bold flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        Profile Information
                      </h2>
                      {!isEditing && (
                        <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                      )}
                    </div>

                    {isEditing ? (
                      <form onSubmit={handleSaveProfile} className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">First Name</label>
                            <Input
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              placeholder="First Name"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Last Name</label>
                            <Input
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              placeholder="Last Name"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Phone Number</label>
                          <Input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+1 (555) 000-0000"
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                          <Button type="submit" size="sm" disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Changes'}
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-5">
                        {[
                          { l: 'Full Name', v: userDisplayName, i: User },
                          { l: 'Email Address', v: user?.email || 'N/A', i: Mail, verified: true },
                          { l: 'Phone Number', v: user?.phone || 'Not provided', i: Phone, verified: !!user?.phone },
                          { l: 'Account Role', v: user?.role || 'CUSTOMER', i: ShieldCheck },
                          { l: 'Member Since', v: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Recently', i: CalendarDays },
                          { l: 'Language', v: 'English', i: BookOpen },
                        ].map((f) => (
                          <div key={f.l}>
                            <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold flex items-center gap-1">
                              <f.i className="h-3 w-3" />
                              {f.l}
                            </label>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-sm font-semibold">{f.v}</span>
                              {f.verified && (
                                <Badge variant="success" size="xs" className="gap-0.5">
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  Verified
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Benefits */}
                <Card className="bg-gradient-to-br from-primary-900 to-primary text-white border-none overflow-hidden relative">
                  <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-secondary/20 blur-2xl" />
                  <CardContent className="p-5 lg:p-6 space-y-4 relative">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-lg bg-white/10 text-secondary flex items-center justify-center">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-bold">Premium Member</div>
                        <div className="text-[11px] text-white/60">Since March 2023</div>
                      </div>
                    </div>
                    <ul className="space-y-2 text-xs text-white/80">
                      {[
                        'Reduced service fee (6% vs 7%)',
                        'Free express consolidation',
                        'Priority 24/7 support',
                        'Exclusive early deals',
                        'Extra 15 days free storage',
                      ].map((b) => (
                        <li key={b} className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-secondary" />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <div className="pt-2">
                      <div className="text-[10px] uppercase tracking-wide text-white/60 font-bold mb-1.5">Lifetime Savings</div>
                      <div className="font-display text-3xl font-extrabold">$1,847</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick actions */}
              <Card>
                <CardContent className="p-5 lg:p-6">
                  <h2 className="font-display text-lg font-bold mb-4">Quick Actions</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { l: 'Browse Marketplace', i: Package, to: '/marketplace', c: 'text-primary', b: 'bg-primary/10' },
                      { l: 'View My Orders', i: Clock, to: '/orders', c: 'text-secondary', b: 'bg-secondary/10' },
                      { l: 'Track Package', i: FileText, to: '/shipping', c: 'text-success', b: 'bg-success/10' },
                    ].map((q) => (
                      <Link
                        key={q.l}
                        to={q.to}
                        className="p-4 rounded-xl border border-border bg-card hover:shadow-card-hover hover:border-primary-200 transition-all group"
                      >
                        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform', q.b)}>
                          <q.i className={cn('h-5 w-5', q.c)} />
                        </div>
                        <div className="font-bold text-sm">{q.l}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">Tap to open →</div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {tab === 'addresses' && (
            <Card>
              <CardContent className="p-5 lg:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Saved Addresses
                  </h2>
                  <Button variant="primary" size="md">
                    <Pencil className="h-4 w-4" />
                    Add Address
                  </Button>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { type: 'Home', default: true, name: 'John Doe', address: '123 Main Street, Apt 4B\nNew York, NY 10001\nUnited States', phone: '+1 (555) 123-4567' },
                    { type: 'Office', default: false, name: 'John Doe', address: '500 Business Ave, Floor 10\nNew York, NY 10003\nUnited States', phone: '+1 (555) 987-6543' },
                  ].map((a) => (
                    <div key={a.type} className={cn(
                      'p-5 rounded-xl border transition-all',
                      a.default ? 'border-primary-300 bg-primary-50/30 shadow-md' : 'border-border bg-white',
                    )}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{a.type}</span>
                          {a.default && (
                            <Badge variant="primary" size="sm" className="gap-0.5">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Default
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      <div className="text-sm font-semibold mb-1">{a.name}</div>
                      <div className="text-sm text-foreground/70 leading-relaxed whitespace-pre-line">{a.address}</div>
                      <div className="mt-2 text-xs text-muted-foreground">{a.phone}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {tab === 'payments' && (
            <Card>
              <CardContent className="p-5 lg:p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Payment Methods
                  </h2>
                  <Button size="md">Add Payment Method</Button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white relative overflow-hidden min-h-[180px] flex flex-col justify-between shadow-xl">
                    <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                    <div className="flex items-center justify-between relative">
                      <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">Marcari23 PAY</div>
                      <Badge variant="accent" size="sm" className="gap-0.5">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Default
                      </Badge>
                    </div>
                    <div className="font-mono text-lg font-bold tracking-widest relative">•••• •••• •••• 4242</div>
                    <div className="flex items-end justify-between relative">
                      <div>
                        <div className="text-[10px] opacity-70 uppercase tracking-wide">Cardholder</div>
                        <div className="text-sm font-semibold">John Doe</div>
                      </div>
                      <div>
                        <div className="text-[10px] opacity-70 uppercase tracking-wide">Expires</div>
                        <div className="text-sm font-semibold">12 / 28</div>
                      </div>
                      <div className="text-2xl font-bold italic">VISA</div>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-muted/40 border-2 border-dashed border-border flex flex-col items-center justify-center text-center min-h-[180px]">
                    <div className="h-12 w-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mb-3">
                      <CreditCard className="h-6 w-6" />
                    </div>
                    <div className="font-semibold mb-1">Add another card</div>
                    <p className="text-xs text-muted-foreground max-w-xs mb-3">
                      We accept Visa, Mastercard, Amex, PayPal, Apple Pay, and more.
                    </p>
                    <Button variant="outline" size="sm">Add Payment Method</Button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-muted/40 text-xs flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  <span className="text-foreground/70 leading-relaxed">
                    <span className="font-bold text-foreground">Your data is secure.</span> Payments are processed by PCI-DSS Level 1 certified providers. Marcari23 never stores your full card information.
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {tab === 'wallet' && (
            <div className="space-y-6">
              {/* Balance Card */}
              <Card className="border-2 border-primary/20 overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6 lg:p-8">
                    <div className="flex items-center justify-between flex-wrap gap-6">
                      <div>
                        <div className="text-sm font-bold text-muted-foreground mb-2 flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Available Balance
                        </div>
                        <div className="font-display text-5xl font-extrabold text-primary mb-1">
                          {formatCurrency(walletBalance, 'USD')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Last updated: {new Date().toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button size="lg" onClick={() => setShowDepositModal(true)}>
                          <span className="inline-flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            <span>Add Funds</span>
                          </span>
                        </Button>
                        <Button size="lg" variant="outline" asChild>
                          <Link to="/wallet" className="inline-flex items-center gap-2">
                            <span>View All Transactions</span>
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 border-t border-border">
                    {(() => {
                      const totalDeposited = transactions
                        .filter((t) => (t.type === 'DEPOSIT' || t.type === 'REFUND' || t.type === 'BONUS') && t.status === 'COMPLETED')
                        .reduce((sum, t) => sum + t.amount, 0)
                      const totalSpent = transactions
                        .filter((t) => (t.type === 'PAYMENT' || t.type === 'WITHDRAWAL') && t.status === 'COMPLETED')
                        .reduce((sum, t) => sum + t.amount, 0)
                      const totalBonuses = transactions
                        .filter((t) => t.type === 'BONUS' && t.status === 'COMPLETED')
                        .reduce((sum, t) => sum + t.amount, 0)

                      return [
                        { label: 'Total Deposited', value: formatCurrency(totalDeposited, 'USD'), icon: TrendingUp, color: 'text-success' },
                        { label: 'Total Spent', value: formatCurrency(totalSpent, 'USD'), icon: ArrowUpRight, color: 'text-primary' },
                        { label: 'Bonuses Earned', value: formatCurrency(totalBonuses, 'USD'), icon: Gift, color: 'text-secondary' },
                      ].map((stat, idx) => (
                        <div
                          key={stat.label}
                          className={cn(
                            'p-5 text-center',
                            idx < 2 && 'border-r border-border'
                          )}
                        >
                          <div className="flex items-center justify-center gap-1.5 mb-1.5">
                            <stat.icon className={cn('h-4 w-4', stat.color)} />
                            <div className="text-xs font-bold text-muted-foreground">{stat.label}</div>
                          </div>
                          <div className="font-display text-xl font-extrabold">{stat.value}</div>
                        </div>
                      ))
                    })()}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Transactions */}
              <Card>
                <CardContent className="p-5 lg:p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-display text-lg font-bold flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      Recent Transactions
                    </h2>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/wallet">View All</Link>
                    </Button>
                  </div>

                  {loadingWallet ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">Loading transactions...</div>
                  ) : transactions.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">No recent transactions</div>
                  ) : (
                    <div className="space-y-3">
                      {transactions.slice(0, 5).map((tx, idx) => {
                        const isPlus = tx.type === 'DEPOSIT' || tx.type === 'REFUND' || tx.type === 'BONUS'
                        return (
                          <div key={tx.id || idx} className="flex items-center justify-between gap-4 p-4 rounded-xl hover:bg-muted/40 transition-colors">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center shrink-0', isPlus ? 'bg-success/10' : 'bg-destructive/10')}>
                                {isPlus ? <ArrowDownLeft className="h-5 w-5 text-success" /> : <Package className="h-5 w-5 text-destructive" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-sm mb-1">{tx.description || tx.type}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                  <CalendarDays className="h-3 w-3" />
                                  {new Date(tx.createdAt || Date.now()).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div
                                className={cn(
                                  'font-display text-xl font-extrabold',
                                  isPlus ? 'text-success' : 'text-destructive'
                                )}
                              >
                                {isPlus ? '+' : '-'}{formatCurrency(tx.amount, 'USD')}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="mt-5 p-4 rounded-xl bg-info/10 border border-info/20 text-sm flex items-start gap-3">
                    <WalletIcon className="h-5 w-5 text-info shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-info mb-1">Use your wallet balance for faster checkout</div>
                      <div className="text-xs text-foreground/70">
                        Pay for orders instantly using your wallet balance. No need to enter payment details every time.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardContent className="p-5 lg:p-6">
                  <h2 className="font-display text-lg font-bold mb-4">Wallet Actions</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { l: 'Add Funds', i: Plus, to: '/wallet', c: 'text-success', b: 'bg-success/10' },
                      { l: 'View Transactions', i: FileText, to: '/wallet', c: 'text-primary', b: 'bg-primary/10' },
                      { l: 'Withdraw', i: ArrowUpRight, to: '/wallet', c: 'text-warning', b: 'bg-warning/10' },
                      { l: 'Pay for Order', i: Package, to: '/cart', c: 'text-info', b: 'bg-info/10' },
                    ].map((action) => (
                      <Link
                        key={action.l}
                        to={action.to}
                        className="p-4 rounded-xl border border-border bg-card hover:shadow-card-hover hover:border-primary-200 transition-all group"
                      >
                        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform', action.b)}>
                          <action.i className={cn('h-5 w-5', action.c)} />
                        </div>
                        <div className="font-bold text-sm">{action.l}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">Tap to open →</div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {tab === 'seller' && (
            <Card>
              <CardContent className="p-5 lg:p-6 space-y-5">
                <h2 className="font-display text-lg font-bold flex items-center gap-2">
                  <Store className="h-5 w-5 text-primary" />
                  {sellerApp?.status === 'APPROVED' || sellerApp?.status === 'SUSPENDED' ? 'Seller Center' : 'Become a Seller'}
                </h2>

                {sellerLoading ? (
                  <div className="py-10 text-center">
                    <div className="animate-spin h-7 w-7 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                    <p className="mt-3 text-sm text-muted-foreground">Loading application status…</p>
                  </div>
                ) : sellerApp?.status === 'APPROVED' ? (
                  <div className="p-4 rounded-xl bg-success/5 border border-success/20">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-6 w-6 text-success shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-foreground">Seller approved</div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Your store <span className="font-semibold text-foreground">{sellerProfile?.storeName || sellerApp.storeName}</span> is active.
                        </p>
                        <Link
                          to="/seller"
                          className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-destructive hover:underline"
                        >
                          Open Store →
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : sellerApp?.status === 'PENDING' ? (
                  <div className="p-4 rounded-xl bg-warning/5 border border-warning/20">
                    <div className="flex items-start gap-3">
                      <Clock className="h-6 w-6 text-warning shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-foreground">Application under review</div>
                        <p className="text-sm text-muted-foreground mt-1">
                          We are reviewing <span className="font-semibold text-foreground">{sellerApp.storeName}</span>.
                          You will see the decision here once an admin has reviewed it.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : sellerApp?.status === 'SUSPENDED' ? (
                  <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                    <div className="flex items-start gap-3">
                      <Ban className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-foreground">Seller account suspended</div>
                        <p className="text-sm text-muted-foreground mt-1">Contact support for more information.</p>
                      </div>
                    </div>
                  </div>
                ) : sellerApp?.status === 'REJECTED' ? (
                  <div className="space-y-5">
                    <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                      <div className="flex items-start gap-3">
                        <XCircle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-foreground">Application rejected</div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Reason: <span className="text-foreground">{sellerApp.rejectionReason || 'Not specified.'}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* Resubmission reuses the same application record server-side. */}
                    <form onSubmit={handleSellerSubmit} className="space-y-4" noValidate>
                      <p className="text-sm font-semibold">Submit a new application</p>
                      {sellerApplicationFields}
                      {sellerAgreementSection}
                      {sellerSubmitProgress}
                      <Button type="submit" disabled={sellerSubmitting || !sellerAgreed}>
                        {sellerSubmitting ? 'Submitting…' : 'Resubmit Application'}
                      </Button>
                    </form>
                  </div>
                ) : (
                  <form onSubmit={handleSellerSubmit} className="space-y-4" noValidate>
                    <p className="text-sm text-muted-foreground">
                      Apply to open a store on Marcari23. Our team reviews every application.
                    </p>
                    {sellerApplicationFields}
                    {sellerAgreementSection}
                    {sellerSubmitProgress}
                    <Button type="submit" disabled={sellerSubmitting || !sellerAgreed}>
                      {sellerSubmitting ? 'Submitting…' : 'Submit Application'}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          )}

          {tab === 'notifications' && (
            <Card>
              <CardContent className="p-5 lg:p-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h2 className="font-display text-lg font-bold flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    Notifications
                  </h2>
                  {notifUnread > 0 && (
                    <Button variant="outline" size="sm" onClick={handleMarkAllNotifications}>
                      <CheckCheck className="h-4 w-4" />
                      Mark all read
                    </Button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  {notifTotal} notification{notifTotal === 1 ? '' : 's'}
                  {notifUnread > 0 ? ` · ${notifUnread} unread` : ''}
                </p>

                {notifLoading ? (
                  <div className="py-10 flex justify-center">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  </div>
                ) : notifError && notifications.length === 0 ? (
                  <div className="py-10 text-center text-sm text-destructive">{notifError}</div>
                ) : notifications.length === 0 ? (
                  <div className="py-10 flex flex-col items-center text-center">
                    <Inbox className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="font-semibold">No notifications yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Updates about your orders and store appear here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border rounded-xl border border-border">
                    {notifications.map((n) => {
                      const Icon = n.type === 'MESSAGE' ? MessageSquare : Bell
                      return (
                        <button
                          key={n.id}
                          onClick={() => handleOpenNotification(n)}
                          className={cn(
                            'w-full text-left flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50',
                            !n.readAt && 'bg-primary-50/40',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                              n.type === 'MESSAGE'
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-primary/10 text-primary',
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="font-semibold text-sm truncate">{n.title}</span>
                              {!n.readAt && (
                                <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                              )}
                            </span>
                            {n.body && (
                              <span className="block text-xs text-muted-foreground mt-0.5 truncate">
                                {n.body}
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                            {formatRelativeTime(n.createdAt)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {notifTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-muted-foreground">
                      Page {notificationsPage} of {notifTotalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={notificationsPage <= 1 || notifLoading}
                        onClick={() => setNotificationsPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={notificationsPage >= notifTotalPages || notifLoading}
                        onClick={() => setNotificationsPage((p) => Math.min(notifTotalPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {tab === 'usdc-policy' && (
            <Card>
              <CardContent className="p-5 lg:p-6 space-y-5">
                <div>
                  <h2 className="font-display text-lg font-bold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    USDC Policy
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">Last updated: September 17, 2026</p>
                </div>

                <div className="space-y-5 text-sm text-muted-foreground leading-relaxed">
                  <section>
                    <h3 className="font-semibold text-foreground mb-1">1. Overview</h3>
                    <p>
                      Marcari23 supports USD Coin (USDC) as a digital-dollar payment and settlement option
                      on the platform. This policy explains how USDC is used for crypto payments, wallet
                      balances, and seller settlement, and the responsibilities that come with it.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-foreground mb-1">2. What USDC is</h3>
                    <p>
                      USDC is a dollar-denominated stablecoin designed to maintain a value of approximately
                      1 USD per token. It is a digital asset, not a bank deposit, and is not insured by any
                      government deposit-insurance scheme. Its value and availability depend on the issuing
                      entity and the blockchain networks on which it operates.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-foreground mb-1">3. How Marcari23 uses USDC</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Buyers may fund orders and wallet balances using USDC on the networks Marcari23 lists at checkout.</li>
                      <li>Wallet USDC balances are credited to your Marcari23 wallet after the required network confirmations.</li>
                      <li>Seller earnings may be settled in USDC to the payout details associated with the seller account.</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-semibold text-foreground mb-1">4. Payments and confirmations</h3>
                    <p>
                      Crypto transfers are only final after the network confirms them. Sending USDC on an
                      unsupported network, to an incorrect address, or with insufficient network fees may
                      result in permanent loss of funds. Marcari23 cannot reverse a confirmed blockchain
                      transaction. You are responsible for verifying the network and address shown at checkout.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-foreground mb-1">5. Fees</h3>
                    <p>
                      Blockchain network fees (gas) are set by the network and are outside Marcari23's control.
                      Marcari23 platform and service fees are disclosed in the order summary and the seller
                      dashboard before you confirm a transaction.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-foreground mb-1">6. Refunds and reversals</h3>
                    <p>
                      Where a refund is approved for an order paid in USDC, Marcari23 will return funds in USDC
                      (or the original asset where required) to the wallet used for the payment, net of any
                      network fees that cannot be recovered. Refund timing depends on network confirmation.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-foreground mb-1">7. Custody and security</h3>
                    <p>
                      Your Marcari23 wallet is a ledger balance maintained by Marcari23. For external wallets, you
                      alone control your private keys and recovery phrase; Marcari23 never has access to them and
                      cannot restore wallets or reverse transfers. You are responsible for securing access to
                      your Marcari23 account and any linked wallet.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-foreground mb-1">8. Compliance</h3>
                    <p>
                      USDC transactions may be subject to identity verification, sanctions screening, and
                      anti-money-laundering controls. Marcari23 may delay, refuse, or reverse a transaction, or
                      request additional information, where required by law or by its payment partners.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-foreground mb-1">9. Risks and limitation of liability</h3>
                    <p>
                      USDC and blockchain networks carry risks including network congestion, protocol failures,
                      issuer-related risk, and regulatory change. To the maximum extent permitted by law, Marcari23
                      is not liable for losses arising from those risks or from incorrect wallet details supplied
                      by a user.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-foreground mb-1">10. Changes to this policy</h3>
                    <p>
                      Marcari23 may update this policy as its USDC features and applicable rules evolve. Material
                      changes will be published on this page with a new "Last updated" date.
                    </p>
                  </section>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Support Chat */}
          {tab === 'support' && (
            <div className="flex flex-col h-[600px] md:h-[700px]">
              {/* Conversation List */}
              <Card className="flex-1 flex flex-col min-h-0">
                <CardContent className="p-0 flex-1 flex flex-col min-h-0">
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <h2 className="font-display text-lg font-bold flex items-center gap-2">
                      <Headphones className="h-5 w-5 text-primary" />
                      Support Center
                    </h2>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setActiveSupportConversation(null)
                        fetchSupportConversations()
                      }}
                      disabled={supportLoading}
                    >
                      <Plus className="h-4 w-4" />
                      New Chat
                    </Button>
                  </div>

                  {supportLoading && !activeSupportConversation ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-sm text-muted-foreground">Loading conversations...</div>
                    </div>
                  ) : supportError ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center p-4">
                        <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                        <p className="text-sm text-destructive mb-2">{supportError}</p>
                        <Button variant="outline" size="sm" onClick={fetchSupportConversations}>
                          Retry
                        </Button>
                      </div>
                    </div>
                  ) : !activeSupportConversation ? (
                    <div className="flex-1 overflow-y-auto">
                      {supportConversations.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                            <Headphones className="h-7 w-7 text-muted-foreground" />
                          </div>
                          <h3 className="font-bold text-lg mb-1">No conversations yet</h3>
                          <p className="text-sm text-muted-foreground max-w-sm mb-4">
                            Start a new chat with our support team for help with orders, account issues, or general questions.
                          </p>
                          <Button
                            variant="primary"
                            onClick={() => {
                              setActiveSupportConversation(null)
                              fetchSupportConversations()
                            }}
                          >
                            <Plus className="h-4 w-4" />
                            Start New Chat
                          </Button>
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {supportConversations.map((conv) => (
                            <button
                              key={conv.id}
                              onClick={() => openSupportConversation(conv)}
                              className="w-full p-4 text-left hover:bg-muted/50 transition-colors flex items-center gap-3"
                            >
                              <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm truncate">{conv.subject || 'General Support'}</span>
                                  <Badge variant={conv.status === 'OPEN' ? 'success' : conv.status === 'RESOLVED' ? 'info' : 'secondary'} size="xs">
                                    {conv.status}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {conv.lastMessage ? conv.lastMessage.body : 'No messages yet'}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(conv.updatedAt).toLocaleDateString()}
                                </span>
                                {conv.unreadCount > 0 && (
                                  <Badge variant="primary" size="xs" className="gap-0.5">
                                    {conv.unreadCount}
                                  </Badge>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Active Conversation */}
              {activeSupportConversation && (
                <Card className="flex flex-col h-[500px] md:h-[600px] border-t border-primary/20">
                  <CardContent className="p-0 flex-1 flex flex-col min-h-0">
                    {/* Header */}
                    <div className="p-4 border-b border-border flex items-center justify-between gap-4">
                      <Button variant="ghost" size="icon" onClick={() => setActiveSupportConversation(null)}>
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{activeSupportConversation.subject || 'General Support'}</h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant={activeSupportConversation.status === 'OPEN' ? 'success' : activeSupportConversation.status === 'RESOLVED' ? 'info' : 'secondary'} size="xs">
                            {activeSupportConversation.status}
                          </Badge>
                          <span>·</span>
                          <span>Updated {new Date(activeSupportConversation.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={messagesEndRef}>
                      {supportMessages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                          No messages yet. Start the conversation!
                        </div>
                      ) : (
                        supportMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={cn('flex gap-3', msg.isOwn ? 'flex-row-reverse' : '')}
                          >
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
                              </div>
                              <p className="whitespace-pre-wrap">{msg.body}</p>
                              {msg.isOwn && msg.readAt && (
                                <div className="text-[10px] opacity-60 mt-1 flex items-center gap-1">
                                  <CheckCheck className="h-3 w-3" />
                                  Read
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-border">
                      <form onSubmit={handleSendMessage} className="flex gap-2">
                        <Input
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type your message..."
                          disabled={sendingMessage || activeSupportConversation.status === 'CLOSED'}
                          className="flex-1"
                        />
                        <Button type="submit" disabled={!newMessage.trim() || sendingMessage || activeSupportConversation.status === 'CLOSED'}>
                          {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Send</span>}
                        </Button>
                      </form>
                      {activeSupportConversation.status === 'CLOSED' && (
                        <p className="text-xs text-muted-foreground text-center mt-2">
                          This conversation is closed. You can start a new one from the conversation list.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Loan Requests */}
          {tab === 'loans' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="font-display text-xl font-bold flex items-center gap-2">
                    <CreditCard className="h-6 w-6 text-primary" />
                    Loan Requests
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">Submit and track your loan requests.</p>
                </div>
                <Button onClick={() => setShowLoanRequestModal(true)} disabled={submittingLoanRequest}>
                  <Plus className="h-4 w-4" />
                  New Request
                </Button>
              </div>

              {loanRequestsError && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-destructive">{loanRequestsError}</p>
                    <Button variant="outline" size="sm" onClick={fetchLoanRequests} className="mt-2">
                      Retry
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Loan Requests List */}
              <Card>
                <CardContent className="p-0">
                  {loanRequestsLoading && loanRequests.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                      <p className="mt-4 text-sm text-muted-foreground">Loading loan requests...</p>
                    </div>
                  ) : loanRequests.length === 0 ? (
                    <div className="p-10 text-center">
                      <CreditCard className="mx-auto h-8 w-8 text-muted-foreground/40" />
                      <p className="mt-3 font-semibold">No loan requests yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Submit your first loan request using the button above.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {loanRequests.map((loan: any) => (
                        <div key={loan.id} className="p-5 hover:bg-muted/30 transition-colors">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <CreditCard className="h-5 w-5 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-bold text-lg">{formatETB(loan.requestedAmount)}</span>
                                  <Badge variant={statusVariant(loan.status)} size="sm" className="gap-1">
                                    {loan.status === 'PENDING' && <Loader2 className="h-3 w-3 animate-spin" />}
                                    {loan.status}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground truncate max-w-xs">{loan.loanPurpose}</p>
                                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-1">
                                  <span>Submitted: {new Date(loan.submittedAt).toLocaleDateString()}</span>
                                  {loan.repaymentPeriod && <span>Term: {loan.repaymentPeriod} months</span>}
                                  {loan.dueDate && <span>Due: {new Date(loan.dueDate).toLocaleDateString()}</span>}
                                  {loan.reviewedAt && <span>Reviewed: {new Date(loan.reviewedAt).toLocaleDateString()}</span>}
                                  {loan.status === 'APPROVED' && loan.overdueDays !== undefined && loan.overdueDays > 0 && (
                                    <span className="text-destructive font-medium">Overdue: {loan.overdueDays} days</span>
                                  )}
                                </div>
                                {loan.status === 'APPROVED' && (
                                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                                    <span className="font-medium">Principal: {formatETB(loan.requestedAmount)}</span>
                                    {loan.interestAmount !== undefined && (
                                      <span className="font-medium text-info">Interest (0.1%): {formatETB(loan.interestAmount)}</span>
                                    )}
                                    {loan.totalRepaymentBeforePenalties !== undefined && (
                                      <span className="font-bold">Total: {formatETB(loan.totalRepaymentBeforePenalties)}</span>
                                    )}
                                    {loan.accruedPenalty !== undefined && loan.accruedPenalty > 0 && (
                                      <span className="font-medium text-destructive">Penalty: {formatETB(loan.accruedPenalty)}</span>
                                    )}
                                    {loan.outstandingPrincipal !== undefined && (
                                      <span className="font-bold text-lg text-primary">Outstanding: {formatETB(loan.outstandingPrincipal)}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {loan.status === 'PENDING' && (
                                <span className="text-xs text-amber-600 font-medium">Under Review</span>
                              )}
                              {loan.status === 'APPROVED' && (
                                <span className="text-xs text-green-600 font-medium">Approved</span>
                              )}
                              {loan.status === 'REJECTED' && (
                                <span className="text-xs text-red-600 font-medium">Rejected</span>
                              )}
                              {loan.status === 'APPROVED' && !loan.isFullyRepaid && (
                                <Button size="sm" variant="outline" onClick={() => handleViewLoanDetails(loan)}>
                                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                                  Details
                                </Button>
                              )}
                              {loan.status === 'APPROVED' && !loan.isFullyRepaid && (
                                <Button size="sm" onClick={() => handleRepayLoan(loan)}>
                                  <ArrowDownLeft className="h-3.5 w-3.5 mr-1.5" />
                                  Repay
                                </Button>
                              )}
                              {loan.isFullyRepaid && (
                                <Badge variant="success" size="sm">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Fully Repaid
                                </Badge>
                              )}
                            </div>
                          </div>
                          {(loan.decisionNote || loan.reviewedByAdmin) && (
                            <div className="mt-4 pt-4 border-t border-border/50 text-sm text-muted-foreground">
                              {loan.decisionNote && <p><span className="font-medium">Decision Note:</span> {loan.decisionNote}</p>}
                              {loan.reviewedByAdmin && (
                                <p><span className="font-medium">Reviewed by:</span> {[loan.reviewedByAdmin.firstName, loan.reviewedByAdmin.lastName].filter(Boolean).join(' ') || loan.reviewedByAdmin.email}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {loanRequestsTotalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-border p-3">
                      <span className="text-sm text-muted-foreground">
                        Page {loanRequestsPage} of {loanRequestsTotalPages} ({loanRequestsTotal} total)
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={loanRequestsPage <= 1} onClick={() => setLoanRequestsPage(p => p - 1)}>
                          Previous
                        </Button>
                        <Button size="sm" variant="outline" disabled={loanRequestsPage >= loanRequestsTotalPages} onClick={() => setLoanRequestsPage(p => p + 1)}>
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

      {/* Seller Agreement Modal — the Agree button appears only after the
          full agreement has been read (scrolled to the end). */}
      <Modal
        isOpen={agreementOpen}
        onClose={() => setAgreementOpen(false)}
        title={agreement?.title || 'Marcari23 Seller Agreement'}
        description={agreement ? `Version ${agreement.version}` : undefined}
        size="lg"
        onBodyScroll={handleAgreementScroll}
        footer={
          agreementViewed ? (
            <>
              <Button type="button" variant="outline" onClick={() => setAgreementOpen(false)}>
                Close
              </Button>
              <Button
                type="button"
                variant="destructive"
                isLoading={acceptingAgreement}
                leftIcon={<ShieldCheck className="h-4 w-4" />}
                onClick={handleAgree}
              >
                Agree to Seller Agreement
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              Scroll to the end of the agreement to continue.
            </span>
          )
        }
      >
        <div className="whitespace-pre-line text-sm text-muted-foreground leading-relaxed">
          {agreement?.text}
        </div>
      </Modal>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDepositModal(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Add Funds to Wallet
              </h3>
              <button
                onClick={() => setShowDepositModal(false)}
                className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Amount Input */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                    $
                  </span>
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-8 text-lg font-semibold"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Minimum deposit: $1.00</p>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground flex items-center gap-1">
                  <CreditCard className="h-4 w-4" />
                  Payment Method
                </label>
                <Select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full"
                >
                  <option value="credit_card">Credit Card</option>
                  <option value="paypal">PayPal</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="stripe">Stripe</option>
                </Select>
              </div>

              {/* Info Notice */}
              <div className="p-4 rounded-xl bg-info/10 border border-info/20 text-xs flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-info shrink-0 mt-0.5" />
                <span className="text-foreground/70 leading-relaxed">
                  Your payment is secure and encrypted. Funds will be available in your wallet immediately after processing.
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowDepositModal(false)
                  setDepositAmount('')
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleDeposit}
              >
                <Plus className="h-4 w-4" />
                Add Funds
              </Button>
            </div>
          </div>
</div>
       )}

      {/* Loan Request Modal */}
      {showLoanRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowLoanRequestModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                New Loan Request
              </h3>
              <button
                onClick={() => setShowLoanRequestModal(false)}
                className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitLoanRequest} className="space-y-4">
              {/* Amount Input */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  Requested Amount <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                    $
                  </span>
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-8 text-lg font-semibold"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">Minimum amount: $1.00</p>
              </div>

              {/* Purpose Input */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  Loan Purpose <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={loanPurpose}
                  onChange={(e) => setLoanPurpose(e.target.value)}
                  placeholder="e.g. Business expansion, inventory purchase, equipment upgrade..."
                  rows={3}
                  required
                  maxLength={500}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
                />
                <p className="text-xs text-muted-foreground">{loanPurpose.length}/500 characters</p>
              </div>

              {/* Repayment Period Input */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" />
                  Repayment Period (months, optional)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="120"
                  value={repaymentPeriod}
                  onChange={(e) => setRepaymentPeriod(e.target.value)}
                  placeholder="e.g. 12"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">Leave empty if not specified (1-120 months)</p>
              </div>

              {/* Info Notice */}
              <div className="p-4 rounded-xl bg-info/10 border border-info/20 text-xs flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-info shrink-0 mt-0.5" />
                <span className="text-foreground/70 leading-relaxed">
                  Submitting a loan request does not guarantee approval. All requests are reviewed by our team.
                  Approved requests do not automatically disburse funds; disbursement follows separate procedures.
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowLoanRequestModal(false)
                    setLoanAmount('')
                    setLoanPurpose('')
                    setRepaymentPeriod('')
                  }}
                  disabled={submittingLoanRequest}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  type="submit"
                  isLoading={submittingLoanRequest}
                >
                  <Plus className="h-4 w-4" />
                  Submit Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loan Detail Modal */}
      {showLoanDetailModal && (
        <Modal
          isOpen={!!showLoanDetailModal}
          onClose={() => setShowLoanDetailModal(null)}
          title="Loan Details"
          size="lg"
        >
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Loan Request #{showLoanDetailModal.id.slice(0, 8)}</h3>
              <Badge variant={statusVariant(showLoanDetailModal.status)} size="sm">
                {showLoanDetailModal.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Principal Amount</p>
                <p className="font-bold text-lg">{formatETB(showLoanDetailModal.requestedAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Interest Rate</p>
                <p className="font-medium text-info">{showLoanDetailModal.interestRate ? (showLoanDetailModal.interestRate * 100).toFixed(1) + '%' : '0.1%'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Interest Amount</p>
                <p className="font-bold">{formatETB(showLoanDetailModal.interestAmount ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Total Before Penalties</p>
                <p className="font-bold text-lg">{formatETB(showLoanDetailModal.totalRepaymentBeforePenalties ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Repayment Period</p>
                <p>{showLoanDetailModal.repaymentPeriod ? `${showLoanDetailModal.repaymentPeriod} months` : 'Not specified (default 6)'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Due Date</p>
                <p>{showLoanDetailModal.dueDate ? new Date(showLoanDetailModal.dueDate).toLocaleDateString() : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Submitted</p>
                <p>{new Date(showLoanDetailModal.submittedAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Reviewed</p>
                <p>{showLoanDetailModal.reviewedAt ? new Date(showLoanDetailModal.reviewedAt).toLocaleString() : '—'}</p>
              </div>
            </div>

            {showLoanDetailModal.status === 'APPROVED' && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Repayment Status</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Outstanding Principal</p>
                    <p className="font-bold text-lg text-primary">{formatETB(showLoanDetailModal.outstandingPrincipal ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Principal Repaid</p>
                    <p className="font-bold">{formatETB(showLoanDetailModal.principalRepaid ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Interest Repaid</p>
                    <p className="font-bold">{formatETB(showLoanDetailModal.interestRepaid ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Penalty Repaid</p>
                    <p className="font-bold">{formatETB(showLoanDetailModal.penaltyRepaid ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Accrued Penalty</p>
                    <p className="font-bold text-destructive">{formatETB(showLoanDetailModal.accruedPenalty ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Overdue Days</p>
                    <p className="font-bold {showLoanDetailModal.isOverdue ? 'text-destructive' : 'text-success'}">{showLoanDetailModal.overdueDays ?? 0}</p>
                  </div>
                </div>
                {showLoanDetailModal.isFullyRepaid && (
                  <div className="flex items-center gap-2 text-success font-medium pt-2 border-t border-border/50">
                    <CheckCircle2 className="h-4 w-4" />
                    Loan fully repaid on {showLoanDetailModal.fullyRepaidAt ? new Date(showLoanDetailModal.fullyRepaidAt).toLocaleDateString() : 'unknown date'}
                  </div>
                )}
                {showLoanDetailModal.isOverdue && !showLoanDetailModal.isFullyRepaid && (
                  <div className="flex items-center gap-2 text-destructive font-medium pt-2 border-t border-border/50">
                    <AlertCircle className="h-4 w-4" />
                    Loan is overdue. Penalties accrue daily at 1% of outstanding principal.
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Loan Purpose</p>
              <p className="whitespace-pre-wrap">{showLoanDetailModal.loanPurpose}</p>
            </div>

            {showLoanDetailModal.decisionNote && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Decision Note</p>
                <p>{showLoanDetailModal.decisionNote}</p>
              </div>
            )}

            {showLoanDetailModal.reviewedByAdmin && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Reviewed By</p>
                <p>
                  {[showLoanDetailModal.reviewedByAdmin.firstName, showLoanDetailModal.reviewedByAdmin.lastName].filter(Boolean).join(' ') || showLoanDetailModal.reviewedByAdmin.email}
                </p>
                <p className="text-xs text-muted-foreground">{showLoanDetailModal.reviewedByAdmin.email}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Repayment Modal */}
      {repayingLoanId && (
        <Modal
          isOpen={!!repayingLoanId}
          onClose={() => { setRepayingLoanId(null); setRepayAmount(''); }}
          title="Make Repayment"
          size="md"
        >
          <form onSubmit={handleSubmitRepayment} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the amount you wish to repay. Payments are applied in order: penalties first, then interest, then principal.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-bold text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                Repayment Amount (ETB)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                  ETB
                </span>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-8 text-lg font-semibold"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">Minimum repayment: ETB 0.01</p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setRepayingLoanId(null); setRepayAmount(''); }}
                disabled={repayAmount === ''}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                type="submit"
                isLoading={repayAmount === ''}
              >
                <ArrowDownLeft className="h-4 w-4" />
                Submit Repayment
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default Account
