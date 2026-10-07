import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { API_ROOT } from '../api/client';

// ─── Dashboard ───────────────────────────────────────────
export function useDashboard(params = {}) {
  return useQuery({
    queryKey: ['hrms-dashboard', params],
    queryFn: async () => {
      const [emp, activeEmp, dept] = await Promise.all([
        api.get('/employees', { params: { limit: 1 } }).then(r => r.data.data),
        api.get('/employees', { params: { limit: 1, status: 'active' } }).then(r => r.data.data),
        api.get('/departments', { params: { limit: 100 } }).then(r => r.data.data),
      ]);
      let attData;
      if (params.startDate && params.endDate) {
        const att = await api.get('/attendance', { params: { startDate: params.startDate, endDate: params.endDate, limit: -1 } }).then(r => r.data.data);
        const records = att.attendance || [];
        attData = {
          total: records.length,
          present: records.filter(r => r.status === 'present').length,
          late: records.filter(r => r.status === 'late').length,
          absent: Math.max(0, (activeEmp.pagination?.totalItems || 0) - records.length),
          totalHours: records.reduce((s, r) => s + (parseFloat(r.totalHours) || 0), 0),
          totalOT: records.reduce((s, r) => s + (parseFloat(r.overtime) || 0), 0),
        };
      } else {
        attData = await api.get('/attendance/today').then(r => r.data.data);
      }
      return { employees: emp, activeCount: activeEmp.pagination?.totalItems || 0, departments: dept, attendance: attData };
    },
  });
}

// ─── Departments ─────────────────────────────────────────
export function useDepartments(params = {}) {
  return useQuery({ queryKey: ['departments', params], queryFn: () => api.get('/departments', { params }).then(r => r.data.data) });
}
export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data) => api.post('/departments', data).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }) });
}
export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }) => api.put(`/departments/${id}`, data).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }) });
}
export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => api.delete(`/departments/${id}`).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }) });
}

// ─── Positions ───────────────────────────────────────────
export function usePositions(params = {}) {
  return useQuery({ queryKey: ['positions', params], queryFn: () => api.get('/positions', { params }).then(r => r.data.data) });
}
export function useCreatePosition() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data) => api.post('/positions', data).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['positions'] }) });
}
export function useUpdatePosition() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }) => api.put(`/positions/${id}`, data).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['positions'] }) });
}
export function useDeletePosition() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => api.delete(`/positions/${id}`).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['positions'] }) });
}

// ─── Employees ───────────────────────────────────────────
export function useEmployees(params = {}) {
  return useQuery({ queryKey: ['employees', params], queryFn: () => api.get('/employees', { params }).then(r => r.data.data) });
}
export function useEmployee(id) {
  return useQuery({ queryKey: ['employee', id], queryFn: () => api.get(`/employees/${id}`).then(r => r.data.data), enabled: !!id });
}
export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data) => api.post('/employees', data).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }) });
}
export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }) => api.put(`/employees/${id}`, data).then(r => r.data.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); qc.invalidateQueries({ queryKey: ['contracts'] }); } });
}
export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => api.delete(`/employees/${id}`).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }) });
}
export function usePendingCounts(enabled = true) {
  return useQuery({
    queryKey: ['pending-counts'],
    queryFn: () => api.get('/pending-counts').then(r => r.data.data),
    enabled,
    refetchOnWindowFocus: true,
  });
}
export function useApproveEmployee() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => api.put(`/employees/${id}/approve`).then(r => r.data.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); qc.invalidateQueries({ queryKey: ['pending-counts'] }); qc.invalidateQueries({ queryKey: ['notifications'] }); } });
}
export function useRejectEmployee() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => api.put(`/employees/${id}/reject`).then(r => r.data.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); qc.invalidateQueries({ queryKey: ['pending-counts'] }); } });
}

