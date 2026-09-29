import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

import LoadingSkeleton from '../components/LoadingSkeleton';
import Modal from '../components/Modal';
import Map from '../components/Map';
import { useToast } from '../components/Toast';
import { formatDate } from '../utils/helpers';
import { useEmployees, useDepartments, usePositions, useSchedules } from '../hooks/useApi';

function useBranches() {
  return useQuery({ queryKey: ['branches'], queryFn: () => api.get('/branches', { baseURL: '/api/v1' }).then(r => r.data.data?.branches || r.data.data || []) });
}
import { useIsAdmin, useIsAdminOrHR } from '../hooks/useRole';
import { confirmApprove, confirmReject, confirmAction, confirmDelete } from '../utils/swal';
import useDebounce from '../hooks/useDebounce';
import { icons } from '../components/ActionButton';

function useJobs(params = {}) {
  return useQuery({ queryKey: ['jobs', params], queryFn: () => api.get('/jobs', { params }).then(r => r.data.data) });
}
function useJob(id) {
  return useQuery({ queryKey: ['job', id], queryFn: () => api.get(`/jobs/${id}`).then(r => r.data.data), enabled: !!id });
}
function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d) => api.post('/jobs', d).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }) });
}
function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...d }) => api.put(`/jobs/${id}`, d).then(r => r.data.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); qc.invalidateQueries({ queryKey: ['job'] }); } });
}
function useCloseJob() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => api.put(`/jobs/${id}/close`).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }) });
}
function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => api.delete(`/jobs/${id}`).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }) });
}
function useApproveJob() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => api.put(`/jobs/${id}/approve`).then(r => r.data.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); qc.invalidateQueries({ queryKey: ['pending-counts'] }); } });
}
function useRejectJob() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => api.put(`/jobs/${id}/reject`).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }) });
}
function useApplications(params = {}) {
  return useQuery({ queryKey: ['applications', params], queryFn: () => api.get('/jobs/applications/list', { params }).then(r => r.data.data) });
}
function useAllInterviews() {
  return useQuery({ queryKey: ['interviews'], queryFn: () => api.get('/interviews', { params: { limit: 200 } }).then(r => r.data.data) });
}
function useInterviewers() {
  return useQuery({ queryKey: ['interviewers'], queryFn: () => api.get('/interviewers').then(r => r.data.data) });
}
function useApply() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (formData) => api.post('/jobs/applications', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['applications'] }) });
}
function useUpdateAppStatus() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, status, notes }) => api.put(`/jobs/applications/${id}/status`, { status, notes }).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['applications'] }) });
}
function useScheduleInterview() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data) => api.post('/interviews', data).then(r => r.data.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['applications'] }); qc.invalidateQueries({ queryKey: ['interviews'] }); } });
}

