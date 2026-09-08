import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet as WalletIcon,
  ChevronRight,
  Home as HomeIcon,
  Plus,
  Download,
  TrendingUp,
  DollarSign,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Gift,
  ShoppingBag,
  RefreshCw,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { cn, formatCurrency } from '@/lib/utils'

type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'PAYMENT' | 'REFUND' | 'BONUS' | 'ADJUSTMENT'
type TransactionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

interface Transaction {
  id: string
  type: TransactionType
  amount: number
  balanceBefore: number
  balanceAfter: number
  status: TransactionStatus
  description: string
  reference?: string
  paymentMethod?: string
  createdAt: string
  processedAt?: string
}

const mockTransactions: Transaction[] = [
  {
    id: '1',
    type: 'DEPOSIT',
    amount: 500,
    balanceBefore: 0,
    balanceAfter: 500,
    status: 'COMPLETED',
    description: 'Deposit via Credit Card',
    paymentMethod: 'credit_card',
    createdAt: '2026-09-08T10:00:00Z',
    processedAt: '2026-09-08T10:00:05Z',
  },
  {
    id: '2',
    type: 'PAYMENT',
    amount: 137,
    balanceBefore: 500,
    balanceAfter: 363,
    status: 'COMPLETED',
    description: 'Payment for order EMT-20240825-48291',
    reference: 'EMT-20240825-48291',
    paymentMethod: 'Wallet',
    createdAt: '2026-09-07T14:30:00Z',
    processedAt: '2026-09-07T14:30:01Z',
  },
  {
    id: '3',
    type: 'BONUS',
    amount: 10,
    balanceBefore: 363,
    balanceAfter: 373,
    status: 'COMPLETED',
    description: 'Welcome bonus - $10 credit',
    reference: 'WELCOME2026',
    createdAt: '2026-09-06T09:00:00Z',
    processedAt: '2026-09-06T09:00:01Z',
  },
]

const transactionConfig: Record<
  TransactionType,
  { label: string; icon: React.FC<any>; color: string; sign: '+' | '-' }
> = {
  DEPOSIT: { label: 'Deposit', icon: ArrowDownLeft, color: 'text-success', sign: '+' },
  WITHDRAWAL: { label: 'Withdrawal', icon: ArrowUpRight, color: 'text-warning', sign: '-' },
  PAYMENT: { label: 'Payment', icon: ShoppingBag, color: 'text-destructive', sign: '-' },
  REFUND: { label: 'Refund', icon: RefreshCw, color: 'text-success', sign: '+' },
  BONUS: { label: 'Bonus', icon: Gift, color: 'text-primary', sign: '+' },
  ADJUSTMENT: { label: 'Adjustment', icon: DollarSign, color: 'text-muted-foreground', sign: '+' },
}

const statusConfig: Record<TransactionStatus, { label: string; icon: React.FC<any>; variant: any }> = {
  PENDING: { label: 'Pending', icon: Clock, variant: 'warning' },
  PROCESSING: { label: 'Processing', icon: Clock, variant: 'info' },
  COMPLETED: { label: 'Completed', icon: CheckCircle2, variant: 'success' },
  FAILED: { label: 'Failed', icon: XCircle, variant: 'destructive' },
  CANCELLED: { label: 'Cancelled', icon: XCircle, variant: 'destructive' },
}