// ─── POS Staff Access ────────────────────────────────────
export function usePosStaff(params = {}) {
  return useQuery({ queryKey: ['pos-staff', params], queryFn: () => api.get('/pos-staff', { params }).then(r => r.data.data) });
}
export function useAssignPosAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roleSlug }) => api.put(`/employees/${id}/pos-access`, { roleSlug }).then(r => r.data.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); qc.invalidateQueries({ queryKey: ['pos-staff'] }); },
  });
}
export function useRevokePosAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.put(`/employees/${id}/pos-revoke`).then(r => r.data.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); qc.invalidateQueries({ queryKey: ['pos-staff'] }); },
  });
}

// ─── Attendance ──────────────────────────────────────────
export function useAttendance(params = {}) {
  return useQuery({ queryKey: ['attendance', params], queryFn: () => api.get('/attendance', { params }).then(r => r.data.data) });
}
export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data) => api.post('/attendance/clock-in', data).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }) });
}
export function useBulkClockIn() {
  const qc = useQueryClient();
  // One request for the whole selection. The previous code looped the
  // self-service endpoint, which always acts on the caller regardless of the
  // employeeId sent, so HR clocked themselves in and every other selected
  // employee failed with "Already clocked in".
  return useMutation({
    mutationFn: (employeeIds) => api.post('/attendance/bulk-clock-in', { employeeIds }).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  });
}

export function useBulkClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (employeeIds) => api.post('/attendance/bulk-clock-out', { employeeIds }).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['my-attendance'] });
    },
  });
}
export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data) => api.post('/attendance/clock-out', data).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }) });
}
// ─── Schedules ───────────────────────────────────────────
export function useSchedules(params = {}) {
  return useQuery({ queryKey: ['schedules', params], queryFn: () => api.get('/schedules', { params }).then(r => r.data.data) });
}
// A schedule change moves both the weekly grid and the per-day/employee views
// that read it (permanent assignments, the attendance sheet's shift column), so
// all three keys are invalidated — invalidating only ['schedules'] left the
// assignment panel stale until a full reload.
const invalidateScheduleViews = (qc) => {
  qc.invalidateQueries({ queryKey: ['schedules'] });
  qc.invalidateQueries({ queryKey: ['permanent-assignments'] });
  qc.invalidateQueries({ queryKey: ['shift-assignments'] });
  qc.invalidateQueries({ queryKey: ['attendance'] });
};

export function useCreateSchedule() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data) => api.post('/schedules', data).then(r => r.data.data), onSuccess: () => invalidateScheduleViews(qc) });
}
export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...data }) => api.put(`/schedules/${id}`, data).then(r => r.data.data), onSuccess: () => invalidateScheduleViews(qc) });
}
export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => api.delete(`/schedules/${id}`).then(r => r.data.data), onSuccess: () => invalidateScheduleViews(qc) });
}
export function useAssignShift() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data) => api.post('/schedules/assign', data).then(r => r.data.data), onSuccess: () => invalidateScheduleViews(qc) });
}
export function useShiftAssignments(params = {}) {
  return useQuery({ queryKey: ['shift-assignments', params], queryFn: () => api.get('/schedules/assignments/list', { params }).then(r => r.data.data), enabled: !!params.date || !!params.startDate });
}
export function usePermanentAssignments() {
  return useQuery({ queryKey: ['permanent-assignments'], queryFn: () => api.get('/schedules/permanent').then(r => r.data.data) });
}
export function useRemovePermanentAssignment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (empId) => api.delete(`/schedules/permanent/${empId}`).then(r => r.data.data), onSuccess: () => invalidateScheduleViews(qc) });
}

// ─── Payroll ─────────────────────────────────────────────
export function usePayrolls(params = {}) {
  return useQuery({ queryKey: ['payrolls', params], queryFn: () => api.get('/payrolls', { params }).then(r => r.data.data) });
}
export function usePayroll(id) {
  return useQuery({ queryKey: ['payroll', id], queryFn: () => api.get(`/payrolls/${id}`).then(r => r.data.data), enabled: !!id });
}
export function useGeneratePayroll() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data) => api.post('/payrolls', data).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['payrolls'] }) });
}
export function useProcessPayroll() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => api.put(`/payrolls/${id}/process`).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['payrolls'] }) });
}
export function usePayPayroll() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => api.put(`/payrolls/${id}/pay`).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['payrolls'] }) });
}

