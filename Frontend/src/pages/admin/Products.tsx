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
  MoreVertical,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

interface Product {
  id: string;
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

export const AdminProducts: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const [products, setProducts] = React.useState<Product[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [productToDelete, setProductToDelete] = React.useState<Product | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const searchQuery = searchParams.get('search') || '';
  const categoryFilter = searchParams.get('category') || '';
  const statusFilter = searchParams.get('status') || '';

  const fetchProducts = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (categoryFilter) params.append('category', categoryFilter);
      params.append('limit', '100');

      const res = await api.get<{ products: Product[] }>(`/products?${params.toString()}`);
      let filteredProducts = res.products || [];

      // Apply status filter
      if (statusFilter === 'active') {
        filteredProducts = filteredProducts.filter((p) => p.isAvailable);
      } else if (statusFilter === 'inactive') {
        filteredProducts = filteredProducts.filter((p) => !p.isAvailable);
      }

      setProducts(filteredProducts);
    } catch (err: any) {
      console.error('Failed to fetch products:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, categoryFilter, statusFilter]);

  React.useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
    setSearchParams(params);
  };

  const handleCategoryChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set('category', value);
    } else {
      params.delete('category');
    }
    setSearchParams(params);
  };

  const handleStatusChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set('status', value);
    } else {
      params.delete('status');
    }
    setSearchParams(params);
  };

  const handleRefreshProducts = () => {
    fetchProducts();
  };

  const handleClearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const handleToggleAvailability = async (product: Product) => {
    try {
      await api.put(`/products/${product.id}`, {
        isAvailable: !product.isAvailable,
      });

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
            Manage your product catalog ({products.length} products)
          </p>
        </div>
        <Link to="/admin/products/new">
          <Button size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </Link>
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
                <option value="">All Status</option>
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
                {searchQuery || categoryFilter || statusFilter
                  ? 'Try adjusting your filters'
                  : 'Get started by adding your first product'}
              </p>
              {!searchQuery && !categoryFilter && !statusFilter && (
                <Link to="/admin/products/new" className="mt-4">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
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
                    <th className="text-left p-4 font-semibold text-sm">Product</th>
                    <th className="text-left p-4 font-semibold text-sm">Category</th>
                    <th className="text-left p-4 font-semibold text-sm">Price</th>
                    <th className="text-left p-4 font-semibold text-sm">Stock</th>
                    <th className="text-left p-4 font-semibold text-sm">Status</th>
                    <th className="text-right p-4 font-semibold text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b border-border hover:bg-muted/30">
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
                        <Badge variant="outline" size="sm">
                          {product.category.name}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-sm">
                          {formatCurrency(product.price, 'JPY')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ~{formatCurrency(product.estimatedPriceUsd, 'USD')}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
