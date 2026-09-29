import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PosLayout from '../layouts/PosLayout';
import { useProducts, useCategories, useCustomers } from '../hooks/useApi';
import useCartStore from '../store/cartStore';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Button from '../components/Button';
import { peso, formatDate, useDebounce } from '../utils/helpers';

const EMOJI_DEFAULTS = ['🍪', '🧴', '🎁', '🍷', '📦', '🛒', '🏷️', '💊', '📱', '🎮'];
const COLOR_DEFAULTS = ['#fde68a', '#bae6fd', '#fbcfe8', '#d8b4fe', '#bbf7d0', '#fecaca', '#e9d5ff', '#fed7aa', '#a5f3fc', '#fde047'];

function getCategoryEmoji(cat) {
  if (cat?.emoji) return cat.emoji;
  const slug = cat?.slug || cat?.name?.toLowerCase() || '';
  const map = { foods: '🍪', home: '🧴', gifts: '🎁', liquor: '🍷' };
  return map[slug] || '📦';
}

function getCategoryColor(cat, index) {
  if (cat?.color) return cat.color;
  const slug = cat?.slug || cat?.name?.toLowerCase() || '';
  const map = { foods: '#fde68a', home: '#bae6fd', gifts: '#fbcfe8', liquor: '#d8b4fe' };
  return map[slug] || COLOR_DEFAULTS[index % COLOR_DEFAULTS.length];
}

const HELD_KEY = 'minimart_held';

const loadHeld = () => {
  try { return JSON.parse(localStorage.getItem(HELD_KEY)) || []; }
  catch { return []; }
};

const saveHeld = (list) => localStorage.setItem(HELD_KEY, JSON.stringify(list));

