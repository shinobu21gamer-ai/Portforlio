import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMyProfile } from '../hooks/useApi';
import api from '../api/client';
import LoadingSkeleton from '../components/LoadingSkeleton';
import Swal from 'sweetalert2';
import { icons } from '../components/ActionButton';
import { formatTime, maskId } from '../utils/helpers';

export default function MyProfile() {
  const { data: emp, isLoading } = useMyProfile();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

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
      Swal.fire({ icon: 'success', title: 'Updated', text: 'Profile updated', timer: 1500, showConfirmButton: false });
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['my-profile'] });
    } catch (err) {
      const errors = err.response?.data?.errors;
      const msg = (errors && errors.length ? errors.join('. ') : err.response?.data?.message) || 'Failed to update';
      Swal.fire({ icon: 'error', title: 'Failed', text: msg });
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
      <div className="card p-md max-w-700">
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
          <div className="profile-grid">
            <strong>Employee No</strong><span className="mono">{emp.employeeNo}</span>
            <strong>Name</strong><span>{emp.firstName} {emp.middleName ? emp.middleName + ' ' : ''}{emp.lastName}</span>
            <strong>Email</strong><span>{emp.email}</span>
            <strong>Phone</strong><span>{emp.phone || '—'}</span>
            <strong>Address</strong><span>{emp.address || '—'}</span>
            <strong>Department</strong><span>{emp.department?.name || '—'}</span>
            <strong>Position</strong><span>{emp.position?.title || '—'}</span>
            <strong>Schedule</strong><span>{emp.schedule ? `${emp.schedule.name} (${formatTime(emp.schedule.startTime)} - ${formatTime(emp.schedule.endTime)})` : '—'}</span>
            <strong>Employment Type</strong><span style={{ textTransform: 'capitalize' }}>{String(emp.employmentType || '').replace(/-/g, ' ')}</span>
            <strong>Status</strong><span><span className={`badge ${emp.status === 'active' ? 'success' : 'error'}`}>{emp.status}</span></span>
            <strong>Hire Date</strong><span>{emp.hireDate ? new Date(emp.hireDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}</span>
            <strong>Salary</strong><span>{emp.salary != null ? `₱${Number(emp.salary).toLocaleString()}` : '—'}</span>
            <strong>Emergency Contact</strong><span>{emp.emergencyContactName ? `${emp.emergencyContactName} (${emp.emergencyContactRelation || ''}) - ${emp.emergencyContactPhone}` : '—'}</span>
            <strong>Bank</strong><span>{emp.bankName ? `${emp.bankName} - ${maskId(emp.bankAccountNumber)}` : '—'}</span>
            <strong>Government IDs</strong><span className="text-xs mono">{[emp.tinNumber && `TIN: ${maskId(emp.tinNumber)}`, emp.sssNumber && `SSS: ${maskId(emp.sssNumber)}`, emp.philHealthNumber && `PH: ${maskId(emp.philHealthNumber)}`, emp.pagIbigNumber && `HDMF: ${maskId(emp.pagIbigNumber)}`].filter(Boolean).join('  |  ') || '—'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
