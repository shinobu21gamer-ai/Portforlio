const { Schedule, ShiftAssignment, Employee } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta, escapeLike, sanitizeObject } = require('../../utils/helpers');
const { Op } = require('sequelize');

class ScheduleService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};
    if (query.search) where.name = { [Op.like]: `%${escapeLike(query.search)}%` };
    const { rows, count } = await Schedule.findAndCountAll({
      where, offset, limit, order: [['createdAt', 'DESC']],
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

  async create(data) {
    const sanitized = sanitizeObject(data);
    return Schedule.create(sanitized);
  }

  async update(id, data) {
    const schedule = await Schedule.findByPk(id);
    if (!schedule) throw ApiError.notFound('Schedule not found');
    await schedule.update(sanitizeObject(data));
    return schedule;
  }

  async delete(id) {
    const schedule = await Schedule.findByPk(id);
    if (!schedule) throw ApiError.notFound('Schedule not found');
    const { sequelize } = require('../../models');
    await sequelize.transaction(async (t) => {
      await Employee.update({ scheduleId: null }, { where: { scheduleId: id }, transaction: t });
      await ShiftAssignment.destroy({ where: { scheduleId: id }, transaction: t });
      await schedule.destroy({ transaction: t });
    });
    return { message: 'Schedule deleted' };
  }

  async assign(data) {
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

    return { assigned: 1 };
  }

  async deleteAssignment(id) {
    const assignment = await ShiftAssignment.findByPk(id);
    if (!assignment) throw ApiError.notFound('Assignment not found');
    await assignment.destroy();
    return { message: 'Assignment deleted' };
  }

  async getPermanentAssignments(query) {
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

  async removePermanentAssignment(employeeId) {
    const emp = await Employee.findByPk(employeeId);
    if (!emp) throw ApiError.notFound('Employee not found');
    await emp.update({ scheduleId: null });
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
