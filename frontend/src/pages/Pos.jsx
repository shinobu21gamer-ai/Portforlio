import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PosLayout from '../layouts/PosLayout';
import { useProducts, useCategories, useCustomers } from '../hooks/useApi';
import useCartStore from '../store/cartStore';
import useAuthStore from '../store/authStore';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Button from '../components/Button';
import { peso, formatDate, useDebounce } from '../utils/helpers';
import AssetImage from '../components/AssetImage';

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

// Held carts auto-expire after this long so a forgotten hold can't be
// recalled weeks later and double-sell a product that has moved on.
const HOLD_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export default function Pos() {
  const user = useAuthStore(s => s.user);
  const HELD_KEY = useMemo(() => `minimart_held_${user?.id || 'guest'}`, [user?.id]);

  const loadHeld = () => {
    try {
      const list = JSON.parse(localStorage.getItem(HELD_KEY)) || [];
      const fresh = list.filter(h => Date.now() - new Date(h.timestamp).getTime() < HOLD_TTL_MS);
      if (fresh.length !== list.length) localStorage.setItem(HELD_KEY, JSON.stringify(fresh));
      return fresh;
    }
    catch { return []; }
  };

  const saveHeld = (list) => localStorage.setItem(HELD_KEY, JSON.stringify(list));
  const isHeldExpired = (h) => Date.now() - new Date(h.timestamp).getTime() >= HOLD_TTL_MS;
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState(() => searchParams.get('cat') || 'all');
  const [customerId, setCustomerId] = useState('');
  const [heldTransactions, setHeldTransactions] = useState(loadHeld);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdReason, setHoldReason] = useState('');
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

  const { data: catData } = useCategories({ limit: 100 });
  const categories = catData?.categories || catData?.data?.categories || [];

  const { data: custData } = useCustomers({ limit: 200 });
  const customers = custData?.data?.customers || custData?.customers || [];

  const { data: prodData, isLoading } = useProducts({
    search: debouncedQuery || undefined,
    categoryId: activeTab !== 'all' ? activeTab : undefined,
    limit: 50,
  });

  // ── Barcode-scanner flow ─────────────────────────────────────────────
  // Scanners type fast (usually 8+ chars in well under a second) and end
  // with Enter. Detect that burst, resolve it as a scan, and add directly —
  // no second Enter or click. A slow Enter still just searches, and with
  // exactly one result it adds that result.
  const scanRef = useRef({ start: 0, last: 0, chars: 0 });
  const pendingScanRef = useRef(null); // scanned value awaiting search results
  const pendingScanTimeoutRef = useRef(null);

  // Focus the search on mount — that covers both page load and the return
  // from /payment after a sale, so the next customer's scan is ready.
  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

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
    if (p.isActive === false) {
      toast.error('Product is inactive');
      return;
    }
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

  // When a scan wasn't resolved against the currently loaded products,
  // resolve it once the search for the scanned value settles.
  useEffect(() => {
    if (isLoading) return;
    if (!pendingScanRef.current) return;
    const scanned = pendingScanRef.current;
    pendingScanRef.current = null;
    if (pendingScanTimeoutRef.current) { clearTimeout(pendingScanTimeoutRef.current); pendingScanTimeoutRef.current = null; }
    const match = products.find(p =>
      (p.barcode && String(p.barcode) === scanned) ||
      (p.sku && String(p.sku).toLowerCase() === scanned.toLowerCase()) ||
      (p.name && p.name.toLowerCase().includes(scanned.toLowerCase()))
    );
    if (match) {
      handleAddProduct(match);
      setQuery('');
      toast.success(`Scanned: ${match.name}`);
    } else if (products.length === 0) {
      toast.error(`No product matches "${scanned}"`);
      setQuery('');
    }
    // multiple ambiguous results stay on screen for a click
  }, [isLoading, products, handleAddProduct, toast]);

  const total = useCartStore(s => s.getTotal());
  const subtotal = useCartStore(s => s.getSubtotal());
  const tax = useCartStore(s => s.getTax());

  const holdTransaction = useCallback((reason) => {
    if (items.length === 0) { toast.error('Cart is empty'); return; }
    const held = {
      id: Date.now(),
      items: JSON.parse(JSON.stringify(items)),
      customerId,
      reason: (reason || '').trim(),
      timestamp: new Date().toISOString(),
    };
    const updated = [...heldTransactions, held];
    setHeldTransactions(updated);
    saveHeld(updated);
    clearCart();
    setCustomerId('');
    setShowHoldModal(false);
    setHoldReason('');
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
          onClick={() => setShowHoldModal(true)}
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
        data-testid="pay-now"
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
          placeholder="Scan barcode or search… (F1)"
          aria-label="Scan barcode or search products"
          value={query}
          onChange={e => {
            // Track keystroke burst: scanners fire 8+ chars in well under
            // a second; humans don't.
            const now = Date.now();
            if (now - scanRef.current.last > 120) {
              scanRef.current.start = now;
              scanRef.current.chars = 1;
            } else {
              scanRef.current.chars += 1;
            }
            scanRef.current.last = now;
            setQuery(e.target.value);
          }}
          onKeyDown={e => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const value = query.trim();
            if (!value) return;

            // Resolve directly against what's already on screen first —
            // also covers re-scanning the same code while it's the query.
            const direct = products.find(p =>
              (p.barcode && String(p.barcode) === value) ||
              (p.sku && String(p.sku).toLowerCase() === value.toLowerCase())
            );
            if (direct) {
              handleAddProduct(direct);
              setQuery('');
              toast.success(`Scanned: ${direct.name}`);
              scanRef.current = { start: 0, last: 0, chars: 0 };
              return;
            }

            const burst =
              scanRef.current.chars >= 8 &&
              Date.now() - scanRef.current.start < 900;
            if (burst) {
              // Fast keystrokes + Enter = scanner. The debounced search
              // will resolve it (effect above adds the match automatically).
              pendingScanRef.current = value;
              if (pendingScanTimeoutRef.current) clearTimeout(pendingScanTimeoutRef.current);
              // Safety: if no search re-fires (e.g. scanned value already
              // was the query), drop the pending scan instead of letting it
              // resolve against an unrelated later search.
              pendingScanTimeoutRef.current = setTimeout(() => { pendingScanRef.current = null; }, 2500);
              scanRef.current = { start: 0, last: 0, chars: 0 };
              return;
            }

            // Slow typing: Enter with exactly one result adds it.
            if (products.length === 1) {
              handleAddProduct(products[0]);
              setQuery('');
            }
          }}
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

      <div className="pos-hintbar" role="note" aria-label="Keyboard shortcuts">
        <span><kbd>F1</kbd> Scan / Search</span>
        <span><kbd>Enter</kbd> Add (single result)</span>
        <span><kbd>F4</kbd> Checkout</span>
        <span><kbd>F8</kbd> Clear</span>
        <span><kbd>Esc</kbd> Clear search</span>
      </div>

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
                data-testid="product-card"
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
                  <AssetImage
                    src={p.image}
                    alt={p.name}
                    loading="lazy"
                    fallback={getCategoryEmoji(p.category)}
                  />
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
              const heldDate = new Date(h.timestamp);
              const time = heldDate.toLocaleString('en-PH', { hour: '2-digit', minute: '2-digit' });
              const ageHrs = Math.floor((Date.now() - heldDate.getTime()) / (60 * 60 * 1000));
              const age = ageHrs >= 24 ? `${Math.floor(ageHrs / 24)}d ${ageHrs % 24}h` : ageHrs >= 1 ? `${ageHrs}h` : `${Math.max(1, Math.floor((Date.now() - heldDate.getTime()) / 60000))}m`;
              const expired = isHeldExpired(h);
              return (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', opacity: expired ? 0.6 : 1 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 'var(--font-semibold)', fontSize: 'var(--text-sm)' }}>
                      {itemCount} item{itemCount !== 1 ? 's' : ''} — {peso(total)}
                      {expired && <span style={{ color: 'var(--danger)', marginLeft: 8, fontSize: 'var(--text-xs)', fontWeight: 700 }}>EXPIRED</span>}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)' }}>
                      {time} · held {age} ago{h.reason ? <span> · “{h.reason}”</span> : null}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="primary" size="sm" disabled={expired} onClick={() => { recallTransaction(h.id); setShowHeldModal(false); }}>
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

      <Modal
        open={showHoldModal}
        onClose={() => setShowHoldModal(false)}
        title="Hold Transaction"
        size="sm"
      >
        <p style={{ margin: '0 0 12px', color: 'var(--fg-secondary)', fontSize: 'var(--text-sm)' }}>
          The cart ({items.length} item{items.length !== 1 ? 's' : ''}) is set aside and can be recalled later. Held carts expire after 12 hours.
        </p>
        <label htmlFor="hold-reason" style={{ display: 'block', marginBottom: '6px', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
          Reason <span style={{ color: 'var(--fg-tertiary)', fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          id="hold-reason"
          className="input"
          placeholder='e.g. "Customer stepping out to pay"'
          value={holdReason}
          maxLength={80}
          onChange={e => setHoldReason(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') holdTransaction(holdReason); }}
          autoFocus
        />
        <div className="modal__footer" style={{ paddingTop: 'var(--space-5)', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowHoldModal(false); setHoldReason(''); }}>Cancel</Button>
          <Button variant="primary" onClick={() => holdTransaction(holdReason)}>Hold Cart</Button>
        </div>
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