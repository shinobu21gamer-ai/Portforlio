import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PosLayout from '../layouts/PosLayout';
import useCartStore from '../store/cartStore';
import useAuthStore from '../store/authStore';
import { useCreateSale, useCreatePendingSale, useCreateCheckout, useVerifyPayment, useCancelPendingSale, useCustomers, useSettings, useValidateDiscount, useDiscounts } from '../hooks/useApi';
import { useToast } from '../components/Toast';
import { peso, useDebounce } from '../utils/helpers';
import { computeCartTotal } from '../utils/pricing';
import api from '../api/client';

const escapeHtml = (str) => {
  if (typeof str !== 'string') return String(str || '');
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

// Print the success screen's #receipt-print-area as an 80mm thermal slip.
// The .print-receipt body class scopes the @media print rules (everything
// else visibility:hidden); window.print() blocks until the dialog closes,
// so the class is removed on afterprint with a timed fallback.
function printReceipt80mm() {
  const body = document.body;
  body.classList.add('print-receipt');
  const cleanup = () => body.classList.remove('print-receipt');
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  setTimeout(cleanup, 1500);
}

export default function Payment({ success: successProp, cancel: cancelProp }) {
  const [searchParams] = useSearchParams();
  const saleIdParam = searchParams.get('saleId');
  const sessionIdParam = searchParams.get('session_id');

  const [method, setMethod] = useState(null);
  const [cashAmount, setCashAmount] = useState('');
  const [selectedWallet, setSelectedWallet] = useState(null);
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

  const { data: verifyData, isLoading: verifyLoading, error: verifyError } = useVerifyPayment(saleIdParam, sessionIdParam, {
    enabled: !!successProp && !!saleIdParam && !!sessionIdParam && !showSuccess,
    refetchInterval: (query) => {
      if (query.state.data?.verified) return false;
      if (query.state.error) return 5000;
      return 3000;
    },
  });

  const taxRate = parseFloat(settings?.taxRate) || 12;
  const storeName = settings?.storeName || 'MiniMart POS';

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
    if (items.length === 0 && !showSuccess && !successProp && !cancelProp) {
      navigate('/');
    }
  }, [items.length, showSuccess, successProp, cancelProp, navigate]);

  useEffect(() => {
    if (successProp && saleIdParam && verifyData?.verified) {
      setSaleResult(verifyData);
      clearCart();
      sessionStorage.removeItem('pendingOnlineSale');
      setShowSuccess(true);
      toast.success('Online payment confirmed!');
    }
  }, [successProp, saleIdParam, verifyData, clearCart, toast]);

  const verifyDataRef = useRef(verifyData);
  verifyDataRef.current = verifyData;

  // Manager/admin escape hatch: the online payment never confirmed but the
  // customer is at the counter with cash. Completes the pending sale as a
  // cash sale server-side (stock was already reserved at pending creation).
  const handleCashOverride = async () => {
    if (!saleIdParam) return;
    if (!window.confirm('Online payment was not confirmed.\nComplete this sale as CASH received at the counter?')) return;
    setCashOverrideLoading(true);
    try {
      const res = await api.post(`/sales/pending/${saleIdParam}/cash-complete`);
      const sale = res.data?.data || {};
      setSaleResult({ ...sale, paymentMethod: 'cash', cashAmount: sale.total });
      clearCart();
      sessionStorage.removeItem('pendingOnlineSale');
      setShowSuccess(true);
      toast.success('Sale completed as cash at the counter.');
      if (autoPrint) setTimeout(printReceipt80mm, 400);
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
      let stored = {};
      try { stored = JSON.parse(sessionStorage.getItem('pendingOnlineSale') || '{}') || {}; } catch {}
      cancelPendingSale.mutate(saleIdParam, { onSettled: () => {} });
      if (Array.isArray(stored.cartItems) && stored.cartItems.length > 0) {
        stored.cartItems.forEach(ci => addItem(ci, ci.quantity || 1));
        toast.info('Cart restored.');
      }
      sessionStorage.removeItem('pendingOnlineSale');
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
                  <strong>Manager option:</strong> if the customer's online payment failed and they are paying cash at the counter, complete the sale as cash.
                </p>
                <button
                  className="btn btn-warning"
                  disabled={cashOverrideLoading}
                  onClick={handleCashOverride}
                >
                  {cashOverrideLoading && <span className="btn-spinner" />}
                  {cashOverrideLoading ? 'Completing…' : 'Complete as cash at counter'}
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
    if (method === 'ewallet') return selectedWallet === 'GCash' ? 'gcash' : 'maya';
    return 'cash';
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

      sessionStorage.setItem('pendingOnlineSale', JSON.stringify({
        saleId,
        invoiceNo: pendingSale.invoiceNo,
        total: pendingSale.total,
        subtotal: pendingSale.subtotal,
        tax: pendingSale.taxAmount,
        discount: pendingSale.discountAmount,
        paymentMethod,
        items: pendingSale.items || [],
      }));

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
        const pendingSaleData = JSON.parse(sessionStorage.getItem('pendingOnlineSale') || '{}');
        pendingSaleData.cartItems = items;
        sessionStorage.setItem('pendingOnlineSale', JSON.stringify(pendingSaleData));
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
        sessionStorage.removeItem('pendingOnlineSale');
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
      const saleData = {
        items: items.map(i => ({ productId: i.id, quantity: i.quantity })),
        paymentMethod: getPaymentMethod(),
        cashAmount: method === 'cash' ? parseFloat(cashAmount) : undefined,
        customerId: customerId || undefined,
        discountType: discountType !== 'none' ? discountType : undefined,
        discountValue: discountType !== 'none' ? parseFloat(discountValue) || 0 : undefined,
        discountId: promoApplied?.id || undefined,
      };

      const result = await createSale.mutateAsync(saleData);
      setSaleResult(result);
      clearCart();
      setShowSuccess(true);
      toast.success('Sale completed successfully!');
      // Print in-page: the browser print dialog picks up the 80mm receipt
      // from the success screen (see @media print CSS). A window.open popup
      // here was routinely eaten by popup blockers, losing the slip.
      if (autoPrint) {
        setTimeout(printReceipt80mm, 400);
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

  const buildReceiptHtml = (resultOverride) => {
    const r = resultOverride || saleResult;
    if (!r) return '';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const invoiceNo = r.invoiceNo || r.invoice || 'N/A';
    const saleItems = r.items || r.lineItems || items;
    const saleSubtotal = r.subtotal ?? storeSubtotal;
    const saleDiscount = r.discount ?? discountAmount;
    const saleTax = r.tax ?? r.taxAmount ?? tax;
    const saleTotal = r.total ?? total;
    const paymentMethod = r.paymentMethod || method || 'cash';
    const cashGiven = r.cashAmount ?? (method === 'cash' ? parseFloat(cashAmount) : saleTotal);
    const change = cashGiven - saleTotal;

    const itemRows = ((saleItems || []).length ? saleItems : items).map(item => {
      const qty = item.quantity;
      const name = escapeHtml(item.product?.name || item.productName || item.name || 'Item');
      const price = item.unitPrice || item.sellingPrice || item.price || 0;
      const lineTotal = price * qty;
      return `<tr><td>${name}</td><td style="text-align:center">${qty}</td><td style="text-align:right">${peso(price)}</td><td style="text-align:right">${peso(lineTotal)}</td></tr>`;
    }).join('');

    const discountRow = saleDiscount > 0
      ? `<div style="display:flex;justify-content:space-between;padding:4px 0"><span>Discount:</span><span>-${peso(saleDiscount)}</span></div>`
      : '';

    const methodLabel = {
      cash: 'Cash',
      gcash: 'GCash',
      maya: 'Maya',
      credit_card: 'Credit Card',
      debit_card: 'Debit Card',
      online: 'Online Payment (PayMongo)',
    }[paymentMethod] || 'Cash';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Receipt - ${invoiceNo}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 13px; color: #000; background: #fff; padding: 20px; }
  .receipt { max-width: 320px; margin: 0 auto; }
  .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 12px; margin-bottom: 12px; }
  .store-name { font-size: 20px; font-weight: bold; letter-spacing: 2px; }
  .store-tagline { font-size: 11px; color: #555; margin-top: 2px; }
  .meta { text-align: center; font-size: 11px; margin-bottom: 12px; color: #555; }
  .items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  .items-table th { border-bottom: 1px dashed #000; padding: 4px 0; font-size: 11px; text-transform: uppercase; }
  .items-table td { padding: 3px 0; }
  .totals { border-top: 2px dashed #000; padding-top: 8px; margin-top: 8px; }
  .total-row { display: flex; justify-content: space-between; padding: 3px 0; }
  .total-row.grand { font-size: 16px; font-weight: bold; border-top: 1px dashed #000; padding-top: 6px; margin-top: 6px; }
  .footer { text-align: center; border-top: 2px dashed #000; margin-top: 12px; padding-top: 12px; font-size: 11px; color: #555; }
  .payment-info { margin-top: 8px; padding: 6px; border: 1px dashed #999; font-size: 11px; }
  .payment-info div { display: flex; justify-content: space-between; padding: 2px 0; }
</style>
</head>
<body>
<div class="receipt">
  <div class="header">
    <div class="store-name">${escapeHtml(storeName)}</div>
    ${settings?.address ? `<div class="store-tagline">${escapeHtml(settings.address)}</div>` : ''}
    ${settings?.phone ? `<div class="store-tagline">Tel: ${escapeHtml(settings.phone)}</div>` : ''}
    ${(settings?.gcashNumber || settings?.mayaNumber) ? `<div class="store-tagline">${settings.gcashNumber ? `GCash: ${escapeHtml(settings.gcashNumber)}` : ''}${settings.gcashNumber && settings.mayaNumber ? ' · ' : ''}${settings.mayaNumber ? `Maya: ${escapeHtml(settings.mayaNumber)}` : ''}</div>` : ''}
  </div>
  <div class="meta">
    <div>Date: ${dateStr} ${timeStr}</div>
    <div>Invoice: <strong>${escapeHtml(invoiceNo)}</strong></div>
    ${selectedCustomer ? `<div>Customer: ${escapeHtml(selectedCustomer.firstName || '')} ${escapeHtml(selectedCustomer.lastName || '')}</div>` : '<div>Customer: Walk-in</div>'}
  </div>
  <table class="items-table">
    <thead><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${itemRows || '<tr><td colspan="4" style="text-align:center;color:#999">No items</td></tr>'}</tbody>
  </table>
  <div class="totals">
    <div class="total-row"><span>Subtotal:</span><span>${peso(saleSubtotal)}</span></div>
    ${discountRow}
    <div class="total-row"><span>Tax:</span><span>${peso(saleTax)}</span></div>
    <div class="total-row grand"><span>TOTAL:</span><span>${peso(saleTotal)}</span></div>
  </div>
  <div class="payment-info">
    <div><span>Payment Method:</span><span>${methodLabel}</span></div>
    <div><span>Amount Tendered:</span><span>${peso(cashGiven)}</span></div>
    ${change > 0 ? `<div><span>Change:</span><span>${peso(change)}</span></div>` : ''}
  </div>
  <div class="footer">
    <div>${escapeHtml(settings?.receiptFooter || 'Thank you for shopping!')}</div>
    <div style="margin-top:4px">This receipt serves as your official proof of purchase.</div>
  </div>
</div>
<script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;
  };

  // Fallback for cashiers whose thermal printer is down: save the receipt as
  // a standalone HTML file. In-page printing (window.print + 80mm CSS) is the
  // primary path — this never opens a popup, which blockers eat.
  const downloadReceiptHtml = () => {
    const html = buildReceiptHtml();
    if (!html) { toast.error('No receipt data'); return; }
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${(saleResult?.invoiceNo || 'sale').replace(/[^A-Za-z0-9-]/g, '')}-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  if (showSuccess) {
    // The receipt block is the print target: @media print hides everything
    // else and renders just this as an 80mm thermal slip (monospace, store
    // header with e-wallet numbers, dashed separators).
    const receiptItems = saleResult?.items || saleResult?.lineItems || items || [];
    const rSubtotal = saleResult?.subtotal ?? storeSubtotal;
    const rDiscount = saleResult?.discount ?? discountAmount;
    const rTax = saleResult?.tax ?? tax;
    const rTotal = saleResult?.total ?? total;
    const tendered = parseFloat(saleResult?.cashAmount ?? (method === 'cash' ? cashAmount : rTotal)) || 0;
    const change = Math.max(0, tendered - rTotal);
    const isCash = (saleResult?.paymentMethod || method) === 'cash';
    const methodLabel = { cash: 'Cash', gcash: 'GCash', maya: 'Maya', credit_card: 'Credit Card', debit_card: 'Debit Card', online: 'Online Payment' }[saleResult?.paymentMethod || method] || 'Cash';

    return (
      <PosLayout active="home">
        <div className="flex-center" style={{ minHeight: '60vh' }}>
          <div className="receipt-wrap">
            <div className="success-circle no-print"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
            <p className="success-text no-print">Payment Success</p>
            {saleResult && (
              <div id="receipt-print-area" className="mt-md text-sm text-muted pay-order-summary receipt-80mm">
                <div className="text-center font-bold" style={{ fontSize: 16, marginBottom: 4, letterSpacing: 1 }}>{storeName}</div>
                {settings?.address && <div className="text-center" style={{ fontSize: 11 }}>{settings.address}</div>}
                {settings?.phone && <div className="text-center" style={{ fontSize: 11 }}>Tel: {settings.phone}</div>}
                {(settings?.gcashNumber || settings?.mayaNumber) && (
                  <div className="text-center" style={{ fontSize: 11 }}>
                    {settings.gcashNumber && <span>GCash: {settings.gcashNumber}</span>}
                    {settings.gcashNumber && settings.mayaNumber && <span> · </span>}
                    {settings.mayaNumber && <span>Maya: {settings.mayaNumber}</span>}
                  </div>
                )}
                <div style={{ borderTop: '1px dashed var(--border)', margin: '8px 0' }} />
                <div className="receipt-header">
                  <div className="receipt-date">
                    {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="receipt-invoice">
                    Invoice: <strong>{saleResult.invoiceNo || saleResult.invoice}</strong>
                  </div>
                </div>
                <div className="receipt-items-wrap">
                  {receiptItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--fg-tertiary)' }}>No items</div>
                  ) : receiptItems.map((item, idx) => {
                    const name = item.product?.name || item.productName || item.name || 'Item';
                    const price = item.unitPrice || item.sellingPrice || item.price || 0;
                    return (
                      <div key={idx} className="receipt-row">
                        <span>{name} × {item.quantity}</span>
                        <span>{peso(price * item.quantity)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="receipt-totals">
                  <div className="pay-summary-row"><span>Subtotal</span><span>{peso(rSubtotal)}</span></div>
                  {rDiscount > 0 && (
                    <div className="pay-summary-row text-error"><span>Discount</span><span>-{peso(rDiscount)}</span></div>
                  )}
                   <div className="pay-summary-row"><span>Tax</span><span>{peso(rTax)}</span></div>
                  <div className="pay-summary-total"><span>Total</span><span>{peso(rTotal)}</span></div>
                </div>
                <div className="receipt-footer">
                  <div className="flex-between"><span>Payment</span><span>{methodLabel}</span></div>
                  {isCash && (
                    <>
                      <div className="flex-between"><span>Tendered</span><span>{peso(tendered)}</span></div>
                      <div className="flex-between font-bold"><span>Change</span><span>{peso(change)}</span></div>
                    </>
                  )}
                </div>
                <div style={{ borderTop: '1px dashed var(--border)', margin: '8px 0' }} />
                <div className="text-center" style={{ fontSize: 11 }}>
                  {settings?.receiptFooter || 'Thank you for your purchase!'}
                  <div style={{ marginTop: 2, color: 'var(--fg-tertiary)' }}>This receipt serves as your official proof of purchase.</div>
                </div>
              </div>
            )}
            <div className="receipt-actions no-print">
              {window.top !== window ? (
                <button className="btn btn-success" onClick={() => { window.top.location.href = import.meta.env.VITE_HRMS_URL || `${window.location.origin}/hrms`; }}>Back to HRMS</button>
              ) : (
                <button className="btn btn-success" onClick={() => navigate('/')}>Next Sale</button>
              )}
              <button className="btn btn-outline" onClick={printReceipt80mm}>Print Receipt</button>
              <button className="btn btn-outline" onClick={downloadReceiptHtml}>Download HTML</button>
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
        <button className={`method ${method === 'cash' ? 'active' : ''}`} onClick={() => { setMethod('cash'); setSelectedWallet(null); }}>Cash</button>
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
            <button className="btn btn-outline" onClick={() => setCashAmount(total.toFixed(2))}>Exact</button>
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
          <button className="btn btn-success btn-lg" disabled={!method || loading || (method === 'cash' && (!cashAmount || parseFloat(cashAmount) < total))} onClick={handleSubmit}>
            {loading && <span className="btn-spinner" />}{loading ? 'Processing...' : 'Complete Payment'}
          </button>
        )}
      </div>
    </PosLayout>
  );
}