const Wallet: React.FC = () => {
  const { toast } = useToast()
  const [showDepositModal, setShowDepositModal] = React.useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = React.useState(false)
  const [depositAmount, setDepositAmount] = React.useState('')
  const [withdrawAmount, setWithdrawAmount] = React.useState('')
  const [paymentMethod, setPaymentMethod] = React.useState('credit_card')

  // Mock wallet data
  const walletBalance = 373.0
  const currency = 'USD'

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount)
    if (isNaN(amount) || amount < 1) {
      toast({ variant: 'error', title: 'Invalid Amount', description: 'Please enter a valid amount (minimum $1)' })
      return
    }

    // TODO: Integrate with backend API
    toast({
      variant: 'success',
      title: 'Deposit Initiated',
      description: `Processing deposit of ${formatCurrency(amount, 'USD')}`,
    })
    setShowDepositModal(false)
    setDepositAmount('')
  }

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount)
    if (isNaN(amount) || amount < 10) {
      toast({
        variant: 'error',
        title: 'Invalid Amount',
        description: 'Minimum withdrawal amount is $10.00',
      })
      return
    }

    if (amount > walletBalance) {
      toast({
        variant: 'error',
        title: 'Insufficient Balance',
        description: `Your current balance is ${formatCurrency(walletBalance, 'USD')}`,
      })
      return
    }

    // TODO: Integrate with backend API
    toast({
      variant: 'success',
      title: 'Withdrawal Initiated',
      description: `Processing withdrawal of ${formatCurrency(amount, 'USD')}`,
    })
    setShowWithdrawModal(false)
    setWithdrawAmount('')
  }

  return (
    <div className="bg-background">
      {/* Breadcrumb */}
      <div className="container-page py-6 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary flex items-center gap-1">
            <HomeIcon className="h-3 w-3" />
            Home
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/account" className="hover:text-primary">My Account</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">My Wallet</span>
        </div>
      </div>

      {/* Header */}
      <div className="container-page py-8">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
              <WalletIcon className="h-7 w-7 text-primary" />
              My Wallet
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your balance, deposits, and transactions
            </p>
          </div>
        </div>

        {/* Balance Card */}
        <Card className="mb-8 overflow-hidden border-2 border-primary/20">
          <CardContent className="p-0">
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background p-8">
              <div className="flex items-center justify-between flex-wrap gap-6">
                <div>
                  <div className="text-sm font-bold text-muted-foreground mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Available Balance
                  </div>
                  <div className="font-display text-5xl font-extrabold text-primary mb-1">
                    {formatCurrency(walletBalance, currency)}
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
                  <Button size="lg" onClick={() => setShowDepositModal(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Funds
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => setShowWithdrawModal(true)} className="gap-2">
                    <Download className="h-4 w-4" />
                    Withdraw
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 border-t border-border">
              {[
                { label: 'Total Deposited', value: '$500', icon: TrendingUp, color: 'text-success' },
                { label: 'Total Spent', value: '$137', icon: ShoppingBag, color: 'text-primary' },
                { label: 'Bonuses Earned', value: '$10', icon: Gift, color: 'text-secondary' },
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
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-extrabold">Transaction History</h2>
            <Select className="w-48">
              <option value="all">All Transactions</option>
              <option value="DEPOSIT">Deposits</option>
              <option value="WITHDRAWAL">Withdrawals</option>
              <option value="PAYMENT">Payments</option>
              <option value="REFUND">Refunds</option>
              <option value="BONUS">Bonuses</option>
            </Select>
          </div>

          <div className="space-y-3">
            {mockTransactions.map((tx) => {
              const cfg = transactionConfig[tx.type]
              const statusCfg = statusConfig[tx.status]
              const Icon = cfg.icon
              const StatusIcon = statusCfg.icon

              return (
                <Card key={tx.id} className="transition-all hover:shadow-card-hover">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div
                          className={cn(
                            'h-12 w-12 rounded-xl flex items-center justify-center shrink-0',
                            tx.type === 'DEPOSIT' || tx.type === 'REFUND' || tx.type === 'BONUS'
                              ? 'bg-success/10'
                              : 'bg-destructive/10'
                          )}
                        >
                          <Icon className={cn('h-5 w-5', cfg.color)} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="font-bold text-sm">{tx.description}</div>
                            <Badge variant={statusCfg.variant} size="sm" className="gap-1">
                              <StatusIcon className="h-2.5 w-2.5" />
                              {statusCfg.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(tx.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                            {tx.paymentMethod && (
                              <div className="flex items-center gap-1">
                                <CreditCard className="h-3 w-3" />
                                {tx.paymentMethod.replace('_', ' ')}
                              </div>
                            )}
                            {tx.reference && (
                              <div className="flex items-center gap-1">
                                Ref: {tx.reference}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={cn(
                            'font-display text-xl font-extrabold',
                            cfg.sign === '+' ? 'text-success' : 'text-destructive'
                          )}
                        >
                          {cfg.sign}{formatCurrency(tx.amount, 'USD')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Balance: {formatCurrency(tx.balanceAfter, 'USD')}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {mockTransactions.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <WalletIcon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                <h3 className="font-display text-lg font-bold mb-2">No Transactions Yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Start by adding funds to your wallet
                </p>
                <Button onClick={() => setShowDepositModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Funds
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <h3 className="font-display text-xl font-extrabold mb-4 flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Add Funds to Wallet
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Amount (USD)</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    leftIcon={<DollarSign className="h-4 w-4" />}
                    min="1"
                    step="0.01"
                  />
                  <div className="mt-2 text-xs text-muted-foreground">Minimum deposit: $1.00</div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Payment Method</label>
                  <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="credit_card">Credit Card</option>
                    <option value="paypal">PayPal</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="stripe">Stripe</option>
                  </Select>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowDepositModal(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleDeposit}>
                    Add Funds
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <h3 className="font-display text-xl font-extrabold mb-4 flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Withdraw Funds
              </h3>
              <div className="space-y-4">
                <div className="p-3 bg-info/10 border border-info/20 rounded-lg text-sm">
                  <div className="font-bold mb-1">Available Balance</div>
                  <div className="text-lg font-display font-extrabold text-primary">
                    {formatCurrency(walletBalance, 'USD')}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Amount (USD)</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    leftIcon={<DollarSign className="h-4 w-4" />}
                    min="10"
                    step="0.01"
                  />
                  <div className="mt-2 text-xs text-muted-foreground">Minimum withdrawal: $10.00</div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Withdrawal Method</label>
                  <Select>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="paypal">PayPal</option>
                  </Select>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowWithdrawModal(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleWithdraw}>
                    Withdraw
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default Wallet
