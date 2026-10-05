import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useIsAdmin } from '../hooks/useRole';
import { useToast } from './Toast';

/**
 * First-run setup checklist for new admins: store details → branch →
 * products → first job posting. Shown on the dashboard until every step is
 * complete or it is explicitly dismissed. Dismissal is persisted in server
 * Settings (`onboardingDismissedAt`), so it survives new browsers/devices.
 *
 * Each step's "done" state is computed live from the real data — the admin
 * does the work in the normal screens (or the inline quick forms here) and
 * the checklist ticks itself off.
 */
export default function OnboardingChecklist() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings', 'hrms'],
    queryFn: () => api.get('/settings', { baseURL: '/api/v1' }).then(r => r.data.data),
  });

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches', { baseURL: '/api/v1' })
      .then(r => r.data.data?.branches || r.data.data || []),
    enabled: isAdmin,
  });

  const { data: productsPage } = useQuery({
    queryKey: ['products', 'onboarding-count'],
    queryFn: () => api.get('/products', { baseURL: '/api/v1', params: { limit: 1 } })
      .then(r => r.data.data),
    enabled: isAdmin,
  });

  const { data: jobs } = useQuery({
    queryKey: ['jobs', 'onboarding'],
    queryFn: () => api.get('/jobs', { params: { limit: 50 } }).then(r => r.data.data),
    enabled: isAdmin,
  });

  const [showStoreForm, setShowStoreForm] = useState(false);
  const [storeForm, setStoreForm] = useState({ storeName: '', address: '', phone: '', gcashNumber: '', mayaNumber: '' });
  const [branchName, setBranchName] = useState('Main Branch');

  const saveSettings = useMutation({
    mutationFn: (payload) => api.put('/settings', payload, { baseURL: '/api/v1' }).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'hrms'] });
      toast.success('Store details saved');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not save store details'),
  });

  const createBranch = useMutation({
    mutationFn: (name) => api.post('/branches', { name }, { baseURL: '/api/v1' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      toast.success('Branch created');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not create branch'),
  });

  const dismiss = useMutation({
    mutationFn: () => api.put('/settings', { onboardingDismissedAt: new Date().toISOString() }, { baseURL: '/api/v1' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'hrms'] }),
    onError: (e) => toast.error(e.response?.data?.message || 'Could not dismiss checklist'),
  });

  if (!isAdmin || settingsLoading) return null;
  if (settings?.onboardingDismissedAt) return null;

  const productCount = productsPage?.pagination?.total ?? (Array.isArray(productsPage) ? productsPage.length : productsPage?.products?.length ?? 0);
  const branchCount = Array.isArray(branches) ? branches.length : 0;
  const jobCount = Array.isArray(jobs) ? jobs.length : (jobs?.jobs?.length ?? 0);
  const hasOpenJob = Array.isArray(jobs)
    ? jobs.some(j => j.status === 'open' || !j.status)
    : jobCount > 0;

  const openStoreForm = () => {
    setStoreForm({
      storeName: settings?.storeName || '',
      address: settings?.address || '',
      phone: settings?.phone || '',
      gcashNumber: settings?.gcashNumber || '',
      mayaNumber: settings?.mayaNumber || '',
    });
    setShowStoreForm(true);
  };

  const steps = [
    {
      id: 'store',
      title: 'Set your store details',
      desc: 'Store name, address, phone and GCash/Maya numbers appear on every receipt.',
      done: Boolean(settings && (settings.address || settings.gcashNumber || settings.mayaNumber)),
      action: showStoreForm ? null : (
        <button className="btn btn-sm btn-outline" onClick={openStoreForm}>Enter details</button>
      ),
    },
    {
      id: 'branch',
      title: 'Add your first branch',
      desc: 'A branch is where employees clock in and where POS terminals live.',
      done: branchCount > 0,
      action: branchCount === 0 ? (
        <div className="flex-wrap-gap">
          <input
            className="input-block"
            style={{ width: 200 }}
            value={branchName}
            onChange={e => setBranchName(e.target.value)}
            placeholder="Branch name"
            aria-label="New branch name"
          />
          <button
            className="btn btn-sm btn-primary"
            disabled={!branchName.trim() || createBranch.isPending}
            onClick={() => createBranch.mutate(branchName.trim())}
          >
            {createBranch.isPending ? 'Creating…' : 'Create branch'}
          </button>
        </div>
      ) : null,
    },
    {
      id: 'products',
      title: 'Confirm your products',
      desc: productCount > 0
        ? `${productCount} product${productCount === 1 ? '' : 's'} found. Review them in the POS app (Products) and adjust prices/stock.`
        : 'Add the products you sell (POS app → Products), or check the seed data.',
      done: productCount > 0,
      action: (
        <a
          className="btn btn-sm btn-outline"
          href={import.meta.env.VITE_POS_URL || `${window.location.origin}/`}
          target="_blank"
          rel="noreferrer"
        >
          Open POS
        </a>
      ),
    },
    {
      id: 'jobs',
      title: 'Publish your first job posting',
      desc: 'Post a role so candidates can apply from the public careers page.',
      done: hasOpenJob,
      action: (
        <button className="btn btn-sm btn-outline" onClick={() => navigate('/jobs')}>Go to Jobs</button>
      ),
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;

  return (
    <div className="card mb-lg onboarding-card" aria-label="Setup checklist">
      <div className="onboarding-head">
        <div>
          <h3 style={{ margin: 0 }}>
            {allDone ? '🎉 You\'re all set' : 'Welcome! Let\'s get your store ready'}
          </h3>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            {allDone
              ? 'Every setup step is complete. You can dismiss this card.'
              : `${doneCount} of ${steps.length} steps complete — finishes as you go.`}
          </p>
        </div>
        <button
          className="btn btn-sm btn-outline"
          onClick={() => dismiss.mutate()}
          disabled={dismiss.isPending}
          aria-label="Dismiss setup checklist"
        >
          Dismiss
        </button>
      </div>

      <div className="onboarding-progress" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={steps.length}>
        <div className="onboarding-progress-fill" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>

      <ul className="onboarding-steps">
        {steps.map(step => (
          <li key={step.id} className={`onboarding-step ${step.done ? 'done' : ''}`}>
            <span className="onboarding-check" aria-hidden="true">{step.done ? '✓' : ''}</span>
            <div className="onboarding-step-body">
              <div className="onboarding-step-title">{step.title}</div>
              <div className="onboarding-step-desc">{step.desc}</div>
              {step.id === 'store' && showStoreForm && (
                <div className="onboarding-inline-form">
                  <div className="onboarding-form-grid">
                    <label>
                      <span>Store name</span>
                      <input className="input-block" value={storeForm.storeName} onChange={e => setStoreForm(f => ({ ...f, storeName: e.target.value }))} placeholder="MiniMart" />
                    </label>
                    <label>
                      <span>Address</span>
                      <input className="input-block" value={storeForm.address} onChange={e => setStoreForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main St, Dasmariñas, Cavite" />
                    </label>
                    <label>
                      <span>Phone</span>
                      <input className="input-block" value={storeForm.phone} onChange={e => setStoreForm(f => ({ ...f, phone: e.target.value }))} placeholder="0917 123 4567" />
                    </label>
                    <label>
                      <span>GCash number</span>
                      <input className="input-block" value={storeForm.gcashNumber} onChange={e => setStoreForm(f => ({ ...f, gcashNumber: e.target.value }))} placeholder="0917 123 4567" />
                    </label>
                    <label>
                      <span>Maya number</span>
                      <input className="input-block" value={storeForm.mayaNumber} onChange={e => setStoreForm(f => ({ ...f, mayaNumber: e.target.value }))} placeholder="0917 123 4567" />
                    </label>
                  </div>
                  <div className="flex-wrap-gap" style={{ marginTop: 10 }}>
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={saveSettings.isPending}
                      onClick={() => {
                        saveSettings.mutate({ ...storeForm });
                        setShowStoreForm(false);
                      }}
                    >
                      {saveSettings.isPending ? 'Saving…' : 'Save details'}
                    </button>
                    <button className="btn btn-sm btn-outline" onClick={() => setShowStoreForm(false)}>Cancel</button>
                  </div>
                </div>
              )}
              {step.action && <div className="onboarding-step-action">{step.action}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
