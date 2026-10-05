import { useState, useMemo } from 'react';
import { useAttendance, useBulkClockIn, useBulkClockOut, useEmployees, useShiftAssignments } from '../hooks/useApi';

import LoadingSkeleton from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';
import { formatDate, getWeekRange, getMonthRange, formatTime } from '../utils/helpers';
import { useIsAdmin } from '../hooks/useRole';
import api from '../api/client';
import useDebounce from '../hooks/useDebounce';

export default function Attendance() {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [view, setView] = useState('day');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const toast = useToast();
  const isAdmin = useIsAdmin();

  const isToday = date === today;
  const isPast = date < today;

  const weekRange = useMemo(() => getWeekRange(date), [date]);
  const monthRange = useMemo(() => getMonthRange(date), [date]);

  const queryParams = useMemo(() => {
    if (view === 'week') return { startDate: weekRange.start, endDate: weekRange.end, search: debouncedSearch, page, limit: 50 };
    if (view === 'month') return { startDate: monthRange.start, endDate: monthRange.end, search: debouncedSearch, page, limit: 50 };
    return { date, search: debouncedSearch, page, limit: 50 };
  }, [view, date, weekRange, monthRange, debouncedSearch, page]);

  const { data: attData, isLoading, isError, error, refetch } = useAttendance(queryParams);
  const { data: empData } = useEmployees({ limit: 100, status: 'active' });
  const { data: shiftData } = useShiftAssignments({ date });
  const clockInMut = useBulkClockIn();
  const clockOutMut = useBulkClockOut();

  const employees = empData?.employees || [];
  const records = attData?.attendance || [];
  const shifts = useMemo(() => {
    const map = {};
    (Array.isArray(shiftData) ? shiftData : []).forEach(s => { map[s.employeeId] = s.schedule; });
    return map;
  }, [shiftData]);

  const rows = useMemo(() => {
    if (view === 'day') {
      const attMap = {};
      records.forEach(r => { attMap[r.employeeId] = r; });
      return employees.map(emp => ({ emp, att: attMap[emp.id] || null, shift: shifts[emp.id] || emp.schedule || null }));
    }
    return records.map(r => ({ emp: r.employee, att: r, shift: r.employee?.schedule || null }));
  }, [employees, records, shifts, view]);

  const summary = useMemo(() => {
    if (view === 'day') {
      const totalHours = records.reduce((s, r) => s + (parseFloat(r.totalHours) || 0), 0);
      const totalOT = records.reduce((s, r) => s + (parseFloat(r.overtime) || 0), 0);
      const present = rows.filter(r => r.att?.status === 'present').length;
      const late = rows.filter(r => r.att?.status === 'late').length;
      const absent = rows.filter(r => !r.att).length;
      return { totalHours, totalOT, present, late, absent, total: employees.length };
    }
    const totalHours = records.reduce((s, r) => s + (parseFloat(r.totalHours) || 0), 0);
    const totalOT = records.reduce((s, r) => s + (parseFloat(r.overtime) || 0), 0);
    const present = records.filter(r => r.status === 'present').length;
    const late = records.filter(r => r.status === 'late').length;
    return { totalHours, totalOT, present, late, absent: 0, total: records.length };
  }, [records, rows, employees, view]);

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selected.length === employees.length) setSelected([]);
    else setSelected(employees.map(e => e.id));
  };

  const handleClockIn = async () => {
    if (selected.length === 0) { toast.error('Select employees first'); return; }
    try {
      const result = await clockInMut.mutateAsync(selected);
      setSelected([]);
      if (result.failed.length === 0) {
        toast.success(`Clocked in ${result.succeeded.length} employee(s)`);
      } else {
        // Name the failures — previously the UI only showed a count, so HR had
        // no way to tell who did not get clocked in or why.
        const names = result.failed.slice(0, 3).map(f => `${f.name} (${f.reason})`).join('; ');
        const more = result.failed.length > 3 ? ` +${result.failed.length - 3} more` : '';
        toast.error(`Clocked in ${result.succeeded.length} of ${result.total}. Failed: ${names}${more}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Clock-in failed');
    }
  };

  const handleClockOut = async () => {
    if (selected.length === 0) { toast.error('Select employees first'); return; }
    try {
      const result = await clockOutMut.mutateAsync(selected);
      setSelected([]);
      if (result.failed.length === 0) {
        toast.success(`Clocked out ${result.succeeded.length} employee(s)`);
      } else {
        const names = result.failed.slice(0, 3).map(f => `${f.name} (${f.reason})`).join('; ');
        const more = result.failed.length > 3 ? ` +${result.failed.length - 3} more` : '';
        toast.error(`Clocked out ${result.succeeded.length} of ${result.total}. Failed: ${names}${more}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Clock-out failed');
    }
  };

  const navigateDate = (dir) => {
    const d = new Date(date);
    if (view === 'day') d.setDate(d.getDate() + dir);
    else if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setDate(d.toISOString().split('T')[0]);
  };

  const viewLabel = view === 'day' ? formatDate(date) : view === 'week' ? weekRange.label : monthRange.label;

  const handleExport = async () => {
    try {
      const params = view === 'week' ? { startDate: weekRange.start, endDate: weekRange.end } : view === 'month' ? { startDate: monthRange.start, endDate: monthRange.end } : { date };
      const res = await api.get('/attendance/export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'attendance.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Exported');
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Export failed');
    }
  };

  const getShiftBadge = (shift) => {
    if (!shift) return <span className="text-muted text-xs">No shift</span>;
    const name = shift.name || '';
    const color = name.includes('Morning') ? 'var(--info)' : name.includes('Afternoon') ? 'var(--warning)' : name.includes('Night') ? 'var(--accent)' : 'var(--text-muted)';
    return <span style={{ color }} className="text-xs font-semibold">{shift.name}<br/><span className="font-normal" style={{ opacity: 0.8 }}>{formatTime(shift.startTime)} – {formatTime(shift.endTime)}</span></span>;
  };

  if (isError) {
    return (
      <div className="page-error-wrap">
        <ErrorState message={error?.response?.data?.message || 'Something went wrong while loading this data.'} onRetry={() => refetch()} />
      </div>
    );
  }

  return (<>
      <header className="pos-header">
        <div><h1>Attendance</h1><div className="sub">{viewLabel}</div></div>
        <div className="flex-gap">
          <button className="btn btn-outline" onClick={handleExport}>↓</button>
        </div>
      </header>

      <div className="search-bar flex-wrap-end">
        <button className="btn btn-primary" onClick={handleClockIn} disabled={clockInMut.isPending || selected.length === 0}>
          {clockInMut.isPending && <span className="btn-spinner" />}
          ● {selected.length > 0 && `(${selected.length})`}
        </button>
        <button className="btn btn-secondary" onClick={handleClockOut} disabled={clockOutMut.isPending || selected.length === 0}>
          {clockOutMut.isPending && <span className="btn-spinner" />}
          ○ {selected.length > 0 && `(${selected.length})`}
        </button>
          <div className="field m-0">
            <label htmlFor="att-date">Date</label>
            <input id="att-date" className="input-block" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ maxWidth: 160 }} />
          </div>
          <div className="field m-0">
            <label htmlFor="att-search">Search</label>
            <input id="att-search" className="input-block" placeholder="Search employee..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ maxWidth: 200 }} />
          </div>
        {isPast && <span className="text-warning font-semibold text-sm">Viewing past date — clock in/out disabled</span>}
      </div>

      <div className="flex-gap-sm items-center mt-sm mb-sm">
        <button className="btn btn-sm" onClick={() => navigateDate(-1)}>◀</button>
        <button className={`btn btn-sm ${view === 'day' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('day')}>Day</button>
        <button className={`btn btn-sm ${view === 'week' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('week')}>Week</button>
        <button className={`btn btn-sm ${view === 'month' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('month')}>Month</button>
        <button className="btn btn-sm" onClick={() => navigateDate(1)}>▶</button>
        <span className="ml-sm text-sm text-muted">
          {summary.total} employees · {summary.present} present · {summary.late} late · {summary.absent > 0 ? `${summary.absent} absent · ` : ''}{summary.totalHours.toFixed(1)} hrs · {summary.totalOT.toFixed(1)} OT
        </span>
      </div>

      {isLoading ? <LoadingSkeleton rows={5} /> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-40">
                  {isToday && <input type="checkbox" checked={selected.length === employees.length && employees.length > 0} onChange={toggleAll} />}
                </th>
                <th>Employee</th>
                <th>Department</th>
                <th>Shift</th>
                {view !== 'day' && <th>Date</th>}
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Status</th>
                <th>Hours</th>
                <th>OT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ emp, att, shift }, i) => (
                <tr key={att?.id || emp?.id || i} style={!att && isToday ? { opacity: 0.5 } : undefined}>
                  <td>{isToday && <input type="checkbox" checked={selected.includes(emp.id)} onChange={() => toggleSelect(emp.id)} />}</td>
                  <td>{emp.firstName} {emp.middleName ? emp.middleName + ' ' : ''}{emp.lastName}</td>
                  <td>{emp.department?.name || '—'}</td>
                  <td>{getShiftBadge(shift)}</td>
                  {view !== 'day' && <td>{att ? formatDate(att.date) : '—'}</td>}
                  <td>{att?.clockIn ? new Date(att.clockIn).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td>{att?.clockOut ? new Date(att.clockOut).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : att?.clockIn && isToday ? <span className="text-warning">Still working</span> : '—'}</td>
                  <td>{att?.status ? <span className={`badge ${att.status === 'present' ? 'success' : att.status === 'late' ? 'warning' : att.status === 'on-leave' ? 'info' : 'error'}`}>{att.status}</span> : '—'}</td>
                  <td>{att?.totalHours ? Number(att.totalHours).toFixed(1) : '—'}</td>
                  <td>{att?.overtime > 0 ? <span className="text-success">+{Number(att.overtime).toFixed(1)}</span> : '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={view !== 'day' ? 10 : 9} className="empty-state">No employees found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {attData?.pagination?.totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>◀</button>
          <span>Page {page} / {attData.pagination.totalPages}</span>
          <button className="btn btn-sm" disabled={page >= attData.pagination.totalPages} onClick={() => setPage(p => p + 1)}>▶</button>
        </div>
      )}
    </>);
}
