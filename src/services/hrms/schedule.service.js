const { Schedule, ShiftAssignment, Employee } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { logActivity } = require('../../utils/audit');
const { getPagination, getPaginationMeta, escapeLike, sanitizeObject } = require('../../utils/helpers');
const { Op } = require('sequelize');

class ScheduleService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};
    if (query.search) where.name = { [Op.like]: `%${escapeLike(query.search)}%` };
    const allowedSort = ["createdAt","name","startTime"];
    const sortBy = allowedSort.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const { rows, count } = await Schedule.findAndCountAll({
      where, offset, limit, order: [[sortBy, sortOrder]],
    });
    return { schedules: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getById(id) {
    const schedule = await Schedule.findByPk(id, {
      include: [{
        association: 'assignments',
        include: [{ association: 'employee', attributes: ['id', 'employeeNo', 'firstName', 'middleName', 'lastName'] }],
      }],
    });
    if (!schedule) throw ApiError.notFound('Schedule not found');
    return schedule;
  }

  async create(data, actorId = null) {
    const sanitized = sanitizeObject(data);
    const sched = await Schedule.create(sanitized);
    await logActivity(actorId, 'schedule-created', 'HRMS', {
      referenceType: 'Schedule', referenceId: sched.id,
      description: `Created schedule ${sched.name}`,
      newData: { name: sched.name, startTime: sched.startTime, endTime: sched.endTime },
    });
    return sched;
  }

  async update(id, data, actorId = null) {
    const schedule = await Schedule.findByPk(id);
    if (!schedule) throw ApiError.notFound('Schedule not found');
    const oldData = { name: schedule.name, startTime: schedule.startTime, endTime: schedule.endTime };
    await schedule.update(sanitizeObject(data));
    await logActivity(actorId, 'schedule-updated', 'HRMS', {
      referenceType: 'Schedule', referenceId: id,
      description: `Updated schedule ${schedule.name}`,
      oldData,
      newData: { name: schedule.name, startTime: schedule.startTime, endTime: schedule.endTime },
    });
    return schedule;
  }

  async delete(id, actorId = null) {
    const schedule = await Schedule.findByPk(id);
    if (!schedule) throw ApiError.notFound('Schedule not found');
    const oldData = { name: schedule.name, startTime: schedule.startTime, endTime: schedule.endTime };
    const { sequelize } = require('../../models');
    await sequelize.transaction(async (t) => {
      await Employee.update({ scheduleId: null }, { where: { scheduleId: id }, transaction: t });
      await ShiftAssignment.destroy({ where: { scheduleId: id }, transaction: t });
      await schedule.destroy({ transaction: t });
    });
    await logActivity(actorId, 'schedule-deleted', 'HRMS', {
      referenceType: 'Schedule', referenceId: id,
      description: `Deleted schedule ${oldData.name} (employees unassigned)`,
      oldData,
    });
    return { message: 'Schedule deleted' };
  }

  async assign(data, actorId = null) {
    const schedule = await Schedule.findByPk(data.scheduleId);
    if (!schedule) throw ApiError.notFound('Schedule not found');

    const emp = await Employee.findByPk(data.employeeId);
    if (!emp) throw ApiError.notFound('Employee not found');

    const { sequelize } = require('../../models');
    await sequelize.transaction(async (t) => {
      await emp.update({ scheduleId: data.scheduleId }, { transaction: t });

      if (data.date) {
        const [assignment, created] = await ShiftAssignment.findOrCreate({
          where: { employeeId: data.employeeId, date: data.date },
          defaults: { scheduleId: data.scheduleId },
          transaction: t,
        });
        if (!created) await assignment.update({ scheduleId: data.scheduleId }, { transaction: t });
      }
    });

    try {
      if (emp.email) {
        const { sendEmail } = require('../../utils/mailer');
        const { scheduleAssignmentEmail } = require('../../utils/emailTemplates');
        await sendEmail({
          to: emp.email,
          subject: 'Schedule Assignment — MiniMart POS',
          html: scheduleAssignmentEmail(emp.firstName || emp.email, schedule.name, schedule.startTime, schedule.endTime, data.date || null),
        }).catch(() => {});
      }
    } catch (e) { console.error('[EMAIL] Schedule assignment email failed:', e.message); }

    await logActivity(actorId, 'schedule-assigned', 'HRMS', {
      referenceType: 'Employee', referenceId: data.employeeId,
      description: `Assigned schedule ${schedule.name} to ${emp.firstName} ${emp.lastName}${data.date ? ` for ${data.date}` : ' (permanent)'}`,
      newData: { scheduleId: data.scheduleId, date: data.date || null },
    });

    return { assigned: 1 };
  }

  async deleteAssignment(id, actorId = null) {
    const assignment = await ShiftAssignment.findByPk(id);
    if (!assignment) throw ApiError.notFound('Assignment not found');
    const oldData = { employeeId: assignment.employeeId, scheduleId: assignment.scheduleId, date: assignment.date };
    await assignment.destroy();
    await logActivity(actorId, 'schedule-assignment-deleted', 'HRMS', {
      referenceType: 'ShiftAssignment', referenceId: id,
      description: `Removed shift assignment for employee #${assignment.employeeId}`,
      oldData,
    });
    return { message: 'Assignment deleted' };
  }

  async getPermanentAssignments(_query) {
    const employees = await Employee.findAll({
      where: { status: 'active', scheduleId: { [require('sequelize').Op.ne]: null } },
      attributes: ['id', 'employeeNo', 'firstName', 'lastName'],
      include: [
        { association: 'schedule', attributes: ['id', 'name', 'startTime', 'endTime'] },
        { association: 'department', attributes: ['id', 'name'] },
      ],
      order: [['firstName', 'ASC']],
    });
    return employees;
  }

  async removePermanentAssignment(employeeId, actorId = null) {
    const emp = await Employee.findByPk(employeeId);
    if (!emp) throw ApiError.notFound('Employee not found');
    const oldData = { scheduleId: emp.scheduleId };
    await emp.update({ scheduleId: null });
    await logActivity(actorId, 'schedule-permanent-assignment-removed', 'HRMS', {
      referenceType: 'Employee', referenceId: employeeId,
      description: `Removed permanent schedule from ${emp.firstName} ${emp.lastName}`,
      oldData,
    });
    return { message: 'Schedule removed' };
  }

  async getAssignments(query) {
    const where = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.date) where.date = query.date;
    if (query.startDate && query.endDate) {
      const { Op } = require('sequelize');
      where.date = { [Op.between]: [query.startDate, query.endDate] };
    }

    return ShiftAssignment.findAll({
      where,
      include: [
        { association: 'employee', attributes: ['id', 'employeeNo', 'firstName', 'middleName', 'lastName'] },
        { association: 'schedule', attributes: ['id', 'name', 'startTime', 'endTime'] },
      ],
      order: [['date', 'ASC']],
    });
  }
}

module.exports = new ScheduleService();