// ─── Employee Self-Service ────────────────────────────────
export function useMyProfile() {
  return useQuery({ queryKey: ['my-profile'], queryFn: () => api.get('/me').then(r => r.data.data) });
}
export function useMyAttendance(params = {}) {
  return useQuery({ queryKey: ['my-attendance', params], queryFn: () => api.get('/me/attendance', { params }).then(r => r.data.data) });
}
export function useMyLeaves(params = {}) {
  return useQuery({ queryKey: ['my-leaves', params], queryFn: () => api.get('/me/leaves', { params }).then(r => r.data.data) });
}
export function useMyLeaveBalance() {
  return useQuery({ queryKey: ['my-leave-balance'], queryFn: () => api.get('/me/leaves/balance').then(r => r.data.data) });
}
export function useMyPayslips(params = {}) {
  return useQuery({ queryKey: ['my-payslips', params], queryFn: () => api.get('/me/payslips', { params }).then(r => r.data.data) });
}
export function useMyContracts() {
  return useQuery({ queryKey: ['my-contracts'], queryFn: () => api.get('/me/contracts').then(r => r.data.data) });
}
export function useCreateMyLeave() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data) => api.post('/me/leaves', data).then(r => r.data.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-leaves'] }); qc.invalidateQueries({ queryKey: ['my-leave-balance'] }); } });
}
export function useMyClockIn() {
  const qc = useQueryClient();
  // Sends the browser's position so a branch with geofencing enabled can verify
  // it. Resolves to nulls when the user denies permission or the device has no
  // fix; the server then rejects the clock-in only if that branch enforces a
  // fence, and otherwise just records no location.
  return useMutation({
    mutationFn: async () => {
      let coords = { latitude: null, longitude: null };
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        coords = await new Promise((resolve) => {
          const timer = setTimeout(() => resolve({ latitude: null, longitude: null }), 5000);
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(timer);
              resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            },
            () => { clearTimeout(timer); resolve({ latitude: null, longitude: null }); },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
          );
        });
      }
      return api.post('/attendance/clock-in', coords).then(r => r.data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-attendance'] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}
export function useMyClockOut() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.post('/attendance/clock-out').then(r => r.data.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-attendance'] }); qc.invalidateQueries({ queryKey: ['attendance'] }); } });
}

// ─── Notifications ────────────────────────────────────────
export function useNotifications(params = {}) {
  return useQuery({ queryKey: ['notifications', params], queryFn: () => api.get('/notifications', { params }).then(r => r.data.data) });
}
export function useUnreadCount() {
  return useQuery({ queryKey: ['notifications-unread'], queryFn: () => api.get('/notifications/unread-count').then(r => r.data.data), refetchInterval: 30000 });
}
export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (ids) => api.put('/notifications/mark-read', { ids }).then(r => r.data.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['notifications-unread'] }); } });
}
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.put('/notifications/mark-all-read').then(r => r.data.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['notifications-unread'] }); } });
}

// ─── Admin diagnostics (email delivery) ───────────────────
// Reads the cached mailer state (configuration, last verify, delivery
// counters). Cheap: no SMTP dial happens unless `verify` is requested.
export function useEmailStatus() {
  return useQuery({
    queryKey: ['email-status'],
    queryFn: () => api.get('/health/email', { baseURL: API_ROOT }).then(r => r.data.data),
    retry: false,
  });
}

// Live "is it actually working?" check: dials the SMTP server, authenticates,
// and feeds the result into the cached status so the card updates in place.
export function useVerifyEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.get('/health/email', { baseURL: API_ROOT, params: { verify: 1 } }).then(r => r.data.data),
    onSuccess: (data) => qc.setQueryData(['email-status'], data),
  });
}

// Sends a real message. A failure is an HTTP error (502/503) carrying
// { errors: { reason, hint } }, so the caller can show what to fix.
export function useSendTestEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/health/email/test', data, { baseURL: API_ROOT }).then(r => r.data.data),
    onSettled: () => qc.invalidateQueries({ queryKey: ['email-status'] }),
  });
}
