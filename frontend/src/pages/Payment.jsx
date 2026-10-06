import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PosLayout from '../layouts/PosLayout';
import useCartStore from '../store/cartStore';
import useAuthStore from '../store/authStore';
import { useCreateSale, useCreatePendingSale, useCreateCheckout, useVerifyPayment, useCancelPendingSale, useCustomers, useSettings, useValidateDiscount, useDiscounts } from '../hooks/useApi';
import { useToast } from '../components/Toast';
import { peso, useDebounce } from '../utils/helpers';
import { computeCartTotal } from '../utils/pricing';
import api from '../api/client';
import {
  buildReceiptModel,
  renderReceiptHtml,
  printHtmlDocument,
  printNodeInPage,
  formatReceiptDate,
  methodLabel,
} from '../utils/receipt';

// The online checkout redirects away from the SPA, so everything needed to
// rebuild the slip (invoice, lines, totals) is parked in sessionStorage before
// the jump. It is the receipt's last line of defence when the verify response
// comes back thin.
const PENDING_KEY = 'pendingOnlineSale';
const readPendingSnapshot = () => {
  try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || '{}') || {}; } catch { return {}; }
};

export default function Payment({ success: successProp, cancel: cancelProp }) {
  const [searchParams] = useSearchParams();
  const saleIdParam = searchParams.get('saleId');
  const sessionIdParam = searchParams.get('session_id');

  const [method, setMethod] = useState(null);
  const [cashAmount, setCashAmount] = useState('');
  const [selectedWallet, setSelectedWallet] = useState(null);
  // Split tender: 2-6 legs, each { method, amount }. Completed at the
  // register (mixed legs are not routed through the online gateway).
  const [splitLegs, setSplitLegs] = useState([
    { method: 'cash', amount: '' },
    { method: 'gcash', amount: '' },
  ]);
  const [customerId, setCustomerId] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFailure, setShowFailure] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saleResult, setSaleResult] = useState(null);
  const [onlineLoading, setOnlineLoading] = useState(false);

  // Per-cashier auto-print preference. Defaults ON: a register prints a slip
  // for every sale, and the cashier who wants it off opts out on the receipt.
  const [autoPrint, setAutoPrint] = useState(() => {
    try { return localStorage.getItem('minimart_autoprint') !== '0'; } catch { return true; }
  });
  const setAutoPrintPref = (v) => {
    setAutoPrint(v);
    try { localStorage.setItem('minimart_autoprint', v ? '1' : '0'); } catch {}
  };

  // Countdown shown while we poll for an online payment, so the cashier is
  // never staring at a spinner wondering how long "a few seconds" is.
  const [waitSecondsLeft, setWaitSecondsLeft] = useState(20);
  const [cashOverrideLoading, setCashOverrideLoading] = useState(false);

  const [discountType, setDiscountType] = useState('none');
  const [discountValue, setDiscountValue] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const navigate = useNavigate();
  const toast = useToast();
  const items = useCartStore(s => s.items);
  const storeSubtotal = useCartStore(s => s.getSubtotal());
  const clearCart = useCartStore(s => s.clearCart);
  const addItem = useCartStore(s => s.addItem);
  const user = useAuthStore(s => s.user);
  // Mirrors saleService.canApplyManualDiscount: the server rejects manual
  // discounts for anyone below manager, so don't offer the option at all.
  const canManualDiscount = user?.role?.slug === 'admin' || user?.role?.slug === 'manager';

  const debouncedCustomerSearch = useDebounce(customerSearch, 300);
  const { data: customersData } = useCustomers({ search: debouncedCustomerSearch || undefined });
  const customerList = customersData?.data?.customers || customersData?.customers || [];

  const createSale = useCreateSale();
  const createPendingSale = useCreatePendingSale();
  const createCheckout = useCreateCheckout();
  const cancelPendingSale = useCancelPendingSale();
  const { data: settings } = useSettings();
  const validateDiscount = useValidateDiscount();
  const { data: discountsData } = useDiscounts({ limit: 100, isActive: true });
  const availableDiscounts = discountsData?.data?.discounts || [];

  const pendingSaleRef = useRef(null);
  // The cart store updates synchronously when cleared, while React may render
  // before the receipt state updates. Prevent the empty-cart redirect from
  // racing a completed cash sale and sending the cashier back to the POS.
  const completedSaleRef = useRef(false);

  const { data: verifyData, isLoading: verifyLoading, error: verifyError } = useVerifyPayment(saleIdParam, sessionIdParam, {
    enabled: !!successProp && !!saleIdParam && !!sessionIdParam && !showSuccess,
    refetchInterval: (query) => {
      if (query.state.data?.verified) return false;
      if (query.state.error) return 5000;
      return 3000;
    },
  });

  const taxRate = parseFloat(settings?.taxRate) || 12;

  const cartTotals = computeCartTotal(items, {
    discountType: discountType !== 'none' ? discountType : 'none',
    discountValue: discountType !== 'none' ? parseFloat(discountValue) || 0 : 0,
    maxDiscountAmount: promoApplied?.maxDiscountAmount ?? null,
    appTaxRate: taxRate,
  });
  const discountAmount = cartTotals.discount;
  const tax = cartTotals.itemTax;
  const total = cartTotals.total;

  useEffect(() => {
    if (items.length === 0 && !showSuccess && !successProp && !cancelProp && !completedSaleRef.current) {
      navigate('/');
    }
  }, [items.length, showSuccess, successProp, cancelProp, navigate]);

  useEffect(() => {
    if (successProp && saleIdParam && verifyData?.verified) {
      setSaleResult(verifyData);
      clearCart();
      sessionStorage.removeItem(PENDING_KEY);
      setShowSuccess(true);
      toast.success('Online payment confirmed!');
      // An online order gets the same slip as a counter sale.
      if (autoPrint) setTimeout(() => { printReceipt(); }, 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [successProp, saleIdParam, verifyData, clearCart, toast]);

  const verifyDataRef = useRef(verifyData);
  verifyDataRef.current = verifyData;

  // ── Receipt data ────────────────────────────────────────────────────────
  // Captured once, before anything clears sessionStorage: the gateway redirect
  // wipes the cart, so this snapshot is what keeps an online receipt from
  // rendering empty if the verify payload comes back thin.
  const snapshotRef = useRef(null);
  if (snapshotRef.current === null) snapshotRef.current = readPendingSnapshot();

  // Re-fetched sale used when the payload we were handed has no lines on it.
  const [saleFetch, setSaleFetch] = useState(null);
  const [saleFetchState, setSaleFetchState] = useState('idle'); // idle | loading | done | failed

  const snapshot = useMemo(() => {
    const snap = snapshotRef.current;
    if (!snap || (!snap.saleId && !snap.invoiceNo)) return null;
    const snapId = String(snap.saleId || '');
    // Only trust a snapshot that belongs to the sale on screen — a stale one
    // from an abandoned checkout must never leak into another receipt.
    if (snapId && saleIdParam && snapId === String(saleIdParam)) return snap;
    if (snapId && saleResult?.id && snapId === String(saleResult.id)) return snap;
    if (successProp && !saleResult) return snap;
    return null;
  }, [saleIdParam, saleResult, successProp]);

  const receiptModel = useMemo(() => buildReceiptModel({
    sale: saleFetch || saleResult,
    snapshot,
    // The cart is cleared the moment a sale completes, so its numbers are only
    // usable while it still has lines in it.
    cartItems: items.length ? items : null,
    cart: items.length ? cartTotals : null,
    method: method || undefined,
    cashAmount,
    settings,
    customer: customerList.find(c => c.id === customerId) || null,
    cashier: user,
  }), [saleFetch, saleResult, snapshot, items, cartTotals, method, cashAmount, settings, customerList, customerId, user]);

  const receiptModelRef = useRef(receiptModel);
  receiptModelRef.current = receiptModel;

  const saleIdForReceipt = saleResult?.id || saleFetch?.id || saleIdParam || receiptModel.saleId;

  // Last resort: we know which sale this is but were handed no lines (a thin
  // verify response, a restored session). Pull the full sale so the slip — and
  // the printout — actually has something on it.
  useEffect(() => {
    if (!showSuccess || receiptModel.hasData || !saleIdForReceipt) return;
    if (saleFetchState !== 'idle') return;
    let cancelled = false;
    setSaleFetchState('loading');
    api.get(`/sales/${saleIdForReceipt}`)
      .then((res) => {
        const sale = res.data?.data;
        if (!cancelled && sale) setSaleFetch(sale);
      })
      .catch(() => { /* keep whatever fallback data we have */ })
      .finally(() => { if (!cancelled) setSaleFetchState('done'); });
    return () => { cancelled = true; };
  }, [showSuccess, receiptModel.hasData, saleIdForReceipt, saleFetchState]);

  // Print a self-contained 80mm document in a hidden frame. This is what makes
  // the paper match the screen: the old in-page window.print() depended on the
  // app's layout (overflow:hidden shell, an animation transform on the receipt
  // card) and on print CSS that could hide the slip entirely — the printer then
  // produced a blank sheet. Falls back to the in-page portal print.
  const printReceipt = useCallback(async () => {
    const html = renderReceiptHtml(receiptModelRef.current);
    const printed = await printHtmlDocument(html);
    if (!printed) printNodeInPage('receipt-print-area');
    return printed;
  }, []);

  const downloadReceiptHtml = useCallback(() => {
    const model = receiptModelRef.current;
    if (!model.hasData) { toast.error('No receipt data to save'); return; }
    const html = renderReceiptHtml(model, { autoPrint: true });
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${String(model.invoiceNo || 'sale').replace(/[^A-Za-z0-9-]/g, '')}-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [toast]);

  // Manager/admin escape hatch: the online payment never confirmed but the
  // customer is at the counter with cash. Completes the pending sale as a
  // cash sale server-side (stock was already reserved at pending creation).
  const handleCashOverride = async () => {
    if (!saleIdParam) return;
    if (!window.confirm('The online payment never confirmed.\n\nComplete this sale with CASH paid at the counter?\nThe sale will be recorded as a CASH sale (it counts to your open shift\'s till).')) return;
    setCashOverrideLoading(true);
    try {
      const res = await api.post(`/sales/pending/${saleIdParam}/cash-complete`);
      const sale = res.data?.data || {};
      setSaleResult({ ...sale, paymentMethod: 'cash', cashAmount: sale.total });
      clearCart();
      sessionStorage.removeItem(PENDING_KEY);
      setShowSuccess(true);
      toast.success('Sale completed as cash at the counter.');
      if (autoPrint) setTimeout(() => { printReceipt(); }, 400);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cash override failed');
    } finally {
      setCashOverrideLoading(false);
    }
  };

  const WAIT_TIMEOUT_MS = 20000;
  useEffect(() => {
    if (!successProp || !saleIdParam || showSuccess) {
      setWaitSecondsLeft(WAIT_TIMEOUT_MS / 1000);
      return undefined;
    }
    const startedAt = Date.now();
    setWaitSecondsLeft(WAIT_TIMEOUT_MS / 1000);
    const timer = setTimeout(() => {
      if (!verifyDataRef.current?.verified) {
        setShowFailure(true);
      }
    }, WAIT_TIMEOUT_MS);
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((WAIT_TIMEOUT_MS - (Date.now() - startedAt)) / 1000));
      setWaitSecondsLeft(left);
    }, 250);
    return () => { clearTimeout(timer); clearInterval(tick); };
  }, [successProp, saleIdParam, showSuccess]);

  useEffect(() => {
    if (cancelProp && saleIdParam) {
      const stored = snapshotRef.current || readPendingSnapshot();
      cancelPendingSale.mutate(saleIdParam, { onSettled: () => {} });
      if (Array.isArray(stored.cartItems) && stored.cartItems.length > 0) {
        stored.cartItems.forEach(ci => addItem(ci, ci.quantity || 1));
        toast.info('Cart restored.');
      }
      sessionStorage.removeItem(PENDING_KEY);
      toast.info('Payment was cancelled. Returning...');
      setTimeout(() => {
        if (window.top !== window) {
          window.top.location.href = import.meta.env.VITE_HRMS_URL || `${window.location.origin}/hrms`;
        } else {
          navigate('/');
        }
      }, 2000);
    }
  }, [cancelProp, saleIdParam, navigate, toast, cancelPendingSale, addItem]);

  if (items.length === 0 && !showSuccess && !successProp && !cancelProp) {
    return null;
  }

  if (successProp && saleIdParam && showFailure && !showSuccess) {
    return (
      <PosLayout active="home">
        <div className="flex-center" style={{ minHeight: '60vh' }}>
          <div className="text-center" style={{ maxWidth: 440 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
            <p className="font-bold mb-sm" style={{ fontSize: 18 }}>We couldn't confirm your payment yet.</p>
            <p className="text-sm text-muted mb-md">Check your email for the receipt, or try again.</p>
            <div className="flex-gap justify-center">
              <button className="btn btn-primary" onClick={() => setShowFailure(false)}>Try Again</button>
              <button className="btn btn-outline" onClick={() => navigate('/')}>Back to POS</button>
            </div>
          </div>
        </div>
      </PosLayout>
    );
  }

  if (successProp && saleIdParam && !showSuccess) {
    return (
      <PosLayout active="home">
        <div className="flex-center" style={{ minHeight: '60vh' }}>
          <div className="text-center" style={{ maxWidth: 420, padding: '0 16px' }}>
            <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
            <p className="font-bold mb-sm" style={{ fontSize: 16 }}>Waiting for payment confirmation...</p>
            <p className="text-sm text-muted">
              This may take a few seconds. Please do not close this page.
              <br />
              <span style={{ fontVariantNumeric: 'tabular-nums', color: waitSecondsLeft <= 5 ? 'var(--danger)' : undefined }}>
                {waitSecondsLeft}s remaining before this times out.
              </span>
            </p>
            {canManualDiscount && (
              <div style={{ marginTop: 20, padding: 14, background: 'var(--bg-tertiary)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
                <p className="text-sm mb-sm" style={{ margin: 0 }}>
                  <strong>Manager override:</strong> the online payment never confirmed. If the customer is paying with cash at the counter, complete the sale as cash — it will be recorded as a CASH sale.
                </p>
                <button
                  className="btn btn-warning"
                  data-testid="cash-override"
                  disabled={cashOverrideLoading}
                  onClick={handleCashOverride}
                >
                  {cashOverrideLoading && <span className="btn-spinner" />}
                  {cashOverrideLoading ? 'Completing…' : 'Record cash & complete sale'}
                </button>
              </div>
            )}
          </div>
        </div>
      </PosLayout>
    );
  }

  const selectedCustomer = customerList.find(c => c.id === customerId);

  const getPaymentMethod = () => {
    if (method === 'cash') return 'cash';
    if (method === 'split') return 'split';
    if (method === 'ewallet') return selectedWallet === 'GCash' ? 'gcash' : 'maya';
    return 'cash';
  };

  const SPLIT_METHODS = [
    { value: 'cash', label: 'Cash' },
    { value: 'gcash', label: 'GCash' },
    { value: 'maya', label: 'Maya' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'debit_card', label: 'Debit Card' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'other', label: 'Other' },
  ];
  const splitFilled = splitLegs.map(l => ({ ...l, num: parseFloat(l.amount) || 0 }));
  const splitCollected = splitFilled.reduce((s, l) => s + l.num, 0);
  const splitRemaining = Math.round((total - splitCollected) * 100) / 100;
  const splitValid = splitFilled.length >= 2
    && splitFilled.every(l => l.num > 0)
    && splitRemaining === 0;

  const updateSplitLeg = (idx, field, value) => {
    setSplitLegs(prev => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };
  const addSplitLeg = () => {
    if (splitLegs.length >= 6) return;
    setSplitLegs(prev => [...prev, { method: 'cash', amount: '' }]);
  };
  const removeSplitLeg = (idx) => {
    if (splitLegs.length <= 2) return;
    setSplitLegs(prev => prev.filter((_, i) => i !== idx));
  };
  const applyRemainingToLast = () => {
    if (splitRemaining <= 0) return;
    setSplitLegs(prev => prev.map((l, i) => (i === prev.length - 1
      ? { ...l, amount: String(Math.round(((parseFloat(l.amount) || 0) + splitRemaining) * 100) / 100) }
      : l)));
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) { toast.error('Enter a promo code'); return; }
    try {
      const result = await validateDiscount.mutateAsync({ code: promoCode.trim(), subtotal: storeSubtotal });
      setPromoApplied(result.discount);
      setDiscountType(result.discount.type);
      setDiscountValue(String(result.discount.value));
      toast.success(`Promo "${result.discount.code}" applied! -${peso(result.discountAmount)}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid promo code');
    }
  };

  const handleRemovePromo = () => {
    setPromoCode('');
    setPromoApplied(null);
    setDiscountType('none');
    setDiscountValue('');
  };

  const handleOnlinePayment = async () => {
    if (items.length === 0) { toast.error('Cart is empty'); return; }
    setOnlineLoading(true);
    try {
      const paymentMethod = selectedWallet === 'GCash' ? 'gcash' : 'maya';
      const saleData = {
        items: items.map(i => ({ productId: i.id, quantity: i.quantity })),
        paymentMethod,
        customerId: customerId || undefined,
        discountType: discountType !== 'none' ? discountType : undefined,
        discountValue: discountType !== 'none' ? parseFloat(discountValue) || 0 : undefined,
        discountId: promoApplied?.id || undefined,
      };

      const pendingSale = await createPendingSale.mutateAsync(saleData);
      const saleId = pendingSale.id;
      pendingSaleRef.current = saleId;

      // Everything the receipt needs to rebuild itself after the gateway
      // redirect (which wipes the cart and this component's state).
      const snapCustomer = customerList.find(c => c.id === customerId);
      const pendingSnapshot = {
        saleId,
        invoiceNo: pendingSale.invoiceNo,
        total: pendingSale.total,
        subtotal: pendingSale.subtotal,
        tax: pendingSale.taxAmount,
        discount: pendingSale.discountAmount,
        paymentMethod,
        items: pendingSale.items || [],
        customerName: pendingSale.customer
          ? `${pendingSale.customer.firstName || ''} ${pendingSale.customer.lastName || ''}`.trim()
          : `${snapCustomer?.firstName || ''} ${snapCustomer?.lastName || ''}`.trim(),
        createdAt: pendingSale.createdAt || new Date().toISOString(),
      };
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(pendingSnapshot));
      snapshotRef.current = pendingSnapshot;

      const checkoutData = {
        amount: pendingSale.total,
        description: `MiniMart POS - ${pendingSale.invoiceNo} (${selectedWallet})`,
        items: (() => {
          const subtotal = pendingSale.subtotal || storeSubtotal || 0;
          const taxAmt = pendingSale.taxAmount || 0;
          const discAmt = pendingSale.discountAmount || 0;
          const total = pendingSale.total || 0;
          return items.map(i => {
            const lineBase = (i.sellingPrice || i.price || 0) * i.quantity;
            const proportionalTax = subtotal > 0 ? (lineBase / subtotal) * taxAmt : 0;
            const proportionalDisc = subtotal > 0 ? (lineBase / subtotal) * discAmt : 0;
            const lineTotal = lineBase + proportionalTax - proportionalDisc;
            const unitAmount = i.quantity > 0 ? Math.round((lineTotal / i.quantity) * 100) / 100 : 0;
            return { name: i.name, amount: unitAmount, quantity: i.quantity };
          });
        })(),
        saleId: saleId,
      };

      const checkout = await createCheckout.mutateAsync(checkoutData);
      if (checkout.checkoutUrl) {
        const pendingSaleData = { ...(snapshotRef.current || {}), cartItems: items };
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(pendingSaleData));
        snapshotRef.current = pendingSaleData;
        pendingSaleRef.current = null;
        clearCart();
        const target = window.top || window;
        target.location.href = checkout.checkoutUrl;
      } else {
        toast.error('Failed to create checkout session');
      }
    } catch (err) {
      if (pendingSaleRef.current) {
        cancelPendingSale.mutate(pendingSaleRef.current, { onSettled: () => {} });
        pendingSaleRef.current = null;
        sessionStorage.removeItem(PENDING_KEY);
        toast.info('Pending order cancelled.');
      }
      toast.error(err.response?.data?.message || err.message || 'Online payment failed');
    } finally {
      setOnlineLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const paymentMethod = getPaymentMethod();
      const cashLegs = method === 'split'
        ? splitFilled.filter(l => l.method === 'cash').reduce((s, l) => s + l.num, 0)
        : (method === 'cash' ? parseFloat(cashAmount) : undefined);
      const saleData = {
        items: items.map(i => ({ productId: i.id, quantity: i.quantity })),
        paymentMethod,
        cashAmount: method === 'split' && cashLegs ? cashLegs : (method === 'cash' ? parseFloat(cashAmount) : undefined),
        payments: method === 'split'
          ? splitFilled.map(l => ({ paymentMethod: l.method, amount: l.num }))
          : undefined,
        customerId: customerId || undefined,
        discountType: discountType !== 'none' ? discountType : undefined,
        discountValue: discountType !== 'none' ? parseFloat(discountValue) || 0 : undefined,
        discountId: promoApplied?.id || undefined,
      };

      const result = await createSale.mutateAsync(saleData);
      completedSaleRef.current = true;
      setSaleResult(result);
      clearCart();
      setShowSuccess(true);
      toast.success('Sale completed successfully!');
      // Print a self-contained 80mm document (see utils/receipt.js). A
      // window.open popup here was routinely eaten by popup blockers, and the
      // old in-page window.print() produced blank sheets whenever the app's
      // layout or print CSS got in the way.
      if (autoPrint) {
        setTimeout(() => { printReceipt(); }, 400);
      }
    } catch (err) {
      // A dropped connection is not the same as a rejected sale: the request may
      // well have succeeded server-side and only the response was lost. Saying
      // "Sale failed" there invites the cashier to press Pay again and create a
      // duplicate sale, so call that case out explicitly and keep the cart.
      const isNetworkError = !err.response;
      toast.error(
        isNetworkError
          ? 'Connection lost — could not confirm the sale. Check the receipt/reports before retrying, as it may still have been saved.'
          : (err.response?.data?.message || 'Sale could not be completed')
      );
    } finally {
      setLoading(false);
    }
  };

  if (showSuccess) {
    // One model feeds the screen, the printer and the download, so the slip
    // that comes out of the printer can never disagree with (or be emptier
    // than) what the cashier sees.
    const m = receiptModel;
    const store = m.store;
    const loadingReceipt = saleFetchState === 'loading';

    return (
      <PosLayout active="home">
        <div className="flex-center" style={{ minHeight: '60vh' }}>
          <div className="receipt-wrap">
            <div className="success-circle no-print"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
            <p className="success-text no-print">Payment Success</p>

            <div id="receipt-print-area" data-testid="receipt" className="mt-md text-sm pay-order-summary receipt-80mm">
              <div className="receipt-store text-center font-bold">{store.name}</div>
              {store.header && <div className="receipt-meta-line text-center">{store.header}</div>}
              {store.address && <div className="receipt-meta-line text-center">{store.address}</div>}
              {store.phone && <div className="receipt-meta-line text-center">Tel: {store.phone}</div>}
              {(store.gcashNumber || store.mayaNumber) && (
                <div className="receipt-meta-line text-center">
                  {store.gcashNumber && <span>GCash: {store.gcashNumber}</span>}
                  {store.gcashNumber && store.mayaNumber && <span> · </span>}
                  {store.mayaNumber && <span>Maya: {store.mayaNumber}</span>}
                </div>
              )}

              <div className="receipt-rule" />

              <div className="receipt-header">
                <div className="receipt-date">{formatReceiptDate(m.date)}</div>
                <div className="receipt-invoice" data-testid="receipt-invoice">
                  Invoice: <strong>{m.invoiceNo}</strong>
                </div>
              </div>
              <div className="receipt-meta-line">Customer: {m.customerName || 'Walk-in'}</div>
              {m.cashierName && <div className="receipt-meta-line">Cashier: {m.cashierName}</div>}

              <div className="receipt-items-wrap" data-testid="receipt-items">
                {m.items.length === 0 ? (
                  <div className="receipt-empty">
                    {loadingReceipt ? 'Loading receipt…' : 'No items recorded'}
                  </div>
                ) : m.items.map((item, idx) => (
                  <div key={idx} className="receipt-row">
                    <span className="receipt-item-name">{item.name} × {item.qty}</span>
                    <span className="receipt-item-amount">{peso(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="receipt-totals">
                <div className="pay-summary-row"><span>Subtotal</span><span>{peso(m.subtotal)}</span></div>
                {m.discount > 0 && (
                  <div className="pay-summary-row text-error"><span>Discount</span><span>-{peso(m.discount)}</span></div>
                )}
                <div className="pay-summary-row"><span>{store.taxLabel}</span><span>{peso(m.tax)}</span></div>
                {m.shipping > 0 && (
                  <div className="pay-summary-row"><span>Shipping</span><span>{peso(m.shipping)}</span></div>
                )}
                <div className="pay-summary-total" data-testid="receipt-total"><span>Total</span><span>{peso(m.total)}</span></div>
              </div>

              <div className="receipt-footer">
                {m.isSplit && m.payments.length > 0 ? (
                  <>
                    <div className="flex-between"><span>Payment</span><span>Split ({m.payments.length})</span></div>
                    {m.payments.map((p, i) => (
                      <div className="flex-between" key={i}><span>{methodLabel(p.method)}</span><span>{peso(p.amount)}</span></div>
                    ))}
                  </>
                ) : (
                  <div className="flex-between" data-testid="receipt-payment"><span>Payment</span><span>{methodLabel(m.paymentMethod)}</span></div>
                )}
                {m.isCash && (
                  <>
                    <div className="flex-between"><span>Tendered</span><span>{peso(m.tendered)}</span></div>
                    <div className="flex-between font-bold" data-testid="receipt-change"><span>Change</span><span>{peso(m.change)}</span></div>
                  </>
                )}
                {m.reference && <div className="flex-between"><span>Ref</span><span>{String(m.reference).slice(0, 18)}</span></div>}
              </div>

              <div className="receipt-rule" />
              <div className="receipt-thanks text-center">
                {store.footer}
                <div className="receipt-proof">This receipt serves as your official proof of purchase.</div>
              </div>
            </div>

            {!m.hasData && !loadingReceipt && (
              <p className="text-sm no-print" style={{ marginTop: 10, color: 'var(--danger)' }}>
                This sale was recorded but its details could not be loaded. Use “Reload details” before printing.
              </p>
            )}

            <div className="receipt-actions no-print">
              {window.top !== window ? (
                <button className="btn btn-success" onClick={() => { window.top.location.href = import.meta.env.VITE_HRMS_URL || `${window.location.origin}/hrms`; }}>Back to HRMS</button>
              ) : (
                <button className="btn btn-success" onClick={() => navigate('/')}>Next Sale</button>
              )}
              <button className="btn btn-outline" data-testid="print-receipt" onClick={() => { printReceipt(); }}>Print Receipt</button>
              <button className="btn btn-outline" onClick={downloadReceiptHtml}>Download HTML</button>
              {!m.hasData && saleIdForReceipt && (
                <button
                  className="btn btn-outline"
                  disabled={loadingReceipt}
                  onClick={() => { setSaleFetchState('idle'); setSaleFetch(null); }}
                >
                  {loadingReceipt ? 'Loading…' : 'Reload details'}
                </button>
              )}
              <label className="flex-between" style={{ width: '100%', gap: 8, cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)' }}>
                <span>Auto-print receipt after each sale</span>
                <input type="checkbox" checked={autoPrint} onChange={e => setAutoPrintPref(e.target.checked)} aria-label="Auto-print receipt after each sale" />
              </label>
            </div>
          </div>
        </div>
      </PosLayout>
    );
  }

  return (
    <PosLayout active="home">
      <span className="back-link" onClick={() => navigate('/')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back
      </span>
      <h1 className="text-sm" style={{ fontSize: 28, fontWeight: 800, margin: '0 0 24px' }}>Payment</h1>

      <div className="pay-section">
        <div className="pay-section-title">Customer</div>
        <div className="pay-customer-wrap">
          <input
            className="input-block"
            placeholder="Search customer or leave blank for Walk-in..."
            value={showCustomerDropdown ? customerSearch : ((selectedCustomer?.firstName || selectedCustomer?.lastName) ? `${selectedCustomer.firstName || ''} ${selectedCustomer.lastName || ''}`.trim() : customerSearch)}
            onChange={e => {
              setCustomerSearch(e.target.value);
              setShowCustomerDropdown(true);
              if (customerId) { setCustomerId(null); }
            }}
            onFocus={() => setShowCustomerDropdown(true)}
          />
          {customerSearch && showCustomerDropdown && (
            <button onClick={() => { setCustomerSearch(''); setShowCustomerDropdown(false); }} className="pay-clear-btn">×</button>
          )}
          {showCustomerDropdown && (
            <div className="pay-dropdown">
              <div
                className={`pay-dropdown-item ${customerId === null && !customerSearch ? 'active' : ''}`}
                onClick={() => { setCustomerId(null); setCustomerSearch(''); setShowCustomerDropdown(false); }}
              >
                Walk-in Customer
              </div>
              {customerList.length > 0 && customerList.map(c => (
                <div
                  key={c.id}
                  className={`pay-dropdown-item ${customerId === c.id ? 'active' : ''}`}
                  onClick={() => { setCustomerId(c.id); setCustomerSearch(''); setShowCustomerDropdown(false); }}
                >
                  <div>{c.firstName} {c.lastName}</div>
                  {c.phone && <div className="text-sm text-muted" style={{ fontSize: 11 }}>{c.phone}</div>}
                </div>
              ))}
              {customerList.length === 0 && customerSearch && (
                <div className="pay-dropdown-item text-muted" style={{ fontSize: 12 }}>No customers found</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pay-section">
        <div className="pay-section-title">Order Summary</div>
        <div className="pay-order-summary">
          {items.map(i => (
            <div key={i.id} className="pay-order-item">
              <span>{i.name} × {i.quantity}</span>
              <span>{peso((i.sellingPrice || i.price || 0) * i.quantity)}</span>
            </div>
          ))}
          <div className="pay-order-divider">
            {!promoApplied && (
              <div className="mb-sm">
                <div className="text-sm font-bold mb-xs text-muted">Discount / Promo</div>
                <div className="pay-promo-row">
                  <select
                    className="input-block flex-1"
                    value=""
                    onChange={e => {
                      const d = availableDiscounts.find(x => String(x.id) === e.target.value);
                      if (d) {
                        setPromoApplied(d);
                        setPromoCode(d.code);
                        setDiscountType(d.type);
                        setDiscountValue(String(d.value));
                        toast.success(`Promo "${d.code}" applied!`);
                      }
                    }}
                    style={{ fontSize: 13, padding: '6px 8px' }}
                  >
                    <option value="">Select discount or promo...</option>
                    {availableDiscounts.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.type === 'percentage' ? `${d.value}% off` : `₱${d.value} off`}{d.name ? ` (${d.name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {!promoApplied && (
              <div className="pay-promo-row mb-sm">
                <input
                  className="input-block flex-1"
                  placeholder="Or enter promo code manually..."
                  value={promoCode}
                  onChange={e => setPromoCode(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleApplyPromo(); } }}
                  style={{ fontSize: 13 }}
                />
                <button type="button" className="btn btn-outline btn-sm" onClick={handleApplyPromo} disabled={validateDiscount.isPending}>
                  {validateDiscount.isPending ? '...' : 'Apply Code'}
                </button>
              </div>
            )}
            {promoApplied && (
              <div className="pay-promo-active">
                <span><strong>{promoApplied.code}</strong> — {promoApplied.type === 'percentage' ? `${promoApplied.value}% off` : `${peso(promoApplied.value)} off`}</span>
                <button type="button" onClick={handleRemovePromo} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--muted-fg)', padding: 0 }}>×</button>
              </div>
            )}
            {!promoApplied && canManualDiscount && (
              <div className="flex-between text-sm mb-sm">
                <span>Manual Discount</span>
                <select
                  value={discountType}
                  onChange={e => { setDiscountType(e.target.value); setDiscountValue(''); }}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--card)', cursor: 'pointer' }}
                >
                  <option value="none">No Discount</option>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed (₱)</option>
                </select>
              </div>
            )}
            {discountType !== 'none' && !promoApplied && (
              <div className="flex-row mb-sm" style={{ gap: 6 }}>
                <input
                  type="number"
                  min="0"
                  max={discountType === 'percentage' ? 100 : storeSubtotal}
                  className="input-block flex-1"
                  placeholder={discountType === 'percentage' ? 'Enter %' : 'Enter ₱'}
                  value={discountValue}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === '' || (!v.includes('-') && !v.includes('+') && !v.includes('e') && !v.includes('E'))) {
                      setDiscountValue(v);
                    }
                  }}
                />
                <span className="text-sm text-muted" style={{ minWidth: 30 }}>
                  {discountType === 'percentage' ? '%' : '₱'}
                </span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="pay-summary-row text-error mb-sm">
                <span>Discount</span>
                <span>-{peso(discountAmount)}</span>
              </div>
            )}
            <div className="pay-summary-row"><span>Subtotal</span><span>{peso(storeSubtotal)}</span></div>
            <div className="pay-summary-row"><span>Tax</span><span>{peso(tax)}</span></div>
            <div className="pay-summary-total"><span>Total</span><span>{peso(total)}</span></div>
          </div>
        </div>
      </div>

      <div className="method-row mb-md">
        <button className={`method ${method === 'cash' ? 'active' : ''}`} data-testid="pay-method-cash" onClick={() => { setMethod('cash'); setSelectedWallet(null); }}>Cash</button>
        <button className={`method ${method === 'split' ? 'active' : ''}`} onClick={() => setMethod('split')}>Split</button>
        <button className={`method ${method === 'ewallet' ? 'active' : ''}`} onClick={() => setMethod('ewallet')}>E-Wallet</button>
      </div>

      {method === 'cash' && (
        <div className="max-w-md">
          <div className="field">
            <label>Cash Amount</label>
            <input
              className="input-block"
              type="number"
              min="0"
              step="0.01"
              value={cashAmount}
              onChange={e => {
                const v = e.target.value;
                if (v === '' || (!v.includes('-') && !v.includes('+') && !v.includes('e') && !v.includes('E'))) {
                  setCashAmount(v);
                }
              }}
              onKeyDown={e => {
                if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                  e.preventDefault();
                }
              }}
              placeholder="Enter cash amount"
            />
          </div>
          <div className="pay-quick-cash">
            <button className="btn btn-outline" data-testid="cash-exact" onClick={() => setCashAmount(total.toFixed(2))}>Exact</button>
            <button className="btn btn-outline" onClick={() => setCashAmount('100')}>₱100</button>
            <button className="btn btn-outline" onClick={() => setCashAmount('200')}>₱200</button>
            <button className="btn btn-outline" onClick={() => setCashAmount('500')}>₱500</button>
            <button className="btn btn-outline" onClick={() => setCashAmount('1000')}>₱1000</button>
          </div>
          {cashAmount && parseFloat(cashAmount) >= total && (
            <div className="pay-change">
              Change: <strong>{peso(parseFloat(cashAmount) - total)}</strong>
            </div>
          )}
        </div>
      )}

      {method === 'split' && (
        <div className="max-w-md">
          <div className="text-sm mb-sm text-muted">
            Divide the total across payment methods. Every leg must be filled and the total must be covered exactly.
          </div>
          {splitLegs.map((leg, idx) => (
            <div key={idx} className="flex-row mb-sm" style={{ gap: 6, alignItems: 'center' }}>
              <select
                className="input-block"
                value={leg.method}
                onChange={e => updateSplitLeg(idx, 'method', e.target.value)}
                style={{ padding: '6px 8px', maxWidth: 150, flexShrink: 0 }}
              >
                {SPLIT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <input
                className="input-block flex-1"
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount"
                value={leg.amount}
                onChange={e => {
                  const v = e.target.value;
                  if (v === '' || (!v.includes('-') && !v.includes('+') && !v.includes('e') && !v.includes('E'))) {
                    updateSplitLeg(idx, 'amount', v);
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={splitLegs.length <= 2}
                onClick={() => removeSplitLeg(idx)}
                aria-label="Remove leg"
              >
                ×
              </button>
            </div>
          ))}
          <div className="flex-row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={addSplitLeg} disabled={splitLegs.length >= 6}>
              + Add method
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={applyRemainingToLast} disabled={splitRemaining <= 0}>
              Put remaining in last leg
            </button>
          </div>
          <div className={`pay-summary-row mt-sm ${splitRemaining === 0 ? 'text-success' : splitCollected > total ? 'text-error' : 'text-muted'}`}>
            <span>{splitRemaining === 0 ? 'Fully covered' : (splitCollected > total ? 'Over total' : 'Remaining')}</span>
            <span>{peso(Math.abs(splitRemaining))}</span>
          </div>
        </div>
      )}

      {method === 'ewallet' && !selectedWallet && (
        <div className="wallet-grid max-w-md">
          <button className="wallet cashg" onClick={() => setSelectedWallet('GCash')}>GCash</button>
          <button className="wallet paymaya" onClick={() => setSelectedWallet('Maya')}>Maya</button>
        </div>
      )}

      {method === 'ewallet' && selectedWallet && (
        <div className="max-w-md">
          <div className="pay-ewallet-info">
            <div className="pay-ewallet-icon">
              {selectedWallet === 'GCash' ? '🟢' : '💜'}
            </div>
            <p className="font-bold" style={{ fontSize: 16, marginBottom: 4 }}>Pay via {selectedWallet}</p>
            <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
              You'll be redirected to PayMongo's secure checkout to complete your {selectedWallet} payment.
            </p>
            <p className="font-bold" style={{ fontSize: 18, margin: '8px 0' }}>{peso(total)}</p>
          </div>
        </div>
      )}

      <div className="pay-actions">
        {method === 'ewallet' && !selectedWallet ? (
          <button className="btn btn-primary btn-lg" disabled>
            Select a wallet to continue
          </button>
        ) : method === 'ewallet' && selectedWallet ? (
          <button className="btn btn-primary btn-lg" disabled={onlineLoading || createPendingSale.isPending || createCheckout.isPending} onClick={handleOnlinePayment}>
            {(onlineLoading || createPendingSale.isPending || createCheckout.isPending) && <span className="btn-spinner" />}{onlineLoading || createPendingSale.isPending || createCheckout.isPending ? 'Redirecting to PayMongo...' : `Pay ${peso(total)} via ${selectedWallet}`}
          </button>
        ) : (
          <button
            className="btn btn-success btn-lg"
            data-testid="complete-payment"
            disabled={
              !method || loading
              || (method === 'cash' && (!cashAmount || parseFloat(cashAmount) < total))
              || (method === 'split' && !splitValid)
            }
            onClick={handleSubmit}
          >
            {loading && <span className="btn-spinner" />}{loading ? 'Processing...' : 'Complete Payment'}
          </button>
        )}
      </div>
    </PosLayout>
  );
}
