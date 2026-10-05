/**
 * Phase-6 route matrix — HRMS surface.
 *
 * Same three-leg contract as routes.pos.integration.test.ts, applied to the 112
 * routes under /api/v1/hrms enumerated in tests/utils/route-table.ts:
 *
 *   • happy      — a role the authorize() allow-list permits, with a valid body
 *                  and a seeded :id, asserting the documented status;
 *   • authz      — no Bearer token must yield 401;
 *   • forbidden  — the least-privileged denied role must yield 403.
 *
 * Two HRMS-specific hazards shaped the fixture design (see
 * tests/utils/route-matrix-setup.ts):
 *
 *   1. employeeService.delete() deactivates the *linked User*, so DELETE
 *      /hrms/employees/:id must never target the employee matrix user's own row
 *      or every later employee-role leg 401s with "Account has been
 *      deactivated". Write legs draw from a disposal pool of unlinked employees.
 *   2. Lifecycle routes only accept a specific prior state — approve wants
 *      `pending`, terminate wants `active`, admin-approve wants `hr-reviewed`,
 *      payrolls/:id/pay wants `processed`. Those get dedicated seeded rows via
 *      an explicit params override rather than a pool row.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import {
  startRouteMatrix,
  type RouteMatrixContext,
} from '../utils/route-matrix-setup';
import { runRouteMatrix, type OverrideMap } from '../utils/route-matrix-runner';
import { HRMS_ROUTES } from '../utils/route-table';

let ctx: RouteMatrixContext;
const getCtx = (): RouteMatrixContext => ctx;

beforeAll(async () => {
  ctx = await startRouteMatrix();
}, 180000);

afterAll(async () => {
  if (ctx) await ctx.close();
}, 30000);

const today = () => new Date().toISOString().split('T')[0];
const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().split('T')[0];

const OVERRIDES: OverrideMap = {
  // ── self-service: only the `employee` role has an Employee row linked to its
  // User, so every /me route must act as employee. As admin these 404 with
  // "Employee profile not found", which is correct but not a happy path. ──
  'GET /api/v1/hrms/me': { role: 'employee', expect: [200] },
  'GET /api/v1/hrms/me/profile': { role: 'employee', expect: [200] },
  'GET /api/v1/hrms/me/attendance': { role: 'employee', expect: [200] },
  'GET /api/v1/hrms/me/leaves': { role: 'employee', expect: [200] },
  'GET /api/v1/hrms/me/leaves/balance': { role: 'employee', expect: [200] },
  'GET /api/v1/hrms/me/payslips': { role: 'employee', expect: [200] },
  'GET /api/v1/hrms/me/contracts': { role: 'employee', expect: [200] },
  'PUT /api/v1/hrms/me/profile': {
    role: 'employee',
    body: { phone: '09174445555', address: '9 Matrix St', emergencyContactName: 'Matrix Kin' },
    expect: [200],
  },
  'POST /api/v1/hrms/me/leaves': {
    role: 'employee',
    body: {
      leaveType: 'personal', startDate: plusDays(20), endDate: plusDays(21),
      reason: 'Matrix self-service leave',
    },
    expect: [200, 201],
  },

  // ── attendance ─────────────────────────────────────────────────────────
  'POST /api/v1/hrms/attendance/clock-in': {
    // Self-service: acts on the caller's own Employee row, so it must be the
    // employee role. latitude/longitude are omitted — the seeded branch does not
    // enforce a geofence.
    role: 'employee',
    body: { notes: 'matrix clock in' },
    expect: [200, 201, 400],
    note: '400 when the caller already has an open attendance row for today, which the seeded present row causes; the point is that it is a domain refusal, not a 500',
  },
  'POST /api/v1/hrms/attendance/clock-out': {
    role: 'employee',
    body: { notes: 'matrix clock out' },
    expect: [200, 400],
    note: '400 when there is no open clock-in to close',
  },
  'POST /api/v1/hrms/attendance/bulk-clock-in': {
    body: (ids: any) => ({ employeeIds: [ids.employee2] }),
    expect: [200, 201, 207],
    note: '207 Multi-Status is the designed response when part of the batch fails — employee2 already has a seeded attendance row for today, so the batch reports "0 of 1" with a per-employee reason instead of failing wholesale',
  },
  'POST /api/v1/hrms/attendance/bulk-clock-out': {
    body: (ids: any) => ({ employeeIds: [ids.employee2] }),
    expect: [200, 201, 207],
    note: '207 for the same partial-batch reason as bulk-clock-in',
  },
  'PUT /api/v1/hrms/attendance/:id': {
    body: { status: 'late', notes: 'matrix attendance correction' },
    expect: [200],
  },

  // ── departments / positions ────────────────────────────────────────────
  'POST /api/v1/hrms/departments': {
    body: { name: 'Matrix Created Department', description: 'created by the route matrix' },
    expect: [201],
  },
  'PUT /api/v1/hrms/departments/:id': { body: { name: 'Matrix Department Renamed' }, expect: [200] },
  'POST /api/v1/hrms/positions': {
    body: (ids: any) => ({
      title: 'Matrix Created Position', departmentId: ids.department,
      roleSlug: 'employee', minSalary: 13000, maxSalary: 16000,
    }),
    expect: [201],
  },
  'PUT /api/v1/hrms/positions/:id': { body: { title: 'Matrix Position Renamed' }, expect: [200] },

  // ── employees ──────────────────────────────────────────────────────────
  'POST /api/v1/hrms/employees': {
    body: (ids: any) => ({
      firstName: 'Matrix', lastName: 'Hire', email: `hire-${Date.now()}@matrix-hrms.test.com`,
      hireDate: today(), departmentId: ids.department, positionId: ids.position,
      salary: 21000, employmentType: 'full-time', paymentFrequency: 'semi-monthly',
    }),
    expect: [201],
  },
  'PUT /api/v1/hrms/employees/:id': { body: { firstName: 'Matrix', lastName: 'Renamed' }, expect: [200] },
  'PUT /api/v1/hrms/employees/:id/approve': {
    params: (ids: any) => ({ id: ids.pendingEmployee }),
    expect: [200],
  },
  'PUT /api/v1/hrms/employees/:id/reject': {
    params: (ids: any) => ({ id: ids.rejectEmployee }),
    expect: [200],
  },
  'PUT /api/v1/hrms/employees/:id/terminate': {
    params: (ids: any) => ({ id: ids.terminateEmployee }),
    body: { terminationType: 'end-of-contract', terminationDate: today() },
    expect: [200],
  },
  'PUT /api/v1/hrms/employees/:id/pos-access': {
    params: (ids: any) => ({ id: ids.posAccessEmployee }),
    body: { roleSlug: 'cashier' },
    expect: [200, 400],
    note: '400 when the employee is not yet approved/active, which is the state the route is designed to refuse',
  },
  'PUT /api/v1/hrms/employees/:id/pos-revoke': {
    params: (ids: any) => ({ id: ids.posAccessEmployee }),
    expect: [200, 400, 404],
    note: 'runs after pos-access in path order, so the account state depends on whether the grant succeeded',
  },

  // ── schedules ──────────────────────────────────────────────────────────
  'POST /api/v1/hrms/schedules': {
    body: { name: 'Matrix Created Schedule', startTime: '10:00', endTime: '19:00', daysOfWeek: [1, 2, 3, 4, 5] },
    expect: [201],
  },
  'PUT /api/v1/hrms/schedules/:id': { body: { name: 'Matrix Schedule Renamed' }, expect: [200] },
  'POST /api/v1/hrms/schedules/assign': {
    body: (ids: any) => ({ employeeId: ids.employee2, scheduleId: ids.schedule, date: plusDays(3) }),
    expect: [200, 201],
  },
  'DELETE /api/v1/hrms/schedules/assignments/:id': {
    params: (ids: any) => ({ id: ids.shiftAssignment }),
    expect: [200, 204, 404],
  },
  'DELETE /api/v1/hrms/schedules/permanent/:employeeId': {
    params: (ids: any) => ({ employeeId: ids.employee2 }),
    expect: [200, 204, 404],
  },

  // ── payroll ────────────────────────────────────────────────────────────
  'POST /api/v1/hrms/payrolls': {
    body: { month: 1, year: 2024, periodType: 'monthly' },
    expect: [200, 201, 400],
    note: '400 when a payroll for that period already exists — the service refuses to double-generate',
  },
  'POST /api/v1/hrms/payrolls/preview': {
    body: { month: 2, year: 2024, periodType: 'monthly' },
    expect: [200, 201],
  },
  'PUT /api/v1/hrms/payrolls/:id/process': {
    params: (ids: any) => ({ id: ids.processPayroll }),
    expect: [200],
  },
  'PUT /api/v1/hrms/payrolls/:id/pay': {
    params: (ids: any) => ({ id: ids.payPayroll }),
    expect: [200],
  },

  // ── job postings / applications / interviews ───────────────────────────
  'POST /api/v1/hrms/jobs': {
    body: (ids: any) => ({
      title: 'Matrix Created Opening', departmentId: ids.department, positionId: ids.position,
      description: 'created by the route matrix', requirements: 'none',
      salaryMin: 13000, salaryMax: 17000, openings: 1, closingDate: plusDays(45),
    }),
    expect: [201],
  },
  'PUT /api/v1/hrms/jobs/:id': { body: { title: 'Matrix Opening Renamed' }, expect: [200] },
  'PUT /api/v1/hrms/jobs/:id/approve': {
    params: (ids: any) => ({ id: ids.pendingJob }),
    expect: [200],
  },
  'PUT /api/v1/hrms/jobs/:id/reject': {
    params: (ids: any) => ({ id: ids.rejectJob }),
    expect: [200],
  },
  'PUT /api/v1/hrms/jobs/:id/close': { expect: [200] },
  'POST /api/v1/hrms/jobs/applications': {
    // Only the employee role may use the internal-candidate apply route; the
    // resume part is optional (validateResumeSignature no-ops without a file).
    role: 'employee',
    body: (ids: any) => ({
      jobId: ids.job, firstName: 'Internal', lastName: 'Candidate',
      email: 'internal@matrix-apply.test.com', coverLetter: 'Matrix internal application',
    }),
    expect: [200, 201, 400],
    note: '400 when this employee has already applied to this posting — duplicate applications are refused',
  },
  'PUT /api/v1/hrms/jobs/applications/:id/status': {
    body: { status: 'reviewed', notes: 'matrix review' },
    expect: [200],
  },
  'GET /api/v1/hrms/jobs/applications/resume/:filename': {
    params: (ids: any) => ({ filename: ids.resumeFilename }),
    expect: [200, 404],
    note: 'streams the seeded resume from uploads/resumes; 404 if the file is not on disk in this checkout',
  },
  'POST /api/v1/hrms/interviews': {
    body: (ids: any) => ({
      // type must be 'initial': the service refuses a 'final' interview when the
      // application has no initial one yet.
      applicationId: ids.reviewedApplication, type: 'initial', scheduledDate: plusDays(6),
      scheduledTime: '14:00', interviewer: 'Matrix Interviewer', location: 'Matrix Branch',
    }),
    expect: [200, 201],
  },
  'PUT /api/v1/hrms/interviews/:id': {
    body: { scheduledTime: '15:30', interviewer: 'Matrix Interviewer Two' },
    expect: [200],
  },
  'PUT /api/v1/hrms/interviews/:id/result': {
    body: { result: 'pass', feedback: 'Matrix fixture feedback' },
    expect: [200],
  },

  // ── contracts ──────────────────────────────────────────────────────────
  'POST /api/v1/hrms/contracts': {
    body: (ids: any) => ({
      // startDate must be >= now; today() is local midnight, already in the past
      // by the time this runs, so the validator would reject it.
      employeeId: ids.contractlessEmployee, contractType: 'project', startDate: plusDays(1),
      endDate: plusDays(180), paymentFrequency: 'monthly', salary: 22000,
    }),
    expect: [201],
  },
  'PUT /api/v1/hrms/contracts/:id': { body: { terms: 'Matrix updated terms' }, expect: [200] },
  'POST /api/v1/hrms/contracts/:id/renew': {
    params: (ids: any) => ({ id: ids.renewContract }),
    body: { contractType: 'regular', startDate: plusDays(1), endDate: plusDays(365) },
    expect: [200, 201],
  },
  'PUT /api/v1/hrms/contracts/:id/approve': {
    params: (ids: any) => ({ id: ids.approveContract }),
    expect: [200],
  },
  'PUT /api/v1/hrms/contracts/:id/reject': { expect: [200] },
  'PUT /api/v1/hrms/contracts/:id/terminate': {
    params: (ids: any) => ({ id: ids.terminateContract }),
    expect: [200],
  },
  'POST /api/v1/hrms/contracts/check-expired': { expect: [200] },

  // ── leaves ─────────────────────────────────────────────────────────────
  'POST /api/v1/hrms/leaves': {
    role: 'employee',
    body: {
      leaveType: 'sick', startDate: plusDays(30), endDate: plusDays(31),
      reason: 'Matrix fixture sick leave',
    },
    expect: [200, 201],
  },
  'PUT /api/v1/hrms/leaves/:id/hr-review': {
    params: (ids: any) => ({ id: ids.hrReviewLeave }),
    body: { remarks: 'Matrix HR review' },
    expect: [200],
  },
  'PUT /api/v1/hrms/leaves/:id/admin-approve': {
    params: (ids: any) => ({ id: ids.adminApproveLeave }),
    expect: [200],
  },
  'PUT /api/v1/hrms/leaves/:id/admin-reject': {
    params: (ids: any) => ({ id: ids.adminRejectLeave }),
    body: { remarks: 'Matrix admin rejection' },
    expect: [200],
  },
  'PUT /api/v1/hrms/leaves/:id/cancel': {
    params: (ids: any) => ({ id: ids.cancelLeave }),
    role: 'employee',
    expect: [200],
  },
  'GET /api/v1/hrms/leaves/balance/:employeeId': {
    params: (ids: any) => ({ employeeId: ids.employee }),
    expect: [200],
  },

  // ── employee documents ─────────────────────────────────────────────────
  'POST /api/v1/hrms/employees/:employeeId/documents': {
    // The controller reads req.file unconditionally, so this leg has to upload a
    // real part; text/plain passes validateFileSignature (no NUL in 512 bytes).
    multipart: {
      field: 'file',
      filename: 'matrix-upload.txt',
      mimetype: 'text/plain',
      contentB64: Buffer.from('matrix uploaded document fixture\n').toString('base64'),
    },
    body: (ids: any) => ({ employeeId: ids.employee2, documentType: 'id' }),
    expect: [200, 201],
  },
  'GET /api/v1/hrms/employee-documents/:id/download': { expect: [200] },

  // ── notifications (mounted under /hrms as an alias of /notifications) ───
  'PUT /api/v1/hrms/notifications/mark-read': {
    body: (ids: any) => ({ ids: [ids.notification] }),
    expect: [200],
  },
  'PUT /api/v1/hrms/notifications/mark-all-read': { expect: [200] },
};

describe('Route matrix — HRMS surface', () => {
  it('the generated table still matches the live Express router (no route added or removed silently)', () => {
    expect(HRMS_ROUTES.length).toBe(112);
  });

  it('only the reviewed self-service routes are bare protect() (no role/permission gate)', () => {
    // The HRMS surface holds salaries, contracts and personal data, so a route
    // that is merely `protect`-ed — authenticated but not role-gated — is a
    // deliberate decision, not an oversight. This pins the exact reviewed set:
    // adding a new ungated HRMS route fails here until someone looks at it.
    //
    // All 18 are self-service or the /hrms alias of /notifications: they act on
    // the caller's own Employee row (or own notifications), and the services
    // scope by req.user, so a role gate would add nothing.
    const bare = HRMS_ROUTES.filter(
      (r) => !r.isPublic && r.roles.length === 0 && r.perms.length === 0,
    ).map((r) => `${r.method} ${r.path}`);

    expect(bare.sort()).toEqual([
      'DELETE /api/v1/hrms/notifications/:id',
      'GET /api/v1/hrms/me',
      'GET /api/v1/hrms/me/attendance',
      'GET /api/v1/hrms/me/contracts',
      'GET /api/v1/hrms/me/leaves',
      'GET /api/v1/hrms/me/leaves/balance',
      'GET /api/v1/hrms/me/payslips',
      'GET /api/v1/hrms/me/profile',
      'GET /api/v1/hrms/notifications',
      'GET /api/v1/hrms/notifications/unread-count',
      'POST /api/v1/hrms/attendance/clock-in',
      'POST /api/v1/hrms/attendance/clock-out',
      'POST /api/v1/hrms/leaves',
      'POST /api/v1/hrms/me/leaves',
      'PUT /api/v1/hrms/leaves/:id/cancel',
      'PUT /api/v1/hrms/me/profile',
      'PUT /api/v1/hrms/notifications/mark-all-read',
      'PUT /api/v1/hrms/notifications/mark-read',
    ]);
  });
});

runRouteMatrix({
  title: 'HRMS route matrix',
  getCtx,
  routes: HRMS_ROUTES,
  overrides: OVERRIDES,
});
