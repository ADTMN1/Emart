import * as React from 'react'
import { Check, Clock3, Eye, ImageIcon, ShieldCheck, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface DepositSubmission {
  id: string
  customerName: string
  email: string
  orderNumber: string
  amount: number
  currency: string
  network: string
  walletAddress: string
  submittedAt: string
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
  screenshotUrl: string
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  return `${days}d ago`
}

const displayStatus = (status: DepositSubmission['status']) =>
  status === 'PAID' ? 'APPROVED' : status === 'FAILED' ? 'REJECTED' : 'PENDING'

export const AdminDeposits: React.FC = () => {
  const { toast } = useToast()
  const [deposits, setDeposits] = React.useState<DepositSubmission[]>([])
  const [selectedDeposit, setSelectedDeposit] = React.useState<DepositSubmission | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const loadDeposits = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.get<DepositSubmission[]>('/admin/deposits')
      setDeposits(Array.isArray(response) ? response : [])
      setError(null)
    } catch (err: any) {
      const message = err?.status === 401
        ? 'Admin access is required to view deposit submissions.'
        : err?.message || 'Failed to load deposits'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadDeposits()
  }, [loadDeposits])

  const updateDepositStatus = async (depositId: string, status: 'PAID' | 'FAILED') => {
    try {
      await api.put(`/admin/deposits/${depositId}/status`, { status })
      setDeposits((current) =>
        current.map((deposit) =>
          deposit.id === depositId ? { ...deposit, status } : deposit
        )
      )
      setSelectedDeposit((current) => (
        current && current.id === depositId ? { ...current, status } : current
      ))

      toast({
        variant: status === 'PAID' ? 'success' : 'error',
        title: status === 'PAID' ? 'Deposit approved' : 'Deposit rejected',
        description: status === 'PAID' ? 'The customer payment has been marked as verified.' : 'The customer payment has been marked as rejected.',
      })

      await loadDeposits()
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Deposit update failed',
        description: err.message || 'Could not update the deposit status.',
      })
    }
  }

  const pendingCount = deposits.filter((deposit) => deposit.status === 'PENDING').length
  const approvedCount = deposits.filter((deposit) => deposit.status === 'PAID').length
  const rejectedCount = deposits.filter((deposit) => deposit.status === 'FAILED').length

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading deposit submissions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-96 flex-col items-center justify-center">
        <div className="text-center">
          <p className="font-semibold">Failed to load deposit submissions</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-4" onClick={() => void loadDeposits()}>Try again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold lg:text-3xl">Deposit verification</h1>
          <p className="mt-1 text-muted-foreground">Review customer payment screenshots before confirming the deposit.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="mt-2 text-3xl font-bold">{pendingCount}</p>
            </div>
            <Clock3 className="h-8 w-8 text-warning" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="mt-2 text-3xl font-bold">{approvedCount}</p>
            </div>
            <ShieldCheck className="h-8 w-8 text-success" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Rejected</p>
              <p className="mt-2 text-3xl font-bold">{rejectedCount}</p>
            </div>
            <XCircle className="h-8 w-8 text-destructive" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
          {deposits.map((deposit) => (
            <Card
              key={deposit.id}
              className={cn(
                'transition-shadow',
                deposit.status === 'PENDING' ? 'border-primary/40 shadow-sm' : '',
                deposit.status === 'PAID' ? 'border-success/30 bg-success/5' : '',
                deposit.status === 'FAILED' ? 'border-destructive/30 bg-destructive/5' : ''
              )}
            >
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{deposit.customerName}</h2>
                      <Badge
                        variant={
                          deposit.status === 'PAID'
                            ? 'success'
                            : deposit.status === 'FAILED'
                              ? 'destructive'
                              : 'warning'
                        }
                        size="sm"
                      >
                        {displayStatus(deposit.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{deposit.email}</p>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <div><span className="text-muted-foreground">Order:</span> <span className="font-medium">{deposit.orderNumber}</span></div>
                      <div><span className="text-muted-foreground">Amount:</span> <span className="font-medium">{deposit.amount} {deposit.currency}</span></div>
                      <div><span className="text-muted-foreground">Network:</span> <span className="font-medium">{deposit.network}</span></div>
                      <div>
                        <span className="text-muted-foreground">Submitted:</span>
                        <span className="ml-2 font-medium" title={formatDate(deposit.submittedAt)}>{timeAgo(deposit.submittedAt)}</span>
                        {new Date().getTime() - new Date(deposit.submittedAt).getTime() < 1000 * 60 * 60 * 24 && (
                          <Badge className="ml-2" size="sm">Recent</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 md:items-end">
                    <Button variant="outline" onClick={() => setSelectedDeposit(deposit)}>
                      <Eye className="h-4 w-4" />
                      View screenshot
                    </Button>
                    {deposit.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => updateDepositStatus(deposit.id, 'FAILED')}>
                          <XCircle className="mr-1 h-4 w-4" />
                          Reject
                        </Button>
                        <Button size="sm" onClick={() => updateDepositStatus(deposit.id, 'PAID')}>
                          <Check className="mr-1 h-4 w-4" />
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          {selectedDeposit ? (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Payment proof</h2>
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedDeposit.status === 'PAID' ? 'success' : selectedDeposit.status === 'FAILED' ? 'destructive' : 'warning'} size="sm">
                      {displayStatus(selectedDeposit.status)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(selectedDeposit.submittedAt)}</span>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-border bg-muted/30">
                  <img
                    src={selectedDeposit.screenshotUrl}
                    alt={`Deposit proof for ${selectedDeposit.customerName}`}
                    className="h-72 w-full object-cover"
                  />
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-medium">{selectedDeposit.customerName}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Order</span>
                    <span className="font-medium">{selectedDeposit.orderNumber}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Wallet</span>
                    <span className="font-medium break-all text-right">{selectedDeposit.walletAddress}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Network</span>
                    <span className="font-medium">{selectedDeposit.network}</span>
                  </div>
                </div>

                {selectedDeposit.status === 'PENDING' && (
                  <div className="mt-5 flex gap-2">
                    <Button variant="secondary" onClick={() => updateDepositStatus(selectedDeposit.id, 'FAILED')}>
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                    <Button onClick={() => updateDepositStatus(selectedDeposit.id, 'PAID')}>
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="font-medium">No deposit selected</p>
                <p className="mt-1 text-sm text-muted-foreground">Choose a pending payment to review the screenshot.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
