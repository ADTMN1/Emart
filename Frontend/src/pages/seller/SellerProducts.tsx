import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Package, Pencil, Trash2, ChevronLeft, ChevronRight, Store } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { OptimizedImage } from '@/components/ui/OptimizedImage'
import { useToast } from '@/components/ui/Toast'
import { sellerProductApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

interface SellerProduct {
  id: string
  sku: string | null
  name: string
  price: number
  estimatedPriceUsd: number
  stock: number
  isAvailable: boolean
  condition: string
  category: { id: string; name: string } | null
  updatedAt: string
  productImages: Array<{ id: string; url: string; isPrimary: boolean }>
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

/**
 * Seller product management (Phase 6). Lists ONLY the signed-in seller's own
 * products — scoping is enforced server-side from the authenticated seller
 * profile; this page merely renders what the API returns.
 */
export default function SellerProducts() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [products, setProducts] = React.useState<SellerProduct[]>([])
  const [pagination, setPagination] = React.useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState<SellerProduct | null>(null)
  const [notApproved, setNotApproved] = React.useState(false)

  const load = React.useCallback(async (page = 1) => {
    try {
      setLoading(true)
      setError(null)
      const res = await sellerProductApi.list({ page, limit: 20, search: search.trim() || undefined, status })
      setProducts(res.products || [])
      setPagination(res.pagination)
      setNotApproved(false)
    } catch (err: any) {
      if (err?.status === 401) {
        navigate('/login')
        return
      }
      if (err?.status === 403 || err?.status === 404) {
        setNotApproved(true)
      } else {
        setError(err?.message || 'Failed to load products.')
      }
    } finally {
      setLoading(false)
    }
  }, [search, status])

  React.useEffect(() => {
    const t = window.setTimeout(() => load(1), search ? 300 : 0)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status])

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      setDeletingId(confirmDelete.id)
      await sellerProductApi.delete(confirmDelete.id)
      toast({ variant: 'success', title: 'Product deleted' })
      setConfirmDelete(null)
      await load(pagination.page)
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Delete failed',
        description: err?.message || 'This product could not be deleted.',
      })
      setConfirmDelete(null)
    } finally {
      setDeletingId(null)
    }
  }

  if (notApproved) {
    return (
      <div className="py-6">
        <div className="max-w-xl mx-auto">
          <Card>
            <CardContent className="py-16 text-center">
              <Store className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <h1 className="font-display text-xl font-bold text-foreground">Seller account required</h1>
              <p className="text-muted-foreground mt-2">
                Product management is available to approved sellers. Check your seller application status for details.
              </p>
              <Link to="/account/seller">
                <Button className="mt-6">View Seller Status</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">My Products</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {pagination.total} product{pagination.total === 1 ? '' : 's'} in your store
            </p>
          </div>
          <Button onClick={() => navigate('/seller/products/new')}>
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, description, or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
            <option value="all">All products</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </Select>
        </div>

        {/* Error state */}
        {error && (
          <Card className="mb-6 border-destructive/30">
            <CardContent className="py-8 text-center">
              <p className="text-destructive font-semibold">{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => load(pagination.page)}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-32 rounded-lg bg-muted animate-pulse mb-4" />
                  <div className="h-4 rounded bg-muted animate-pulse mb-2" />
                  <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && products.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center">
              <Package className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <h2 className="font-display text-lg font-bold text-foreground">
                {search || status !== 'all' ? 'No products match your filters' : 'No products yet'}
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                {search || status !== 'all'
                  ? 'Try adjusting your search or availability filter.'
                  : 'Add your first product to start selling.'}
              </p>
              {!search && status === 'all' && (
                <Button className="mt-6" onClick={() => navigate('/seller/products/new')}>
                  <Plus className="h-4 w-4" />
                  Add Product
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Product grid */}
        {!loading && !error && products.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => {
                const primary = product.productImages?.find((img) => img.isPrimary) || product.productImages?.[0]
                return (
                  <Card key={product.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <div className="h-20 w-20 rounded-lg bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                          {primary ? (
                            <OptimizedImage
                              src={primary.url}
                              alt={product.name}
                              size="thumb"
                              context="thumbnail"
                              lazy
                              aspectRatio="aspect-square"
                              containerClassName="h-20 w-20 shrink-0 rounded-lg"
                            />
                          ) : (
                            <Package className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
                            <Badge variant={product.isAvailable ? 'success' : 'secondary'}>
                              {product.isAvailable ? 'Available' : 'Hidden'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {product.category?.name || 'Uncategorized'}
                            {product.sku ? ` · SKU ${product.sku}` : ''}
                          </p>
                          <p className="font-bold text-primary mt-1">{formatCurrency(product.price)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Stock: {product.stock}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => navigate(`/seller/products/${product.id}/edit`)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmDelete(product)}
                          disabled={deletingId === product.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => load(pagination.page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => load(pagination.page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <Card className="w-full max-w-md" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <CardContent className="p-6">
              <h3 className="font-display text-lg font-bold text-foreground">Delete product?</h3>
              <p className="text-sm text-muted-foreground mt-2">
                <span className="font-semibold text-foreground">{confirmDelete.name}</span> will be permanently removed.
                Products that are part of an existing order cannot be deleted.
              </p>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDelete}
                  disabled={deletingId === confirmDelete.id}
                >
                  {deletingId === confirmDelete.id ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
