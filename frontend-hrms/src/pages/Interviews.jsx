import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

import LoadingSkeleton from '../components/LoadingSkeleton';
import Modal from '../components/Modal';
import Map from '../components/Map';
import { useToast } from '../components/Toast';
import { formatDate } from '../utils/helpers';
import { useIsAdmin } from '../hooks/useRole';
import useConfirm from '../hooks/useConfirm.jsx';
import useDebounce from '../hooks/useDebounce';
import { icons } from '../components/ActionButton';

function useInterviews(params = {}) {
  return useQuery({ queryKey: ['interviews', params], queryFn: () => api.get('/interviews', { params }).then(r => r.data.data) });
}
function useInterviewers() {
  return useQuery({ queryKey: ['interviewers'], queryFn: () => api.get('/interviewers').then(r => r.data.data) });
}
function useBranches() {
  return useQuery({ queryKey: ['branches'], queryFn: () => api.get('/branches', { baseURL: '/api/v1', params: { limit: 100 } }).then(r => r.data.data?.branches || r.data.data || []) });
}
function useUpdateResult() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, result, feedback }) => api.put(`/interviews/${id}/result`, { result, feedback }).then(r => r.data.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['interviews'] }); qc.invalidateQueries({ queryKey: ['applications'] }); } });
}
function useUpdateInterview() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }) => api.put(`/interviews/${id}`, data).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['interviews'] }) });
}
function useDeleteInterview() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => api.delete(`/interviews/${id}`).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['interviews'] }) });
}