export default function Pos() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState(() => searchParams.get('cat') || 'all');
  const [customerId, setCustomerId] = useState('');
  const [heldTransactions, setHeldTransactions] = useState(loadHeld);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();
  const addItem = useCartStore(s => s.addItem);
  const items = useCartStore(s => s.items);
  const clearCart = useCartStore(s => s.clearCart);
  const updateQuantity = useCartStore(s => s.updateQuantity);
  const removeItem = useCartStore(s => s.removeItem);

  const debouncedQuery = useDebounce(query, 300);

  const { data: catData } = useCategories();
  const categories = catData?.categories || catData?.data?.categories || [];

  const { data: custData } = useCustomers({ limit: 200 });
  const customers = custData?.data?.customers || custData?.customers || [];

  const { data: prodData, isLoading } = useProducts({
    search: debouncedQuery || undefined,
    categoryId: activeTab !== 'all' ? activeTab : undefined,
    limit: 50,
  });

  const products = useMemo(() => {
    const prods = (prodData?.data?.products || prodData?.products || []);
    return prods.sort((a, b) => {
      const aExpired = a.expiryDate && new Date(a.expiryDate) < new Date();
      const bExpired = b.expiryDate && new Date(b.expiryDate) < new Date();
      if (aExpired && !bExpired) return 1;
      if (!aExpired && bExpired) return -1;
      return 0;
    });
  }, [prodData]);

  const isExpired = useCallback((p) => p.expiryDate && new Date(p.expiryDate) < new Date(), []);

  const handleAddProduct = useCallback((p, qty = 1) => {
    if (isExpired(p)) {
      toast.error('Cannot add expired product');
      return;
    }
    if (p.stockQuantity <= 0) {
      toast.error('Out of stock');
      return;
    }
    const cartItem = items.find(i => i.id === p.id);
    const currentQty = cartItem ? cartItem.quantity : 0;
    if (currentQty + qty > p.stockQuantity) {
      toast.error(`Only ${p.stockQuantity - currentQty} left in stock`);
      return;
    }
    addItem({
      id: p.id,
      name: p.name,
      sellingPrice: parseFloat(p.sellingPrice),
      price: parseFloat(p.sellingPrice),
      image: p.image,
      category: p.category,
      taxRate: p.taxRate,
      stockQuantity: p.stockQuantity,
      minStockLevel: p.minStockLevel,
    }, qty);
    if (qty > 1) {
      toast.success(`Added ${p.name} x${qty}`);
    }
  }, [isExpired, items, addItem, toast]);

  const total = useCartStore(s => s.getTotal());
  const subtotal = useCartStore(s => s.getSubtotal());
  const tax = useCartStore(s => s.getTax());

  const holdTransaction = useCallback(() => {
    if (items.length === 0) { toast.error('Cart is empty'); return; }
    const held = { id: Date.now(), items: JSON.parse(JSON.stringify(items)), customerId, timestamp: new Date().toISOString() };
    const updated = [...heldTransactions, held];
    setHeldTransactions(updated);
    saveHeld(updated);
    clearCart();
    setCustomerId('');
    toast.success('Transaction held');
  }, [items, customerId, heldTransactions, clearCart, toast]);

  const recallTransaction = useCallback((heldId) => {
    const held = heldTransactions.find(h => h.id === heldId);
    if (!held) return;
    clearCart();
    const skipped = new Set();
    held.items.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
        const ok = addItem({ ...item, stockQuantity: item.stockQuantity });
        if (!ok) { skipped.add(item.name || 'Item'); break; }
      }
    });
    setCustomerId(held.customerId || '');
    const updated = heldTransactions.filter(h => h.id !== heldId);
    setHeldTransactions(updated);
    saveHeld(updated);
    if (skipped.size > 0) {
      toast.warning(`Skipped out-of-stock items: ${[...skipped].join(', ')}`);
    } else {
      toast.success('Transaction recalled');
    }
  }, [heldTransactions, clearCart, addItem, toast]);

  const getStockColor = useCallback((p) => {
    if (p.stockQuantity <= 0) return 'var(--danger)';
    if (p.minStockLevel && p.stockQuantity <= p.minStockLevel) return 'var(--warning)';
    return 'var(--success)';
  }, []);

  const getCatColor = useCallback((cat, idx) => getCategoryColor(cat, idx), []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const active = document.activeElement;
      const isEditable = active && (['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) || active.isContentEditable);
      if (isEditable && !['F1', 'F4', 'F8', 'Escape'].includes(e.key)) return;

      if (e.key === 'F1') { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === 'F4') { e.preventDefault(); if (items.length > 0) navigate('/payment'); }
      else if (e.key === 'F8') { e.preventDefault(); if (items.length > 0) setShowClearConfirm(true); }
      else if (e.key === 'Escape') { setQuery(''); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items.length, navigate, clearCart]);

  const cartFooter = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 12px 12px' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          onClick={holdTransaction}
          disabled={items.length === 0}
        >
          Hold {heldTransactions.length > 0 && `(${heldTransactions.length})`}
        </Button>
        {heldTransactions.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            fullWidth
            onClick={() => setShowHeldModal(true)}
          >
            Recall ({heldTransactions.length})
          </Button>
        )}
      </div>
      <Button
        variant="danger"
        size="sm"
        fullWidth
        disabled={items.length === 0}
        onClick={() => setShowClearConfirm(true)}
      >
        Clear (F8)
      </Button>
      <Button
        variant="success"
        size="lg"
        fullWidth
        disabled={items.length === 0}
        onClick={() => navigate('/payment')}
      >
        Pay Now {total > 0 && `(${peso(total)})`} (F4)
      </Button>
    </div>
  );

  return (
    <PosLayout active="home" showCart cartFooter={cartFooter}>
      <header className="pos-header">
        <div>
          <h1>MiniMart POS</h1>
          <div className="sub">Point of Sale Terminal</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select
            className="input"
            value={customerId}
            onChange={e => setCustomerId(e.target.value)}
            style={{ maxWidth: 220 }}
          >
            <option value="">Walk-in Customer</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
            ))}
          </select>
          <div className="search">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              ref={searchRef}
              className="input"
              placeholder="Search products... (F1)"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery('')} className="search-clear" aria-label="Clear search">
                ×
              </button>
            )}
          </div>
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="Product categories">
        <button
          role="tab"
          aria-selected={activeTab === 'all'}
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >All Items</button>
        {categories.map(c => (
          <button
            key={c.id}
            role="tab"
            aria-selected={activeTab === String(c.id)}
            className={`tab ${activeTab === String(c.id) ? 'active' : ''}`}
            onClick={() => setActiveTab(String(c.id))}
          >{c.name}</button>
        ))}
      </nav>

      <div className="products" role="list" aria-label="Products">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton skeleton-card" style={{ height: 140 }} role="listitem" />)
        ) : products.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1', padding: 'var(--space-12)' }}>
            <div className="empty-state__icon">📦</div>
            <h3 className="empty-state__title">No products found</h3>
            <p className="empty-state__desc">Try another search or scan a barcode</p>
          </div>
        ) : (
          products.map(p => {
            const catIdx = categories.findIndex(c => c.id === p.category?.id);
            const expired = isExpired(p);
            const outOfStock = p.stockQuantity <= 0;
            const disabled = expired || outOfStock;

            let stockClass = 'stock--ok';
            let stockText = `Stock: ${p.stockQuantity}`;
            if (outOfStock) {
              stockClass = 'stock--out';
              stockText = 'Out of Stock';
            } else if (p.minStockLevel && p.stockQuantity <= p.minStockLevel) {
              stockClass = 'stock--low';
              stockText = `Low Stock: ${p.stockQuantity}`;
            }

            let expiryEl = null;
            if (p.expiryDate) {
              const daysLeft = Math.ceil((new Date(p.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
              if (daysLeft < 0) {
                expiryEl = <span className="expiry expiry--expired">EXPIRED</span>;
              } else if (daysLeft <= 30) {
                expiryEl = <span className="expiry expiry--soon">Exp: {daysLeft}d left</span>;
              } else {
                expiryEl = <span className="expiry expiry--normal" style={{ fontSize: 12 }}>Exp: {formatDate(p.expiryDate)}</span>;
              }
            }

            return (
              <button
                key={p.id}
                className="product"
                onClick={() => handleAddProduct(p)}
                disabled={disabled}
                style={{
                  opacity: disabled ? 0.5 : 1,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  filter: expired ? 'grayscale(0.6)' : 'none'
                }}
                role="listitem"
                aria-disabled={disabled}
                aria-label={`${p.name}, ${peso(p.sellingPrice)}, ${stockText}`}
              >
                <div className="thumb" style={{ backgroundColor: getCatColor(p.category, catIdx >= 0 ? catIdx : 0) }}>
                  {p.image ? <img src={p.image} alt={p.name} loading="lazy" /> : getCategoryEmoji(p.category)}
                </div>
                <div className="info">
                  <div className="name">{p.name}</div>
                  <div className="sku">#{p.sku}</div>
                  {p.category && <div className="category">{p.category.name}</div>}
                  <div className={`stock ${stockClass}`}>{stockText}</div>
                  {expiryEl}
                  <div className="price">{peso(p.sellingPrice)}</div>
                </div>
                {!expired && !outOfStock && (
                  <div className="quick-qty">
                    {[1, 5, 10].map(q => (
                      <span
                        key={q}
                        onClick={(e) => { e.stopPropagation(); handleAddProduct(p, q); }}
                        style={{
                          background: 'var(--primary)', color: 'var(--primary-fg)', borderRadius: 'var(--radius-sm)',
                          padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', lineHeight: '16px',
                          border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >
                        +{q}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      <Modal
        open={showHeldModal}
        onClose={() => setShowHeldModal(false)}
        title="Held Transactions"
        size="lg"
      >
        {heldTransactions.length === 0 ? (
          <p className="empty-state__desc" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>No held transactions</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {heldTransactions.map(h => {
              const itemCount = h.items.reduce((s, i) => s + i.quantity, 0);
              const total = h.items.reduce((s, i) => s + (i.sellingPrice || i.price || 0) * i.quantity, 0);
              const time = new Date(h.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontWeight: 'var(--font-semibold)', fontSize: 'var(--text-sm)' }}>
                      {itemCount} item{itemCount !== 1 ? 's' : ''} — {peso(total)}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)' }}>{time}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="primary" size="sm" onClick={() => { recallTransaction(h.id); setShowHeldModal(false); }}>
                      Recall
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => {
                      const updated = heldTransactions.filter(x => x.id !== h.id);
                      setHeldTransactions(updated);
                      saveHeld(updated);
                      toast.success('Held transaction removed');
                    }}>
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={() => { clearCart(); toast.success('Cart cleared'); }}
        title="Clear Cart"
        message="Remove all items from the cart?"
        confirmLabel="Clear Cart"
        variant="danger"
      />
    </PosLayout>
  );
}