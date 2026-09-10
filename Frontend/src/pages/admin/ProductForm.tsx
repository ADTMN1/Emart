import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Save,
  ArrowLeft,
  Upload,
  X,
  Star,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { api, productImageApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
}

interface ProductImage {
  id: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
}

interface ProductFormData {
  name: string;
  description: string;
  price: number;
  estimatedPriceUsd: number;
  condition: string;
  seller: string;
  sellerType: string;
  source: string;
  domesticShipping: number;
  internationalShippingUsd: number;
  serviceFee: number;
  categoryId: string;
  tags: string;
  stock: number;
  isAvailable: boolean;
  isNew: boolean;
  isBestSeller: boolean;
}

interface PendingImage {
  id: string;
  file: File;
  previewUrl: string;
  isPrimary: boolean;
  sortOrder: number;
}

export const AdminProductForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isEditMode = !!id;

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = React.useState(true);
  const [images, setImages] = React.useState<ProductImage[]>([]);
  const [pendingImages, setPendingImages] = React.useState<PendingImage[]>([]);
  const [loading, setLoading] = React.useState(isEditMode);
  const [saving, setSaving] = React.useState(false);
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [formData, setFormData] = React.useState<ProductFormData>({
    name: '',
    description: '',
    price: 0,
    estimatedPriceUsd: 0,
    condition: 'NEW',
    seller: '',
    sellerType: 'SHOP',
    source: 'Yahoo! Auctions',
    domesticShipping: 0,
    internationalShippingUsd: 25,
    serviceFee: 0,
    categoryId: '',
    tags: '',
    stock: 1,
    isAvailable: true,
    isNew: false,
    isBestSeller: false,
  });

  // Load categories
  React.useEffect(() => {
    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true);
        const res = await api.get<Category[]>('/categories');
        setCategories(res || []);
        if (res && res.length > 0 && !formData.categoryId) {
          setFormData((prev) => ({ ...prev, categoryId: res[0].id }));
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

  // Refresh product data from API (used after image operations)
  const refreshProductImages = React.useCallback(async () => {
    if (!isEditMode || !id) return;
    try {
      const cacheBuster = `t=${Date.now()}-${refreshKey}`;
      const product = await api.get(`/products/${id}?${cacheBuster}`);
      
      if (product.productImages && product.productImages.length > 0) {
        setImages(product.productImages);
      } else {
        setImages([]);
      }
    } catch (err: any) {
      console.error('Failed to refresh product images:', err);
    }
  }, [id, isEditMode, refreshKey]);

  // Load product data if editing
  React.useEffect(() => {
    if (!isEditMode || !id) return;

    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);

        const cacheBuster = `t=${Date.now()}-${refreshKey}`;
        const product = await api.get(`/products/${id}?${cacheBuster}`);
        
        setFormData({
          name: product.name || '',
          description: product.description || '',
          price: product.price || 0,
          estimatedPriceUsd: product.estimatedPriceUsd || 0,
          condition: product.condition || 'NEW',
          seller: product.seller || '',
          sellerType: product.sellerType || 'SHOP',
          source: product.source || 'Yahoo! Auctions',
          domesticShipping: product.domesticShipping || 0,
          internationalShippingUsd: product.internationalShippingUsd || 25,
          serviceFee: product.serviceFee || 0,
          categoryId: product.categoryId || '',
          tags: Array.isArray(product.tags) ? product.tags.join(', ') : '',
          stock: product.stock || 1,
          isAvailable: product.isAvailable ?? true,
          isNew: product.isNew ?? false,
          isBestSeller: product.isBestSeller ?? false,
        });

        if (product.productImages && product.productImages.length > 0) {
          setImages(product.productImages);
        } else {
          setImages([]);
        }
      } catch (err: any) {
        console.error('Failed to fetch product:', err);
        setError(err.message || 'Failed to load product');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, isEditMode, refreshKey]);

  // Auto-calculate service fee (7% of price)
  React.useEffect(() => {
    if (formData.price > 0) {
      const fee = Math.round(formData.price * 0.07);
      setFormData((prev) => ({ ...prev, serviceFee: fee }));
    }
  }, [formData.price]);

  // Auto-calculate estimated USD price
  React.useEffect(() => {
    if (formData.price > 0) {
      const estimatedUsd = Math.round(formData.price * 0.007 * 100) / 100;
      setFormData((prev) => ({ ...prev, estimatedPriceUsd: estimatedUsd }));
    }
  }, [formData.price]);

  // Cleanup preview URLs on unmount
  React.useEffect(() => {
    return () => {
      pendingImages.forEach((img) => {
        URL.revokeObjectURL(img.previewUrl);
      });
    };
  }, []);

  const handleInputChange = (field: keyof ProductFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!isEditMode) {
      try {
        setUploadingImage(true);
        const newPendingImages: PendingImage[] = [];
        const currentCount = pendingImages.length;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const previewUrl = URL.createObjectURL(file);
          newPendingImages.push({
            id: `pending-${Date.now()}-${i}`,
            file,
            previewUrl,
            isPrimary: currentCount === 0 && i === 0,
            sortOrder: currentCount + i,
          });
        }

        setPendingImages((prev) => [...prev, ...newPendingImages]);

        toast({
          variant: 'success',
          title: 'Images Added',
          description: `${files.length} image(s) will be uploaded when you save the product`,
        });
      } catch (err: any) {
        toast({
          variant: 'error',
          title: 'Failed to Add Images',
          description: err.message || 'Failed to add images',
        });
      } finally {
        setUploadingImage(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
      return;
    }

    try {
      setUploadingImage(true);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await productImageApi.uploadProductImage(id!, file);
      }

      // Refresh from API to get consistent state (sortOrder, isPrimary, etc.)
      setRefreshKey((k) => k + 1);
      await refreshProductImages();

      toast({
        variant: 'success',
        title: 'Images Uploaded',
        description: `${files.length} image(s) uploaded successfully`,
      });
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Upload Failed',
        description: err.message || 'Failed to upload images',
      });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSetPrimary = async (imageId: string) => {
    if (!isEditMode) {
      setPendingImages((prev) =>
        prev.map((img) => ({
          ...img,
          isPrimary: img.id === imageId,
        }))
      );
      toast({
        variant: 'success',
        title: 'Primary Image Set',
      });
      return;
    }

    if (!id) return;

    try {
      await productImageApi.setPrimaryImage(id, imageId);
      setImages((prev) =>
        prev.map((img) => ({
          ...img,
          isPrimary: img.id === imageId,
        }))
      );
      setRefreshKey((k) => k + 1);
      await refreshProductImages();

      toast({
        variant: 'success',
        title: 'Primary Image Set',
      });
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Failed to Set Primary',
        description: err.message,
      });
    }
  };

  const handleDeletePendingImage = (imageId: string) => {
    setPendingImages((prev) => {
      const imgToDelete = prev.find((img) => img.id === imageId);
      if (imgToDelete) {
        URL.revokeObjectURL(imgToDelete.previewUrl);
      }
      const remaining = prev.filter((img) => img.id !== imageId);
      if (imgToDelete?.isPrimary && remaining.length > 0) {
        remaining[0].isPrimary = true;
      }
      return remaining;
    });
    toast({
      variant: 'success',
      title: 'Image Removed',
    });
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!isEditMode) {
      handleDeletePendingImage(imageId);
      return;
    }

    if (!id) return;

    try {
      await productImageApi.deleteProductImage(id, imageId);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
      setRefreshKey((k) => k + 1);
      await refreshProductImages();

      toast({
        variant: 'success',
        title: 'Image Deleted',
      });
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Delete Failed',
        description: err.message,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: string[] = [];

    if (categoriesLoading) {
      errors.push('Please wait while categories load...');
    }
    if (!formData.name || formData.name.trim().length < 3) {
      errors.push('Product name must be at least 3 characters');
    }
    if (!formData.description || formData.description.trim().length === 0) {
      errors.push('Product description is required');
    }
    if (isNaN(formData.price) || formData.price < 0) {
      errors.push('Price must be a positive number');
    }
    if (isNaN(formData.estimatedPriceUsd) || formData.estimatedPriceUsd < 0) {
      errors.push('Estimated USD price must be a positive number');
    }
    if (!formData.categoryId) {
      errors.push(categories.length === 0 ? 'No categories available. Please create one first.' : 'Please select a category');
    }
    const validConditions = ['NEW', 'LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE'];
    if (!validConditions.includes(formData.condition)) {
      errors.push('Invalid product condition');
    }

    if (errors.length > 0) {
      toast({
        variant: 'error',
        title: 'Validation Error',
        description: errors.join('; '),
      });
      return;
    }

    try {
      setSaving(true);

      const validSellerTypes = ['SHOP', 'INDIVIDUAL'];
      const validConditions = ['NEW', 'LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE'];

      let safeStock = Math.floor(Number(formData.stock) || 1);
      if (safeStock < 0) safeStock = 0;

      const tagsArray = Array.isArray(formData.tags)
        ? formData.tags
        : String(formData.tags || '')
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: Number(formData.price) || 0,
        estimatedPriceUsd: Number(formData.estimatedPriceUsd) || 0,
        condition: validConditions.includes(formData.condition) ? formData.condition : 'NEW',
        seller: (formData.seller || 'Unknown Seller').trim() || 'Unknown Seller',
        sellerType: validSellerTypes.includes(formData.sellerType) ? formData.sellerType : 'SHOP',
        source: (formData.source || 'Yahoo! Auctions').trim() || 'Yahoo! Auctions',
        domesticShipping: Number(formData.domesticShipping) || 0,
        internationalShippingUsd: Number(formData.internationalShippingUsd) || 0,
        serviceFee: Number(formData.serviceFee) || 0,
        categoryId: String(formData.categoryId),
        tags: tagsArray,
        stock: safeStock,
        isAvailable: Boolean(formData.isAvailable),
        isNew: Boolean(formData.isNew),
        isBestSeller: Boolean(formData.isBestSeller),
        images: [],
      };

      if (isEditMode && id) {
        await api.put(`/products/${id}`, payload);
        toast({
          variant: 'success',
          title: 'Product Updated',
          description: 'Product has been updated successfully',
        });
        navigate('/admin/products');
      } else {
        const newProduct = await api.post('/products', payload);

        if (pendingImages.length > 0) {
          let primaryImageId: string | null = null;
          const sortedPending = [...pendingImages].sort((a, b) => a.sortOrder - b.sortOrder);

          for (let i = 0; i < sortedPending.length; i++) {
            const pending = sortedPending[i];
            try {
              const uploaded = await productImageApi.uploadProductImage(newProduct.id, pending.file);
              if (pending.isPrimary && uploaded?.id) {
                primaryImageId = uploaded.id;
              }
              URL.revokeObjectURL(pending.previewUrl);
            } catch (uploadErr: any) {
              console.error('Failed to upload image:', uploadErr);
            }
          }

          if (primaryImageId) {
            try {
              await productImageApi.setPrimaryImage(newProduct.id, primaryImageId);
            } catch (primaryErr: any) {
              console.error('Failed to set primary image:', primaryErr);
            }
          }
        }

        toast({
          variant: 'success',
          title: 'Product Created',
          description: pendingImages.length > 0
            ? `Product created with ${pendingImages.length} image(s)`
            : 'Product has been created successfully',
        });
        navigate(`/admin/products/${newProduct.id}/edit`);
      }
    } catch (err: any) {
      const errorDetails = err.data?.error || err.message || 'Failed to save product';
      console.error('Save error:', err);
      toast({
        variant: 'error',
        title: isEditMode ? 'Update Failed' : 'Create Failed',
        description: errorDetails,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-semibold">Failed to Load Product</p>
        <p className="text-sm text-muted-foreground mt-2">{error}</p>
        <Button className="mt-4" onClick={() => navigate('/admin/products')}>
          Back to Products
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/products')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold">
              {isEditMode ? 'Edit Product' : 'Add New Product'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isEditMode ? 'Update product information' : 'Create a new product'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/products')}>
            Cancel
          </Button>
          <Button type="submit" isLoading={saving} disabled={categoriesLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isEditMode ? 'Update' : 'Create'} Product
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold text-lg">Basic Information</h2>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Product Name <span className="text-destructive">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter product name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Description <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter product description"
                  rows={4}
                  className="w-full rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/70 p-3 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary/15"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Category <span className="text-destructive">*</span>
                  </label>
                  <Select
                    value={formData.categoryId}
                    onChange={(e) => handleInputChange('categoryId', e.target.value)}
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Condition</label>
                  <Select
                    value={formData.condition}
                    onChange={(e) => handleInputChange('condition', e.target.value)}
                  >
                    <option value="NEW">New</option>
                    <option value="LIKE_NEW">Like New</option>
                    <option value="VERY_GOOD">Very Good</option>
                    <option value="GOOD">Good</option>
                    <option value="ACCEPTABLE">Acceptable</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tags (comma-separated)</label>
                <Input
                  value={formData.tags}
                  onChange={(e) => handleInputChange('tags', e.target.value)}
                  placeholder="e.g., vintage, rare, limited edition"
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold text-lg">Pricing</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Price (JPY)</label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    min="0"
                    step="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Estimated USD (Auto-calculated)
                  </label>
                  <Input
                    type="number"
                    value={formData.estimatedPriceUsd}
                    disabled
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Domestic Shipping (JPY)</label>
                  <Input
                    type="number"
                    value={formData.domesticShipping}
                    onChange={(e) =>
                      handleInputChange('domesticShipping', parseFloat(e.target.value) || 0)
                    }
                    placeholder="0"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    International Shipping (USD)
                  </label>
                  <Input
                    type="number"
                    value={formData.internationalShippingUsd}
                    onChange={(e) =>
                      handleInputChange('internationalShippingUsd', parseFloat(e.target.value) || 0)
                    }
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Service Fee (Auto-calculated 7%)
                </label>
                <Input type="number" value={formData.serviceFee} disabled placeholder="0" />
              </div>
            </CardContent>
          </Card>

          {/* Seller Information */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold text-lg">Seller Information</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Seller Name</label>
                  <Input
                    value={formData.seller}
                    onChange={(e) => handleInputChange('seller', e.target.value)}
                    placeholder="Enter seller name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Seller Type</label>
                  <Select
                    value={formData.sellerType}
                    onChange={(e) => handleInputChange('sellerType', e.target.value)}
                  >
                    <option value="SHOP">Shop</option>
                    <option value="INDIVIDUAL">Individual</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Source Marketplace</label>
                <Input
                  value={formData.source}
                  onChange={(e) => handleInputChange('source', e.target.value)}
                  placeholder="e.g., Yahoo! Auctions, Rakuten"
                />
              </div>
            </CardContent>
          </Card>

          {/* Product Images */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">Product Images</h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  isLoading={uploadingImage}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Images
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>

              {isEditMode ? (
                images.length === 0 ? (
                  <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
                    <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm font-medium">No images uploaded</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload product images to showcase your item
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {images.map((image) => (
                      <div
                        key={image.id}
                        className="relative group aspect-square rounded-lg overflow-hidden border border-border"
                      >
                        <img
                          src={image.url}
                          alt="Product"
                          className="w-full h-full object-cover"
                        />
                        {image.isPrimary && (
                          <div className="absolute top-2 left-2">
                            <Badge variant="primary" size="sm">
                              <Star className="h-3 w-3 mr-1 fill-current" />
                              Primary
                            </Badge>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          {!image.isPrimary && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(image.id)}
                              className="p-2 bg-white rounded-lg hover:bg-gray-100"
                              title="Set as primary"
                            >
                              <Star className="h-4 w-4 text-amber-600" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteImage(image.id)}
                            className="p-2 bg-white rounded-lg hover:bg-gray-100"
                            title="Delete image"
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                pendingImages.length === 0 ? (
                  <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
                    <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm font-medium">No images added</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload product images to showcase your item. Images will be uploaded when you save the product.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {pendingImages.map((image) => (
                      <div
                        key={image.id}
                        className="relative group aspect-square rounded-lg overflow-hidden border border-border"
                      >
                        <img
                          src={image.previewUrl}
                          alt="Product Preview"
                          className="w-full h-full object-cover"
                        />
                        {image.isPrimary && (
                          <div className="absolute top-2 left-2">
                            <Badge variant="primary" size="sm">
                              <Star className="h-3 w-3 mr-1 fill-current" />
                              Primary
                            </Badge>
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          <Badge variant="outline" size="sm" className="bg-white/90">
                            Pending
                          </Badge>
                        </div>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          {!image.isPrimary && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(image.id)}
                              className="p-2 bg-white rounded-lg hover:bg-gray-100"
                              title="Set as primary"
                            >
                              <Star className="h-4 w-4 text-amber-600" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteImage(image.id)}
                            className="p-2 bg-white rounded-lg hover:bg-gray-100"
                            title="Remove image"
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              <p className="text-xs text-muted-foreground">
                Supported formats: JPEG, PNG, WebP, AVIF. Max size: 5MB per image.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold text-lg">Status</h2>

              <div>
                <label className="block text-sm font-medium mb-2">Stock</label>
                <Input
                  type="number"
                  value={formData.stock}
                  onChange={(e) => handleInputChange('stock', parseInt(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isAvailable"
                  checked={formData.isAvailable}
                  onChange={(e) => handleInputChange('isAvailable', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="isAvailable" className="text-sm font-medium">
                  Available for purchase
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isNew"
                  checked={formData.isNew}
                  onChange={(e) => handleInputChange('isNew', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="isNew" className="text-sm font-medium">
                  Mark as New
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isBestSeller"
                  checked={formData.isBestSeller}
                  onChange={(e) => handleInputChange('isBestSeller', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="isBestSeller" className="text-sm font-medium">
                  Mark as Best Seller
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Tips */}
          {!isEditMode && pendingImages.length > 0 && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="p-6">
                <h3 className="font-semibold text-sm text-blue-900 mb-2">💡 Tip</h3>
                <p className="text-xs text-blue-800">
                  You have {pendingImages.length} pending image(s). They will be uploaded automatically when you create the product.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </form>
  );
};