export default function Interviews() {
  const { confirmDelete, confirmDialog } = useConfirm();
  const [dateFilter, setDateFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [page, setPage] = useState(1);
  const [resultModal, setResultModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [editForm, setEditForm] = useState({ scheduledDate: '', scheduledTime: '', interviewer: '', location: '', latitude: '', longitude: '', notes: '', _selectedBranch: '' });
  const [resultForm, setResultForm] = useState({ result: 'pass', feedback: '' });
  const toast = useToast();
  const isAdmin = useIsAdmin();

  const { data, isLoading, error: queryError } = useInterviews({ date: dateFilter || undefined, result: resultFilter || undefined, type: typeFilter || undefined, search: debouncedSearch || undefined, page, limit: 10 });
  const { data: interviewers } = useInterviewers();
  const { data: branchesData } = useBranches();
  const branches = Array.isArray(branchesData) ? branchesData : (branchesData?.branches || branchesData?.data?.branches || []);
  const resultMut = useUpdateResult();
  const updateMut = useUpdateInterview();
  const deleteMut = useDeleteInterview();

  const today = new Date().toISOString().split('T')[0];

  const handleResult = async (e) => {
    e.preventDefault();
    if (!selectedInterview) return;
    try {
      await resultMut.mutateAsync({ id: selectedInterview.id, ...resultForm });
      toast.success('Result saved — application status updated');
      setResultModal(false);
      setSelectedInterview(null);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!selectedInterview) return;
    try {
      await updateMut.mutateAsync({ id: selectedInterview.id, data: editForm });
      toast.success('Interview updated');
      setEditModal(false);
      setSelectedInterview(null);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirmDelete('Delete this interview?'))) return;
    try { await deleteMut.mutateAsync(id); toast.success('Interview deleted'); }
    catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const openResultModal = (interview) => {
    setSelectedInterview(interview);
    setResultForm({ result: interview.result === 'pending' ? 'pass' : interview.result, feedback: interview.feedback || '' });
    setResultModal(true);
  };

  const openEditModal = (interview) => {
    setSelectedInterview(interview);
    const matchedBranch = (branches || []).find(b => {
      const branchLabel = `${b.name}${b.city ? ', ' + b.city : ''}`;
      return branchLabel === interview.location;
    });
    setEditForm({
      scheduledDate: interview.scheduledDate,
      scheduledTime: interview.scheduledTime,
      interviewer: interview.interviewer,
      location: interview.location || '',
      latitude: interview.latitude || '',
      longitude: interview.longitude || '',
      notes: interview.notes || '',
      _selectedBranch: matchedBranch ? String(matchedBranch.id) : (interview.location ? '__custom' : ''),
    });
    setEditModal(true);
  };

  const openViewModal = (interview) => { setSelectedInterview(interview); setViewModal(true); };

  const resultColors = { pending: 'warning', pass: 'success', fail: 'error', cancelled: 'info' };
  const typeColors = { initial: 'info', final: 'accent' };

  return (
    <>
      <header className="pos-header">
        <div><h1>Interviews</h1><div className="sub">View and manage scheduled interviews, set results</div></div>
      </header>

      <div className="flex-wrap-sm mb-md">
        <input className="input-block" placeholder="Search applicant name..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ width: 200 }} />
        <div className="field m-0">
          <label>Date</label>
          <input className="input-block" type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ width: 150 }} />
        </div>
        <div className="field m-0">
          <label>Type</label>
          <select className="input-block" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ width: 130 }}>
            <option value="">All</option><option value="initial">Initial</option><option value="final">Final</option>
          </select>
        </div>
        <div className="field m-0">
          <label>Result</label>
          <select className="input-block" value={resultFilter} onChange={e => setResultFilter(e.target.value)} style={{ width: 130 }}>
            <option value="">All</option><option value="pending">Pending</option><option value="pass">Pass</option><option value="fail">Fail</option>
          </select>
        </div>
      </div>

      {isLoading ? <LoadingSkeleton rows={4} /> : queryError ? (
        <div className="empty-state">Failed to load interviews. Please try again.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Applicant</th><th>Job</th><th>Type</th><th>Date</th><th>Time</th><th>Interviewer</th><th>Location</th><th>Result</th><th>Actions</th></tr></thead>
            <tbody>
              {(data?.interviews || []).map(i => (
                <tr key={i.id}>
                  <td>{i.application?.firstName} {i.application?.middleName ? i.application.middleName + ' ' : ''}{i.application?.lastName}</td>
                  <td>{i.application?.job?.title || '—'}</td>
                  <td><span className={`badge ${typeColors[i.type]}`}>{i.type}</span></td>
                  <td>{formatDate(i.scheduledDate)}</td>
                  <td>{i.scheduledTime}</td>
                  <td>{i.interviewer}</td>
                  <td>{i.location || '—'}</td>
                  <td><span className={`badge ${resultColors[i.result]}`}>{i.result}</span></td>
                  <td>
                    <button className="btn btn-sm btn-secondary mr-xs" onClick={() => openViewModal(i)}>{icons.view}</button>
                    {i.result === 'pending' && <button className="btn btn-sm btn-secondary mr-xs" onClick={() => openResultModal(i)}>{icons.approve}</button>}
                    {i.result === 'pending' && <button className="btn btn-sm btn-outline mr-xs" onClick={() => openEditModal(i)}>{icons.edit}</button>}
                    {isAdmin && i.result === 'pending' && <button className="btn btn-sm btn-danger" onClick={() => handleDelete(i.id)}>{icons.delete}</button>}
                  </td>
                </tr>
              ))}
              {(!data?.interviews || data.interviews.length === 0) && <tr><td colSpan={9} className="empty-state">No interviews.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {data?.pagination?.totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>◀</button>
          <span>Page {page} / {data.pagination.totalPages}</span>
          <button className="btn btn-sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage(p => p + 1)}>▶</button>
        </div>
      )}

      <Modal open={resultModal} onClose={() => setResultModal(false)} title="Interview Result">
        <form onSubmit={handleResult} className="modal-form">
          <div className="mb-sm text-sm">
            <div><strong>Applicant:</strong> {selectedInterview?.application?.firstName} {selectedInterview?.application?.middleName ? selectedInterview.application.middleName + ' ' : ''}{selectedInterview?.application?.lastName}</div>
            <div><strong>Type:</strong> {selectedInterview?.type}</div>
          </div>
          <div className="field"><label>Result *</label>
            <select className="input-block" value={resultForm.result} onChange={e => setResultForm({...resultForm, result: e.target.value})} required>
              <option value="pass">Pass</option><option value="fail">Fail</option><option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="field"><label>Feedback</label><textarea className="input-block" rows={3} value={resultForm.feedback} onChange={e => setResultForm({...resultForm, feedback: e.target.value})} placeholder="Interview feedback..." /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setResultModal(false)}>{icons.close}</button>
            <button type="submit" className="btn btn-primary" disabled={resultMut.isPending}>{resultMut.isPending && <span className="btn-spinner" />}{resultMut.isPending ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Interview">
        <form onSubmit={handleEdit} className="modal-form">
          <div className="form-row">
            <div className="field"><label>Date *</label><input className="input-block" type="date" min={today} value={editForm.scheduledDate} onChange={e => setEditForm({...editForm, scheduledDate: e.target.value})} required /></div>
            <div className="field"><label>Time *</label><input className="input-block" type="time" min={editForm.scheduledDate === today ? new Date().toTimeString().slice(0, 5) : undefined} value={editForm.scheduledTime} onChange={e => setEditForm({...editForm, scheduledTime: e.target.value})} required /></div>
          </div>
          <div className="field"><label>Interviewer *</label>
            <select className="input-block" value={editForm.interviewer} onChange={e => setEditForm({...editForm, interviewer: e.target.value})} required>
              <option value="">Select interviewer</option>
              {(interviewers || []).map(u => <option key={u.id} value={`${u.firstName} ${u.lastName}`}>{u.firstName} {u.lastName}</option>)}
            </select>
          </div>
          <div className="field"><label>Location</label>
            <select className="input-block" value={editForm._selectedBranch || ''} onChange={e => {
              const val = e.target.value;
              if (val === '__custom') {
                setEditForm({...editForm, _selectedBranch: '__custom', location: '', latitude: '', longitude: ''});
              } else if (val) {
                const branch = (branches || []).find(b => String(b.id) === val);
                if (branch) {
                  setEditForm({...editForm, _selectedBranch: val, location: `${branch.name}${branch.city ? ', ' + branch.city : ''}`, latitude: branch.latitude || '', longitude: branch.longitude || ''});
                }
              } else {
                setEditForm({...editForm, _selectedBranch: '', location: '', latitude: '', longitude: ''});
              }
            }}>
              <option value="">Select a location</option>
              {(branches || []).map(b => <option key={b.id} value={b.id}>{b.name}{b.city ? ` (${b.city})` : ''}</option>)}
              <option value="__custom">Custom Location</option>
            </select>
          </div>
          {editForm._selectedBranch === '__custom' && (
            <div className="field"><label>Location Name</label><input className="input-block" value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} placeholder="e.g. Office Meeting Room" /></div>
          )}
          {editForm._selectedBranch === '__custom' && (
            <div className="form-row">
              <div className="field"><label>Latitude</label><input className="input-block" type="number" step="any" value={editForm.latitude} onChange={e => setEditForm({...editForm, latitude: e.target.value})} placeholder="e.g. 14.5995" /></div>
              <div className="field"><label>Longitude</label><input className="input-block" type="number" step="any" value={editForm.longitude} onChange={e => setEditForm({...editForm, longitude: e.target.value})} placeholder="e.g. 120.9842" /></div>
            </div>
          )}
          {editForm.latitude && editForm.longitude && (
            <div className="field">
              <label>Map Preview</label>
              <Map latitude={editForm.latitude} longitude={editForm.longitude} markerTitle={editForm.location || 'Interview Location'} height={200} />
            </div>
          )}
          <div className="field"><label>Notes</label><textarea className="input-block" rows={2} value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setEditModal(false)}>{icons.close}</button>
            <button type="submit" className="btn btn-primary" disabled={updateMut.isPending}>{updateMut.isPending && <span className="btn-spinner" />}{updateMut.isPending ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={viewModal} onClose={() => setViewModal(false)} title="Interview Details">
        {selectedInterview && (
          <div className="text-sm leading-relaxed">
            <div className="mb-sm">
              <div><strong>Applicant:</strong> {selectedInterview.application?.firstName} {selectedInterview.application?.middleName ? selectedInterview.application.middleName + ' ' : ''}{selectedInterview.application?.lastName}</div>
              <div><strong>Email:</strong> {selectedInterview.application?.email || '—'}</div>
              <div><strong>Job:</strong> {selectedInterview.application?.job?.title || '—'}</div>
              <div><strong>Type:</strong> <span className={`badge ${typeColors[selectedInterview.type]}`}>{selectedInterview.type}</span></div>
              <div><strong>Date:</strong> {formatDate(selectedInterview.scheduledDate)}</div>
              <div><strong>Time:</strong> {selectedInterview.scheduledTime}</div>
              <div><strong>Interviewer:</strong> {selectedInterview.interviewer}</div>
              <div><strong>Location:</strong> {selectedInterview.location || '—'}</div>
              {selectedInterview.latitude && selectedInterview.longitude && (
                <div className="mt-sm">
                  <Map latitude={selectedInterview.latitude} longitude={selectedInterview.longitude} markerTitle={selectedInterview.location || 'Interview Location'} height={200} />
                </div>
              )}
              <div><strong>Result:</strong> <span className={`badge ${resultColors[selectedInterview.result]}`}>{selectedInterview.result}</span></div>
            </div>
            {selectedInterview.notes && <div className="mb-sm"><strong>Notes:</strong><div className="mt-xs whitespace-pre-wrap">{selectedInterview.notes}</div></div>}
            {selectedInterview.feedback && <div className="mb-sm"><strong>Feedback:</strong><div className={`mt-xs whitespace-pre-wrap ${selectedInterview.result === 'pass' ? 'text-success' : selectedInterview.result === 'fail' ? 'text-error' : ''}`}>{selectedInterview.feedback}</div></div>}
          </div>
        )}
      </Modal>
    {confirmDialog}
    </>
  );
}
