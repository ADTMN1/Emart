import * as React from 'react'
import { AlertCircle, Edit, Loader2, Plus, QrCode, Trash2, WalletCards } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { api } from '@/lib/api'

interface CryptoWallet {
  id: string
  currency: string
  network: string
  address: string
  qrCodeUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type WalletForm = Pick<CryptoWallet, 'currency' | 'network' | 'address' | 'qrCodeUrl' | 'isActive'>

const emptyForm: WalletForm = { currency: '', network: '', address: '', qrCodeUrl: '', isActive: true }
const networkOptions = ['Bitcoin', 'Ethereum (ERC-20)', 'BNB Smart Chain (BEP-20)', 'Tron (TRC-20)', 'Solana', 'Polygon', 'Other']

export const AdminWallets: React.FC = () => {
  const { toast } = useToast()
  const [wallets, setWallets] = React.useState<CryptoWallet[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editingWallet, setEditingWallet] = React.useState<CryptoWallet | null>(null)
  const [form, setForm] = React.useState<WalletForm>(emptyForm)
  const [networkChoice, setNetworkChoice] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [deletingWallet, setDeletingWallet] = React.useState<CryptoWallet | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const loadWallets = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setWallets(await api.get<CryptoWallet[]>('/admin/crypto-wallets'))
    } catch (err: any) {
      setError(err.message || 'Unable to load wallets.')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { loadWallets() }, [loadWallets])

  const openForm = (wallet?: CryptoWallet) => {
    setEditingWallet(wallet || null)
    if (wallet) {
      const knownNetwork = networkOptions.includes(wallet.network) ? wallet.network : 'Other'
      setNetworkChoice(knownNetwork)
      setForm({ currency: wallet.currency, network: wallet.network, address: wallet.address, qrCodeUrl: wallet.qrCodeUrl || '', isActive: wallet.isActive })
    } else {
      setNetworkChoice('')
      setForm(emptyForm)
    }
    setModalOpen(true)
  }

  const closeForm = () => {
    if (!saving) setModalOpen(false)
  }

  const updateForm = (field: keyof WalletForm, value: string | boolean) => setForm((current) => ({ ...current, [field]: value }))

  const selectNetwork = (network: string) => {
    setNetworkChoice(network)
    updateForm('network', network === 'Other' ? '' : network)
  }

