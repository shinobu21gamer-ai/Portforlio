import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../components/Toast';
import useAuthStore from '../store/authStore';

const api = axios.create({ baseURL: '/api/v1/public' });

const EMPLOYMENT_COLORS = {
  'full-time': { bg: 'rgba(99,102,241,.12)', text: '#6366f1' },
  'part-time': { bg: 'rgba(34,197,94,.12)', text: '#22c55e' },
  'contract': { bg: 'rgba(234,179,8,.12)', text: '#ca8a04' },
  'internship': { bg: 'rgba(168,85,247,.12)', text: '#a855f7' },
  'probationary': { bg: 'rgba(236,72,153,.12)', text: '#ec4899' },
};

export default function JobPortal() {
  const navigate = useNavigate();
  const toast = useToast();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedJob, setSelectedJob] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({
    firstName: '', middleName: '', lastName: '', email: '', phone: '', coverLetter: '',
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState(false);

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await api.get('/jobs', { params: { search: search || undefined } });
      setJobs(res.data.data.jobs);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
      setLoadError(true);
      toast.error('Failed to load job listings');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => { e.preventDefault(); fetchJobs(); };

  const departments = useMemo(() => {
    const set = new Set(jobs.map(j => j.department?.name).filter(Boolean));
    return ['all', ...set];
  }, [jobs]);

  const types = useMemo(() => {
    const set = new Set(jobs.map(j => j.employmentType).filter(Boolean));
    return ['all', ...set];
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(j => {
      if (deptFilter !== 'all' && j.department?.name !== deptFilter) return false;
      if (typeFilter !== 'all' && j.employmentType !== typeFilter) return false;
      return true;
    });
  }, [jobs, deptFilter, typeFilter]);

  const openDetail = (job) => { setSelectedJob(job); setShowDetail(true); };

  const openApply = (job) => {
    setSelectedJob(job);
    setApplyForm({ firstName: '', middleName: '', lastName: '', email: '', phone: '', coverLetter: '' });
    setResumeFile(null);
    setSubmitted(false);
    setError('');
    setShowApplyModal(true);
  };

  const handleApply = async (e) => {
    e.preventDefault();
    if (!applyForm.firstName.trim()) { setError('First name is required'); return; }
    if (!applyForm.lastName.trim()) { setError('Last name is required'); return; }
    if (!applyForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applyForm.email)) {
      setError('Valid email is required'); return;
    }
    if (applyForm.phone && applyForm.phone.replace(/[^0-9]/g, '').length < 7) {
      setError('Phone number must be at least 7 digits'); return;
    }
    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('jobId', selectedJob.id);
      fd.append('firstName', applyForm.firstName);
      fd.append('middleName', applyForm.middleName);
      fd.append('lastName', applyForm.lastName);
      fd.append('email', applyForm.email);
      if (applyForm.phone) fd.append('phone', applyForm.phone);
      if (applyForm.coverLetter) fd.append('coverLetter', applyForm.coverLetter);
      if (resumeFile) fd.append('resume', resumeFile);
      await api.post('/jobs/apply', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const formatSalary = (min, max) => {
    if (!min && !max) return 'Negotiable';
    const fmt = (n) => '₱' + Number(n).toLocaleString();
    if (min && max) return `${fmt(min)} – ${fmt(max)}`;
    if (min) return `From ${fmt(min)}`;
    return `Up to ${fmt(max)}`;
  };

  const formatDate = (d) => {
    if (!d) return '';
    const diff = Math.floor((Date.now() - new Date(d)) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff}d ago`;
    if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
    return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="jp">
      {/* Portal Top Bar */}
      <header className="jp-topbar">
        <div className="jp-topbar-inner">
          <span className="jp-topbar-brand">MiniMart</span>
          <nav className="jp-topbar-nav">
            <a href="#jp-listings-anchor" className="jp-topbar-link">Careers</a>
            {isAuthenticated ? (
              <Link to="/" className="jp-topbar-cta">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                My Work
              </Link>
            ) : (
              <Link to="/hrms/login" className="jp-topbar-cta">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/></svg>
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="jp-hero">
        <div className="jp-hero-bg">
          <div className="jp-hero-shape jp-hero-shape-1" />
          <div className="jp-hero-shape jp-hero-shape-2" />
          <div className="jp-hero-shape jp-hero-shape-3" />
        </div>
<div className="jp-hero-content">
            <div className="jp-hero-badge">We're Hiring</div>
            <h1 className="jp-hero-title">Build Your Future<br/>With Us</h1>
            <p className="jp-hero-sub">Join a team that values growth, innovation, and meaningful work.<br/>Explore open positions and take the next step in your career.</p>
            <div className="jp-hero-actions">
              {isAuthenticated ? (
                <Link to="/" className="jp-btn-primary jp-hero-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Go to My Work
                </Link>
              ) : (
                <Link to="/hrms/login" className="jp-btn-primary jp-hero-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/></svg>
                  Employee Login
                </Link>
              )}
            </div>
            <div className="jp-hero-stats">
            <div className="jp-hero-stat">
              <span className="jp-hero-stat-value">{jobs.length}</span>
              <span className="jp-hero-stat-label">Open Positions</span>
            </div>
            <div className="jp-hero-stat-divider" />
            <div className="jp-hero-stat">
              <span className="jp-hero-stat-value">{departments.length - 1}</span>
              <span className="jp-hero-stat-label">Departments</span>
            </div>
            <div className="jp-hero-stat-divider" />
            <div className="jp-hero-stat">
              <span className="jp-hero-stat-value">{types.length - 1}</span>
              <span className="jp-hero-stat-label">Employment Types</span>
            </div>
          </div>
        </div>
      </section>

      {/* Search & Filters */}
      <section className="jp-toolbar" id="jp-listings-anchor">
        <div className="jp-toolbar-inner">
          <form onSubmit={handleSearch} className="jp-search">
            <svg className="jp-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              type="text"
              placeholder="Search by job title, keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="jp-search-input"
            />
            <button type="submit" className="jp-search-btn">Search</button>
          </form>
          <div className="jp-filters">
            <select className="jp-filter-select" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              {departments.map(d => <option key={d} value={d}>{d === 'all' ? 'All Departments' : d}</option>)}
            </select>
            <select className="jp-filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {types.map(t => <option key={t} value={t}>{t === 'all' ? 'All Types' : t}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Job Listings */}
      <section className="jp-listings">
        <div className="jp-listings-inner">
          <div className="jp-listings-header">
            <h2 className="jp-listings-title">{filteredJobs.length} {filteredJobs.length === 1 ? 'Position' : 'Positions'} Found</h2>
            {(deptFilter !== 'all' || typeFilter !== 'all' || search) && (
              <button className="jp-clear-btn" onClick={() => { setDeptFilter('all'); setTypeFilter('all'); setSearch(''); fetchJobs(); }}>
                Clear filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="jp-loading">
              {[1, 2, 3].map(i => (
                <div key={i} className="jp-card-skeleton">
                  <div className="jp-skel-line jp-skel-w60" />
                  <div className="jp-skel-line jp-skel-w40" />
                  <div className="jp-skel-line jp-skel-w100" />
                  <div className="jp-skel-line jp-skel-w80" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="jp-empty">
              <div className="jp-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <h3>Could not load jobs</h3>
              <p>Please try again later.</p>
              <button className="jp-btn-secondary" onClick={() => fetchJobs()}>Retry</button>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="jp-empty">
              <div className="jp-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              </div>
              <h3>No positions found</h3>
              <p>Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="jp-grid">
              {filteredJobs.map((job) => {
                const empStyle = EMPLOYMENT_COLORS[job.employmentType] || { bg: 'rgba(99,102,241,.12)', text: '#6366f1' };
                return (
                  <article key={job.id} className="jp-card" onClick={() => openDetail(job)}>
                    <div className="jp-card-top">
                      <div className="jp-card-dept">
                        <div className="jp-card-dept-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                        {job.department?.name || 'General'}
                      </div>
                      <span className="jp-card-status" data-status={job.status}>{job.status}</span>
                    </div>

                    <h3 className="jp-card-title">{job.title}</h3>

                    <div className="jp-card-tags">
                      <span className="jp-tag" style={{ background: empStyle.bg, color: empStyle.text }}>{job.employmentType}</span>
                      <span className="jp-tag jp-tag-outline">{job.paymentFrequency === 'semi-monthly' ? 'Semi-Monthly' : 'Monthly'}</span>
                      {job.openings > 1 && <span className="jp-tag jp-tag-accent">{job.openings} slots</span>}
                    </div>

                    <p className="jp-card-desc">
                      {job.description?.substring(0, 140)}{job.description?.length > 140 ? '…' : ''}
                    </p>

                    <div className="jp-card-bottom">
                      <div className="jp-card-salary">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        {formatSalary(job.salaryMin, job.salaryMax)}
                      </div>
                      <div className="jp-card-meta">
                        {formatDate(job.createdAt) && <span className="jp-card-date">{formatDate(job.createdAt)}</span>}
                        <button className="jp-card-apply" onClick={(e) => { e.stopPropagation(); openApply(job); }}>
                          Apply Now
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Job Detail Modal */}
      {showDetail && selectedJob && (
        <div className="jp-overlay" onClick={() => setShowDetail(false)}>
          <div className="jp-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="jp-detail-close" onClick={() => setShowDetail(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>

            <div className="jp-detail-header">
              <div className="jp-detail-dept">{selectedJob.department?.name || 'General'}</div>
              <h2 className="jp-detail-title">{selectedJob.title}</h2>
              <div className="jp-detail-tags">
                <span className="jp-tag">{selectedJob.employmentType}</span>
                <span className="jp-tag jp-tag-outline">{selectedJob.paymentFrequency === 'semi-monthly' ? 'Semi-Monthly' : 'Monthly'}</span>
                <span className="jp-tag jp-tag-outline">{formatSalary(selectedJob.salaryMin, selectedJob.salaryMax)}</span>
                {selectedJob.openings > 1 && <span className="jp-tag jp-tag-accent">{selectedJob.openings} openings</span>}
              </div>
            </div>

            <div className="jp-detail-body">
              <div className="jp-detail-section">
                <h3>About This Role</h3>
                <p>{selectedJob.description}</p>
              </div>

              {selectedJob.requirements && (
                <div className="jp-detail-section">
                  <h3>Requirements</h3>
                  <p>{selectedJob.requirements}</p>
                </div>
              )}

              {selectedJob.responsibilities && (
                <div className="jp-detail-section">
                  <h3>Responsibilities</h3>
                  <p>{selectedJob.responsibilities}</p>
                </div>
              )}

              {selectedJob.benefits && (
                <div className="jp-detail-section">
                  <h3>Benefits</h3>
                  <p>{selectedJob.benefits}</p>
                </div>
              )}
            </div>

            <div className="jp-detail-footer">
              <button className="jp-btn-secondary" onClick={() => setShowDetail(false)}>Close</button>
              <button className="jp-btn-primary" onClick={() => { setShowDetail(false); openApply(selectedJob); }}>
                Apply for This Position
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="jp-overlay" onClick={() => setShowApplyModal(false)}>
          <div className="jp-apply-modal" onClick={(e) => e.stopPropagation()}>
            {submitted ? (
              <div className="jp-apply-success">
                <div className="jp-success-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <h2>Application Submitted!</h2>
                <p>Thank you for applying for <strong>{selectedJob?.title}</strong>. We'll review your application and get back to you soon.</p>
                <button className="jp-btn-primary" onClick={() => setShowApplyModal(false)}>Done</button>
              </div>
            ) : (
              <>
                <div className="jp-apply-header">
                  <div>
                    <h2>Apply for {selectedJob?.title}</h2>
                    <p className="jp-apply-dept">{selectedJob?.department?.name || 'General'}</p>
                  </div>
                  <button className="jp-detail-close" onClick={() => setShowApplyModal(false)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>

                {error && <div className="jp-error">{error}</div>}

                <form onSubmit={handleApply} className="jp-apply-form">
                  <div className="jp-form-row-3">
                    <div className="jp-field">
                      <label>First Name *</label>
                      <input type="text" required value={applyForm.firstName} onChange={(e) => setApplyForm({ ...applyForm, firstName: e.target.value.replace(/[^a-zA-Z\s\-'.]/g, '') })} />
                    </div>
                    <div className="jp-field">
                      <label>Middle Name</label>
                      <input type="text" value={applyForm.middleName} onChange={(e) => setApplyForm({ ...applyForm, middleName: e.target.value.replace(/[^a-zA-Z\s\-'.]/g, '') })} />
                    </div>
                    <div className="jp-field">
                      <label>Last Name *</label>
                      <input type="text" required value={applyForm.lastName} onChange={(e) => setApplyForm({ ...applyForm, lastName: e.target.value.replace(/[^a-zA-Z\s\-'.]/g, '') })} />
                    </div>
                  </div>

                  <div className="jp-form-row-2">
                    <div className="jp-field">
                      <label>Email *</label>
                      <input type="email" required value={applyForm.email} onChange={(e) => setApplyForm({ ...applyForm, email: e.target.value })} />
                    </div>
                    <div className="jp-field">
                      <label>Phone</label>
                      <input type="tel" inputMode="tel" minLength={7} maxLength={20} value={applyForm.phone} onChange={(e) => setApplyForm({ ...applyForm, phone: e.target.value.replace(/[^0-9+\-\s]/g, '') })} />
                    </div>
                  </div>

                  <div className="jp-field">
                    <label>Resume</label>
                    <label className="jp-file-label">
                      <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => setResumeFile(e.target.files[0])} className="jp-file-input" />
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      <span>{resumeFile ? resumeFile.name : 'Choose file (PDF, DOC, DOCX, JPEG, PNG)'}</span>
                    </label>
                  </div>

                  <div className="jp-field">
                    <label>Cover Letter</label>
                    <textarea rows={4} value={applyForm.coverLetter} onChange={(e) => setApplyForm({ ...applyForm, coverLetter: e.target.value })} placeholder="Tell us why you'd be a great fit for this role..." />
                  </div>

                  <div className="jp-apply-actions">
                    <button type="button" className="jp-btn-secondary" onClick={() => setShowApplyModal(false)}>Cancel</button>
                    <button type="submit" className="jp-btn-primary" disabled={submitting}>
                      {submitting && <span className="btn-spinner" />}
                      {submitting ? 'Submitting...' : 'Submit Application'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
