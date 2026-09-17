import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Upload,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { api, invalidateCache } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

interface Product {
  id: string;
  sku: string | null;
  name: string;
  price: number;
  estimatedPriceUsd: number;
  condition: string;
  stock: number;
  isAvailable: boolean;
  category: {
    id: string;
    name: string;
  };
  productImages: Array<{
    id: string;
    url: string;
    isPrimary: boolean;
  }>;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
}

interface BulkDeleteResult {
  deletedCount: number;
  failedCount: number;
  failed: Array<{ id: string; reason: string }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const AdminProducts: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const [products, setProducts] = React.useState<Product[]>([]);
  const [pagination, setPagination] = React.useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [productToDelete, setProductToDelete] = React.useState<Product | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = React.useState(false);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);

  const searchQuery = searchParams.get('search') || '';
  const categoryFilter = searchParams.get('category') || '';
  const statusFilter = searchParams.get('status') || 'all';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const fetchProducts = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (categoryFilter) params.append('category', categoryFilter);
      params.append('status', statusFilter);
      params.append('page', String(page));
      params.append('limit', '20');

      const res = await api.get<{ products: Product[]; pagination: Pagination }>(
        `/products?${params.toString()}`
      );
      setProducts(res.products || []);
      if (res.pagination) setPagination(res.pagination);

      // If the current page is out of range (e.g. after filtering), fall back to page 1
      if (page > 1 && res.pagination && page > res.pagination.totalPages) {
        const next = new URLSearchParams(searchParams);
        next.set('page', '1');
        setSearchParams(next);
      }
    } catch (err: any) {
      console.error('Failed to fetch products:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, categoryFilter, statusFilter, page, searchParams, setSearchParams]);

  React.useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Clear selection whenever the visible product list changes
  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [products]);

  React.useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get<Category[]>('/categories');
        setCategories(res || []);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    };
    fetchCategories();
  }, []);

  const handleSearchChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set('search', value);
    } else {
      params.delete('search');
    }
    params.delete('page');
    setSearchParams(params);
  };

  const handleCategoryChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set('category', value);
    } else {
      params.delete('category');
    }
    params.delete('page');
    setSearchParams(params);
  };

  const handleStatusChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set('status', value);
    } else {
      params.delete('status');
    }
    params.delete('page');
    setSearchParams(params);
  };

  const handleRefreshProducts = () => {
    fetchProducts();
  };

  const handleClearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    if (newPage <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(newPage));
    }
    setSearchParams(params);
  };

  // --- Selection helpers ---

  const allVisibleSelected = products.length > 0 && products.every((p) => selectedIds.has(p.id));
  const someVisibleSelected = products.some((p) => selectedIds.has(p.id));
  const selectedCount = selectedIds.size;

  const handleToggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        // Deselect everything visible
        const next = new Set(prev);
        products.forEach((p) => next.delete(p.id));
        return next;
      }
      // Select all visible
      const next = new Set(prev);
      products.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // --- Bulk delete ---

  const handleBulkDeleteClick = () => {
    if (selectedCount === 0) return;
    setBulkDeleteModalOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedCount === 0) return;

    try {
      setBulkDeleting(true);
      const res = await api.post<BulkDeleteResult>('/products/bulk-delete', {
        ids: Array.from(selectedIds),
      });

      // Bust the storefront product cache so deleted items disappear immediately
      if ((res?.deletedCount ?? 0) > 0) {
        invalidateCache.products();
      }

      const deletedCount = res?.deletedCount ?? 0;
      const failed = res?.failed ?? [];

      if (deletedCount > 0 && failed.length === 0) {
        toast({
          variant: 'success',
          title: 'Products Deleted',
          description: `${deletedCount} product${deletedCount === 1 ? '' : 's'} deleted successfully`,
        });
      } else if (deletedCount > 0 && failed.length > 0) {
        toast({
          variant: 'warning',
          title: 'Partially Deleted',
          description: `${deletedCount} deleted, ${failed.length} failed (${failed[0].reason}${failed.length > 1 ? ` and ${failed.length - 1} more` : ''})`,
          duration: 7000,
        });
      } else if (failed.length > 0) {
        toast({
          variant: 'error',
          title: 'Delete Failed',
          description: failed[0].reason,
          duration: 7000,
        });
      }

      setBulkDeleteModalOpen(false);
      setSelectedIds(new Set());
      fetchProducts();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Delete Failed',
        description: err.message || 'Failed to delete selected products',
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  // --- Single product actions ---

  const handleToggleAvailability = async (product: Product) => {
    try {
      await api.put(`/products/${product.id}`, {
        isAvailable: !product.isAvailable,
      });

      // Publish/unpublish changes storefront visibility — bust the cached lists
      invalidateCache.products();

      toast({
        variant: 'success',
        title: 'Product Updated',
        description: `Product ${product.isAvailable ? 'unpublished' : 'published'} successfully`,
      });

      fetchProducts();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Update Failed',
        description: err.message || 'Failed to update product',
      });
    }
  };

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;

    try {
      setDeleting(true);
      await api.delete(`/products/${productToDelete.id}`);

      // Bust the storefront product cache so the deleted product disappears immediately
      invalidateCache.products();

      toast({
        variant: 'success',
        title: 'Product Deleted',
        description: 'Product has been deleted successfully',
      });

      setDeleteModalOpen(false);
      setProductToDelete(null);
      fetchProducts();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Delete Failed',
        description: err.message || 'Failed to delete product',
      });
    } finally {
      setDeleting(false);
    }
  };

  const getPrimaryImage = (product: Product) => {
    const primary = product.productImages.find((img) => img.isPrimary);
    return primary?.url || product.productImages[0]?.url || '/api/placeholder/100/100';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground mt-1">
            Manage your product catalog ({pagination.total} product{pagination.total === 1 ? '' : 's'})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/products/import/history"><Button variant="outline" leftIcon={<History className="h-4 w-4" />}>Import History</Button></Link>
          <Link to="/admin/products/import"><Button variant="outline" leftIcon={<Upload className="h-4 w-4" />}>Import CSV</Button></Link>
          <Link to="/admin/products/new"><Button size="lg"><Plus className="h-4 w-4" />Add Product</Button></Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(180px,1fr)_minmax(180px,1fr)_auto] xl:items-center">
            <div className="min-w-0">
              <Input
                placeholder="Search products..."
                leftIcon={<Search className="h-4 w-4" />}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="h-11"
              />
            </div>

            <div className="min-w-0">
              <Select
                value={categoryFilter}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="h-11"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="min-w-0">
              <Select
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="h-11"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>

            <div className="flex justify-end xl:justify-center">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleRefreshProducts}
                className="h-11 w-11 p-0 rounded-lg"
                aria-label="Refresh products"
                title="Refresh products"
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk selection bar */}
      {selectedCount > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium">
                {selectedCount} product{selectedCount === 1 ? '' : 's'} selected
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                  disabled={bulkDeleting}
                >
                  <X className="h-4 w-4" />
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDeleteClick}
                  isLoading={bulkDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-96">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-lg font-semibold">Failed to Load Products</p>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96">
              <p className="text-lg font-semibold">No Products Found</p>
              <p className="text-sm text-muted-foreground mt-2">
                {searchQuery || categoryFilter || (statusFilter && statusFilter !== 'all')
                  ? 'Try adjusting your filters'
                  : 'Get started by adding your first product'}
              </p>
              {!searchQuery && !categoryFilter && !statusFilter && (
                <Link to="/admin/products/new" className="mt-4">
                  <Button>
                    <Plus className="h-4 w-4" />
                    Add Product
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="p-4 w-10">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                        }}
                        onChange={handleToggleSelectAll}
                        className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                        aria-label="Select all products"
                      />
                    </th>
                    <th className="text-left p-4 font-semibold text-sm">Product</th>
                    <th className="text-left p-4 font-semibold text-sm">SKU</th>
                    <th className="text-left p-4 font-semibold text-sm">Category</th>
                    <th className="text-left p-4 font-semibold text-sm">Price</th>
                    <th className="text-left p-4 font-semibold text-sm">Stock</th>
                    <th className="text-left p-4 font-semibold text-sm">Status</th>
                    <th className="text-right p-4 font-semibold text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const isSelected = selectedIds.has(product.id);
                    return (
                      <tr
                        key={product.id}
                        className={cn(
                          'border-b border-border hover:bg-muted/30',
                          isSelected && 'bg-primary/5'
                        )}
                      >
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOne(product.id)}
                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                            aria-label={`Select ${product.name}`}
                          />
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={getPrimaryImage(product)}
                              alt={product.name}
                              className="h-12 w-12 rounded-lg object-cover bg-muted"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {product.condition}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-xs font-mono text-muted-foreground">
                            {product.sku || '—'}
                          </p>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" size="sm">
                            {product.category.name}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <p className="font-semibold text-sm">
                            {formatCurrency(product.price, 'USD')}
                          </p>
                        </td>
                        <td className="p-4">
                          <Badge
                            variant={product.stock > 5 ? 'success' : product.stock > 0 ? 'warning' : 'default'}
                            size="sm"
                          >
                            {product.stock}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge variant={product.isAvailable ? 'success' : 'default'} size="sm">
                            {product.isAvailable ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleAvailability(product)}
                              className="p-2 hover:bg-muted rounded-lg transition-colors"
                              title={product.isAvailable ? 'Unpublish' : 'Publish'}
                            >
                              {product.isAvailable ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            <Link to={`/admin/products/${product.id}/edit`}>
                              <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                                <Edit className="h-4 w-4 text-muted-foreground" />
                              </button>
                            </Link>
                            <button
                              onClick={() => handleDeleteClick(product)}
                              className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && products.length > 0 && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} product
                {pagination.total === 1 ? '' : 's'}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Delete Confirmation Modal */}
      <Modal
        isOpen={bulkDeleteModalOpen}
        onClose={() => !bulkDeleting && setBulkDeleteModalOpen(false)}
        title="Delete Selected Products"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{selectedCount}</strong> selected product
            {selectedCount === 1 ? '' : 's'}? This action cannot be undone.
          </p>
          <p className="text-xs text-muted-foreground">
            Note: products that are part of existing orders cannot be deleted and will be skipped.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setBulkDeleteModalOpen(false)}
              disabled={bulkDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDeleteConfirm} isLoading={bulkDeleting}>
              Delete {selectedCount} Product{selectedCount === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => !deleting && setDeleteModalOpen(false)}
        title="Delete Product"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{productToDelete?.name}</strong>? This action
            cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} isLoading={deleting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
