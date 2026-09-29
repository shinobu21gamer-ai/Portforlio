const { LeaveRequest, Employee, Department, Attendance, Notification, sequelize } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta, escapeLike, sanitizeObject } = require('../../utils/helpers');
const { Op } = require('sequelize');
const { logActivity } = require('../../utils/audit');

const LEAVE_CREDITS = {
  sick: 15,
  vacation: 15,
  personal: 5,
  maternity: 105,
  paternity: 7,
  bereavement: 5,
  other: 0,
};

class LeaveService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};
    if (query.status) where.status = query.status;
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.leaveType) where.leaveType = query.leaveType;

    const include = [{
      association: 'employee',
      attributes: ['id', 'employeeNo', 'firstName', 'middleName', 'lastName'],
      include: [{ association: 'department', attributes: ['id', 'name'] }],
    }];

    if (query.search) {
      const esc = escapeLike(query.search);
      include[0].where = {
        [Op.or]: [
          { firstName: { [Op.like]: `%${esc}%` } },
          { lastName: { [Op.like]: `%${esc}%` } },
        ],
      };
    }

    const { rows, count } = await LeaveRequest.findAndCountAll({
      where, include, offset, limit, order: [['createdAt', 'DESC']],
      distinct: true,
    });
    return { leaves: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getById(id) {
    const leave = await LeaveRequest.findByPk(id, {
      include: [{
        association: 'employee',
        attributes: ['id', 'employeeNo', 'firstName', 'middleName', 'lastName', 'email'],
        include: [{ association: 'department', attributes: ['id', 'name'] }],
      }],
    });
    if (!leave) throw ApiError.notFound('Leave request not found');
    return leave;
  }

  async getLeaveBalance(employeeId) {
    const emp = await Employee.findByPk(employeeId);
    if (!emp) throw ApiError.notFound('Employee not found');

    const year = new Date().getFullYear();
    const startOfYear = `${year}-01-01`;
    const endOfYear = `${year}-12-31`;

    const usedLeaves = await LeaveRequest.findAll({
      where: {
        employeeId,
        status: { [Op.in]: ['admin-approved'] },
        startDate: { [Op.gte]: startOfYear },
        endDate: { [Op.lte]: endOfYear },
      },
      attributes: ['leaveType', [sequelize.fn('SUM', sequelize.col('days')), 'totalDays']],
      group: ['leaveType'],
    });

    const balance = {};
    for (const [type, max] of Object.entries(LEAVE_CREDITS)) {
      const used = usedLeaves.find(u => u.leaveType === type);
      balance[type] = {
        total: max,
        used: used ? parseInt(used.get('totalDays')) : 0,
        remaining: max - (used ? parseInt(used.get('totalDays')) : 0),
      };
    }

    return balance;
  }

  async create(data) {
    const sanitized = sanitizeObject(data);
    let emp;
    if (sanitized.employeeId) {
      emp = await Employee.findByPk(sanitized.employeeId);
    } else if (sanitized.userId) {
      emp = await Employee.findOne({ where: { userId: sanitized.userId } });
      if (emp) sanitized.employeeId = emp.id;
    }
    if (!emp) throw ApiError.notFound('Employee not found');

    const start = new Date(sanitized.startDate);
    const end = new Date(sanitized.endDate);
    if (end < start) throw ApiError.badRequest('End date must be on or after start date');

    let weekdays = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) weekdays++;
    }
    sanitized.days = weekdays;

    // Check leave balance
    const balance = await this.getLeaveBalance(emp.id);
    const leaveBalance = balance[sanitized.leaveType];
    if (leaveBalance && leaveBalance.remaining < weekdays) {
      throw ApiError.badRequest(`Insufficient ${sanitized.leaveType} leave credits. Remaining: ${leaveBalance.remaining} days`);
    }

    // Check for overlapping leaves
    const overlapping = await LeaveRequest.findOne({
      where: {
        employeeId: emp.id,
        status: { [Op.notIn]: ['rejected', 'cancelled'] },
        [Op.or]: [
          { startDate: { [Op.between]: [sanitized.startDate, sanitized.endDate] } },
          { endDate: { [Op.between]: [sanitized.startDate, sanitized.endDate] } },
          { startDate: { [Op.lte]: sanitized.startDate }, endDate: { [Op.gte]: sanitized.endDate } },
        ],
      },
    });
    if (overlapping) throw ApiError.badRequest('Leave request overlaps with an existing leave');

    const leave = await LeaveRequest.create(sanitized);

    await Notification.create({
      userId: emp.userId || null,
      type: 'hrms_leave_request',
      title: 'Leave Request Submitted',
      message: `${emp.firstName} ${emp.lastName} submitted a ${sanitized.leaveType} leave request from ${sanitized.startDate} to ${sanitized.endDate}`,
    });

    try {
      if (emp.email) {
        const { sendEmail } = require('../../utils/mailer');
        const { leaveRequestEmail } = require('../../utils/emailTemplates');
        await sendEmail({
          to: emp.email,
          subject: `Leave Request Submitted — MiniMart POS`,
          html: leaveRequestEmail(emp.firstName || emp.email, sanitized.leaveType, 'submitted', sanitized.startDate, sanitized.endDate),
        }).catch(() => {});
      }
    } catch (e) { console.error('[EMAIL] Leave submission email failed:', e.message); }

    return leave;
  }

  async hrReview(id, reviewedBy, remarks) {
    const leave = await LeaveRequest.findByPk(id);
    if (!leave) throw ApiError.notFound('Leave request not found');
    if (leave.status !== 'pending') throw ApiError.badRequest('Only pending leaves can be reviewed');
    await leave.update({ status: 'hr-reviewed', reviewedBy, reviewedAt: new Date(), remarks: remarks || leave.remarks });
    await logActivity(reviewedBy, 'leave-hr-reviewed', 'HRMS', { referenceType: 'LeaveRequest', referenceId: id, description: `HR reviewed leave request #${id}` });

    const emp = await Employee.findByPk(leave.employeeId);
    if (emp) {
      await Notification.create({
        userId: emp.userId || null,
        type: 'hrms_leave_approved',
        title: 'Leave Request Reviewed',
        message: `Your leave request has been reviewed by HR and is pending admin approval.`,
      });
      try {
        if (emp.email) {
          const { sendEmail } = require('../../utils/mailer');
          const { leaveRequestEmail } = require('../../utils/emailTemplates');
          await sendEmail({
            to: emp.email,
            subject: `Leave Request Reviewed — MiniMart POS`,
            html: leaveRequestEmail(emp.firstName || emp.email, leave.leaveType, 'reviewed', leave.startDate, leave.endDate),
          }).catch(() => {});
        }
      } catch (e) { console.error('[EMAIL] Leave HR review email failed:', e.message); }
    }

    return this.getById(id);
  }

  async adminApprove(id, approvedBy) {
    const leave = await LeaveRequest.findByPk(id);
    if (!leave) throw ApiError.notFound('Leave request not found');
    if (leave.status !== 'hr-reviewed') throw ApiError.badRequest('Only HR-reviewed leaves can be approved by admin');

    const overlapping = await LeaveRequest.findOne({
      where: {
        id: { [Op.ne]: id },
        employeeId: leave.employeeId,
        status: 'admin-approved',
        [Op.or]: [
          { startDate: { [Op.between]: [leave.startDate, leave.endDate] } },
          { endDate: { [Op.between]: [leave.startDate, leave.endDate] } },
          { startDate: { [Op.lte]: leave.startDate }, endDate: { [Op.gte]: leave.endDate } },
        ],
      },
    });
    if (overlapping) throw ApiError.badRequest('Leave overlaps with an already approved leave');

    await leave.update({ status: 'admin-approved', approvedBy, approvedAt: new Date() });
    await logActivity(approvedBy, 'leave-admin-approved', 'HRMS', { referenceType: 'LeaveRequest', referenceId: id, description: `Admin approved leave request #${id}` });

    await sequelize.transaction(async (t) => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayOfWeek = d.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;
        const existing = await Attendance.findOne({ where: { employeeId: leave.employeeId, date: dateStr } });
        if (!existing) {
          await Attendance.create({
            employeeId: leave.employeeId,
            date: dateStr,
            status: 'on-leave',
            notes: `Approved ${leave.leaveType} leave`,
          }, { transaction: t });
        }
      }
    });

    const emp = await Employee.findByPk(leave.employeeId);
    if (emp) {
      await Notification.create({
        userId: emp.userId || null,
        type: 'hrms_leave_approved',
        title: 'Leave Request Approved',
        message: `Your ${leave.leaveType} leave request from ${leave.startDate} to ${leave.endDate} has been approved.`,
      });
      try {
        const { sendEmail } = require('../../utils/mailer');
        const { leaveStatusEmail } = require('../../utils/emailTemplates');
        if (emp.email) {
          sendEmail({
            to: emp.email,
            subject: `Leave Request Approved - ${process.env.APP_NAME || 'MiniMart POS'}`,
            html: leaveStatusEmail(emp.firstName || emp.email, leave.leaveType, 'approved', leave.startDate, leave.endDate),
          }).catch(() => {});
        }
      } catch (err) { /* email errors should not block leave approval */ }
    }

    return this.getById(id);
  }

  async adminReject(id, approvedBy, remarks) {
    const leave = await LeaveRequest.findByPk(id);
    if (!leave) throw ApiError.notFound('Leave request not found');
    if (leave.status !== 'hr-reviewed') throw ApiError.badRequest('Only HR-reviewed leaves can be rejected');
    await leave.update({ status: 'rejected', approvedBy, approvedAt: new Date(), remarks: remarks || leave.remarks });

    await sequelize.transaction(async (t) => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        await Attendance.destroy({ where: { employeeId: leave.employeeId, date: dateStr, status: 'on-leave' }, transaction: t });
      }
    });

    const emp = await Employee.findByPk(leave.employeeId);
    if (emp) {
      await Notification.create({
        userId: emp.userId || null,
        type: 'hrms_leave_rejected',
        title: 'Leave Request Rejected',
        message: `Your ${leave.leaveType} leave request from ${leave.startDate} to ${leave.endDate} has been rejected.`,
      });
      try {
        if (emp.email) {
          const { sendEmail } = require('../../utils/mailer');
          const { leaveRequestEmail } = require('../../utils/emailTemplates');
          await sendEmail({
            to: emp.email,
            subject: `Leave Request Rejected — MiniMart POS`,
            html: leaveRequestEmail(emp.firstName || emp.email, leave.leaveType, 'rejected', leave.startDate, leave.endDate),
          }).catch(() => {});
        }
      } catch (e) { console.error('[EMAIL] Leave reject email failed:', e.message); }
    }

    return this.getById(id);
  }

  async cancel(id, userId) {
    const leave = await LeaveRequest.findByPk(id);
    if (!leave) throw ApiError.notFound('Leave request not found');
    if (leave.status !== 'pending') throw ApiError.badRequest('Only pending leaves can be cancelled');

    const emp = await Employee.findOne({ where: { userId } });
    if (!emp || emp.id !== leave.employeeId) throw ApiError.badRequest('You can only cancel your own leave requests');

    await leave.update({ status: 'cancelled', remarks: 'Cancelled by employee' });
    return { message: 'Leave request cancelled' };
  }

  async delete(id) {
    const leave = await LeaveRequest.findByPk(id);
    if (!leave) throw ApiError.notFound('Leave request not found');
    await leave.destroy();
    return { message: 'Leave request deleted' };
  }
}

module.exports = new LeaveService();
