import { useState } from 'react';
import { useSchedules, useEmployees, usePermanentAssignments, useCreateSchedule, useUpdateSchedule, useDeleteSchedule, useAssignShift, useRemovePermanentAssignment } from '../hooks/useApi';

import LoadingSkeleton from '../components/LoadingSkeleton';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { useIsAdmin, useIsAdminOrHR } from '../hooks/useRole';
import { confirmDelete, confirmAction } from '../utils/swal';
import useDebounce from '../hooks/useDebounce';
import { icons } from '../components/ActionButton';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const emptyForm = { name: '', startTime: '08:00', endTime: '17:00', description: '', daysOfWeek: '1,2,3,4,5', breakMinutes: 60 };

function toDayArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return val.split(',').map(Number).filter(n => !isNaN(n));
  return [1,2,3,4,5];
}

function DaysCheckboxes({ value, onChange }) {
  const selected = toDayArray(value);
  const toggle = (day) => {
    const next = selected.includes(day) ? selected.filter(d => d !== day) : [...selected, day].sort();
    onChange(next.join(','));
  };
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {DAY_LABELS.map((label, i) => (
        <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: selected.includes(i) ? 'var(--primary)' : 'transparent', color: selected.includes(i) ? '#fff' : 'var(--text)' }}>
          <input type="checkbox" checked={selected.includes(i)} onChange={() => toggle(i)} style={{ display: 'none' }} />
          {label}
        </label>
      ))}
    </div>
  );
}

