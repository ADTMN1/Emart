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
  Loader2,
  Copy,
  QrCode,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { OptimizedImage } from '@/components/ui/OptimizedImage'
import type { Product } from '@/lib/types'
import { cn, formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { SuccessState, EmptyCart } from '@/components/ui/States'
import { api } from '@/lib/api'

interface CartItem {
  id: string
  productId: string
  quantity: number
  product?: Product
}

interface AddressForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
  state: string
  postalCode: string
  addressLine: string
  city: string
}

const emptyAddress: AddressForm = {
  firstName: '', lastName: '', email: '', phone: '', country: '', state: '',
  postalCode: '', addressLine: '', city: '',
}

const toOrderAddress = (address: AddressForm) => ({
  fullName: `${address.firstName} ${address.lastName}`.trim(),
  addressLine: address.addressLine,
  city: address.city,
  state: address.state,
  postalCode: address.postalCode,
  country: address.country,
  countryCode: address.country,
  phone: address.phone,
})

const InlineField: React.FC<{ error?: string; children: React.ReactNode }> = ({ error, children }) => (
  <div className="space-y-1">
    {children}
    {error && <p className="text-xs font-medium text-destructive" role="alert">{error}</p>}
  </div>
)

const Checkout: React.FC = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [step, setStep] = React.useState<1 | 2 | 3>(1)
  const [sameAddress, setSameAddress] = React.useState(true)
  const [payment] = React.useState<'crypto'>('crypto')
  const [cryptoConfig, setCryptoConfig] = React.useState<{ walletId: string; address: string; network: string; currency: string; qrCodeUrl: string | null; networks: { id: string; network: string; currency: string }[] } | null>(null)
  const [selectedWalletId, setSelectedWalletId] = React.useState('')
  const [cryptoLoading, setCryptoLoading] = React.useState(true)
  const [copied, setCopied] = React.useState(false)
  const [paymentSubmitted, setPaymentSubmitted] = React.useState(false)
  const [paymentScreenshot, setPaymentScreenshot] = React.useState<File | null>(null)
  const [paymentScreenshotPreview, setPaymentScreenshotPreview] = React.useState<string | null>(null)
  const [paymentScreenshotError, setPaymentScreenshotError] = React.useState('')
  const [submitted, setSubmitted] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [cartItems, setCartItems] = React.useState<CartItem[]>([])
  const [quantities, setQuantities] = React.useState<Record<string, number>>({})
  const [shippingAddress, setShippingAddress] = React.useState<AddressForm>(emptyAddress)
  const [billingAddress, setBillingAddress] = React.useState<AddressForm>(emptyAddress)
  const [touchedFields, setTouchedFields] = React.useState<Record<string, boolean>>({})
  const [shippingSubmitted, setShippingSubmitted] = React.useState(false)

  // Helper function to get product image - matches ProductDetails logic
  const getProductImage = (product: any): string => {
    // Try productImages array first (with url property)
    if (product?.productImages && Array.isArray(product.productImages)) {
      const validImages = product.productImages.filter((img: any) => img && img.url)
      if (validImages.length > 0) {
        return validImages[0].url
      }
    }
    // Fall back to image field
    if (product?.image) {
      return product.image
    }
    // Fall back to images array
    if (product?.images && Array.isArray(product.images) && product.images.length > 0) {
      return product.images[0]
    }
    // Return placeholder if no image found
    return 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22800%22%20height%3D%22800%22%20viewBox%3D%220%200%20800%20800%22%3E%3Crect%20fill%3D%22%23f3f4f6%22%20width%3D%22800%22%20height%3D%22800%22%2F%3E%3Ctext%20fill%3D%22%239ca3af%22%20font-family%3D%22sans-serif%22%20font-size%3D%2232%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%3ENo%20Image%3C%2Ftext%3E%3C%2Fsvg%3E'
  }

  const fetchCart = React.useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get<any>('/cart').catch(() => null)
      const rawItems = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
      const items = rawItems
        .map((item: any) => ({ ...item, productId: item?.productId || item?.product?.id }))
        .filter((item: any) => item.product && item.productId)
      setCartItems(items)
      const qtyMap: Record<string, number> = {}
      items.forEach((item: any) => {
        qtyMap[item.productId] = item.quantity || 1
      })
      setQuantities(qtyMap)
    } catch {
      setCartItems([])
      setQuantities({})
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchCart()
    const handleCartUpdate = () => fetchCart()
    window.addEventListener('cart:updated', handleCartUpdate)
    return () => window.removeEventListener('cart:updated', handleCartUpdate)
  }, [fetchCart])

  React.useEffect(() => {
    api.get<any>('/payments/crypto').then((config) => { setCryptoConfig(config); setSelectedWalletId(config.walletId) }).catch(() => setCryptoConfig(null)).finally(() => setCryptoLoading(false))
  }, [])

  const loadCryptoNetwork = async (walletId: string) => {
    setSelectedWalletId(walletId)
    setCryptoLoading(true)
    setPaymentSubmitted(false)
    setPaymentScreenshot(null)
    setPaymentScreenshotPreview(null)
    setPaymentScreenshotError('')
    try {
      const config = await api.get<any>(`/payments/crypto?walletId=${encodeURIComponent(walletId)}`)
      setCryptoConfig(config)
      setSelectedWalletId(config.walletId)
    } catch {
      setCryptoConfig(null)
    } finally {
      setCryptoLoading(false)
    }
  }

  const handlePaymentScreenshotChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setPaymentScreenshot(null)
      setPaymentScreenshotPreview(null)
      setPaymentScreenshotError('')
      return
    }

    if (!file.type.startsWith('image/')) {
      setPaymentScreenshot(null)
      setPaymentScreenshotPreview(null)
      setPaymentScreenshotError('Please upload a valid image file for the payment screenshot.')
      event.target.value = ''
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setPaymentScreenshot(null)
      setPaymentScreenshotPreview(null)
      setPaymentScreenshotError('The payment screenshot must be smaller than 10MB.')
      event.target.value = ''
      return
    }

    setPaymentScreenshot(file)
    setPaymentScreenshotError('')

    const reader = new FileReader()
    reader.onload = () => setPaymentScreenshotPreview(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(file)
  }

  const handlePaymentCompletion = () => {
    if (!paymentScreenshot) {
      const errorMessage = 'Please upload a screenshot of the completed crypto payment before continuing.'
      setPaymentScreenshotError(errorMessage)
      toast({ variant: 'error', title: 'Payment screenshot required', description: errorMessage })
      return
    }

    setPaymentSubmitted(true)
    toast({
      variant: 'success',
      title: 'Payment screenshot uploaded',
      description: 'Your payment proof has been attached and is pending verification.',
    })
  }

  const subtotal = cartItems.reduce(
    (s, i) => s + (i.product?.estimatedPriceUsd || 0) * (quantities[i.productId] || 1),
    0
  )
  const fees = cartItems.length > 0 ? Math.round(subtotal * 0.07) : 0
  const shipping = cartItems.length > 0 ? 58 : 0
  const insurance = cartItems.length > 0 ? Math.round(subtotal * 0.02) : 0
  const total = subtotal + fees + shipping + insurance

  const [createdOrder, setCreatedOrder] = React.useState<any>(null)
  const [submittingOrder, setSubmittingOrder] = React.useState(false)

  const handleSubmit = async () => {
    if (cartItems.length === 0) return

    try {
      setSubmittingOrder(true)
      const res = await api.post('/orders', {
        items: cartItems.map((item) => ({
          productId: item.productId,
          quantity: quantities[item.productId] || item.quantity || 1,
        })),
        shippingMethod: 'dhl',
        paymentMethod: payment,
        paymentProofUrl: paymentScreenshotPreview || null,
        paymentStatus: 'PENDING',
        shippingAddress: toOrderAddress(shippingAddress),
        ...(!sameAddress ? {
          billingAddress: toOrderAddress(billingAddress),
        } : {}),
      })
      setCreatedOrder(res)
      setSubmitted(true)
      toast({
        variant: 'success',
        title: 'Order placed successfully!',
        description: `Order #${res.orderNumber || res.id} has been confirmed.`,
      })
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Checkout Failed',
        description: err.message || 'Could not place order. Please try again.',
      })
    } finally {
      setSubmittingOrder(false)
    }
  }

  const updateAddress = (setter: React.Dispatch<React.SetStateAction<AddressForm>>, field: keyof AddressForm, prefix = 'shipping') =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setTouchedFields((previous) => ({ ...previous, [`${prefix}.${field}`]: true }))
      setter((previous) => ({ ...previous, [field]: event.target.value }))
    }

  const fieldError = (address: AddressForm, field: keyof AddressForm, prefix = 'shipping') =>
    (shippingSubmitted || touchedFields[`${prefix}.${field}`]) && !address[field].trim()
      ? `${field === 'postalCode' ? 'ZIP / Postal code' : field === 'addressLine' ? 'Street address' : field.charAt(0).toUpperCase() + field.slice(1)} is required.`
      : undefined

  const continueToPayment = () => {
    setShippingSubmitted(true)
    const required = ['firstName', 'lastName', 'email', 'phone', 'country', 'state', 'postalCode', 'addressLine', 'city'] as const
    const billingRequired = ['firstName', 'lastName', 'phone', 'country', 'state', 'postalCode', 'addressLine', 'city'] as const
    if (required.some((field) => !shippingAddress[field].trim()) || (!sameAddress && billingRequired.some((field) => !billingAddress[field].trim()))) {
      const firstInvalid = required.find((field) => !shippingAddress[field].trim())
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-address-field="shipping.${firstInvalid || 'firstName'}"]`)?.focus())
      return
    }
    setStep(2)
  }

  if (submitted) {
    const orderNum = createdOrder?.orderNumber || createdOrder?.id || ''
    return (
      <div className="container-page py-16 min-h-[70vh] flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <SuccessState
            title="Order Placed Successfully!"
            description={`Order ${orderNum ? `#${orderNum} ` : ''}has been confirmed. Our team will begin processing your purchase.`}
            action={{ label: 'View My Orders', onClick: () => navigate('/orders') }}
          />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container-page py-16 min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading checkout...</p>
        </div>
      </div>
    )
  }

  if (cartItems.length === 0) {
    return (
      <div className="container-page py-16 min-h-[70vh]">
        <div className="max-w-xl mx-auto">
          <EmptyCart onShop={() => navigate('/marketplace')} />
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
                        <InlineField error={fieldError(shippingAddress, 'firstName')}><Input data-address-field="shipping.firstName" aria-invalid={!!fieldError(shippingAddress, 'firstName')} className={fieldError(shippingAddress, 'firstName') ? 'border-destructive focus:border-destructive' : ''} placeholder="First name" value={shippingAddress.firstName} onChange={updateAddress(setShippingAddress, 'firstName')} required /></InlineField>
                        <InlineField error={fieldError(shippingAddress, 'lastName')}><Input data-address-field="shipping.lastName" aria-invalid={!!fieldError(shippingAddress, 'lastName')} className={fieldError(shippingAddress, 'lastName') ? 'border-destructive focus:border-destructive' : ''} placeholder="Last name" value={shippingAddress.lastName} onChange={updateAddress(setShippingAddress, 'lastName')} required /></InlineField>
                      </div>
                      <InlineField error={fieldError(shippingAddress, 'email')}><Input data-address-field="shipping.email" aria-invalid={!!fieldError(shippingAddress, 'email')} className={fieldError(shippingAddress, 'email') ? 'border-destructive focus:border-destructive' : ''} placeholder="Email address" type="email" value={shippingAddress.email} onChange={updateAddress(setShippingAddress, 'email')} required /></InlineField>
                      <InlineField error={fieldError(shippingAddress, 'phone')}><Input data-address-field="shipping.phone" aria-invalid={!!fieldError(shippingAddress, 'phone')} className={fieldError(shippingAddress, 'phone') ? 'border-destructive focus:border-destructive' : ''} placeholder="Phone number" type="tel" value={shippingAddress.phone} onChange={updateAddress(setShippingAddress, 'phone')} required /></InlineField>
                      <div className="grid sm:grid-cols-3 gap-4">
                        <InlineField error={fieldError(shippingAddress, 'country')}><Select data-address-field="shipping.country" className={fieldError(shippingAddress, 'country') ? 'border-destructive focus:border-destructive' : ''} value={shippingAddress.country} onChange={updateAddress(setShippingAddress, 'country')} required>
                          <option value="">Country</option>
                          <option value="US">United States</option>
                          <option value="GB">United Kingdom</option>
                          <option value="CA">Canada</option>
                        </Select></InlineField>
                        <InlineField error={fieldError(shippingAddress, 'state')}><Input data-address-field="shipping.state" className={fieldError(shippingAddress, 'state') ? 'border-destructive focus:border-destructive' : ''} placeholder="State / Province" value={shippingAddress.state} onChange={updateAddress(setShippingAddress, 'state')} required /></InlineField>
                        <InlineField error={fieldError(shippingAddress, 'postalCode')}><Input data-address-field="shipping.postalCode" className={fieldError(shippingAddress, 'postalCode') ? 'border-destructive focus:border-destructive' : ''} placeholder="ZIP / Postal code" value={shippingAddress.postalCode} onChange={updateAddress(setShippingAddress, 'postalCode')} required /></InlineField>
                      </div>
                      <InlineField error={fieldError(shippingAddress, 'addressLine')}><Input data-address-field="shipping.addressLine" className={fieldError(shippingAddress, 'addressLine') ? 'border-destructive focus:border-destructive' : ''} placeholder="Street address, apartment, suite" value={shippingAddress.addressLine} onChange={updateAddress(setShippingAddress, 'addressLine')} required /></InlineField>
                      <InlineField error={fieldError(shippingAddress, 'city')}><Input data-address-field="shipping.city" className={fieldError(shippingAddress, 'city') ? 'border-destructive focus:border-destructive' : ''} placeholder="City" value={shippingAddress.city} onChange={updateAddress(setShippingAddress, 'city')} required /></InlineField>
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
                      {!sameAddress && (
                        <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
                          <div className="text-sm font-bold text-foreground">Billing address</div>
                          <div className="grid sm:grid-cols-2 gap-4">
                            <Input placeholder="First name" value={billingAddress.firstName} onChange={updateAddress(setBillingAddress, 'firstName')} required />
                            <Input placeholder="Last name" value={billingAddress.lastName} onChange={updateAddress(setBillingAddress, 'lastName')} required />
                          </div>
                          <Input placeholder="Phone number" type="tel" value={billingAddress.phone} onChange={updateAddress(setBillingAddress, 'phone')} required />
                          <div className="grid sm:grid-cols-3 gap-4">
                            <Select value={billingAddress.country} onChange={updateAddress(setBillingAddress, 'country')} required>
                              <option value="">Country</option>
                              <option value="US">United States</option>
                              <option value="GB">United Kingdom</option>
                              <option value="CA">Canada</option>
                            </Select>
                            <Input placeholder="State / Province" value={billingAddress.state} onChange={updateAddress(setBillingAddress, 'state')} required />
                            <Input placeholder="ZIP / Postal code" value={billingAddress.postalCode} onChange={updateAddress(setBillingAddress, 'postalCode')} required />
                          </div>
                          <Input placeholder="Street address, apartment, suite" value={billingAddress.addressLine} onChange={updateAddress(setBillingAddress, 'addressLine')} required />
                          <Input placeholder="City" value={billingAddress.city} onChange={updateAddress(setBillingAddress, 'city')} required />
                        </div>
                      )}
                      <Button
                        size="lg"
                        className="w-full sm:w-auto shadow-md shadow-primary/20"
                        onClick={continueToPayment}
                        disabled={submittingOrder}
                      >
                        {submittingOrder ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Processing...</> : <>Continue to Payment<ChevronRight className="h-4 w-4 ml-1" /></>}
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-muted/40 border border-border/60 p-4 text-sm">
                      <div className="font-bold mb-1">{shippingAddress.firstName} {shippingAddress.lastName}</div>
                      <div className="text-muted-foreground leading-relaxed">
                        {shippingAddress.addressLine}<br />
                        {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}, {shippingAddress.country}<br />
                        {shippingAddress.phone} · {shippingAddress.email}
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
                      <div className="rounded-xl border-2 border-primary bg-primary-50/40 p-4 flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 rounded-lg bg-primary text-white flex items-center justify-center"><QrCode className="h-5 w-5" /></div>
                        <div className="font-bold">Crypto Payment</div>
                      </div>

                      {!cryptoLoading && cryptoConfig?.networks?.length ? <div className="space-y-2"><label className="text-xs font-bold text-muted-foreground">Network</label><Select value={selectedWalletId} onChange={(event) => loadCryptoNetwork(event.target.value)}>{cryptoConfig.networks.map((option) => <option key={option.id} value={option.id}>{option.currency} — {option.network}</option>)}</Select></div> : null}
                      {cryptoLoading ? <div className="p-5 text-sm text-muted-foreground">Loading payment details...</div> : cryptoConfig?.address ? (
                        <div className="space-y-4 rounded-xl border border-border/60 bg-muted/30 p-5">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border border-border bg-background p-3"><div className="text-xs text-muted-foreground">Cryptocurrency</div><div className="mt-1 font-bold text-primary">{cryptoConfig.currency}</div></div>
                            <div className="rounded-lg border border-border bg-background p-3"><div className="text-xs text-muted-foreground">Selected network</div><div className="mt-1 font-bold text-primary">{cryptoConfig.network}</div></div>
                          </div>
                          <div className="rounded-lg border border-border bg-background p-3"><div className="text-xs text-muted-foreground">Order total</div><div className="mt-1 font-bold">{formatCurrency(total)}</div><p className="mt-1 text-xs text-muted-foreground">Send {cryptoConfig.currency} only on the {cryptoConfig.network} network.</p></div>
                          <div className="space-y-2"><div className="text-xs font-bold text-muted-foreground">EMART Receiving Address</div><div className="flex flex-col gap-2 sm:flex-row"><Input value={cryptoConfig.address} readOnly className="font-mono text-xs" /><Button type="button" variant="outline" className="shrink-0" onClick={() => { navigator.clipboard.writeText(cryptoConfig.address); setCopied(true); setTimeout(() => setCopied(false), 1600) }}><Copy className="h-4 w-4 mr-1" />{copied ? 'Copied' : 'Copy Address'}</Button></div></div>
                          {cryptoConfig.qrCodeUrl && <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-background p-4"><div className="text-xs font-bold text-muted-foreground self-start">QR Code</div><img src={cryptoConfig.qrCodeUrl} alt={`QR code for ${cryptoConfig.currency} on ${cryptoConfig.network}`} className="h-44 w-44 rounded-md" /></div>}
                          <div className="space-y-3 rounded-lg border border-dashed border-border bg-background/60 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-xs font-bold text-muted-foreground uppercase tracking-[0.14em]">Payment proof</div>
                                <p className="mt-1 text-sm text-muted-foreground">Upload a screenshot of your crypto transfer after sending the funds.</p>
                              </div>
                              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
                                <Upload className="h-4 w-4" />
                                Upload
                                <input type="file" accept="image/*" className="hidden" onChange={handlePaymentScreenshotChange} />
                              </label>
                            </div>

                            {paymentScreenshotPreview ? (
                              <div className="space-y-3">
                                <div className="relative overflow-hidden rounded-lg border border-border bg-muted/50 p-2">
                                  <img src={paymentScreenshotPreview} alt="Payment proof upload preview" className="max-h-52 w-full rounded-md object-contain" />
                                </div>
                                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                                  <span className="truncate font-medium text-foreground">{paymentScreenshot?.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPaymentScreenshot(null)
                                      setPaymentScreenshotPreview(null)
                                      setPaymentScreenshotError('')
                                      setPaymentSubmitted(false)
                                    }}
                                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-5 text-center text-sm text-muted-foreground">
                                No payment screenshot uploaded yet.
                              </div>
                            )}

                            {paymentScreenshotError && (
                              <p className="text-sm font-medium text-destructive">{paymentScreenshotError}</p>
                            )}
                          </div>

                          {paymentSubmitted ? (
                            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4"><div className="font-bold text-sm">Payment Verification</div><p className="mt-1 text-sm text-muted-foreground">Your payment screenshot has been uploaded and is being reviewed. We'll update your order once the payment is confirmed.</p></div>
                          ) : (
                            <Button type="button" className="w-full" onClick={handlePaymentCompletion}>I've Completed the Payment</Button>
                          )}
                        </div>
                      ) : <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">No active crypto payment network is currently configured.</div>}

                      <div className="flex gap-3">
                        <Button variant="outline" size="lg" onClick={() => setStep(1)}>
                          Back
                        </Button>
                        <Button
                          size="lg"
                          className="flex-1 sm:flex-none shadow-md shadow-primary/20"
                          onClick={() => setStep(3)}
                          disabled={!cryptoConfig?.address || cryptoLoading || !paymentScreenshot || !paymentSubmitted}
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
                        <div className="font-bold">Crypto Payment</div>
                        <div className="text-xs text-muted-foreground">Payment verification pending</div>
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
                        <h3 className="text-sm font-bold">
                          Items ({Object.values(quantities).reduce((s, q) => s + q, 0)})
                        </h3>
                      </div>
                      <div className="space-y-3">
                        {cartItems.map((item, idx) => {
                          const product = item.product
                          const qty = quantities[item.productId] || 1
                          if (!product) return null
                          return (
                            <div key={item.id} className="flex gap-3 p-3 rounded-lg bg-muted/30 border border-border/60">
                              <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted shrink-0 border border-border">
                                <OptimizedImage
                                  src={getProductImage(product)}
                                  alt={product.name}
                                  size="thumb"
                                  context="thumbnail"
                                  lazy
                                  showShimmer
                                  aspectRatio="aspect-square"
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm leading-snug line-clamp-2">{product.name}</div>
                                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                                  <span className="font-medium">{product.source}</span>
                                  <span>·</span>
                                  <span>Qty: {qty}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-sm">
                                  {formatCurrency(product.estimatedPriceUsd * qty, 'USD')}
                                </div>
                              </div>
                            </div>
                          )
                        })}
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
                        disabled={submittingOrder}
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        {submittingOrder ? 'Placing Order...' : `Place Order — ${formatCurrency(total, 'USD')}`}
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
