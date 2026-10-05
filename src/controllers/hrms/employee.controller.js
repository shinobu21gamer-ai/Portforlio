const employeeService = require('../../services/hrms/employee.service');
const { sendSuccess } = require('../../utils/response');
const { Employee, Attendance, LeaveRequest, Payslip, Contract, Department, Position, Role } = require('../../models');
const ApiError = require('../../utils/ApiError');

class EmployeeController {
  async getAll(req, res, next) { try { sendSuccess(res, await employeeService.getAll(req.query)); } catch (e) { next(e); } }
  async getById(req, res, next) { try { sendSuccess(res, await employeeService.getById(req.params.id)); } catch (e) { next(e); } }
  async create(req, res, next) { try { sendSuccess(res, await employeeService.create(req.body, req.user?.id), 'Created', 201); } catch (e) { next(e); } }
  async update(req, res, next) { try { sendSuccess(res, await employeeService.update(req.params.id, req.body, req.user?.id), 'Updated'); } catch (e) { next(e); } }
  async delete(req, res, next) { try { sendSuccess(res, await employeeService.delete(req.params.id, req.user?.id)); } catch (e) { next(e); } }
  async approve(req, res, next) { try { sendSuccess(res, await employeeService.approve(req.params.id, req.user?.id), 'Approved'); } catch (e) { next(e); } }
  async reject(req, res, next) { try { sendSuccess(res, await employeeService.reject(req.params.id, req.user?.id), 'Rejected'); } catch (e) { next(e); } }
  async terminate(req, res, next) { try { sendSuccess(res, await employeeService.terminate(req.params.id, req.body, req.user?.id)); } catch (e) { next(e); } }
  async exportCSV(req, res, next) {
    try {
      const csv = await employeeService.exportCSV(req.query);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="employees.csv"');
      res.send(csv);
    } catch (e) { next(e); }
  }

