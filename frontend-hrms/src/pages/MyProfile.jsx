import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMyProfile } from '../hooks/useApi';
import api from '../api/client';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';
import { icons } from '../components/ActionButton';
import { formatTime, formatDate, maskId, peso } from '../utils/helpers';
import Avatar from '../components/Avatar';

export default function MyProfile() {
  const { data: emp, isLoading } = useMyProfile();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();

  if (isLoading) return <LoadingSkeleton rows={4} />;
  if (!emp) return <div className="empty-state">Profile not found</div>;

  const openEdit = () => {
    setForm({
      phone: emp.phone || '',
      address: emp.address || '',
      emergencyContactName: emp.emergencyContactName || '',
      emergencyContactPhone: emp.emergencyContactPhone || '',
      emergencyContactRelation: emp.emergencyContactRelation || '',
      bankName: emp.bankName || '',
      bankAccountNumber: emp.bankAccountNumber || '',
    });
    setEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/me/profile', form);
      toast.success('Profile updated', { title: 'Updated' });
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['my-profile'] });
    } catch (err) {
      const errors = err.response?.data?.errors;
      const msg = (errors && errors.length ? errors.join('. ') : err.response?.data?.message) || 'Failed to update';
      toast.error(msg, { title: 'Failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hrms-page">
      <div className="page-header">
        <h1>My Profile</h1>
        {!editing && <button className="btn btn-sm btn-primary" onClick={openEdit}>{icons.edit} Edit</button>}
      </div>
      <div className={editing ? 'card p-md max-w-700' : ''}>
        {editing ? (
          <form onSubmit={handleSave} className="modal-form">
            <div className="text-sm text-muted mb-sm">You can update your phone, address, emergency contact, and bank details.</div>
            <div className="form-row">
              <div className="field"><label>Phone</label><input className="input-block" inputMode="tel" minLength={7} maxLength={20} value={form.phone} onChange={e => setForm({...form, phone: e.target.value.replace(/[^0-9+\-\s]/g, '')})} /></div>
              <div className="field"><label>Address</label><textarea className="input-block" rows={2} value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
            </div>
            <div className="text-sm font-semibold mt-sm mb-sm">Emergency Contact</div>
            <div className="form-row">
              <div className="field"><label>Name</label><input className="input-block" value={form.emergencyContactName} onChange={e => setForm({...form, emergencyContactName: e.target.value.replace(/[^a-zA-Z\s\-'.]/g, '')})} /></div>
              <div className="field"><label>Phone</label><input className="input-block" inputMode="tel" minLength={7} maxLength={20} value={form.emergencyContactPhone} onChange={e => setForm({...form, emergencyContactPhone: e.target.value.replace(/[^0-9+\-\s]/g, '')})} /></div>
              <div className="field"><label>Relationship</label><input className="input-block" value={form.emergencyContactRelation} onChange={e => setForm({...form, emergencyContactRelation: e.target.value.replace(/[^a-zA-Z\s]/g, '')})} placeholder="e.g. Spouse" /></div>
            </div>
            <div className="text-sm font-semibold mt-sm mb-sm">Bank Details</div>
            <div className="form-row">
              <div className="field"><label>Bank Name</label><input className="input-block" value={form.bankName} onChange={e => setForm({...form, bankName: e.target.value.replace(/[^a-zA-Z\s]/g, '')})} /></div>
              <div className="field"><label>Account Number</label><input className="input-block" inputMode="numeric" value={form.bankAccountNumber} onChange={e => setForm({...form, bankAccountNumber: e.target.value.replace(/[^0-9]/g, '')})} /></div>
            </div>
            <div className="modal-actions mt-md">
              <button type="button" className="btn btn-outline" onClick={() => setEditing(false)}>{icons.close}</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving && <span className="btn-spinner" />}{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        ) : (
          <div className="profile-view">
            <div className="profile-hero">
              <Avatar
                src={emp.avatar}
                name={`${emp.firstName || ''} ${emp.lastName || ''}`.trim()}
                size="2xl"
              />
              <div className="profile-hero__meta">
                <h2 className="profile-hero__name">
                  {emp.firstName} {emp.middleName ? `${emp.middleName} ` : ''}{emp.lastName}
                </h2>
                <div className="profile-hero__sub">
                  {emp.position?.title || '—'}
                  {emp.department?.name ? ` · ${emp.department.name}` : ''}
                </div>
                <div className="profile-hero__tags">
                  <span className={`badge ${emp.status === 'active' ? 'success' : emp.status === 'pending' ? 'warning' : 'error'}`}>
                    {emp.status}
                  </span>
                  <span className="badge accent">{emp.employeeNo}</span>
                </div>
              </div>
            </div>

            <div className="profile-cards">
              <section className="card p-md">
                <h3 className="mt-0 mb-md">Personal Information</h3>
                <div className="detail-grid">
                  <div>
                    <div className="detail-label">Email</div>
                    <div className="detail-value">{emp.email || '—'}</div>
                  </div>
                  <div>
                    <div className="detail-label">Phone</div>
                    <div className="detail-value">{emp.phone || '—'}</div>
                  </div>
                  <div className="detail-span-2">
                    <div className="detail-label">Address</div>
                    <div className="detail-value">{emp.address || '—'}</div>
                  </div>
                </div>
              </section>

              <section className="card p-md">
                <h3 className="mt-0 mb-md">Employment</h3>
                <div className="detail-grid">
                  <div>
                    <div className="detail-label">Department</div>
                    <div className="detail-value">{emp.department?.name || '—'}</div>
                  </div>
                  <div>
                    <div className="detail-label">Position</div>
                    <div className="detail-value">{emp.position?.title || '—'}</div>
                  </div>
                  <div>
                    <div className="detail-label">Employment Type</div>
                    <div className="detail-value">
                      {String(emp.employmentType || '').replace(/-/g, ' ')}
                    </div>
                  </div>
                  <div>
                    <div className="detail-label">Hire Date</div>
                    <div className="detail-value">{formatDate(emp.hireDate)}</div>
                  </div>
                  <div className="detail-span-2">
                    <div className="detail-label">Schedule</div>
                    <div className="detail-value">
                      {emp.schedule
                        ? `${emp.schedule.name} · ${formatTime(emp.schedule.startTime)} – ${formatTime(emp.schedule.endTime)}`
                        : '—'}
                    </div>
                  </div>
                  <div className="detail-span-2">
                    <div className="detail-label">Base Salary</div>
                    <div className="detail-value">{emp.salary != null ? peso(emp.salary) : '—'}</div>
                  </div>
                </div>
              </section>

              <section className="card p-md">
                <h3 className="mt-0 mb-md">Emergency Contact</h3>
                {emp.emergencyContactName ? (
                  <div className="detail-grid">
                    <div>
                      <div className="detail-label">Name</div>
                      <div className="detail-value">{emp.emergencyContactName}</div>
                    </div>
                    <div>
                      <div className="detail-label">Relationship</div>
                      <div className="detail-value">{emp.emergencyContactRelation || '—'}</div>
                    </div>
                    <div className="detail-span-2">
                      <div className="detail-label">Phone</div>
                      <div className="detail-value">{emp.emergencyContactPhone || '—'}</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted mb-0">No emergency contact on file.</p>
                )}
              </section>

              <section className="card p-md">
                <h3 className="mt-0 mb-md">Bank &amp; Government IDs</h3>
                <div className="detail-grid">
                  <div>
                    <div className="detail-label">Bank</div>
                    <div className="detail-value">{emp.bankName || '—'}</div>
                  </div>
                  <div>
                    <div className="detail-label">Account Number</div>
                    <div className="detail-value mono">{emp.bankName ? maskId(emp.bankAccountNumber) : '—'}</div>
                  </div>
                  {[['TIN', emp.tinNumber], ['SSS', emp.sssNumber], ['PhilHealth', emp.philHealthNumber], ['Pag-IBIG', emp.pagIbigNumber]].map(([label, value]) => (
                    <div key={label}>
                      <div className="detail-label">{label}</div>
                      <div className="detail-value mono">{value ? maskId(value) : '—'}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
