import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Package,
  ExternalLink,
  FolderTree,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { useToast } from '@/components/ui/Toast';
import { api, invalidateCache } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

interface CJProduct {
  id: string;
  name: string;
  image: string;
  price: number;
  currency: string;
  categoryId: number;
  categoryName: string;
  warehouse: string;
  shippingTime: string;
  stock: number;
}

interface CJProductDetail {
  id: string;
  name: string;
  description: string;
  image: string;
  images: string[];
  price: number;
  currency: string;
  categoryId: number;
  categoryName: string;
  categoryPath: string;
  warehouse: string;
  shippingTime: string;
  stock: number;
  videoUrl?: string;
  attributes: any[];
  variants: Array<{
    vid: string;
    sku: string;
    name: string;
    price: number;
    stock: number;
    attrs: any[];
  }>;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface CJCategory {
  categoryId: number;
  categoryName: string;
  parentId: number;
  level: number;
}

interface EMARTCategory {
  id: string;
  name: string;
}

interface ImportProgress {
  runId: string;
  status: string;
  totalRows: number;
  successRows: number;
  warningRows: number;
  errorRows: number;
}

export const SupplierCatalog: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const [products, setProducts] = React.useState<CJProduct[]>([]);
  const [pagination, setPagination] = React.useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = React.useState(searchParams.get('keyword') || '');

