import * as React from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  AlertCircle,
  Save,
  FolderTree,
  Package,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  count: number;
}

export const AdminCategories: React.FC = () => {
  const { toast } = useToast();

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(null);
  const [formData, setFormData] = React.useState({ name: '', icon: '', color: '' });
  const [saving, setSaving] = React.useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [categoryToDelete, setCategoryToDelete] = React.useState<Category | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const totalProducts = categories.reduce((sum, category) => sum + category.count, 0);
  const activeCategories = categories.filter((category) => category.count > 0).length;

  const fetchCategories = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<Category[]>('/categories');
      setCategories(res || []);
    } catch (err: any) {
      console.error('Failed to fetch categories:', err);
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        icon: category.icon,
        color: category.color,
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: '', icon: '📦', color: '#3b82f6' });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    if (!saving) {
      setModalOpen(false);
      setEditingCategory(null);
      setFormData({ name: '', icon: '', color: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        variant: 'error',
        title: 'Validation Error',
        description: 'Category name is required',
      });
      return;
    }

    try {
      setSaving(true);

      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, formData);
        toast({
          variant: 'success',
          title: 'Category Updated',
          description: 'Category has been updated successfully',
        });
      } else {
        await api.post('/categories', { ...formData, count: 0 });
        toast({
          variant: 'success',
          title: 'Category Created',
          description: 'Category has been created successfully',
        });
      }

      handleCloseModal();
      fetchCategories();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: editingCategory ? 'Update Failed' : 'Create Failed',
        description: err.message || 'Failed to save category',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (category: Category) => {
    setCategoryToDelete(category);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;

    try {
      setDeleting(true);
      await api.delete(`/categories/${categoryToDelete.id}`);

      toast({
        variant: 'success',
        title: 'Category Deleted',
        description: 'Category has been deleted successfully',
      });

      setDeleteModalOpen(false);
      setCategoryToDelete(null);
      fetchCategories();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Delete Failed',
        description: err.message || 'Failed to delete category',
      });
    } finally {
      setDeleting(false);
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
        <p className="text-lg font-semibold">Failed to Load Categories</p>
        <p className="text-sm text-muted-foreground mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Categories</h1>
          <p className="text-muted-foreground mt-1">
            Manage your product catalog structure and organization
          </p>
        </div>
        <Button size="lg" onClick={() => handleOpenModal()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total categories</p>
                <p className="mt-2 text-3xl font-bold">{categories.length}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FolderTree className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Product count</p>
                <p className="mt-2 text-3xl font-bold">{totalProducts}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Package className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active groups</p>
                <p className="mt-2 text-3xl font-bold">{activeCategories}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <p className="text-lg font-semibold">No Categories Yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Get started by creating your first category
              </p>
              <Button className="mt-4" onClick={() => handleOpenModal()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {categories.map((category) => {
            const initial = (category.name || 'C').trim().charAt(0).toUpperCase() || 'C';

            return (
              <Card
                key={category.id}
                className="group h-full border border-border/80 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <CardContent className="flex h-full flex-col justify-between p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold text-foreground shadow-sm"
                        style={{ backgroundColor: `${category.color}20`, border: `1px solid ${category.color}40` }}
                      >
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-base font-semibold leading-6 text-foreground">
                          {category.name}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {category.count} {category.count === 1 ? 'product' : 'products'}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => handleOpenModal(category)}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={`Edit ${category.name}`}
                        title="Edit category"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(category)}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        disabled={category.count > 0}
                        aria-label={`Delete ${category.name}`}
                        title={category.count > 0 ? 'Cannot delete category with products' : 'Delete category'}
                      >
                        <Trash2 className={`h-4 w-4 ${category.count > 0 ? 'opacity-40' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
                    <Badge variant="outline" size="sm">
                      {category.count > 0 ? 'In use' : 'Empty'}
                    </Badge>
                    <span className="max-w-[95px] truncate text-[10px] text-muted-foreground">
                      ID: {category.id.slice(0, 8)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingCategory ? 'Edit Category' : 'Add New Category'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Category Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Electronics"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Icon (Emoji)</label>
            <Input
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              placeholder="📦"
              maxLength={4}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="h-11 w-20 rounded-lg border border-input bg-background p-1"
              />
              <Input
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="#3b82f6"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleCloseModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              <Save className="h-4 w-4 mr-2" />
              {editingCategory ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => !deleting && setDeleteModalOpen(false)}
        title="Delete Category"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{categoryToDelete?.name}</strong>? This action
            cannot be undone.
          </p>
          {categoryToDelete && categoryToDelete.count > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">
                This category has {categoryToDelete.count} product(s). Please reassign or delete
                these products first.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              isLoading={deleting}
              disabled={categoryToDelete ? categoryToDelete.count > 0 : false}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
