import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import PosLayout from '../layouts/PosLayout';
import { useCategories } from '../hooks/useApi';
import { useToast } from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import Modal from '../components/Modal';
import api from '../api/client';

const EMOJI = { beverages: '🥤', snacks: '🍿', 'canned-goods': '🥫', dairy: '🥛', bakery: '🍞', household: '🧹', 'personal-care': '🧴', 'frozen-foods': '🧊' };
const COLORS = { beverages: '#dbeafe', snacks: '#fef3c7', 'canned-goods': '#fee2e2', dairy: '#e0f2fe', bakery: '#fef9c3', household: '#d1fae5', 'personal-care': '#ede9fe', 'frozen-foods': '#cffafe' };
const EMOJI_FALLBACK = ['🍪', '🧴', '🎁', '🍷', '🧃', '🧹', '📦', '🛍️'];

const toKebab = (str) =>
  str.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

export default function Categories() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useCategories();
  const categories = data?.categories || data?.data?.categories || [];

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/categories', d).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      closeModal();
      toast.success('Category created');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create category'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }) => api.put(`/categories/${id}`, d).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      closeModal();
      toast.success('Category updated');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update category'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/categories/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category deleted');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete category'),
  });

  const openAddModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '' });
    setShowAddModal(true);
  };

  const openEditModal = (e, cat) => {
    e.stopPropagation();
    setEditingCategory(cat);
    setFormData({ name: cat.name, description: cat.description || '' });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingCategory(null);
    setFormData({ name: '', description: '' });
  };

  const handleDelete = (e, cat) => {
    e.stopPropagation();
    setDeleteConfirm(cat);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) return;
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getEmoji = (slug, idx) => EMOJI[slug] || EMOJI_FALLBACK[idx % EMOJI_FALLBACK.length];
  const getColor = (slug) => COLORS[slug] || '#f5f5f5';

  return (
    <PosLayout active="categories">
      <header className="pos-header">
        <div>
          <h1>Categories</h1>
          <div className="sub">{categories.length} categories</div>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>+ Add Category</button>
      </header>

      {isLoading ? (
        <LoadingSkeleton type="cards" />
      ) : categories.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📂</div>
          <h3>No categories yet</h3>
          <p className="text-muted mt-sm">Add your first category to organize products.</p>
          <button className="btn btn-primary mt-md" onClick={openAddModal}>+ Add Category</button>
        </div>
      ) : (
        <div className="cat-grid">
          {categories.map((c, idx) => (
            <div
              key={c.id}
              className="cat-card"
              style={{ background: getColor(c.slug) }}
              onClick={() => navigate(`/?cat=${c.id}`)}
            >
              <div className="cat-card-actions">
                <button className="btn-icon" onClick={(e) => openEditModal(e, c)} title="Edit">✏️</button>
                <button className="btn-icon" onClick={(e) => handleDelete(e, c)} title="Delete">🗑️</button>
              </div>
              <div className="cat-emoji">{getEmoji(c.slug, idx)}</div>
              <div>
                <div className="cat-label">{c.name}</div>
                <div className="cat-count">{c.description || 'No description'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showAddModal}
        onClose={closeModal}
        title={editingCategory ? 'Edit Category' : 'New Category'}
      >
        <div className="field">
          <label>Category Name</label>
          <input
            className="input-block"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Beverages, Snacks..."
            autoFocus
          />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea
            className="input-block"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Optional description for this category"
            rows={3}
            style={{ borderRadius: 12, resize: 'vertical' }}
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!formData.name.trim() || createMutation.isPending || updateMutation.isPending}
          >
            {(createMutation.isPending || updateMutation.isPending) && <span className="btn-spinner" />}
            {createMutation.isPending || updateMutation.isPending
              ? 'Saving...'
              : editingCategory ? 'Update Category' : 'Create Category'}
          </button>
        </div>
      </Modal>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Category">
        <p className="mb-md">Are you sure you want to delete <strong>"{deleteConfirm?.name}"</strong>? This cannot be undone.</p>
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={confirmDelete} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </PosLayout>
  );
}