export default function JobPostings() {
  const [tab, setTab] = useState('jobs');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({ title: '', departmentId: '', positionId: '', scheduleId: '', description: '', requirements: '', salaryMin: '', salaryMax: '', employmentType: 'full-time', paymentFrequency: 'monthly', openings: 1, closingDate: '', location: '' });
  const [editForm, setEditForm] = useState({ title: '', departmentId: '', positionId: '', scheduleId: '', description: '', requirements: '', salaryMin: '', salaryMax: '', employmentType: 'full-time', paymentFrequency: 'monthly', openings: 1, closingDate: '', location: '' });
  const [applyModal, setApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({ firstName: '', lastName: '', email: '', phone: '', coverLetter: '' });
  const [applyJobId, setApplyJobId] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [interviewModal, setInterviewModal] = useState(false);
  const [interviewForm, setInterviewForm] = useState({ applicationId: null, type: 'initial', scheduledDate: '', scheduledTime: '', interviewer: '', location: '', latitude: '', longitude: '', notes: '', _selectedBranch: '' });
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewApplicant, setReviewApplicant] = useState(null);
  const toast = useToast();
  const isAdmin = useIsAdmin();
  const canCreateEdit = useIsAdminOrHR();

  const { data: deptData } = useDepartments({ limit: 100 });
  const { data: empData } = useEmployees({ limit: 100, status: 'active' });
  const depts = deptData?.departments || [];
  const posParams = { limit: 100 };
  if (form.departmentId) posParams.departmentId = form.departmentId;
  const { data: posData } = usePositions(posParams);
  const positions = posData?.positions || [];
  const editPosParams = { limit: 100 };
  if (editForm.departmentId) editPosParams.departmentId = editForm.departmentId;
  const { data: editPosData } = usePositions(editPosParams);
  const editPositions = editPosData?.positions || [];
  const { data: schedData } = useSchedules({ limit: 100 });
  const schedules = schedData?.schedules || [];
  const { data: branchesData } = useBranches();
  const branches = Array.isArray(branchesData) ? branchesData : (branchesData?.branches || branchesData?.data?.branches || []);
  const { data, isLoading } = useJobs({ page, limit: 10, status: statusFilter || undefined, search: debouncedSearch || undefined });
  const { data: appData, isLoading: appLoading } = useApplications({ page, limit: 20, status: statusFilter || undefined });
  const { data: interviewData } = useAllInterviews();
  const { data: interviewers } = useInterviewers();
  const createMut = useCreateJob();
  const updateMut = useUpdateJob();
  const closeMut = useCloseJob();
  const deleteMut = useDeleteJob();
  const approveMut = useApproveJob();
  const rejectMut = useRejectJob();
  const updateStatus = useUpdateAppStatus();
  const applyMut = useApply();
  const scheduleInterviewMut = useScheduleInterview();

  const today = new Date().toLocaleDateString('en-CA');

  const openReviewModal = (app) => { setReviewApplicant(app); setReviewModal(true); };

  const handleConfirmReview = async () => {
    if (!reviewApplicant) return;
    await handleStatusUpdate(reviewApplicant.id, 'reviewed');
    setReviewModal(false);
    setReviewApplicant(null);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Job title is required'); return; }
    if (!form.departmentId) { toast.error('Department is required'); return; }
    if (!form.description.trim()) { toast.error('Description is required'); return; }
    if (form.salaryMin && form.salaryMax && parseFloat(form.salaryMin) > parseFloat(form.salaryMax)) {
      toast.error('Minimum salary cannot exceed maximum salary'); return;
    }
    if (form.openings && parseInt(form.openings, 10) < 1) { toast.error('Openings must be at least 1'); return; }
    try {
      const payload = {
        title: form.title,
        departmentId: parseInt(form.departmentId),
        positionId: form.positionId ? parseInt(form.positionId) : null,
        scheduleId: form.scheduleId ? parseInt(form.scheduleId) : null,
        description: form.description,
        requirements: form.requirements || '',
        salaryMin: form.salaryMin ? parseFloat(form.salaryMin) : null,
        salaryMax: form.salaryMax ? parseFloat(form.salaryMax) : null,
        employmentType: form.employmentType,
        paymentFrequency: form.paymentFrequency,
        openings: form.openings ? parseInt(form.openings) : 1,
        closingDate: form.closingDate || null,
        location: form.location || '',
      };
      await createMut.mutateAsync(payload);
      toast.success('Job posting created - pending admin approval');
      setCreateModal(false);
      setForm({ title: '', departmentId: '', positionId: '', scheduleId: '', description: '', requirements: '', salaryMin: '', salaryMax: '', employmentType: 'full-time', openings: 1, closingDate: '', location: '', _selectedBranch: '' });
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editForm.title.trim()) { toast.error('Job title is required'); return; }
    if (!editForm.departmentId) { toast.error('Department is required'); return; }
    if (!editForm.description.trim()) { toast.error('Description is required'); return; }
    if (editForm.salaryMin && editForm.salaryMax && parseFloat(editForm.salaryMin) > parseFloat(editForm.salaryMax)) {
      toast.error('Minimum salary cannot exceed maximum salary'); return;
    }
    if (editForm.openings && parseInt(editForm.openings, 10) < 1) { toast.error('Openings must be at least 1'); return; }
    try {
      const payload = {
        title: editForm.title,
        departmentId: parseInt(editForm.departmentId),
        positionId: editForm.positionId ? parseInt(editForm.positionId) : null,
        scheduleId: editForm.scheduleId ? parseInt(editForm.scheduleId) : null,
        description: editForm.description,
        requirements: editForm.requirements || '',
        salaryMin: editForm.salaryMin ? parseFloat(editForm.salaryMin) : null,
        salaryMax: editForm.salaryMax ? parseFloat(editForm.salaryMax) : null,
        employmentType: editForm.employmentType,
        paymentFrequency: editForm.paymentFrequency,
        openings: editForm.openings ? parseInt(editForm.openings) : 1,
        closingDate: editForm.closingDate || null,
        location: editForm.location || '',
      };
      await updateMut.mutateAsync({ id: selectedJob.id, ...payload });
      toast.success('Job posting updated');
      setEditModal(false);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleApproveAndPreview = async (job) => {
    try {
      await approveMut.mutateAsync(job.id);
      toast.success('Job posting approved');
      window.open(import.meta.env.BASE_URL + 'careers', '_blank');
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Approval failed');
    }
  };

  const handleApprove = async (job) => {
    if (!(await confirmApprove('Approve this job posting?'))) return;
    handleApproveAndPreview(job);
  };

  const handleReject = async (job) => {
    if (!(await confirmReject('Reject this job posting?'))) return;
    try {
      await rejectMut.mutateAsync(job.id);
      toast.success('Job posting rejected');
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Rejection failed');
    }
  };

  const handleClose = async (job) => {
    if (!(await confirmAction('Close this job posting?'))) return;
    closeMut.mutateAsync(job.id);
  };

  const handleDeleteJob = async (job) => {
    if (!(await confirmDelete(`Delete "${job.title}"? This cannot be undone.`))) return;
    try {
      await deleteMut.mutateAsync(job.id);
      toast.success('Job posting deleted');
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      const result = await updateStatus.mutateAsync({ id, status });
      toast.success(`Application ${status}`);
      return result;
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
      throw err;
    }
  };

  const handleAppStatus = async (id, status, label) => {
    if (!(await confirmAction(`${label}?`))) return;
    await handleStatusUpdate(id, status);
  };

  const handleScheduleInterview = async (e) => {
    e.preventDefault();
    try {
      await scheduleInterviewMut.mutateAsync(interviewForm);
      toast.success('Interview scheduled successfully');
      setInterviewModal(false);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed to schedule interview');
    }
  };

  const viewJob = (job) => { setSelectedJob(job); setDetailModal(true); };

  const openApply = (jobId) => { setApplyJobId(jobId); setApplyForm({ firstName: '', lastName: '', email: '', phone: '', coverLetter: '' }); setResumeFile(null); setApplyModal(true); };

  const handleApply = async (e) => {
    e.preventDefault();
    if (!applyForm.firstName.trim()) { toast.error('First name is required'); return; }
    if (!applyForm.lastName.trim()) { toast.error('Last name is required'); return; }
    if (!applyForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applyForm.email)) {
      toast.error('Valid email is required'); return;
    }
    if (applyForm.phone && applyForm.phone.replace(/[^0-9]/g, '').length < 7) {
      toast.error('Phone number must be at least 7 digits'); return;
    }
    try {
      const fd = new FormData();
      fd.append('jobId', applyJobId);
      fd.append('firstName', applyForm.firstName);
      fd.append('lastName', applyForm.lastName);
      fd.append('email', applyForm.email);
      if (applyForm.phone) fd.append('phone', applyForm.phone);
      if (applyForm.coverLetter) fd.append('coverLetter', applyForm.coverLetter);
      if (resumeFile) fd.append('resume', resumeFile);
      await applyMut.mutateAsync(fd);
      toast.success('Application submitted');
      setApplyModal(false);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const viewResume = async (resumePath) => {
    if (!resumePath) return;
    try {
      const filename = resumePath.split('/').pop();
      const res = await api.get(`/jobs/applications/resume/${encodeURIComponent(filename)}`, { responseType: 'blob' });
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      const ext = filename.split('.').pop().toLowerCase();
      if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(`<html><head><title>Resume</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f5f5f5}img{max-width:100%;max-height:100vh;object-fit:contain}</style></head><body><img src="${url}"/></body></html>`);
          w.document.close();
        } else {
          const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
        }
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      toast.error('Could not load file: ' + err.message);
    }
  };

  const statusColors = { open: 'success', closed: 'error', filled: 'info', pending: 'warning', rejected: 'error', reviewed: 'info', 'initial-interview': 'info', 'final-interview': 'info', accepted: 'success', hired: 'success' };

  const interviews = interviewData?.interviews || [];
  const interviewsByApp = {};
  interviews.forEach(i => {
    if (!interviewsByApp[i.applicationId]) interviewsByApp[i.applicationId] = [];
    interviewsByApp[i.applicationId].push(i);
  });

  const getInterviewsForApp = (appId) => interviewsByApp[appId] || [];
  const hasInitialInterview = (appId) => getInterviewsForApp(appId).some(i => i.type === 'initial' && i.result === 'pass');
  const hasFinalInterview = (appId) => getInterviewsForApp(appId).some(i => i.type === 'final');
  const hasFinalPassed = (appId) => getInterviewsForApp(appId).some(i => i.type === 'final' && i.result === 'pass');
  const hasScheduledInterview = (appId, type) => getInterviewsForApp(appId).some(i => i.type === type);

  const jobStatusFilterOptions = [
    { value: '', label: 'All Status' },
    { value: 'pending', label: 'Pending Approval' },
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
    { value: 'filled', label: 'Filled' },
  ];

  return (
    <>
      <header className="pos-header">
        <div><h1>Job Postings & Hiring</h1><div className="sub">Manage job postings, applications, and interviews</div></div>
        <div className="flex-gap">
          <button className="btn btn-outline" onClick={() => window.open(import.meta.env.BASE_URL + 'careers', '_blank')}>{icons.view} Portal</button>
          {tab === 'jobs' && canCreateEdit && <button className="btn btn-primary" onClick={() => setCreateModal(true)}>＋</button>}
        </div>
      </header>

      <div className="flex gap-xs items-center mb-md">
        {['jobs', 'applications'].map(t => (
          <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setTab(t); setPage(1); setStatusFilter(''); }}>
            {t === 'jobs' ? 'Job Postings' : 'Applications'}
          </button>
        ))}
        <select className="input-block w-160 ml-xs" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          {tab === 'jobs' ? <>
            <option value="pending">Pending Approval</option><option value="open">Open</option><option value="closed">Closed</option><option value="rejected">Rejected</option><option value="filled">Filled</option>
          </> : <>
            <option value="pending">Pending</option><option value="reviewed">Reviewed</option><option value="initial-interview">Initial Interview</option>
            <option value="final-interview">Final Interview</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="hired">Hired</option>
          </>}
        </select>
        <input className="input-block w-200 ml-xs" placeholder={tab === 'jobs' ? 'Search job title...' : 'Search applicant...'} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {tab === 'jobs' && (isLoading ? <LoadingSkeleton rows={4} /> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Title</th><th>Department</th><th>Type</th><th>Pay</th><th>Location</th><th>Schedule</th><th>Salary Range</th><th>Openings</th><th>Applicants</th><th>Closing</th><th>Status</th><th>Approved</th><th>Actions</th></tr></thead>
            <tbody>
              {(data?.jobs || []).map(j => (
                <tr key={j.id}>
                  <td><strong>{j.title}</strong></td>
                  <td>{j.department?.name}</td>
                  <td>{j.employmentType}</td>
                  <td>{j.paymentFrequency === 'semi-monthly' ? 'Semi-Monthly' : 'Monthly'}</td>
                  <td>{j.location || '—'}</td>
                  <td>{j.schedule ? `${j.schedule.name} (${j.schedule.startTime}-${j.schedule.endTime})` : '—'}</td>
                  <td>{j.salaryMin ? `₱${Number(j.salaryMin).toLocaleString()}` : '—'} – {j.salaryMax ? `₱${Number(j.salaryMax).toLocaleString()}` : '—'}</td>
                  <td>{j.openings}</td>
                  <td>{j.applicantCount || 0}</td>
                  <td>{j.closingDate || '—'}</td>
                  <td><span className={`badge ${statusColors[j.status] || 'info'}`}>{j.status}</span></td>
                  <td>{j.approvedAt ? <span className="badge success">Approved</span> : j.status === 'rejected' ? <span className="badge error">Rejected</span> : <span className="badge warning">Pending</span>}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => viewJob(j)} style={{ marginRight: 4 }}>{icons.view}</button>
                    {canCreateEdit && (j.status === 'pending' || j.status === 'open') && <button className="btn btn-sm btn-outline" onClick={() => { setSelectedJob(j); const matchedBranch = (branches || []).find(b => j.location && j.location.startsWith(b.name)); setEditForm({ title: j.title, departmentId: j.departmentId || '', positionId: j.positionId || '', scheduleId: j.scheduleId || '', description: j.description || '', requirements: j.requirements || '', salaryMin: j.salaryMin || '', salaryMax: j.salaryMax || '', employmentType: j.employmentType || 'full-time', paymentFrequency: j.paymentFrequency || 'monthly', openings: j.openings || 1, closingDate: j.closingDate || '', location: j.location || '', _selectedBranch: matchedBranch ? String(matchedBranch.id) : (j.location ? '__custom' : '') }); setEditModal(true); }} style={{ marginRight: 4 }}>{icons.edit}</button>}
                    {j.status === 'pending' && isAdmin && <button className="btn btn-sm btn-success" onClick={() => handleApprove(j)} disabled={approveMut.isPending} style={{ marginRight: 4 }}>{icons.approve} Approve</button>}
                    {j.status === 'pending' && isAdmin && <button className="btn btn-sm btn-danger" onClick={() => handleReject(j)} disabled={rejectMut.isPending}>Reject</button>}
                    {j.status === 'open' && <button className="btn btn-sm btn-primary" onClick={() => window.open(import.meta.env.BASE_URL + 'careers', '_blank')} style={{ marginRight: 4 }}>⊙</button>}
                    {j.status === 'open' && <button className="btn btn-sm btn-outline" onClick={() => handleClose(j)} disabled={closeMut.isPending} style={{ marginRight: 4 }}>{icons.close}</button>}
                    {isAdmin && <button className="btn btn-sm btn-danger" onClick={() => handleDeleteJob(j)} disabled={deleteMut.isPending}>{icons.delete}</button>}
                  </td>
                </tr>
              ))}
              {(!data?.jobs || data.jobs.length === 0) && <tr><td colSpan={13} className="empty-state">No job postings.</td></tr>}
            </tbody>
          </table>
        </div>
      ))}

      {tab === 'applications' && (appLoading ? <LoadingSkeleton rows={4} /> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Applied For</th><th>Resume</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {(appData?.applications || []).map(a => (
                <tr key={a.id}>
                  <td>{a.firstName} {a.middleName ? a.middleName + ' ' : ''}{a.lastName}</td>                  <td>{a.email}</td>
                  <td>{a.phone || '—'}</td>
                  <td>{a.job?.title || '—'}</td>
                  <td>{a.resumePath ? <button className="btn btn-sm btn-outline" onClick={() => viewResume(a.resumePath)}>{icons.view}</button> : <span className="muted">—</span>}</td>
                  <td><span className={`badge ${statusColors[a.status] || 'info'}`}>{a.status}</span></td>
                  <td>
                            {a.status === 'pending' && <button className="btn btn-sm btn-secondary" onClick={() => openReviewModal(a)}>📋 Review</button>}
                    {a.status === 'reviewed' && !hasScheduledInterview(a.id, 'initial') && <button className="btn btn-sm btn-primary" onClick={() => { setSelectedApplicant(a); setInterviewForm({ applicationId: a.id, type: 'initial', scheduledDate: '', scheduledTime: '', interviewer: '', location: '', latitude: '', longitude: '', _selectedBranch: '', notes: '' }); setInterviewModal(true); }}>Schedule</button>}
                    {a.status === 'reviewed' && hasScheduledInterview(a.id, 'initial') && <span className="muted text-xs">Interview scheduled</span>}
                    {a.status === 'initial-interview' && !hasInitialInterview(a.id) && hasScheduledInterview(a.id, 'initial') && <span className="muted text-xs">Awaiting initial result</span>}
                    {a.status === 'initial-interview' && !hasInitialInterview(a.id) && !hasScheduledInterview(a.id, 'initial') && <span className="muted text-xs">No interview scheduled</span>}
                    {a.status === 'initial-interview' && hasInitialInterview(a.id) && !hasScheduledInterview(a.id, 'final') && <button className="btn btn-sm btn-primary" onClick={() => { setSelectedApplicant(a); setInterviewForm({ applicationId: a.id, type: 'final', scheduledDate: '', scheduledTime: '', interviewer: '', location: '', latitude: '', longitude: '', _selectedBranch: '', notes: '' }); setInterviewModal(true); }}>Schedule Final</button>}
                    {a.status === 'initial-interview' && hasInitialInterview(a.id) && hasScheduledInterview(a.id, 'final') && <span className="muted" style={{ fontSize: 12 }}>Final scheduled</span>}
                    {a.status === 'final-interview' && hasFinalInterview(a.id) && !hasFinalPassed(a.id) && <span className="muted" style={{ fontSize: 12 }}>Awaiting result</span>}
                    {a.status === 'final-interview' && hasFinalInterview(a.id) && hasFinalPassed(a.id) && <>
                      <button className="btn btn-sm btn-success" onClick={() => handleAppStatus(a.id, 'accepted', 'Accept application')} style={{ marginRight: 4 }}>{icons.approve}</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleAppStatus(a.id, 'rejected', 'Reject application')}>Reject</button>
                    </>}
                    {a.status === 'final-interview' && !hasFinalInterview(a.id) && <button className="btn btn-sm btn-primary" onClick={() => { setSelectedApplicant(a); setInterviewForm({ applicationId: a.id, type: 'final', scheduledDate: '', scheduledTime: '', interviewer: '', location: '', latitude: '', longitude: '', _selectedBranch: '', notes: '' }); setInterviewModal(true); }}>Schedule Final</button>}
                    {a.status === 'accepted' && <button className="btn btn-sm btn-success" onClick={() => handleAppStatus(a.id, 'hired', 'Hire this applicant')}>★ Hire</button>}
                  </td>
                </tr>
              ))}
              {(!appData?.applications || appData.applications.length === 0) && <tr><td colSpan={7} className="empty-state">No applications.</td></tr>}
            </tbody>
          </table>
        </div>
      ))}

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="New Job Posting" wide>
        <form onSubmit={handleCreate} className="modal-form">
          <div className="field"><label htmlFor="job-title">Title *</label><input id="job-title" className="input-block" value={form.title} onChange={e => setForm({...form, title: e.target.value.replace(/[^a-zA-Z\s\-'.]/g, '')})} required /></div>
          <div className="form-row">
            <div className="field"><label htmlFor="job-departmentId">Department *</label>
              <select id="job-departmentId" className="input-block" value={form.departmentId} onChange={e => setForm({...form, departmentId: e.target.value, positionId: ''})} required>
                <option value="">Select</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="job-positionId">Position *</label>
              <select id="job-positionId" className="input-block" value={form.positionId} onChange={e => setForm({...form, positionId: e.target.value})} required disabled={!form.departmentId}>
                <option value="">{form.departmentId ? (positions.length ? 'Select position' : 'No positions — create one first') : 'Select department first'}</option>{positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="job-employmentType">Employment Type</label>
              <select id="job-employmentType" className="input-block" value={form.employmentType} onChange={e => setForm({...form, employmentType: e.target.value})}>
                <option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="contract">Contract</option>
              </select>
            </div>
            <div className="field"><label htmlFor="job-paymentFreq">Pay Schedule</label>
              <select id="job-paymentFreq" className="input-block" value={form.paymentFrequency} onChange={e => setForm({...form, paymentFrequency: e.target.value})}>
                <option value="monthly">Monthly</option><option value="semi-monthly">Semi-Monthly (15th)</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="job-salaryMin">Salary Min (₱)</label><input id="job-salaryMin" className="input-block" type="number" min="0" value={form.salaryMin} onChange={e => setForm({...form, salaryMin: e.target.value})} /></div>
            <div className="field"><label htmlFor="job-salaryMax">Salary Max (₱)</label><input id="job-salaryMax" className="input-block" type="number" min="0" value={form.salaryMax} onChange={e => setForm({...form, salaryMax: e.target.value})} /></div>
            <div className="field"><label htmlFor="job-openings">Openings</label><input id="job-openings" className="input-block" type="number" min="1" value={form.openings} onChange={e => setForm({...form, openings: e.target.value})} /></div>
          </div>
          <div className="field"><label htmlFor="job-schedule">Shift Schedule</label><select id="job-schedule" className="input-block" value={form.scheduleId} onChange={e => setForm({...form, scheduleId: e.target.value})}><option value="">No schedule</option>{schedules.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</option>)}</select></div>
          <div className="form-row">
            <div className="field"><label htmlFor="job-location">Work Location</label>
              <select id="job-location" className="input-block" value={form._selectedBranch || ''} onChange={e => {
                const val = e.target.value;
                if (val === '__custom') {
                  setForm({...form, _selectedBranch: '__custom', location: ''});
                } else if (val) {
                  const branch = (branches || []).find(b => String(b.id) === val);
                  if (branch) setForm({...form, _selectedBranch: val, location: `${branch.name}${branch.city ? ', ' + branch.city : ''}`});
                } else {
                  setForm({...form, _selectedBranch: '', location: ''});
                }
              }}>
                <option value="">Select a location</option>
                {(branches || []).map(b => <option key={b.id} value={b.id}>{b.name}{b.city ? ` (${b.city})` : ''}</option>)}
                <option value="__custom">Custom Location</option>
              </select>
            </div>
            {form._selectedBranch === '__custom' && (
              <div className="field"><label htmlFor="job-location-custom">Location Name</label><input id="job-location-custom" className="input-block" value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="e.g. Remote, Main Office" /></div>
            )}
            <div className="field"><label htmlFor="job-closingDate">Closing Date</label><input id="job-closingDate" className="input-block" type="date" min={today} value={form.closingDate} onChange={e => setForm({...form, closingDate: e.target.value})} /></div>
          </div>
          <div className="field"><label htmlFor="job-description">Description *</label><textarea id="job-description" className="input-block" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} required /></div>
          <div className="field"><label htmlFor="job-requirements">Requirements</label><textarea id="job-requirements" className="input-block" rows={2} value={form.requirements} onChange={e => setForm({...form, requirements: e.target.value})} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setCreateModal(false)}>{icons.close}</button>
            <button type="submit" className="btn btn-primary" disabled={createMut.isPending}>{createMut.isPending && <span className="btn-spinner" />}{createMut.isPending ? 'Creating...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Job Posting" wide>
        <form onSubmit={handleEdit} className="modal-form">
          <div className="field"><label htmlFor="edit-title">Title *</label><input id="edit-title" className="input-block" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} required /></div>
          <div className="form-row">
            <div className="field"><label htmlFor="edit-departmentId">Department *</label>
              <select id="edit-departmentId" className="input-block" value={editForm.departmentId} onChange={e => setEditForm({...editForm, departmentId: e.target.value, positionId: ''})} required>
                <option value="">Select</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="edit-positionId">Position *</label>
              <select id="edit-positionId" className="input-block" value={editForm.positionId} onChange={e => setEditForm({...editForm, positionId: e.target.value})} required disabled={!editForm.departmentId}>
                <option value="">{editForm.departmentId ? (editPositions.length ? 'Select position' : 'No positions — create one first') : 'Select department first'}</option>{editPositions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="edit-employmentType">Employment Type</label>
              <select id="edit-employmentType" className="input-block" value={editForm.employmentType} onChange={e => setEditForm({...editForm, employmentType: e.target.value})}>
                <option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="contract">Contract</option>
              </select>
            </div>
            <div className="field"><label htmlFor="edit-paymentFreq">Pay Schedule</label>
              <select id="edit-paymentFreq" className="input-block" value={editForm.paymentFrequency} onChange={e => setEditForm({...editForm, paymentFrequency: e.target.value})}>
                <option value="monthly">Monthly</option><option value="semi-monthly">Semi-Monthly (15th)</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="edit-salaryMin">Salary Min (₱)</label><input id="edit-salaryMin" className="input-block" type="number" min="0" value={editForm.salaryMin} onChange={e => setEditForm({...editForm, salaryMin: e.target.value})} /></div>
            <div className="field"><label htmlFor="edit-salaryMax">Salary Max (₱)</label><input id="edit-salaryMax" className="input-block" type="number" min="0" value={editForm.salaryMax} onChange={e => setEditForm({...editForm, salaryMax: e.target.value})} /></div>
            <div className="field"><label htmlFor="edit-openings">Openings</label><input id="edit-openings" className="input-block" type="number" min="1" value={editForm.openings} onChange={e => setEditForm({...editForm, openings: e.target.value})} /></div>
          </div>
          <div className="field"><label htmlFor="edit-schedule">Shift Schedule</label><select id="edit-schedule" className="input-block" value={editForm.scheduleId} onChange={e => setEditForm({...editForm, scheduleId: e.target.value})}><option value="">No schedule</option>{schedules.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</option>)}</select></div>
          <div className="form-row">
            <div className="field"><label htmlFor="edit-location">Work Location</label>
              <select id="edit-location" className="input-block" value={editForm._selectedBranch || ''} onChange={e => {
                const val = e.target.value;
                if (val === '__custom') {
                  setEditForm({...editForm, _selectedBranch: '__custom', location: ''});
                } else if (val) {
                  const branch = (branches || []).find(b => String(b.id) === val);
                  if (branch) setEditForm({...editForm, _selectedBranch: val, location: `${branch.name}${branch.city ? ', ' + branch.city : ''}`});
                } else {
                  setEditForm({...editForm, _selectedBranch: '', location: ''});
                }
              }}>
                <option value="">Select a location</option>
                {(branches || []).map(b => <option key={b.id} value={b.id}>{b.name}{b.city ? ` (${b.city})` : ''}</option>)}
                <option value="__custom">Custom Location</option>
              </select>
            </div>
            {editForm._selectedBranch === '__custom' && (
              <div className="field"><label htmlFor="edit-location-custom">Location Name</label><input id="edit-location-custom" className="input-block" value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} placeholder="e.g. Remote, Main Office" /></div>
            )}
            <div className="field"><label htmlFor="edit-closingDate">Closing Date</label><input id="edit-closingDate" className="input-block" type="date" min={today} value={editForm.closingDate} onChange={e => setEditForm({...editForm, closingDate: e.target.value})} /></div>
          </div>
          <div className="field"><label htmlFor="edit-description">Description *</label><textarea id="edit-description" className="input-block" rows={3} value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} required /></div>
          <div className="field"><label htmlFor="edit-requirements">Requirements</label><textarea id="edit-requirements" className="input-block" rows={2} value={editForm.requirements} onChange={e => setEditForm({...editForm, requirements: e.target.value})} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setEditModal(false)}>{icons.close}</button>
            <button type="submit" className="btn btn-primary" disabled={updateMut.isPending}>{updateMut.isPending && <span className="btn-spinner" />}{updateMut.isPending ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={applyModal} onClose={() => setApplyModal(false)} title="Apply for Position" wide>
        <form onSubmit={handleApply} className="modal-form">
          <div className="form-row">
            <div className="field"><label htmlFor="apply-firstName">First Name *</label><input id="apply-firstName" className="input-block" value={applyForm.firstName} onChange={e => setApplyForm({...applyForm, firstName: e.target.value.replace(/[^a-zA-Z\s\-'.]/g, '')})} required /></div>
            <div className="field"><label htmlFor="apply-lastName">Last Name *</label><input id="apply-lastName" className="input-block" value={applyForm.lastName} onChange={e => setApplyForm({...applyForm, lastName: e.target.value.replace(/[^a-zA-Z\s\-'.]/g, '')})} required /></div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="apply-email">Email *</label><input id="apply-email" className="input-block" type="email" value={applyForm.email} onChange={e => setApplyForm({...applyForm, email: e.target.value})} required /></div>
            <div className="field"><label htmlFor="apply-phone">Phone</label><input id="apply-phone" className="input-block" inputMode="tel" minLength={7} maxLength={20} value={applyForm.phone} onChange={e => setApplyForm({...applyForm, phone: e.target.value.replace(/[^0-9+\-\s]/g, '')})} /></div>
          </div>
          <div className="field"><label htmlFor="apply-resume">Resume (PDF, DOC, DOCX, JPEG, PNG)</label><input id="apply-resume" className="input-block" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => setResumeFile(e.target.files[0])} /></div>
          <div className="field"><label htmlFor="apply-coverLetter">Cover Letter</label><textarea id="apply-coverLetter" className="input-block" rows={3} value={applyForm.coverLetter} onChange={e => setApplyForm({...applyForm, coverLetter: e.target.value})} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setApplyModal(false)}>{icons.close}</button>
            <button type="submit" className="btn btn-primary" disabled={applyMut.isPending}>{applyMut.isPending && <span className="btn-spinner" />}{applyMut.isPending ? 'Submitting...' : 'Submit'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={detailModal} onClose={() => setDetailModal(false)} title={selectedJob?.title || 'Job Details'} wide>
        {selectedJob && (
          <div>
            <div className="detail-grid mb-md text-sm">
              <div><strong>Department:</strong> {selectedJob.department?.name}</div>
              <div><strong>Type:</strong> {selectedJob.employmentType}</div>
              <div><strong>Pay Schedule:</strong> {selectedJob.paymentFrequency === 'semi-monthly' ? 'Semi-Monthly (15th)' : 'Monthly'}</div>
              <div><strong>Salary:</strong> {selectedJob.salaryMin ? `₱${Number(selectedJob.salaryMin).toLocaleString()}` : '—'} – {selectedJob.salaryMax ? `₱${Number(selectedJob.salaryMax).toLocaleString()}` : '—'}</div>
              <div><strong>Openings:</strong> {selectedJob.openings}</div>
              <div><strong>Applicants:</strong> {selectedJob.applications?.length || 0}</div>
              <div><strong>Location:</strong> {selectedJob.location || '—'}</div>
              <div><strong>Closing Date:</strong> {selectedJob.closingDate || '—'}</div>
              <div><strong>Status:</strong> <span className={`badge ${statusColors[selectedJob.status]}`}>{selectedJob.status}</span></div>
            </div>
            {selectedJob.status === 'open' && (
              <div className="mb-md">
                <button className="btn btn-primary" onClick={() => window.open(import.meta.env.BASE_URL + 'careers', '_blank')}>⊙ Portal</button>
              </div>
            )}
            <div className="mb-sm"><strong>Description:</strong><div className="text-sm mt-xs">{selectedJob.description}</div></div>
            {selectedJob.requirements && <div className="mb-sm"><strong>Requirements:</strong><div className="text-sm mt-xs">{selectedJob.requirements}</div></div>}
            {selectedJob.applications?.length > 0 && (
              <div><strong>Applications ({selectedJob.applications.length}):</strong>
                <div className="table-wrap overflow-auto" style={{ maxHeight: 200 }}>
                  <table className="data-table">
                    <thead><tr><th>Name</th><th>Email</th><th>Resume</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {selectedJob.applications.map(a => (
                        <tr key={a.id}>
                          <td>{a.firstName} {a.middleName ? a.middleName + ' ' : ''}{a.lastName}</td><td>{a.email}</td>
                          <td>{a.resumePath ? <button className="btn btn-sm btn-outline" onClick={() => viewResume(a.resumePath)}>📄</button> : '—'}</td>
                          <td><span className={`badge ${statusColors[a.status]}`}>{a.status}</span></td>
                          <td>
                    {a.status === 'pending' && <button className="btn btn-sm btn-secondary" onClick={() => openReviewModal(a)}>📋 Review</button>}
                            {a.status === 'reviewed' && !hasScheduledInterview(a.id, 'initial') && <button className="btn btn-sm btn-primary" onClick={() => { setSelectedApplicant(a); setInterviewForm({ applicationId: a.id, type: 'initial', scheduledDate: '', scheduledTime: '', interviewer: '', location: '', latitude: '', longitude: '', _selectedBranch: '', notes: '' }); setInterviewModal(true); }}>Schedule</button>}
                            {a.status === 'reviewed' && hasScheduledInterview(a.id, 'initial') && <span className="muted text-xs">Scheduled</span>}
                            {a.status === 'initial-interview' && !hasInitialInterview(a.id) && hasScheduledInterview(a.id, 'initial') && <span className="muted text-xs">Awaiting initial result</span>}
                            {a.status === 'initial-interview' && !hasInitialInterview(a.id) && !hasScheduledInterview(a.id, 'initial') && <span className="muted text-xs">No interview scheduled</span>}
                            {a.status === 'initial-interview' && hasInitialInterview(a.id) && !hasScheduledInterview(a.id, 'final') && <button className="btn btn-sm btn-primary" onClick={() => { setSelectedApplicant(a); setInterviewForm({ applicationId: a.id, type: 'final', scheduledDate: '', scheduledTime: '', interviewer: '', location: '', latitude: '', longitude: '', _selectedBranch: '', notes: '' }); setInterviewModal(true); }}>Schedule Final</button>}
                            {a.status === 'initial-interview' && hasInitialInterview(a.id) && hasScheduledInterview(a.id, 'final') && <span className="muted text-xs">Final scheduled</span>}
                            {a.status === 'final-interview' && hasFinalInterview(a.id) && !hasFinalPassed(a.id) && <span className="muted text-xs">Awaiting result</span>}
                            {a.status === 'final-interview' && hasFinalInterview(a.id) && hasFinalPassed(a.id) && <>
                              <button className="btn btn-sm btn-success" onClick={() => handleAppStatus(a.id, 'accepted', 'Accept application')} style={{ marginRight: 4 }}>{icons.approve}</button>
<button className="btn btn-sm btn-danger" onClick={() => handleAppStatus(a.id, 'rejected', 'Reject application')}>Reject</button>
                            </>}
{a.status === 'final-interview' && !hasFinalInterview(a.id) && <button className="btn btn-sm btn-primary" onClick={() => { setSelectedApplicant(a); setInterviewForm({ applicationId: a.id, type: 'final', scheduledDate: '', scheduledTime: '', interviewer: '', location: '', latitude: '', longitude: '', _selectedBranch: '', notes: '' }); setInterviewModal(true); }}>Schedule Final</button>}
                            {a.status === 'accepted' && <button className="btn btn-sm btn-success" onClick={() => handleAppStatus(a.id, 'hired', 'Hire this applicant')}>★ Hire</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
      <Modal open={interviewModal} onClose={() => setInterviewModal(false)} title={`Schedule ${interviewForm.type === 'initial' ? 'Initial' : 'Final'} Interview${selectedApplicant ? ` for ${selectedApplicant.firstName} ${selectedApplicant.middleName ? selectedApplicant.middleName + ' ' : ''}${selectedApplicant.lastName}` : ''}`} wide>
        <form onSubmit={handleScheduleInterview} className="modal-form">
          <div className="form-row">
            <div className="field">
              <label htmlFor="int-scheduledDate">Date *</label>
              <input id="int-scheduledDate" className="input-block" type="date" min={today} value={interviewForm.scheduledDate} onChange={e => setInterviewForm({...interviewForm, scheduledDate: e.target.value})} required />
            </div>
            <div className="field">
              <label htmlFor="int-scheduledTime">Time *</label>
              <input id="int-scheduledTime" className="input-block" type="time" min={interviewForm.scheduledDate === today ? new Date().toTimeString().slice(0, 5) : undefined} value={interviewForm.scheduledTime} onChange={e => setInterviewForm({...interviewForm, scheduledTime: e.target.value})} required />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="int-interviewer">Interviewer *</label>
              <select id="int-interviewer" className="input-block" value={interviewForm.interviewer} onChange={e => setInterviewForm({...interviewForm, interviewer: e.target.value})} required>
                <option value="">Select interviewer</option>
                {(interviewers || []).map(u => <option key={u.id} value={`${u.firstName} ${u.lastName}`}>{u.firstName} {u.lastName} — {u.email}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="int-location">Location</label>
              <select id="int-location" className="input-block" value={interviewForm._selectedBranch || ''} onChange={e => {
                const val = e.target.value;
                if (val === '__custom') {
                  setInterviewForm({...interviewForm, _selectedBranch: '__custom', location: '', latitude: '', longitude: ''});
                } else if (val) {
                  const branch = (branches || []).find(b => String(b.id) === val);
                  if (branch) setInterviewForm({...interviewForm, _selectedBranch: val, location: `${branch.name}${branch.city ? ', ' + branch.city : ''}`, latitude: branch.latitude || '', longitude: branch.longitude || ''});
                } else {
                  setInterviewForm({...interviewForm, _selectedBranch: '', location: '', latitude: '', longitude: ''});
                }
              }}>
                <option value="">Select a location</option>
                {(branches || []).map(b => <option key={b.id} value={b.id}>{b.name}{b.city ? ` (${b.city})` : ''}</option>)}
                <option value="__custom">Custom Location</option>
              </select>
            </div>
          </div>
          {interviewForm._selectedBranch === '__custom' && (
            <div className="form-row">
              <div className="field"><label>Location Name</label><input className="input-block" value={interviewForm.location} onChange={e => setInterviewForm({...interviewForm, location: e.target.value})} placeholder="e.g. Conference Room A, Zoom" /></div>
            </div>
          )}
          {interviewForm._selectedBranch !== '__custom' && interviewForm._selectedBranch && (
            <div className="form-row">
              <div className="field"><label>Location Name</label><input className="input-block" value={interviewForm.location} readOnly style={{ background: 'var(--muted)' }} /></div>
            </div>
          )}
          {interviewForm.latitude && interviewForm.longitude && (
            <div className="field">
              <label>Map Preview</label>
              <Map latitude={interviewForm.latitude} longitude={interviewForm.longitude} markerTitle={interviewForm.location || 'Interview Location'} height={200} />
            </div>
          )}
          <div className="form-row">
            <div className="field">
              <label>Latitude</label>
              <input className="input-block" type="number" step="any" value={interviewForm.latitude || ''} onChange={e => setInterviewForm({...interviewForm, latitude: e.target.value})} placeholder="e.g. 14.5995" />
            </div>
            <div className="field">
              <label>Longitude</label>
              <input className="input-block" type="number" step="any" value={interviewForm.longitude || ''} onChange={e => setInterviewForm({...interviewForm, longitude: e.target.value})} placeholder="e.g. 120.9842" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="int-notes">Notes</label>
            <textarea id="int-notes" className="input-block" rows={2} value={interviewForm.notes} onChange={e => setInterviewForm({...interviewForm, notes: e.target.value})} placeholder="Any additional notes for the interview..." />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setInterviewModal(false)}>{icons.close}</button>
            <button type="submit" className="btn btn-primary" disabled={scheduleInterviewMut.isPending}>{scheduleInterviewMut.isPending && <span className="btn-spinner" />}{scheduleInterviewMut.isPending ? 'Scheduling...' : 'Schedule'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={reviewModal} onClose={() => setReviewModal(false)} title="Review Application" wide>
        {reviewApplicant && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: 13 }}>
              <div><strong>Name:</strong> {reviewApplicant.firstName} {reviewApplicant.middleName ? reviewApplicant.middleName + ' ' : ''}{reviewApplicant.lastName}</div>
              <div><strong>Email:</strong> {reviewApplicant.email}</div>
              <div><strong>Phone:</strong> {reviewApplicant.phone || '—'}</div>
              <div><strong>Applied For:</strong> {reviewApplicant.job?.title || '—'}</div>
              <div><strong>Status:</strong> <span className={`badge ${statusColors[reviewApplicant.status] || 'info'}`}>{reviewApplicant.status}</span></div>
            </div>
            {reviewApplicant.coverLetter && (
              <div style={{ marginBottom: 16 }}>
                <strong>Cover Letter:</strong>
                <div style={{ fontSize: 13, marginTop: 4, padding: 12, background: 'var(--bg)', borderRadius: 6, whiteSpace: 'pre-wrap' }}>{reviewApplicant.coverLetter}</div>
              </div>
            )}
            {reviewApplicant.resumePath && (
              <div style={{ marginBottom: 16 }}>
                <strong>Resume:</strong>
                <div style={{ marginTop: 4 }}>
                  <button className="btn btn-sm btn-outline" onClick={() => viewResume(reviewApplicant.resumePath)}>📄 View Resume</button>
                </div>
              </div>
            )}
            {!reviewApplicant.resumePath && (
              <div style={{ marginBottom: 16 }}><strong>Resume:</strong> <span className="muted">No resume uploaded</span></div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setReviewModal(false)}>{icons.close}</button>
              <button className="btn btn-primary" onClick={handleConfirmReview} disabled={updateStatus.isPending}>{updateStatus.isPending && <span className="btn-spinner" />}{updateStatus.isPending ? 'Reviewing...' : <>{icons.approve} Mark as Reviewed</>}</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