export default function Schedules() {
  const [schedModal, setSchedModal] = useState(false);
  const [schedEditModal, setSchedEditModal] = useState(false);
  const [schedEditTarget, setSchedEditTarget] = useState(null);
  const [assignModal, setAssignModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [form, setForm] = useState({ ...emptyForm });
  const [schedEditForm, setSchedEditForm] = useState({ ...emptyForm });
  const [assignForm, setAssignForm] = useState({ employeeId: '', scheduleId: '' });
  const [editForm, setEditForm] = useState({ scheduleId: '' });
  const toast = useToast();
  const isAdmin = useIsAdmin();
  const canCreateEdit = useIsAdminOrHR();

  const { data: schedData, isLoading: schedLoading } = useSchedules({ limit: 100, search: debouncedSearch || undefined });
  const { data: empData } = useEmployees({ limit: 100, status: 'active' });
  const { data: permData, isLoading: permLoading } = usePermanentAssignments();
  const createSched = useCreateSchedule();
  const updateSched = useUpdateSchedule();
  const deleteSched = useDeleteSchedule();
  const assignShift = useAssignShift();
  const removePerm = useRemovePermanentAssignment();

  const schedules = schedData?.schedules || [];
  const employees = empData?.employees || [];
  const permList = Array.isArray(permData) ? permData : [];
  const assignableEmployees = employees;

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Schedule name is required'); return; }
    if (!form.startTime) { toast.error('Start time is required'); return; }
    if (!form.endTime) { toast.error('End time is required'); return; }
    if (form.startTime >= form.endTime) { toast.error('End time must be after start time'); return; }
    if (!form.daysOfWeek || (Array.isArray(form.daysOfWeek) && form.daysOfWeek.length === 0)) {
      toast.error('Select at least one day'); return;
    }
    try { await createSched.mutateAsync(form); toast.success('Schedule created'); setSchedModal(false); setForm({ ...emptyForm }); }
    catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleSchedEdit = async (e) => {
    e.preventDefault();
    if (!schedEditTarget) return;
    if (!schedEditForm.name.trim()) { toast.error('Schedule name is required'); return; }
    if (!schedEditForm.startTime) { toast.error('Start time is required'); return; }
    if (!schedEditForm.endTime) { toast.error('End time is required'); return; }
    if (schedEditForm.startTime >= schedEditForm.endTime) { toast.error('End time must be after start time'); return; }
    try {
      await updateSched.mutateAsync({ id: schedEditTarget.id, ...schedEditForm });
      toast.success('Schedule updated');
      setSchedEditModal(false);
      setSchedEditTarget(null);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const openSchedEdit = (s) => {
    setSchedEditTarget(s);
    setSchedEditForm({
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      description: s.description || '',
      daysOfWeek: s.daysOfWeek || '1,2,3,4,5',
      breakMinutes: s.breakMinutes ?? 60,
    });
    setSchedEditModal(true);
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignForm.employeeId) { toast.error('Employee is required'); return; }
    if (!assignForm.scheduleId) { toast.error('Schedule is required'); return; }
    try {
      await assignShift.mutateAsync({ employeeId: parseInt(assignForm.employeeId), scheduleId: parseInt(assignForm.scheduleId) });
      toast.success('Shift assigned');
      setAssignModal(false);
      setAssignForm({ employeeId: '', scheduleId: '' });
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editEmp) return;
    if (!editForm.scheduleId) { toast.error('Schedule is required'); return; }
    try {
      await assignShift.mutateAsync({ employeeId: editEmp.id, scheduleId: parseInt(editForm.scheduleId) });
      toast.success('Shift updated');
      setEditModal(false);
      setEditEmp(null);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleRemove = async (empId, name) => {
    if (!(await confirmAction(`Remove shift from ${name}?`))) return;
    try { await removePerm.mutateAsync(empId); toast.success('Shift removed'); }
    catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleDelete = async (s) => {
    if (!(await confirmDelete(`Delete "${s.name}"?`))) return;
    try {
      await deleteSched.mutateAsync(s.id);
      toast.success('Schedule deleted');
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const openEdit = (emp) => {
    setEditEmp(emp);
    setEditForm({ scheduleId: emp.schedule?.id || '' });
    setEditModal(true);
  };

  return (
    <>
      <header className="pos-header">
        <div><h1>Schedules</h1><div className="sub">Manage shift templates and employee assignments</div></div>
        <div className="flex-gap">
          {canCreateEdit && <button className="btn btn-primary" onClick={() => setSchedModal(true)}>＋</button>}
          {canCreateEdit && <button className="btn btn-secondary" onClick={() => setAssignModal(true)}>＋</button>}
        </div>
      </header>

      <div className="search-bar">
        <input className="input-block w-250" placeholder="Search schedules..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <section className="mb-lg">
        <h2 className="section-title">Shift Templates</h2>
        {schedLoading ? <LoadingSkeleton rows={2} /> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Start</th><th>End</th><th>Days</th><th>Break</th><th>Description</th><th>Actions</th></tr></thead>
              <tbody>
                {schedules.map(s => {
                  const days = toDayArray(s.daysOfWeek);
                  return (
                    <tr key={s.id}>
                      <td><strong>{s.name}</strong></td>
                      <td>{s.startTime}</td>
                      <td>{s.endTime}</td>
                      <td>{days.map(d => DAY_LABELS[d]).join(', ')}</td>
                      <td>{s.breakMinutes ?? 60}m</td>
                      <td>{s.description || '—'}</td>
                      <td>
                         {canCreateEdit && <button className="btn btn-sm btn-secondary mr-xs" onClick={() => openSchedEdit(s)}>{icons.edit}</button>}
                         {canCreateEdit && <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s)}>{icons.delete}</button>}
                      </td>
                    </tr>
                  );
                })}
                {schedules.length === 0 && <tr><td colSpan={7} className="empty-state">No schedules yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="section-title">Employee Shift Assignments</h2>
        {permLoading ? <LoadingSkeleton rows={3} /> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Employee</th><th>Employee #</th><th>Department</th><th>Shift</th><th>Start</th><th>End</th><th>Actions</th></tr></thead>
              <tbody>
                {permList.map(emp => (
                  <tr key={emp.id}>
                    <td>{emp.firstName} {emp.middleName ? emp.middleName + ' ' : ''}{emp.lastName}</td>
                    <td>{emp.employeeNo}</td>
                    <td>{emp.department?.name || '—'}</td>
                    <td><strong>{emp.schedule?.name || '—'}</strong></td>
                    <td>{emp.schedule?.startTime || '—'}</td>
                    <td>{emp.schedule?.endTime || '—'}</td>
                    <td>
                       {canCreateEdit && <button className="btn btn-sm btn-secondary mr-xs" onClick={() => openEdit(emp)}>{icons.edit}</button>}
                      {canCreateEdit && <button className="btn btn-sm btn-danger" onClick={() => handleRemove(emp.id, emp.firstName + ' ' + (emp.middleName ? emp.middleName + ' ' : '') + emp.lastName)}>−</button>}
                    </td>
                  </tr>
                ))}
                {permList.length === 0 && <tr><td colSpan={7} className="empty-state">No assignments yet. Click "Assign Shift" to get started.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Create Schedule Modal */}
      <Modal open={schedModal} onClose={() => setSchedModal(false)} title="New Schedule">
        <form onSubmit={handleCreateSchedule} className="modal-form">
          <div className="field"><label htmlFor="sched-name">Name *</label><input id="sched-name" className="input-block" value={form.name} onChange={e => setForm({...form, name: e.target.value.replace(/[^a-zA-Z\s\-'.]/g, '')})} required placeholder="e.g. Morning Shift" /></div>
          <div className="form-row">
            <div className="field"><label htmlFor="sched-startTime">Start Time *</label><input id="sched-startTime" className="input-block" type="time" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} required /></div>
            <div className="field"><label htmlFor="sched-endTime">End Time *</label><input id="sched-endTime" className="input-block" type="time" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} required /></div>
          </div>
          <div className="field"><label>Days of Week</label><DaysCheckboxes value={form.daysOfWeek} onChange={v => setForm({...form, daysOfWeek: v})} /></div>
          <div className="field"><label htmlFor="sched-break">Break Minutes</label><input id="sched-break" className="input-block" type="number" min="0" max="240" value={form.breakMinutes} onChange={e => setForm({...form, breakMinutes: +e.target.value})} /></div>
          <div className="field"><label htmlFor="sched-description">Description</label><input id="sched-description" className="input-block" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Optional" /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setSchedModal(false)}>{icons.close}</button>
            <button type="submit" className="btn btn-primary" disabled={createSched.isPending}>{createSched.isPending && <span className="btn-spinner" />}{createSched.isPending ? 'Creating...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Schedule Modal */}
      <Modal open={schedEditModal} onClose={() => setSchedEditModal(false)} title={`Edit Schedule — ${schedEditTarget?.name || ''}`}>
        <form onSubmit={handleSchedEdit} className="modal-form">
          <div className="field"><label htmlFor="schedEdit-name">Name *</label><input id="schedEdit-name" className="input-block" value={schedEditForm.name} onChange={e => setSchedEditForm({...schedEditForm, name: e.target.value})} required /></div>
          <div className="form-row">
            <div className="field"><label htmlFor="schedEdit-startTime">Start Time *</label><input id="schedEdit-startTime" className="input-block" type="time" value={schedEditForm.startTime} onChange={e => setSchedEditForm({...schedEditForm, startTime: e.target.value})} required /></div>
            <div className="field"><label htmlFor="schedEdit-endTime">End Time *</label><input id="schedEdit-endTime" className="input-block" type="time" value={schedEditForm.endTime} onChange={e => setSchedEditForm({...schedEditForm, endTime: e.target.value})} required /></div>
          </div>
          <div className="field"><label>Days of Week</label><DaysCheckboxes value={schedEditForm.daysOfWeek} onChange={v => setSchedEditForm({...schedEditForm, daysOfWeek: v})} /></div>
          <div className="field"><label htmlFor="schedEdit-break">Break Minutes</label><input id="schedEdit-break" className="input-block" type="number" min="0" max="240" value={schedEditForm.breakMinutes} onChange={e => setSchedEditForm({...schedEditForm, breakMinutes: +e.target.value})} /></div>
          <div className="field"><label htmlFor="schedEdit-desc">Description</label><input id="schedEdit-desc" className="input-block" value={schedEditForm.description} onChange={e => setSchedEditForm({...schedEditForm, description: e.target.value})} placeholder="Optional" /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setSchedEditModal(false)}>{icons.close}</button>
            <button type="submit" className="btn btn-primary" disabled={updateSched.isPending}>{updateSched.isPending && <span className="btn-spinner" />}{updateSched.isPending ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* Assign Shift Modal */}
      <Modal open={assignModal} onClose={() => setAssignModal(false)} title="Assign Shift">
        <form onSubmit={handleAssign} className="modal-form">
          <div className="field"><label htmlFor="assign-employeeId">Employee *</label>
            <select id="assign-employeeId" className="input-block" value={assignForm.employeeId} onChange={e => setAssignForm({...assignForm, employeeId: e.target.value})} required>
              <option value="">Select Employee</option>
              {assignableEmployees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.middleName ? e.middleName + ' ' : ''}{e.lastName}</option>)}
            </select>
            {assignableEmployees.length === 0 && <div className="sub mt-xs">No employees available.</div>}
          </div>
          <div className="field"><label htmlFor="assign-scheduleId">Schedule *</label>
            <select id="assign-scheduleId" className="input-block" value={assignForm.scheduleId} onChange={e => setAssignForm({...assignForm, scheduleId: e.target.value})} required>
              <option value="">Select Schedule</option>
              {schedules.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime} – {s.endTime})</option>)}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setAssignModal(false)}>{icons.close}</button>
            <button type="submit" className="btn btn-primary" disabled={assignShift.isPending}>{assignShift.isPending && <span className="btn-spinner" />}{assignShift.isPending ? 'Assigning...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Shift Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title={`Edit Shift — ${editEmp?.firstName || ''} ${editEmp?.middleName ? editEmp.middleName + ' ' : ''}${editEmp?.lastName || ''}`}>
        <form onSubmit={handleEdit} className="modal-form">
          <div className="field"><label>Current: <strong>{editEmp?.schedule?.name || 'None'}</strong></label></div>
          <div className="field"><label htmlFor="edit-scheduleId">New Schedule *</label>
            <select id="edit-scheduleId" className="input-block" value={editForm.scheduleId} onChange={e => setEditForm({...editForm, scheduleId: e.target.value})} required>
              <option value="">Select Schedule</option>
              {schedules.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime} – {s.endTime})</option>)}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setEditModal(false)}>{icons.close}</button>
            <button type="submit" className="btn btn-primary" disabled={assignShift.isPending}>{assignShift.isPending && <span className="btn-spinner" />}{assignShift.isPending ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
