import { useState, useEffect } from 'react';
import PosLayout from '../layouts/PosLayout';
import useAuthStore from '../store/authStore';
import { useSettings, useUpdateSettings } from '../hooks/useApi';
import { useToast } from '../components/Toast';

export default function Settings() {
  const user = useAuthStore(s => s.user);
  const toast = useToast();
  const { data: serverSettings, isLoading: loadingSettings } = useSettings();
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
  });

  useEffect(() => {
    if (serverSettings) {
      setForm({
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
      });
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

        <div className="flex-end mb-lg">
          <button type="submit" className="btn btn-primary" disabled={updateSettingsMut.isPending}>{updateSettingsMut.isPending && <span className="btn-spinner" />}{updateSettingsMut.isPending ? 'Saving...' : 'Save Settings'}</button>
        </div>
      </form>
    </PosLayout>
  );
}