  const saveWallet = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.currency.trim() || !form.network.trim() || !form.address.trim()) {
      toast({ variant: 'error', title: 'Missing wallet details', description: 'Cryptocurrency, network, and receiving address are required.' })
      return
    }
    try {
      setSaving(true)
      const payload = { ...form, currency: form.currency.trim(), network: form.network.trim(), address: form.address.trim(), qrCodeUrl: form.qrCodeUrl?.trim() || null }
      if (editingWallet) {
        await api.put(`/admin/crypto-wallets/${editingWallet.id}`, payload)
      } else {
        await api.post('/admin/crypto-wallets', payload)
      }
      toast({ variant: 'success', title: editingWallet ? 'Wallet updated' : 'Wallet added', description: 'Checkout will use this wallet when it is active.' })
      setModalOpen(false)
      await loadWallets()
    } catch (err: any) {
      toast({ variant: 'error', title: 'Could not save wallet', description: err.message || 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const toggleWallet = async (wallet: CryptoWallet) => {
    try {
      await api.put(`/admin/crypto-wallets/${wallet.id}`, { currency: wallet.currency, network: wallet.network, address: wallet.address, qrCodeUrl: wallet.qrCodeUrl, isActive: !wallet.isActive })
      await loadWallets()
    } catch (err: any) {
      toast({ variant: 'error', title: 'Could not update wallet', description: err.message || 'Please try again.' })
    }
  }

  const deleteWallet = async () => {
    if (!deletingWallet) return
    try {
      setDeleting(true)
      await api.delete(`/admin/crypto-wallets/${deletingWallet.id}`)
      toast({ variant: 'success', title: 'Wallet deleted' })
      setDeletingWallet(null)
      await loadWallets()
    } catch (err: any) {
      toast({ variant: 'error', title: 'Could not delete wallet', description: err.message || 'Please try again.' })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (error) return <div className="flex h-96 flex-col items-center justify-center"><AlertCircle className="mb-3 h-12 w-12 text-destructive" /><p className="font-semibold">Failed to load wallets</p><p className="mt-1 text-sm text-muted-foreground">{error}</p><Button className="mt-4" onClick={loadWallets}>Try again</Button></div>

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div><h1 className="font-display text-2xl font-bold lg:text-3xl">Wallets</h1><p className="mt-1 text-muted-foreground">Manage EMART cryptocurrency receiving wallets used at checkout.</p></div>
      <Button size="lg" onClick={() => openForm()}><Plus className="h-4 w-4" />Add wallet</Button>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <Card><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">Configured wallets</p><p className="mt-1 text-3xl font-bold">{wallets.length}</p></div><WalletCards className="h-8 w-8 text-primary" /></CardContent></Card>
      <Card><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">Active at checkout</p><p className="mt-1 text-3xl font-bold">{wallets.filter((wallet) => wallet.isActive).length}</p></div><QrCode className="h-8 w-8 text-success" /></CardContent></Card>
    </div>

    {wallets.length === 0 ? <Card><CardContent className="p-12 text-center"><WalletCards className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-4 font-semibold">No wallets configured</p><p className="mt-1 text-sm text-muted-foreground">Add an active receiving wallet to make crypto checkout available.</p><Button className="mt-5" onClick={() => openForm()}><Plus className="h-4 w-4" />Add wallet</Button></CardContent></Card> :
      <div className="grid gap-4 xl:grid-cols-2">{wallets.map((wallet) => <Card key={wallet.id}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{wallet.currency}</h2><Badge variant={wallet.isActive ? 'success' : 'outline'} size="sm" dot>{wallet.isActive ? 'Active' : 'Disabled'}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{wallet.network}</p></div><div className="flex shrink-0 gap-1"><Button aria-label={`Edit ${wallet.currency} ${wallet.network}`} title="Edit wallet" variant="ghost" size="icon" onClick={() => openForm(wallet)}><Edit className="h-4 w-4" /></Button><Button aria-label={`Delete ${wallet.currency} ${wallet.network}`} title="Delete wallet" variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeletingWallet(wallet)}><Trash2 className="h-4 w-4" /></Button></div></div><div className="mt-4 rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">EMART receiving address</p><p className="mt-1 break-all font-mono text-xs">{wallet.address}</p></div><div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4"><span className="text-xs text-muted-foreground">QR code: {wallet.qrCodeUrl ? 'Included' : 'Not included'}</span><button type="button" role="switch" aria-checked={wallet.isActive} onClick={() => toggleWallet(wallet)} className={`relative h-6 w-11 rounded-full transition-colors ${wallet.isActive ? 'bg-primary' : 'bg-muted-foreground/30'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${wallet.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} /></button></div></CardContent></Card>)}</div>}

    <Modal isOpen={modalOpen} onClose={closeForm} title={editingWallet ? 'Edit wallet' : 'Add wallet'} description="Only active wallets are shown to customers at checkout." size="md">
      <form id="wallet-form" className="space-y-4" onSubmit={saveWallet}>
        <div><label className="mb-1.5 block text-sm font-medium">Cryptocurrency</label><Input value={form.currency} onChange={(event) => updateForm('currency', event.target.value)} placeholder="e.g. USDT or BTC" autoComplete="off" /></div>
        <div><label className="mb-1.5 block text-sm font-medium">Network</label><Select value={networkChoice} onChange={(event) => selectNetwork(event.target.value)}><option value="" disabled>Select a network</option>{networkOptions.map((network) => <option key={network} value={network}>{network}</option>)}</Select>{networkChoice === 'Other' && <Input className="mt-2" value={form.network} onChange={(event) => updateForm('network', event.target.value)} placeholder="Enter network name" autoComplete="off" />}</div>
        <div><label className="mb-1.5 block text-sm font-medium">EMART receiving address</label><Input value={form.address} onChange={(event) => updateForm('address', event.target.value)} placeholder="Wallet address" autoComplete="off" /></div>
        <div><label className="mb-1.5 block text-sm font-medium">QR code URL <span className="font-normal text-muted-foreground">(optional)</span></label><Input type="url" value={form.qrCodeUrl || ''} onChange={(event) => updateForm('qrCodeUrl', event.target.value)} placeholder="https://…" /></div>
        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3"><span><span className="block text-sm font-medium">Enable at checkout</span><span className="text-xs text-muted-foreground">Customers can select this network.</span></span><input type="checkbox" className="h-4 w-4" checked={form.isActive} onChange={(event) => updateForm('isActive', event.target.checked)} /></label>
      </form>
      <div className="mt-6 flex justify-end gap-3"><Button variant="outline" onClick={closeForm} disabled={saving}>Cancel</Button><Button type="submit" form="wallet-form" isLoading={saving}>{editingWallet ? 'Save changes' : 'Add wallet'}</Button></div>
    </Modal>
    <ConfirmDialog isOpen={!!deletingWallet} title="Delete wallet?" description="This wallet will no longer be offered at checkout." confirmText="Delete" variant="danger" isLoading={deleting} onCancel={() => !deleting && setDeletingWallet(null)} onConfirm={deleteWallet} />
  </div>
}
