import { useState, useEffect } from 'react';
import ErrorState from '../components/ErrorState';
import PosLayout from '../layouts/PosLayout';
import useAuthStore from '../store/authStore';
import { useSettings, useUpdateSettings } from '../hooks/useApi';
import { useToast } from '../components/Toast';

export default function Settings() {
  const user = useAuthStore(s => s.user);
  const toast = useToast();
  const { data: serverSettings, isLoading: loadingSettings, isError, error, refetch } = useSettings();
  const updateSettingsMut = useUpdateSettings();
  const [form, setForm] = useState({
    storeName: '',
    address: '',
    phone: '',
    storeEmail: '',
    taxRate: 12,
    lowStockThreshold: 10,
    currency: 'PHP',
    receiptFooter: 'Thank you for your purchase!',
    gcashNumber: '',
    mayaNumber: '',
    allowPublicRegistration: false,
  });

  useEffect(() => {
    if (serverSettings) {
      setForm(p => ({
        ...p,
        storeName: serverSettings.storeName || '',
        address: serverSettings.address || '',
        phone: serverSettings.phone || '',
        storeEmail: serverSettings.storeEmail || serverSettings.email || '',
        taxRate: serverSettings.taxRate ?? 12,
        lowStockThreshold: serverSettings.lowStockThreshold ?? 10,
        currency: serverSettings.currency || 'PHP',
        receiptFooter: serverSettings.receiptFooter || 'Thank you for your purchase!',
        gcashNumber: serverSettings.gcashNumber || '',
        mayaNumber: serverSettings.mayaNumber || '',
        allowPublicRegistration: !!serverSettings.allowPublicRegistration,
      }));
    }
  }, [serverSettings]);

  const userRole = user?.role?.slug || user?.role;
  if (userRole !== 'admin') {
    return (
      <PosLayout active="settings">
        <header className="pos-header"><div><h1>Settings</h1><div className="sub">Access denied — admin only</div></div></header>
        <div className="dashboard-section text-center p-md" style={{ color: 'var(--muted-fg)' }}>You do not have permission to view this page.</div>
      </PosLayout>
    );
  }

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await updateSettingsMut.mutateAsync(form);
      toast.success('Settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    }
  };

  if (isError) {
    return (
      <div className="page-error-wrap">
        <ErrorState message={error?.response?.data?.message || 'Something went wrong while loading this data.'} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <PosLayout active="settings">
      <header className="pos-header">
        <div><h1>Settings</h1><div className="sub">Configure your store preferences</div></div>
      </header>

      <form onSubmit={handleSave}>
        <div className="dashboard-section">
          <h2 style={{ marginBottom: 16 }}>Store Information</h2>
          <div className="two-col">
            <div className="field"><label>Store Name</label><input className="input-block" value={form.storeName} onChange={e => update('storeName', e.target.value)} required /></div>
            <div className="field"><label>Email</label><input className="input-block" type="email" value={form.storeEmail} onChange={e => update('storeEmail', e.target.value)} /></div>
          </div>
          <div className="two-col">
            <div className="field"><label>Phone</label><input className="input-block" value={form.phone} onChange={e => update('phone', e.target.value)} /></div>
            <div className="field"><label>Currency</label>
              <input className="input-block" value="PHP — Philippine Peso" disabled />
            </div>
          </div>
          <div className="field"><label>Address</label><textarea className="input-block" value={form.address} onChange={e => update('address', e.target.value)} rows={2} /></div>
        </div>

        <div className="dashboard-section">
          <h2 style={{ marginBottom: 16 }}>Tax &amp; Inventory</h2>
          <div className="two-col">
            <div className="field"><label>Tax Rate (%)</label><input className="input-block" type="number" step="0.01" min="0" max="100" value={form.taxRate} onChange={e => update('taxRate', Number(e.target.value))} required /></div>
            <div className="field"><label>Low Stock Threshold</label><input className="input-block" type="number" min="0" value={form.lowStockThreshold} onChange={e => update('lowStockThreshold', Number(e.target.value))} required /></div>
          </div>
        </div>

        <div className="dashboard-section">
          <h2 style={{ marginBottom: 16 }}>Receipt</h2>
          <div className="field"><label>Footer Message</label><textarea className="input-block" value={form.receiptFooter} onChange={e => update('receiptFooter', e.target.value)} rows={2} placeholder="Thank you for your purchase!" /></div>
        </div>

        <div className="dashboard-section">
          <h2 style={{ marginBottom: 16 }}>E-Wallet Payment (QR Code)</h2>
          <p className="text-sm text-muted mb-md">Enter the phone number or account number linked to your e-wallet. This will be used to generate QR codes for customer payments.</p>
          <div className="two-col">
            <div className="field"><label>GCash Number</label><input className="input-block" placeholder="09XX XXX XXXX" value={form.gcashNumber} onChange={e => update('gcashNumber', e.target.value)} /></div>
            <div className="field"><label>Maya Number</label><input className="input-block" placeholder="09XX XXX XXXX" value={form.mayaNumber} onChange={e => update('mayaNumber', e.target.value)} /></div>
          </div>
        </div>

        <div className="dashboard-section">
          <h2 style={{ marginBottom: 16 }}>Security</h2>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.allowPublicRegistration}
              onChange={e => update('allowPublicRegistration', e.target.checked)}
              style={{ marginTop: 4, width: 18, height: 18, accentColor: 'var(--primary, #6366f1)' }}
            />
            <span>
              <span style={{ fontWeight: 600, display: 'block' }}>Allow public self-registration</span>
              <span className="text-sm text-muted">
                When enabled, anyone can create an account from the login page — new accounts get the cashier role.
                Off by default in production; enable only if you want walk-up self-serve sign-ups.
              </span>
              {serverSettings && serverSettings.publicRegistrationEffective !== form.allowPublicRegistration && (
                <span className="text-sm" style={{ display: 'block', marginTop: 4, color: 'var(--warning-fg)' }}>
                  Note: this store's environment configuration currently overrides this toggle (effective: {serverSettings.publicRegistrationEffective ? 'enabled' : 'disabled'}).
                </span>
              )}
            </span>
          </label>
        </div>

        <div className="flex-end mb-lg">
          <button type="submit" className="btn btn-primary" disabled={updateSettingsMut.isPending || loadingSettings}>{updateSettingsMut.isPending && <span className="btn-spinner" />}{updateSettingsMut.isPending ? 'Saving...' : 'Save Settings'}</button>
        </div>
      </form>
    </PosLayout>
  );
}