  async getDetail(req, res, next) {
    try {
      const emp = await Employee.scope('withSensitive').findByPk(req.params.id, {
        include: [
          { association: 'department' },
          { association: 'position' },
          { association: 'schedule', attributes: ['id', 'name', 'startTime', 'endTime'] },
          { association: 'user', attributes: ['id', 'roleId', 'isActive'],
            include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'slug'] }],
          },
        ],
      });
      if (!emp) return next(new ApiError(404, 'Employee not found'));

      const [attendance, leaves, payslips, contracts] = await Promise.all([
        Attendance.findAll({ where: { employeeId: emp.id }, order: [['date', 'DESC']], limit: 30 }),
        LeaveRequest.findAll({ where: { employeeId: emp.id }, order: [['createdAt', 'DESC']], limit: 10 }),
        Payslip.findAll({ where: { employeeId: emp.id }, order: [['createdAt', 'DESC']], limit: 10,
          include: [{ association: 'payroll', attributes: ['id', 'period'] }],
        }),
        Contract.findAll({ where: { employeeId: emp.id }, order: [['createdAt', 'DESC']] }),
      ]);

      sendSuccess(res, { employee: emp, attendance, leaves, payslips, contracts });
    } catch (e) { next(e); }
  }

  async getMyProfile(req, res, next) {
    try {
      const emp = await Employee.scope('withSensitive').findOne({
        where: { userId: req.user.id },
        include: [
          { association: 'department' },
          { association: 'position' },
          { association: 'schedule', attributes: ['id', 'name', 'startTime', 'endTime'] },
        ],
      });
      if (!emp) throw ApiError.notFound('No employee profile found for this account');
      sendSuccess(res, emp);
    } catch (e) { next(e); }
  }

  async getMyAttendance(req, res, next) {
    try {
      const emp = await Employee.findOne({ where: { userId: req.user.id } });
      if (!emp) throw ApiError.notFound('No employee profile found');
      const { getPagination, getPaginationMeta } = require('../../utils/helpers');
      const { page, limit, offset } = getPagination(req.query.page, req.query.limit);
      const where = { employeeId: emp.id };
      if (req.query.date) where.date = req.query.date;
      const { rows, count } = await Attendance.findAndCountAll({ where, offset, limit, order: [['date', 'DESC']] });
      sendSuccess(res, { attendance: rows, pagination: getPaginationMeta(count, page, limit) });
    } catch (e) { next(e); }
  }

  async getMyLeaves(req, res, next) {
    try {
      const emp = await Employee.findOne({ where: { userId: req.user.id } });
      if (!emp) throw ApiError.notFound('No employee profile found');
      const { getPagination, getPaginationMeta } = require('../../utils/helpers');
      const { page, limit, offset } = getPagination(req.query.page, req.query.limit);
      const { rows, count } = await LeaveRequest.findAndCountAll({ where: { employeeId: emp.id }, offset, limit, order: [['createdAt', 'DESC']] });
      sendSuccess(res, { leaves: rows, pagination: getPaginationMeta(count, page, limit) });
    } catch (e) { next(e); }
  }

  async getMyPayslips(req, res, next) {
    try {
      const emp = await Employee.findOne({ where: { userId: req.user.id } });
      if (!emp) throw ApiError.notFound('No employee profile found');
      const { getPagination, getPaginationMeta } = require('../../utils/helpers');
      const { page, limit, offset } = getPagination(req.query.page, req.query.limit);
      const { rows, count } = await Payslip.findAndCountAll({
        where: { employeeId: emp.id }, offset, limit, order: [['createdAt', 'DESC']],
        include: [{ association: 'payroll', attributes: ['id', 'period'] }],
      });
      sendSuccess(res, { payslips: rows, pagination: getPaginationMeta(count, page, limit) });
    } catch (e) { next(e); }
  }

  async getMyContracts(req, res, next) {
    try {
      const emp = await Employee.findOne({ where: { userId: req.user.id } });
      if (!emp) throw ApiError.notFound('No employee profile found');
      const contracts = await Contract.findAll({ where: { employeeId: emp.id }, order: [['createdAt', 'DESC']] });
      sendSuccess(res, { contracts });
    } catch (e) { next(e); }
  }

  async updateMyProfile(req, res, next) {
    try { sendSuccess(res, await employeeService.updateProfile(req.user.id, req.body), 'Profile updated'); } catch (e) { next(e); }
  }

  async assignPosAccess(req, res, next) {
    try { sendSuccess(res, await employeeService.assignPosAccess(req.params.id, req.body, req.user?.id), 'POS access assigned'); } catch (e) { next(e); }
  }

  async revokePosAccess(req, res, next) {
    try { sendSuccess(res, await employeeService.revokePosAccess(req.params.id, req.user?.id), 'POS access revoked'); } catch (e) { next(e); }
  }

  async getPosStaff(req, res, next) {
    try { sendSuccess(res, await employeeService.getPosStaff(req.query)); } catch (e) { next(e); }
  }

  async getOrgChart(req, res, next) {
    try {
      const employees = await Employee.findAll({
        where: { status: 'active' },
        attributes: ['id', 'employeeNo', 'firstName', 'lastName', 'reportsToId', 'departmentId', 'positionId', 'avatar'],
        include: [
          { model: Department, as: 'department', attributes: ['id', 'name'] },
          { model: Position, as: 'position', attributes: ['id', 'title'] },
        ],
        order: [['lastName', 'ASC']],
      });

      const empMap = {};
      employees.forEach(e => { empMap[e.id] = { ...e.toJSON(), children: [] }; });

      const roots = [];
      employees.forEach(e => {
        const node = empMap[e.id];
        if (e.reportsToId && empMap[e.reportsToId]) {
          empMap[e.reportsToId].children.push(node);
        } else {
          roots.push(node);
        }
      });

      sendSuccess(res, { roots, total: employees.length });
    } catch (e) { next(e); }
  }
}
module.exports = new EmployeeController();
