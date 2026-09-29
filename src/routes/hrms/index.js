const router = require('express').Router();
const { protect, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const schemas = require('../../validators/hrms');
const deptCtrl = require('../../controllers/hrms/department.controller');
const posCtrl = require('../../controllers/hrms/position.controller');
const empCtrl = require('../../controllers/hrms/employee.controller');
const attCtrl = require('../../controllers/hrms/attendance.controller');
const schCtrl = require('../../controllers/hrms/schedule.controller');
const payCtrl = require('../../controllers/hrms/payroll.controller');
const jobCtrl = require('../../controllers/hrms/job.controller');
const contractCtrl = require('../../controllers/hrms/contract.controller');
const leaveCtrl = require('../../controllers/hrms/leave.controller');
const empDocCtrl = require('../../controllers/hrms/employeeDocument.controller');
const { uploadDocument, validateDocumentSignature } = require('../../middleware/upload');
const { Employee, JobPosting, Contract, LeaveRequest, Payroll, User, Role } = require('../../models');

// ─── Pending Counts (for sidebar badges) ───────────────
router.get('/pending-counts', protect, authorize('admin', 'hr', 'manager'), async (req, res, next) => {
  try {
    const [pendingEmployees, pendingJobs, pendingContracts, pendingLeaves, hrReviewedLeaves, processedPayrolls] = await Promise.all([
      Employee.count({ where: { status: 'pending' } }),
      JobPosting.count({ where: { status: 'pending' } }),
      Contract.count({ where: { status: 'pending' } }),
      LeaveRequest.count({ where: { status: 'pending' } }),
      LeaveRequest.count({ where: { status: 'hr-reviewed' } }),
      Payroll.count({ where: { status: 'processed' } }),
    ]);
    res.json({ success: true, data: { pendingEmployees, pendingJobs, pendingContracts, pendingLeaves, hrReviewedLeaves, processedPayrolls } });
  } catch (e) { next(e); }
});

// ─── Departments ──────────────────────────────────────
router.get('/departments', protect, authorize('admin', 'hr', 'manager'), deptCtrl.getAll);
router.get('/departments/:id', protect, authorize('admin', 'hr', 'manager'), deptCtrl.getById);
router.post('/departments', protect, authorize('admin', 'hr'), validate(schemas.createDepartment), deptCtrl.create);
router.put('/departments/:id', protect, authorize('admin', 'hr'), validate(schemas.updateDepartment), deptCtrl.update);
router.delete('/departments/:id', protect, authorize('admin', 'hr'), deptCtrl.delete);

// ─── Positions ────────────────────────────────────────
router.get('/positions', protect, authorize('admin', 'hr', 'manager'), posCtrl.getAll);
router.get('/positions/:id', protect, authorize('admin', 'hr', 'manager'), posCtrl.getById);
router.post('/positions', protect, authorize('admin', 'hr'), validate(schemas.createPosition), posCtrl.create);
router.put('/positions/:id', protect, authorize('admin', 'hr'), validate(schemas.updatePosition), posCtrl.update);
router.delete('/positions/:id', protect, authorize('admin', 'hr'), posCtrl.delete);

// ─── Employees ────────────────────────────────────────
router.get('/employees', protect, authorize('admin', 'hr', 'manager'), empCtrl.getAll);
router.get('/employees/export', protect, authorize('admin', 'hr', 'manager'), empCtrl.exportCSV);
router.get('/employees/org-chart', protect, authorize('admin', 'hr', 'manager'), empCtrl.getOrgChart);
router.get('/employees/:id', protect, authorize('admin', 'hr', 'manager'), empCtrl.getById);
router.get('/employees/:id/detail', protect, authorize('admin', 'hr', 'manager'), empCtrl.getDetail);
router.post('/employees', protect, authorize('admin', 'hr'), validate(schemas.createEmployee), empCtrl.create);
router.put('/employees/:id', protect, authorize('admin', 'hr'), validate(schemas.updateEmployee), empCtrl.update);
router.delete('/employees/:id', protect, authorize('admin', 'hr'), empCtrl.delete);
router.put('/employees/:id/approve', protect, authorize('admin'), empCtrl.approve);
router.put('/employees/:id/reject', protect, authorize('admin'), empCtrl.reject);
router.put('/employees/:id/terminate', protect, authorize('admin'), validate(schemas.terminateEmployee), empCtrl.terminate);
router.put('/employees/:id/pos-access', protect, authorize('admin', 'hr', 'manager'), empCtrl.assignPosAccess);
router.put('/employees/:id/pos-revoke', protect, authorize('admin', 'hr', 'manager'), empCtrl.revokePosAccess);
router.get('/pos-staff', protect, authorize('admin', 'hr', 'manager', 'cashier'), empCtrl.getPosStaff);

// ─── Attendance ───────────────────────────────────────
router.get('/attendance/today', protect, attCtrl.getTodaySummary);
router.get('/attendance/calendar', protect, authorize('admin', 'hr', 'manager'), attCtrl.getCalendar);
router.get('/attendance', protect, authorize('admin', 'hr', 'manager'), attCtrl.getAll);
router.get('/attendance/export', protect, authorize('admin', 'hr', 'manager'), attCtrl.exportCSV);
router.post('/attendance/clock-in', protect, validate(schemas.clockIn), attCtrl.clockIn);
router.post('/attendance/clock-out', protect, validate(schemas.clockOut), attCtrl.clockOut);
router.put('/attendance/:id', protect, authorize('admin', 'hr'), validate(schemas.updateAttendance), attCtrl.update);

// ─── Schedules ────────────────────────────────────────
router.get('/schedules', protect, authorize('admin', 'hr', 'manager'), schCtrl.getAll);
router.get('/schedules/assignments/list', protect, authorize('admin', 'hr', 'manager'), schCtrl.getAssignments);
router.get('/schedules/permanent', protect, authorize('admin', 'hr', 'manager'), schCtrl.getPermanentAssignments);
router.delete('/schedules/permanent/:employeeId', protect, authorize('admin', 'hr'), schCtrl.removePermanentAssignment);
router.delete('/schedules/assignments/:id', protect, authorize('admin', 'hr'), schCtrl.deleteAssignment);
router.post('/schedules/assign', protect, authorize('admin', 'hr'), validate(schemas.assignShift), schCtrl.assign);
router.get('/schedules/:id', protect, authorize('admin', 'hr'), schCtrl.getById);
router.post('/schedules', protect, authorize('admin', 'hr'), validate(schemas.createSchedule), schCtrl.create);
router.put('/schedules/:id', protect, authorize('admin', 'hr'), validate(schemas.updateSchedule), schCtrl.update);
router.delete('/schedules/:id', protect, authorize('admin', 'hr'), schCtrl.delete);

// ─── Payroll ──────────────────────────────────────────
router.get('/payrolls', protect, authorize('admin', 'hr', 'manager'), payCtrl.getAll);
router.get('/payrolls/:id', protect, authorize('admin', 'hr', 'manager'), payCtrl.getById);
router.post('/payrolls', protect, authorize('admin', 'hr'), validate(schemas.generatePayroll), payCtrl.generate);
router.post('/payrolls/preview', protect, authorize('admin', 'hr'), payCtrl.preview);
router.put('/payrolls/:id/process', protect, authorize('admin', 'hr'), payCtrl.process);
router.put('/payrolls/:id/pay', protect, authorize('admin'), payCtrl.pay);
router.get('/payrolls/:id/payslips', protect, authorize('admin', 'hr'), payCtrl.getPayslips);
router.get('/payrolls/:id/export', protect, authorize('admin', 'hr'), payCtrl.exportCSV);

// ─── Job Postings ───────────────────────────────────
const resumeUpload = require('../../middleware/resumeUpload');
const { validateResumeSignature } = resumeUpload;

router.get('/jobs', protect, authorize('admin', 'hr', 'manager'), jobCtrl.getAll);
router.get('/jobs/:id', protect, authorize('admin', 'hr', 'manager'), jobCtrl.getById);
router.post('/jobs', protect, authorize('admin', 'hr'), validate(schemas.createJobPosting), jobCtrl.create);
router.put('/jobs/:id', protect, authorize('admin', 'hr'), validate(schemas.updateJobPosting), jobCtrl.update);
router.put('/jobs/:id/close', protect, authorize('admin', 'hr'), jobCtrl.close);
router.put('/jobs/:id/approve', protect, authorize('admin'), jobCtrl.approve);
router.put('/jobs/:id/reject', protect, authorize('admin'), jobCtrl.reject);
router.delete('/jobs/:id', protect, authorize('admin', 'hr'), jobCtrl.delete);
router.get('/jobs/applications/list', protect, authorize('admin', 'hr'), jobCtrl.getApplications);
router.get('/jobs/applications/resume/:filename', protect, authorize('admin', 'hr', 'manager'), jobCtrl.downloadResume);
router.post('/jobs/applications', protect, resumeUpload.single('resume'), validateResumeSignature, validate(schemas.applyJob), jobCtrl.apply);
router.put('/jobs/applications/:id/status', protect, authorize('admin', 'hr'), validate(schemas.updateApplicationStatus), jobCtrl.updateApplicationStatus);

// ─── Interviews ─────────────────────────────────────
router.get('/interviews', protect, authorize('admin', 'hr', 'manager'), jobCtrl.getInterviews);
router.get('/interviewers', protect, authorize('admin', 'hr', 'manager'), async (req, res, next) => {
  try {
    const roles = await Role.findAll({ where: { slug: ['admin', 'hr', 'manager'] }, attributes: ['id'] });
    const roleIds = roles.map(r => r.id);
    const users = await User.findAll({ where: { roleId: roleIds, isActive: true }, attributes: ['id', 'firstName', 'lastName', 'email'], order: [['firstName', 'ASC']] });
    res.json({ success: true, data: users });
  } catch (e) { next(e); }
});
router.post('/interviews', protect, authorize('admin', 'hr'), validate(schemas.scheduleInterview), jobCtrl.scheduleInterview);
router.put('/interviews/:id', protect, authorize('admin', 'hr'), validate(schemas.updateInterview), jobCtrl.updateInterview);
router.put('/interviews/:id/result', protect, authorize('admin', 'hr'), validate(schemas.updateInterviewResult), jobCtrl.updateInterviewResult);
router.delete('/interviews/:id', protect, authorize('admin', 'hr'), jobCtrl.deleteInterview);

// ─── Contracts ──────────────────────────────────────
router.get('/contracts', protect, authorize('admin', 'hr', 'manager'), contractCtrl.getAll);
router.get('/contracts/:id', protect, authorize('admin', 'hr', 'manager'), contractCtrl.getById);
router.get('/contracts/expiring/soon', protect, authorize('admin', 'hr', 'manager'), contractCtrl.getExpiring);
router.post('/contracts', protect, authorize('admin', 'hr'), validate(schemas.createContract), contractCtrl.create);
router.put('/contracts/:id', protect, authorize('admin', 'hr'), validate(schemas.updateContract), contractCtrl.update);
router.put('/contracts/:id/approve', protect, authorize('admin'), contractCtrl.approve);
router.put('/contracts/:id/reject', protect, authorize('admin'), contractCtrl.reject);
router.put('/contracts/:id/terminate', protect, authorize('admin'), contractCtrl.terminate);
router.post('/contracts/:id/renew', protect, authorize('admin', 'hr'), validate(schemas.renewContract), contractCtrl.renew);
router.post('/contracts/check-expired', protect, authorize('admin'), contractCtrl.checkExpired);
router.delete('/contracts/:id', protect, authorize('admin', 'hr'), contractCtrl.delete);

// ─── Leaves ─────────────────────────────────────────
router.get('/leaves', protect, authorize('admin', 'hr', 'manager'), leaveCtrl.getAll);
router.get('/leaves/:id', protect, authorize('admin', 'hr', 'manager'), leaveCtrl.getById);
router.post('/leaves', protect, validate(schemas.createLeave), leaveCtrl.create);
router.put('/leaves/:id/hr-review', protect, authorize('admin', 'hr'), validate(schemas.hrReviewLeave), leaveCtrl.hrReview);
router.put('/leaves/:id/admin-approve', protect, authorize('admin'), leaveCtrl.adminApprove);
router.put('/leaves/:id/admin-reject', protect, authorize('admin'), validate(schemas.adminRejectLeave), leaveCtrl.adminReject);
router.put('/leaves/:id/cancel', protect, leaveCtrl.cancel);
router.delete('/leaves/:id', protect, authorize('admin', 'hr'), leaveCtrl.delete);

// ─── Leave Balances ─────────────────────────────────
router.get('/leaves/balance/:employeeId', protect, authorize('admin', 'hr', 'manager'), leaveCtrl.getBalance);
router.put('/leaves/balance/:employeeId', protect, authorize('admin'), leaveCtrl.updateBalance);
router.get('/me/leaves/balance', protect, leaveCtrl.getMyBalance);

// ─── Employee Documents ───────────────────────────────
router.get('/employees/:employeeId/documents', protect, authorize('admin', 'hr', 'manager'), empDocCtrl.list);
router.post('/employees/:employeeId/documents', protect, authorize('admin', 'hr', 'manager'), uploadDocument.single('file'), validateDocumentSignature, empDocCtrl.upload);
router.get('/employee-documents/:id/download', protect, authorize('admin', 'hr', 'manager'), empDocCtrl.download);
router.delete('/employee-documents/:id', protect, authorize('admin', 'hr'), empDocCtrl.delete);

// ─── Employee Self-Service ──────────────────────────────
router.get('/me', protect, empCtrl.getMyProfile);
router.put('/me/profile', protect, validate(schemas.updateProfile), empCtrl.updateMyProfile);
router.get('/me/attendance', protect, empCtrl.getMyAttendance);
router.get('/me/leaves', protect, empCtrl.getMyLeaves);
router.get('/me/payslips', protect, empCtrl.getMyPayslips);
router.get('/me/contracts', protect, empCtrl.getMyContracts);
router.post('/me/leaves', protect, validate(schemas.createLeave), leaveCtrl.create);

module.exports = router;
