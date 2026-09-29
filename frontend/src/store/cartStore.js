import { create } from 'zustand';
import { computeCartTotal } from '../utils/pricing';

const CART_KEY = 'minimart_cart';

const loadCart = () => {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
};

const saveCart = (items) => localStorage.setItem(CART_KEY, JSON.stringify(items));

const getTaxRate = () => {
  try {
    const settings = JSON.parse(localStorage.getItem('minimart_settings') || '{}');
    return (parseFloat(settings.taxRate) || 12) / 100;
  } catch {
    return 0.12;
  }
};

const computeSubtotal = (items) => items.reduce((s, i) => s + (i.sellingPrice || i.price || 0) * i.quantity, 0);

const taxPortion = (items) => {
  const appTaxRate = getTaxRate() * 100;
  const totals = computeCartTotal(items, { appTaxRate });
  return { itemTax: totals.itemTax, total: totals.total };
};

const useCartStore = create((set, get) => ({
  items: loadCart(),

  addItem: (product, quantity = 1) => {
    if (!product || product.id == null) return false;
    const items = [...get().items];
    const stock = product.stockQuantity;
    if (stock == null || stock <= 0) return false;
    const idx = items.findIndex((i) => i.id === product.id);
    if (idx >= 0) {
      const itemStock = items[idx].stockQuantity ?? stock;
      const newQty = items[idx].quantity + quantity;
      if (itemStock != null && newQty > itemStock) {
        return false;
      }
      const currentPrice = parseFloat(product.sellingPrice || product.price || 0);
      const cartPrice = parseFloat(items[idx].sellingPrice || items[idx].price || 0);
      if (currentPrice !== cartPrice) {
        items[idx] = { ...items[idx], quantity: newQty, sellingPrice: currentPrice, price: currentPrice, stockQuantity: stock };
      } else {
        items[idx] = { ...items[idx], quantity: newQty };
      }
    } else {
      if (quantity <= 0 || (stock != null && quantity > stock)) {
        return false;
      }
      items.push({ ...product, quantity, stockQuantity: stock });
    }
    saveCart(items);
    set({ items });
    return true;
  },

  removeItem: (productId) => {
    const items = get().items
      .map((i) => (i.id === productId ? { ...i, quantity: i.quantity - 1 } : i))
      .filter((i) => i.quantity > 0);
    saveCart(items);
    set({ items });
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      const items = get().items.filter((i) => i.id !== productId);
      saveCart(items);
      set({ items });
      return;
    }
    const items = get().items.map((i) => {
      if (i.id !== productId) return i;
      const stock = i.stockQuantity;
      if (quantity <= 0) return i;
      if (stock != null && quantity > stock) return i; // reject over-stock silently; caller (Pos) should guard
      return { ...i, quantity };
    });
    saveCart(items);
    set({ items });
  },

  clearCart: () => {
    saveCart([]);
    set({ items: [] });
  },

  getSubtotal: () => computeSubtotal(get().items),
  getTax: () => taxPortion(get().items).itemTax,
  getTotal: () => taxPortion(get().items).total,
  getItemCount: () => get().items.reduce((s, i) => s + i.quantity, 0),
}));

export default useCartStore;
