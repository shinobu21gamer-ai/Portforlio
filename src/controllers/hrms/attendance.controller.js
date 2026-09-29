const attendanceService = require('../../services/hrms/attendance.service');
const { Employee, Attendance, Department } = require('../../models');
const { sendSuccess } = require('../../utils/response');
const ApiError = require('../../utils/ApiError');
const { Op } = require('sequelize');

class AttendanceController {
  async getAll(req, res, next) { try { sendSuccess(res, await attendanceService.getAll(req.query)); } catch (e) { next(e); } }
  async clockIn(req, res, next) {
    try {
      const employee = await Employee.findOne({ where: { email: req.user.email } });
      if (!employee) throw ApiError.notFound('No employee record found for this user');
      sendSuccess(res, await attendanceService.clockIn({ ...req.body, employeeId: employee.id }), 'Clocked in', 201);
    } catch (e) { next(e); }
  }
  async clockOut(req, res, next) {
    try {
      const employee = await Employee.findOne({ where: { email: req.user.email } });
      if (!employee) throw ApiError.notFound('No employee record found for this user');
      sendSuccess(res, await attendanceService.clockOut({ ...req.body, employeeId: employee.id }), 'Clocked out');
    } catch (e) { next(e); }
  }
  async create(req, res, next) { try { sendSuccess(res, await attendanceService.create(req.body), 'Created', 201); } catch (e) { next(e); } }
  async update(req, res, next) { try { sendSuccess(res, await attendanceService.update(req.params.id, req.body), 'Updated'); } catch (e) { next(e); } }
  async getTodaySummary(req, res, next) { try { sendSuccess(res, await attendanceService.getTodaySummary()); } catch (e) { next(e); } }
  async exportCSV(req, res, next) {
    try {
      const csv = await attendanceService.exportCSV(req.query);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="attendance.csv"');
      res.send(csv);
    } catch (e) { next(e); }
  }

  async getCalendar(req, res, next) {
    try {
      const { year, month, departmentId } = req.query;
      const y = parseInt(year) || new Date().getFullYear();
      const m = parseInt(month) || (new Date().getMonth() + 1);
      const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const endDate = new Date(y, m, 0).toISOString().split('T')[0];

      const empWhere = { status: 'active' };
      if (departmentId) empWhere.departmentId = parseInt(departmentId);

      const employees = await Employee.findAll({
        where: empWhere,
        attributes: ['id', 'employeeNo', 'firstName', 'lastName'],
        include: [{ model: Department, as: 'department', attributes: ['id', 'name'] }],
        order: [['lastName', 'ASC'], ['firstName', 'ASC']],
      });

      const empIds = employees.map(e => e.id);
      const attendance = empIds.length ? await Attendance.findAll({
        where: { employeeId: { [Op.in]: empIds }, date: { [Op.between]: [startDate, endDate] } },
        attributes: ['employeeId', 'date', 'status', 'clockIn', 'clockOut'],
      }) : [];

      const attMap = {};
      attendance.forEach(a => {
        const key = `${a.employeeId}_${a.date}`;
        attMap[key] = { status: a.status, clockIn: a.clockIn, clockOut: a.clockOut };
      });

      sendSuccess(res, { employees, attendance: attMap, year: y, month: m, startDate, endDate });
    } catch (e) { next(e); }
  }
}
module.exports = new AttendanceController();
