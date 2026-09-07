import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  Home as HomeIcon,
  CheckCircle2,
  ShieldCheck,
  Truck,
  CreditCard,
  Lock,
  MapPin,
  Package,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { products } from '@/data/mockData'
import { cn, formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { SuccessState } from '@/components/ui/States'

const Checkout: React.FC = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [step, setStep] = React.useState<1 | 2 | 3>(1)
  const [sameAddress, setSameAddress] = React.useState(true)
  const [payment, setPayment] = React.useState<'card' | 'paypal' | 'apple' | 'bank'>('card')

  const [submitted, setSubmitted] = React.useState(false)

  const cartItems = [products[0], products[2], products[4]]
  const subtotal = cartItems.reduce((s, p) => s + p.estimatedPriceUsd, 0) + products[4].estimatedPriceUsd
  const fees = 54
  const shipping = 58
  const insurance = 17
  const total = subtotal + fees + shipping + insurance

  const handleSubmit = () => {
    setSubmitted(true)
    toast({
      variant: 'success',
      title: 'Order placed successfully!',
      description: 'Order #EMT-20240907-12345 has been confirmed.',
    })
  }

  if (submitted) {
    return (
      <div className="container-page py-16 min-h-[70vh] flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <SuccessState
            title="Order Placed Successfully!"
            description="Order #EMT-20240907-12345 has been confirmed. Our team will begin processing your purchase. You will receive email updates at every step."
            action={{ label: 'View My Orders', onClick: () => navigate('/orders') }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="container-page py-6 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary flex items-center gap-1"><HomeIcon className="h-3 w-3" />Home</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/cart" className="hover:text-primary">Cart</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Checkout</span>
        </div>
      </div>

      <div className="container-page py-8">
        {/* Stepper */}
        <div className="max-w-2xl mx-auto mb-10">
          <div className="flex items-center">
            {['Shipping', 'Payment', 'Review'].map((label, i) => {
              const n = (i + 1) as 1 | 2 | 3
              const active = step === n
              const done = step > n
              return (
                <React.Fragment key={label}>
                  <button
                    onClick={() => step > n && setStep(n)}
                    className={cn(
                      'flex items-center gap-2.5 shrink-0',
                      step > n && 'cursor-pointer',
                    )}
                    disabled={step < n}
                  >
                    <div
                      className={cn(
                        'h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all',
                        done
                          ? 'bg-success text-white border-success'
                          : active
                          ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30'
                          : 'bg-background text-muted-foreground border-border',
                      )}
                    >
                      {done ? <CheckCircle2 className="h-5 w-5" /> : n}
                    </div>
                    <span className={cn(
                      'text-sm font-bold hidden sm:block',
                      active || done ? 'text-foreground' : 'text-muted-foreground',
                    )}>
                      {label}
                    </span>
                  </button>
                  {i < 2 && (
                    <div className={cn(
                      'flex-1 h-0.5 mx-2 sm:mx-4 transition-colors',
                      step > n ? 'bg-success' : 'bg-border',
                    )} />
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Shipping */}
            {step >= 1 && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-display text-xl font-bold flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      Shipping Address
                    </h2>
                    {step > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => setStep(1)}>Edit</Button>
                    )}
                  </div>
                  {step === 1 ? (
                    <div className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <Input placeholder="First name" />
                        <Input placeholder="Last name" />
                      </div>
                      <Input placeholder="Email address" type="email" />
                      <Input placeholder="Phone number" type="tel" />
                      <div className="grid sm:grid-cols-3 gap-4">
                        <Select>
                          <option>Country</option>
                          <option>United States</option>
                          <option>United Kingdom</option>
                          <option>Canada</option>
                        </Select>
                        <Input placeholder="State / Province" />
                        <Input placeholder="ZIP / Postal code" />
                      </div>
                      <Input placeholder="Street address, apartment, suite" />
                      <Input placeholder="City" />
                      <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={!sameAddress}
                          onChange={(e) => setSameAddress(!e.target.checked)}
                          className="h-4 w-4 rounded mt-0.5"
                        />
                        <span className="text-sm text-foreground/80">
                          Billing address is different from shipping
                        </span>
                      </label>
                      <Button
                        size="lg"
                        className="w-full sm:w-auto shadow-md shadow-primary/20"
                        onClick={() => setStep(2)}
                      >
                        Continue to Payment
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-muted/40 border border-border/60 p-4 text-sm">
                      <div className="font-bold mb-1">John Doe</div>
                      <div className="text-muted-foreground leading-relaxed">
                        123 Main Street, Apt 4B<br />
                        New York, NY 10001, United States<br />
                        +1 (555) 123-4567 · john.doe@email.com
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 2: Payment */}
            {step >= 2 && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-display text-xl font-bold flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                      Payment Method
                    </h2>
                    {step > 2 && (
                      <Button variant="ghost" size="sm" onClick={() => setStep(2)}>Edit</Button>
                    )}
                  </div>
                  {step === 2 ? (
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                          { id: 'card', name: 'Credit Card', icon: '💳' },
                          { id: 'paypal', name: 'PayPal', icon: '🅿️' },
                          { id: 'apple', name: 'Apple Pay', icon: '🍎' },
                          { id: 'bank', name: 'Bank Transfer', icon: '🏦' },
                        ].map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setPayment(m.id as any)}
                            className={cn(
                              'p-4 rounded-xl border-2 transition-all text-left flex flex-col items-center gap-2',
                              payment === m.id
                                ? 'border-primary bg-primary-50/40 ring-2 ring-primary/15'
                                : 'border-border hover:border-border/80',
                            )}
                          >
                            <span className="text-2xl">{m.icon}</span>
                            <span className="text-xs font-bold">{m.name}</span>
                          </button>
                        ))}
                      </div>

                      {payment === 'card' && (
                        <div className="space-y-4 p-5 rounded-xl bg-muted/30 border border-border/60">
                          <Input placeholder="Card number" />
                          <div className="grid grid-cols-2 gap-4">
                            <Input placeholder="MM / YY" />
                            <Input placeholder="CVC" />
                          </div>
                          <Input placeholder="Name on card" />
                        </div>
                      )}

                      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                        <Lock className="h-4 w-4 text-success shrink-0 mt-0.5" />
                        Payment information is encrypted and processed through PCI-DSS Level 1 certified providers. EMART never stores your full card details.
                      </div>

                      <div className="flex gap-3">
                        <Button variant="outline" size="lg" onClick={() => setStep(1)}>
                          Back
                        </Button>
                        <Button
                          size="lg"
                          className="flex-1 sm:flex-none shadow-md shadow-primary/20"
                          onClick={() => setStep(3)}
                        >
                          Review Order
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-muted/40 border border-border/60 p-4 text-sm flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xl">
                        💳
                      </div>
                      <div>
                        <div className="font-bold">{payment === 'card' ? 'Visa ending in 4242' : 'PayPal'}</div>
                        <div className="text-xs text-muted-foreground">John Doe · Expires 12/28</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="font-display text-xl font-bold mb-5 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    Review & Place Order
                  </h2>

                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <h3 className="text-sm font-bold">Items ({cartItems.length + 1})</h3>
                      </div>
                      <div className="space-y-3">
                        {cartItems.map((p, idx) => (
                          <div key={p.id} className="flex gap-3 p-3 rounded-lg bg-muted/30 border border-border/60">
                            <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted shrink-0 border border-border">
                              <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm leading-snug line-clamp-2">{p.name}</div>
                              <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                                <span className="font-medium">{p.source}</span>
                                <span>·</span>
                                <span>Qty: {idx === 2 ? 2 : 1}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-sm">
                                {formatCurrency(p.estimatedPriceUsd * (idx === 2 ? 2 : 1), 'USD')}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-xl border border-border/70 bg-muted/20 hover:bg-muted/40 transition-colors">
                        <input type="checkbox" defaultChecked className="h-4 w-4 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-bold">Consolidate packages</div>
                          <div className="text-xs text-muted-foreground">
                            Combine all items into one shipment to save on shipping (Recommended)
                          </div>
                        </div>
                        <Badge variant="success" size="sm">Save ~60%</Badge>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-xl border border-border/70 bg-muted/20 hover:bg-muted/40 transition-colors">
                        <input type="checkbox" defaultChecked className="h-4 w-4 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-bold">Item inspection & photos</div>
                          <div className="text-xs text-muted-foreground">
                            Free photos when items arrive at our warehouse
                          </div>
                        </div>
                        <Badge variant="info" size="sm">FREE</Badge>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-xl border border-border/70 bg-muted/20 hover:bg-muted/40 transition-colors">
                        <input type="checkbox" className="h-4 w-4 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-bold">Extra protective packaging</div>
                          <div className="text-xs text-muted-foreground">
                            Bubble wrap and reinforced box for fragile items (+$5)
                          </div>
                        </div>
                      </label>
                    </div>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input type="checkbox" defaultChecked className="h-4 w-4 mt-0.5" />
                      <span className="text-sm text-foreground/80 leading-relaxed">
                        I agree to the <a href="#terms" className="text-primary font-medium hover:underline">Terms of Service</a> and understand that customs duties may apply upon delivery in my country.
                      </span>
                    </label>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button variant="outline" size="lg" onClick={() => setStep(2)}>
                        Back to Payment
                      </Button>
                      <Button
                        size="xl"
                        className="flex-1 shadow-xl shadow-primary/25"
                        onClick={handleSubmit}
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        Place Order — {formatCurrency(total, 'USD')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Summary */}
          <aside className="space-y-5 lg:sticky lg:top-24 self-start">
            <Card>
              <CardContent className="p-5 lg:p-6 space-y-5">
                <h3 className="font-display text-lg font-bold flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Order Summary
                </h3>

                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-foreground/80 font-medium">Subtotal (4 items)</span>
                    <span className="font-semibold">{formatCurrency(subtotal, 'USD')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground/80 font-medium flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" /> Service & Protection
                    </span>
                    <span className="font-semibold">{formatCurrency(fees, 'USD')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground/80 font-medium flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5" /> DHL Express (3-5 days)
                    </span>
                    <span className="font-semibold">{formatCurrency(shipping, 'USD')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground/80 font-medium">Insurance</span>
                    <span className="font-semibold">{formatCurrency(insurance, 'USD')}</span>
                  </div>
                </div>

                <div className="h-px bg-border/70" />

                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold">Total</span>
                  <div>
                    <div className="font-display text-2xl font-extrabold">
                      {formatCurrency(total, 'USD')}
                    </div>
                    <div className="text-[10px] text-right text-muted-foreground">
                      JPY {Math.round(total / 0.0069).toLocaleString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-success/5 border-success/20">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <ShieldCheck className="h-5 w-5 text-success" />
                  Covered by Buyer Protection
                </div>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    Condition verified before shipping
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    Full refund for misrepresented items
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    Cancel anytime before purchase
                  </li>
                </ul>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default Checkout
