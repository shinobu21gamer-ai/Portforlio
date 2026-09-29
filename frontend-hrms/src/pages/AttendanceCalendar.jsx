import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { useDepartments } from '../hooks/useApi';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getDayOfWeek(year, month, day) {
  return new Date(year, month - 1, day).getDay();
}

export default function AttendanceCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [deptFilter, setDeptFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['att-calendar', year, month, deptFilter],
    queryFn: () => api.get('/attendance/calendar', { params: { year, month, ...(deptFilter ? { departmentId: deptFilter } : {}) } }).then(r => r.data.data),
  });

  const { data: deptData } = useDepartments({ limit: 100 });

  const daysInMonth = getDaysInMonth(year, month);
  const days = useMemo(() => {
    const arr = [];
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ day: d, dow: getDayOfWeek(year, month, d) });
    }
    return arr;
  }, [year, month, daysInMonth]);

  const navigate = (dir) => {
    let m = month + dir;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  };

  const getCellClass = (empId, day) => {
    const key = `${empId}_${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const att = data?.attendance?.[key];
    if (!att) {
      const dow = getDayOfWeek(year, month, day);
      if (dow === 0 || dow === 6) return 'rest';
      return '';
    }
    return att.status === 'present' ? 'present' : att.status === 'late' ? 'late' : att.status === 'on-leave' ? 'leave' : 'absent';
  };

  const employees = data?.employees || [];

  return (
    <>
      <header className="pos-header">
        <div><h1>Attendance Calendar</h1><div className="sub">{MONTH_NAMES[month - 1]} {year}</div></div>
      </header>

      <div className="search-bar flex-wrap-end">
        <button className="btn btn-sm" onClick={() => navigate(-1)}>◀</button>
        <select className="input-block" style={{ width: 160 }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
          {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <input className="input-block" type="number" value={year} onChange={e => setYear(parseInt(e.target.value) || year)} style={{ width: 90 }} />
        <button className="btn btn-sm" onClick={() => navigate(1)}>▶</button>
        <select className="input-block" style={{ width: 160 }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
          <option value="">All Departments</option>
          {(deptData?.departments || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button className="btn btn-sm btn-outline" onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }}>Today</button>
      </div>

      <div className="cal-legend mb-sm">
        <div className="cal-legend-item"><div className="cal-legend-dot cal-cell present" /> Present</div>
        <div className="cal-legend-item"><div className="cal-legend-dot cal-cell late" /> Late</div>
        <div className="cal-legend-item"><div className="cal-legend-dot cal-cell absent" /> Absent</div>
        <div className="cal-legend-item"><div className="cal-legend-dot cal-cell leave" /> Leave</div>
        <div className="cal-legend-item"><div className="cal-legend-dot cal-cell rest" /> Rest Day</div>
      </div>

      {isLoading ? <LoadingSkeleton rows={8} /> : employees.length === 0 ? (
        <div className="empty-state">No active employees found.</div>
      ) : (
        <div className="cal-grid">
          <table className="cal-table">
            <thead>
              <tr>
                <th className="cal-name">Employee</th>
                {days.map(d => (
                  <th key={d.day} className={d.dow === 0 || d.dow === 6 ? 'weekend' : ''} title={DAY_NAMES[d.dow]}>
                    {d.day}
                    <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.7 }}>{DAY_NAMES[d.dow]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id}>
                  <td className="cal-name">{emp.lastName}, {emp.firstName}</td>
                  {days.map(d => {
                    const cls = getCellClass(emp.id, d.day);
                    return (
                      <td key={d.day} className={`cal-day ${d.dow === 0 || d.dow === 6 ? 'weekend' : ''}`}>
                        {cls ? <span className={`cal-cell ${cls}`}>{cls === 'present' ? 'P' : cls === 'late' ? 'L' : cls === 'absent' ? 'A' : cls === 'leave' ? 'LV' : '—'}</span> : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
