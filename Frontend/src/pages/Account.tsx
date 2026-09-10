import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronRight,
  Home as HomeIcon,
  User,
  Mail,
  MapPin,
  CreditCard,
  Settings,
  Package,
  Heart,
  Bell,
  Lock,
  Globe2,
  Pencil,
  CheckCircle2,
  ShieldCheck,
  LogOut,
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
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/contexts/AuthContext'
import { cn, formatCurrency } from '@/lib/utils'
import { api } from '@/lib/api'

const navItems = [
  { key: 'overview', label: 'Overview', icon: User },
  { key: 'orders', label: 'My Orders', icon: Package, to: '/orders' },
  { key: 'wallet', label: 'My Wallet', icon: WalletIcon },
  { key: 'warehouse', label: 'Warehouse', icon: Package, to: '/warehouse' },
  { key: 'shipping', label: 'Shipments', icon: Truck, to: '/shipping' },
  { key: 'favorites', label: 'Favorites', icon: Heart },
  { key: 'addresses', label: 'Addresses', icon: MapPin },
  { key: 'payments', label: 'Payment Methods', icon: CreditCard },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'security', label: 'Security', icon: Lock },
  { key: 'settings', label: 'Preferences', icon: Settings },
  { key: 'support', label: 'Support & FAQ', icon: Headphones },
]

function Truck(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  )
}

const Account: React.FC = () => {
  const { user, logout, updateProfile } = useAuth()
  const { toast } = useToast()
  const [tab, setTab] = React.useState('overview')
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

  React.useEffect(() => {
    fetchWallet()
  }, [fetchWallet])

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
    <div className="bg-background">
      <div className="container-page py-6 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary flex items-center gap-1"><HomeIcon className="h-3 w-3" />Home</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">My Account</span>
        </div>
      </div>

      <div className="container-page py-6 lg:py-8 grid lg:grid-cols-5 gap-6 lg:gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-1 space-y-4 lg:sticky lg:top-24 self-start">
          <Card>
            <CardContent className="p-5 flex items-center gap-3 border-b border-border/60">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary-600 text-white font-bold flex items-center justify-center text-lg">
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{userDisplayName}</div>
                <div className="text-xs text-muted-foreground truncate">{user?.email || 'Guest'}</div>
                <div className="mt-1 flex items-center gap-1">
                  <Badge variant="accent" size="xs" className="gap-1">
                    <Gift className="h-2.5 w-2.5" />
                    {user?.role || 'Customer'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <nav className="p-2">
                {navItems.map((n) => {
                  const Icon = n.icon
                  const active = tab === n.key
                  const Inner = (
                    <>
                      <Icon className="h-4.5 w-4.5" />
                      <span className="font-medium text-sm">{n.label}</span>
                      {active && <ChevronRight className="h-3.5 w-3.5 ml-auto text-primary" />}
                    </>
                  )
                  const cls = cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors',
                    active
                      ? 'bg-primary-50 text-primary font-semibold'
                      : 'text-foreground/80 hover:bg-muted hover:text-foreground',
                  )
                  return n.to ? (
                    <Link key={n.key} to={n.to} className={cls} onClick={() => setTab(n.key)}>
                      {Inner}
                    </Link>
                  ) : (
                    <button key={n.key} onClick={() => setTab(n.key)} className={cls}>
                      {Inner}
                    </button>
                  )
                })}
              </nav>
              <div className="p-2 border-t border-border/60">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <LogOut className="h-4.5 w-4.5" />
                  <span className="font-medium text-sm">Sign Out</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Content */}
        <div className="lg:col-span-4 space-y-6">
          {tab === 'overview' && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { l: 'Total Orders', v: '12', s: '+3 this month', icon: Package, c: 'text-primary', b: 'bg-primary/10' },
                  { l: 'In Warehouse', v: '2', s: 'Ready to ship', icon: Building, c: 'text-secondary', b: 'bg-secondary/10' },
                  { l: 'In Transit', v: '1', s: 'ETA Sep 12', icon: Truck, c: 'text-info', b: 'bg-info/10' },
                  { l: 'Savings This Year', v: '$486', s: 'vs individual shipping', icon: Gift, c: 'text-success', b: 'bg-success/10' },
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
                          <Pencil className="h-4 w-4 mr-1" />
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
                      { l: 'Request Shipping', i: Truck, to: '/warehouse', c: 'text-info', b: 'bg-info/10' },
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

          {tab === 'favorites' && (
            <Card>
              <CardContent className="p-5 lg:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-lg font-bold flex items-center gap-2">
                    <Heart className="h-5 w-5 text-secondary" />
                    Saved Items (12)
                  </h2>
                  <Select className="w-48" wrapperClassName="w-48">
                    <option>All categories</option>
                  </Select>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="aspect-square rounded-xl bg-muted border-2 border-dashed border-border/80 flex flex-col items-center justify-center text-muted-foreground text-center p-4">
                      <Heart className="h-6 w-6 mb-2 opacity-50" />
                      <p className="text-xs font-medium">View favorites list</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
                    <Pencil className="h-4 w-4 mr-1.5" />
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
                      <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">EMART PAY</div>
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
                    <span className="font-bold text-foreground">Your data is secure.</span> Payments are processed by PCI-DSS Level 1 certified providers. EMART never stores your full card information.
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

          {['notifications', 'security', 'settings', 'support'].includes(tab) && (
            <Card>
              <CardContent className="p-8 min-h-[300px] flex flex-col items-center justify-center text-center">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  {tab === 'notifications' && <Bell className="h-7 w-7 text-muted-foreground" />}
                  {tab === 'security' && <Lock className="h-7 w-7 text-muted-foreground" />}
                  {tab === 'settings' && <Settings className="h-7 w-7 text-muted-foreground" />}
                  {tab === 'support' && <Headphones className="h-7 w-7 text-muted-foreground" />}
                </div>
                <h3 className="font-bold text-lg mb-1 capitalize">{tab}</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Manage your {tab} preferences. This section can be expanded with specific controls and options.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

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
                <Plus className="h-4 w-4 mr-1.5" />
                Add Funds
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Account