  const [detailModalOpen, setDetailModalOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<CJProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  const [cjCategories, setCjCategories] = React.useState<CJCategory[]>([]);
  const [emartCategories, setEmartCategories] = React.useState<EMARTCategory[]>([]);
  const [selectedCjCategory, setSelectedCjCategory] = React.useState<string>('');
  const [selectedEmartCategory, setSelectedEmartCategory] = React.useState<string>('');
  const [categoryImportLoading, setCategoryImportLoading] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState<ImportProgress | null>(null);
  const [progressPolling, setProgressPolling] = React.useState(false);

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const keyword = searchParams.get('keyword') || '';

  const fetchProducts = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (keyword) params.append('keyword', keyword);
      params.append('page', String(page));
      params.append('pageSize', '20');

      const res = await api.get<{ products: CJProduct[]; pagination: Pagination }>(
        `/admin/suppliers/cj/products?${params.toString()}`
      );
      setProducts(res.products || []);
      if (res.pagination) setPagination(res.pagination);
    } catch (err: any) {
      console.error('Failed to fetch CJ products:', err);
      setError(err.message || 'Failed to load CJ products');
    } finally {
      setLoading(false);
    }
  }, [keyword, page]);

  React.useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchKeyword) {
      params.set('keyword', searchKeyword);
    } else {
      params.delete('keyword');
    }
    params.delete('page');
    setSearchParams(params);
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

  const handleViewDetails = async (productId: string) => {
    try {
      setDetailLoading(true);
      setDetailModalOpen(true);
      const detail = await api.get<CJProductDetail>(`/admin/suppliers/cj/products/${productId}`);
      setSelectedProduct(detail);
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Failed to Load Details',
        description: err.message || 'Failed to load product details',
      });
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleImport = async (productId: string) => {
    try {
      setImporting(true);
      const result = await api.post<{ id: string; name: string }>(
        `/admin/suppliers/cj/products/${productId}/import`
      );

      invalidateCache.products();

      toast({
        variant: 'success',
        title: 'Product Imported',
        description: `"${result.name}" has been imported to Marcari23 successfully.`,
      });

      setDetailModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      if (err.status === 409) {
        toast({
          variant: 'warning',
          title: 'Already Imported',
          description: 'This product has already been imported to Marcari23.',
        });
      } else {
        toast({
          variant: 'error',
          title: 'Import Failed',
          description: err.message || 'Failed to import product',
        });
      }
    } finally {
      setImporting(false);
    }
  };

  const fetchCategories = React.useCallback(async () => {
    try {
      const [cjRes, emartRes] = await Promise.all([
        api.get<CJCategory[]>('/admin/suppliers/cj/categories'),
        api.get<EMARTCategory[]>('/categories'),
      ]);
      setCjCategories(cjRes || []);
      setEmartCategories(emartRes || []);
    } catch (err: any) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  React.useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleStartCategoryImport = async () => {
    if (!selectedCjCategory || !selectedEmartCategory) {
      toast({
        variant: 'error',
        title: 'Selection Required',
        description: 'Please select both a CJ category and a Marcari23 category.',
      });
      return;
    }

    try {
      setCategoryImportLoading(true);
      const result = await api.post<{ runId: string; status: string }>(
        `/admin/suppliers/cj/categories/${selectedCjCategory}/import`,
        { emartCategoryId: selectedEmartCategory }
      );

      setImportProgress({
        runId: result.runId,
        status: 'PROCESSING',
        totalRows: 0,
        successRows: 0,
        warningRows: 0,
        errorRows: 0,
      });
      setProgressPolling(true);

      toast({
        variant: 'success',
        title: 'Import Started',
        description: `Category import started. Run ID: ${result.runId}`,
      });

      invalidateCache.products();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Import Failed',
        description: err.message || 'Failed to start category import',
      });
    } finally {
      setCategoryImportLoading(false);
    }
  };

  const pollImportProgress = React.useCallback(async () => {
    if (!importProgress?.runId) return;

    try {
      const run = await api.get<{
        status: string;
        totalRows: number;
        successRows: number;
        warningRows: number;
        errorRows: number;
      }>(`/products/import/${importProgress.runId}`);

      setImportProgress(prev => prev ? {
        ...prev,
        status: run.status,
        totalRows: run.totalRows,
        successRows: run.successRows,
        warningRows: run.warningRows,
        errorRows: run.errorRows,
      } : null);

      if (run.status === 'COMPLETED' || run.status === 'COMPLETED_WITH_ERRORS' || run.status === 'FAILED') {
        setProgressPolling(false);
        invalidateCache.products();
      }
    } catch (err: any) {
      console.error('Failed to poll import progress:', err);
    }
  }, [importProgress?.runId]);

  React.useEffect(() => {
    if (!progressPolling || !importProgress) return;

    const interval = setInterval(pollImportProgress, 2000);
    return () => clearInterval(interval);
  }, [progressPolling, importProgress, pollImportProgress]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Supplier Catalog</h1>
          <p className="text-muted-foreground mt-1">
            Search and import products from CJdropshipping
          </p>
        </div>
        <Badge variant="outline" size="sm">
          CJdropshipping
        </Badge>
      </div>

      {/* Category Import */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Category Import</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Import all products from a CJ category into a Marcari23 category.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">CJ Category</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedCjCategory}
                  onChange={(e) => setSelectedCjCategory(e.target.value)}
                >
                  <option value="">Select CJ category...</option>
                  {cjCategories.map((cat) => (
                    <option key={cat.categoryId} value={cat.categoryId}>
                      {cat.categoryName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Marcari23 Category</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedEmartCategory}
                  onChange={(e) => setSelectedEmartCategory(e.target.value)}
                >
                  <option value="">Select Marcari23 category...</option>
                  {emartCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              onClick={handleStartCategoryImport}
              isLoading={categoryImportLoading}
              disabled={!selectedCjCategory || !selectedEmartCategory}
              leftIcon={<Upload className="h-4 w-4" />}
            >
              Import Category
            </Button>

            {importProgress && (
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Import Progress</span>
                  <Badge
                    variant={
                      importProgress.status === 'COMPLETED' ? 'success' :
                      importProgress.status === 'FAILED' ? 'destructive' :
                      'default'
                    }
                    size="sm"
                  >
                    {importProgress.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Run ID: {importProgress.runId}
                </div>
                {importProgress.totalRows > 0 && (
                  <>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{
                          width: `${((importProgress.successRows + importProgress.warningRows + importProgress.errorRows) / importProgress.totalRows) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <p className="font-semibold">{importProgress.totalRows}</p>
                        <p className="text-muted-foreground">Total</p>
                      </div>
                      <div>
                        <p className="font-semibold text-green-600">{importProgress.successRows}</p>
                        <p className="text-muted-foreground">Imported</p>
                      </div>
                      <div>
                        <p className="font-semibold text-yellow-600">{importProgress.warningRows}</p>
                        <p className="text-muted-foreground">Warnings</p>
                      </div>
                      <div>
                        <p className="font-semibold text-red-600">{importProgress.errorRows}</p>
                        <p className="text-muted-foreground">Failed</p>
                      </div>
                    </div>
                  </>
                )}
                {progressPolling && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Processing...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search CJ products..."
                leftIcon={<Search className="h-4 w-4" />}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="h-11"
              />
            </div>
            <Button type="submit" size="lg" isLoading={loading}>
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
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
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold">No Products Found</p>
              <p className="text-sm text-muted-foreground mt-2">
                {keyword ? 'Try a different search term' : 'Enter a keyword to search CJ products'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left p-4 font-semibold text-sm">Product</th>
                    <th className="text-left p-4 font-semibold text-sm">Category</th>
                    <th className="text-left p-4 font-semibold text-sm">Supplier Price</th>
                    <th className="text-left p-4 font-semibold text-sm">Stock</th>
                    <th className="text-right p-4 font-semibold text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b border-border hover:bg-muted/30">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <OptimizedImage
                            src={product.image}
                            alt={product.name}
                            size="thumb"
                            context="thumbnail"
                            lazy
                            aspectRatio="aspect-square"
                            containerClassName="h-12 w-12 min-w-12 shrink-0 rounded-lg"
                            className="rounded-lg"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {product.warehouse} · {product.shippingTime}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" size="sm">
                          {product.categoryName}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-sm">
                          {formatCurrency(product.price, product.currency as "USD")}
                        </p>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={product.stock > 10 ? 'success' : product.stock > 0 ? 'warning' : 'default'}
                          size="sm"
                        >
                          {product.stock}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(product.id)}
                            isLoading={detailLoading}
                          >
                            View Details
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleImport(product.id)}
                            isLoading={importing}
                          >
                            Import
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && products.length > 0 && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} products
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

      {/* Product Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => !importing && setDetailModalOpen(false)}
        title="CJ Product Details"
        size="xl"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : selectedProduct ? (
          <div className="space-y-6">
            {/* Images */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {selectedProduct.images.slice(0, 4).map((img, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden border border-border">
                  <img src={img} alt={`${selectedProduct.name} ${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>

            {/* Info */}
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{selectedProduct.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  CJ Product ID: {selectedProduct.id}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Description</p>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {selectedProduct.description || 'No description available'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Supplier Price</p>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(selectedProduct.price, selectedProduct.currency as "USD")}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Stock</p>
                  <Badge
                    variant={selectedProduct.stock > 10 ? 'success' : selectedProduct.stock > 0 ? 'warning' : 'default'}
                    size="sm"
                  >
                    {selectedProduct.stock} units
                  </Badge>
                </div>
              </div>

              {/* Variants */}
              {selectedProduct.variants.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Variants ({selectedProduct.variants.length})</p>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 font-medium">Variant</th>
                          <th className="text-left p-2 font-medium">SKU</th>
                          <th className="text-left p-2 font-medium">Price</th>
                          <th className="text-left p-2 font-medium">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProduct.variants.map((v) => (
                          <tr key={v.vid} className="border-t border-border">
                            <td className="p-2">{v.name}</td>
                            <td className="p-2 font-mono text-xs">{v.sku}</td>
                            <td className="p-2">{formatCurrency(v.price, selectedProduct.currency as "USD")}</td>
                            <td className="p-2">{v.stock}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Category */}
              <div>
                <p className="text-sm font-medium">Category</p>
                <p className="text-sm text-muted-foreground">{selectedProduct.categoryPath || selectedProduct.categoryName}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setDetailModalOpen(false)} disabled={importing}>
                Cancel
              </Button>
              <Button onClick={() => handleImport(selectedProduct.id)} isLoading={importing}>
                Import to Marcari23
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};