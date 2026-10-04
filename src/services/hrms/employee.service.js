const { Op } = require('sequelize');
const crypto = require('crypto');
const { Employee, Department, Position, Contract, User, Role, sequelize } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta, sanitizeObject, generateEmployeeNo, escapeLike } = require('../../utils/helpers');
const { logActivity } = require('../../utils/audit');

class EmployeeService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};
    if (query.search) {
      const safeSearch = escapeLike(query.search);
      where[Op.or] = [
        { firstName: { [Op.like]: `%${safeSearch}%` } },
        { lastName: { [Op.like]: `%${safeSearch}%` } },
        { employeeNo: { [Op.like]: `%${safeSearch}%` } },
        { email: { [Op.like]: `%${safeSearch}%` } },
      ];
    }
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.status) where.status = query.status;
    if (query.employmentType) where.employmentType = query.employmentType;

    const allowedSort = ['employeeNo', 'firstName', 'lastName', 'email', 'salary', 'hireDate', 'status', 'createdAt'];
    const sortBy = allowedSort.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const { rows, count } = await Employee.findAndCountAll({
      where,
      include: [
        { association: 'department', attributes: ['id', 'name'] },
        { association: 'position', attributes: ['id', 'title'] },
        { association: 'schedule', attributes: ['id', 'name', 'startTime', 'endTime'] },
        { association: 'user', attributes: ['id', 'roleId', 'isActive'],
          include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'slug'] }],
        },
      ],
      offset, limit, order: [[sortBy, sortOrder]],
    });

    return { employees: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getById(id) {
    const emp = await Employee.scope('withSensitive').findByPk(id, {
      include: [
        { association: 'department' },
        { association: 'position' },
        { association: 'schedule', attributes: ['id', 'name', 'startTime', 'endTime'] },
        { association: 'payslips', limit: 5, order: [['createdAt', 'DESC']] },
        { association: 'user', attributes: ['id', 'roleId', 'isActive'],
          include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'slug'] }],
        },
      ],
    });
    if (!emp) throw ApiError.notFound('Employee not found');
    return emp;
  }

  async create(data, actorId = null) {
    const sanitized = sanitizeObject(data);
    const existingEmail = await Employee.findOne({ where: { email: sanitized.email } });
    if (existingEmail) throw ApiError.badRequest('Email already exists');

    const dept = await Department.findByPk(sanitized.departmentId);
    if (!dept) throw ApiError.notFound('Department not found');
    const pos = await Position.findByPk(sanitized.positionId);
    if (!pos) throw ApiError.notFound('Position not found');

    const { sequelize } = require('../../models');
    const employeeNo = await generateEmployeeNo(sequelize);

    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const employee = await Employee.create({ ...sanitized, employeeNo, status: 'pending' }, { transaction: t });

      const pos = await Position.findByPk(sanitized.positionId, { transaction: t });
      let role = pos?.roleSlug ? await Role.findOne({ where: { slug: pos.roleSlug }, transaction: t }) : null;
      if (!role) role = await Role.findOne({ where: { slug: 'employee' }, transaction: t });
      if (role) {
        const tempPassword = 'employee123';
        const user = await User.create({
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          password: tempPassword,
          roleId: role.id,
          isActive: false,
        }, { transaction: t });
        await employee.update({ userId: user.id }, { transaction: t });
      }

      // Record the employee record itself; approve/reject/terminate log their
      // own transitions separately. Inside the transaction so a rollback cannot
      // leave an audit row claiming a hire that did not happen.
      await logActivity(actorId, 'employee-created', 'HRMS', {
        referenceType: 'Employee', referenceId: employee.id,
        description: `Created employee ${employee.firstName} ${employee.lastName} (${employee.employeeNo})`,
        newData: { employeeNo: employee.employeeNo, status: employee.status, departmentId: employee.departmentId, positionId: employee.positionId },
      }, t);

      await t.commit();

      return this.getById(employee.id);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async update(id, data, actorId = null) {
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const emp = await Employee.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!emp) throw ApiError.notFound('Employee not found');

      const sanitized = sanitizeObject(data);

      // Sensitive fields are excluded from list/detail responses. If a client
      // round-trips a record and submits them blank, keep the stored value
      // rather than erasing it.
      for (const field of Employee.SENSITIVE_FIELDS) {
        if (sanitized[field] === '' || sanitized[field] === null || sanitized[field] === undefined) {
          delete sanitized[field];
        }
      }

      if (sanitized.email && sanitized.email !== emp.email) {
        const existing = await Employee.findOne({ where: { email: sanitized.email }, transaction: t });
        if (existing) throw ApiError.badRequest('Email already exists');
      }
      if (sanitized.departmentId) {
        const dept = await Department.findByPk(sanitized.departmentId, { transaction: t });
        if (!dept) throw ApiError.notFound('Department not found');
      }
      if (sanitized.positionId) {
        const pos = await Position.findByPk(sanitized.positionId, { transaction: t });
        if (!pos) throw ApiError.notFound('Position not found');
      }

      const oldData = {
        departmentId: emp.departmentId,
        positionId: emp.positionId,
        salary: emp.salary,
        paymentFrequency: emp.paymentFrequency,
        employmentType: emp.employmentType,
        status: emp.status,
      };

      await emp.update(sanitized, { transaction: t });

      const activeContract = await Contract.findOne({ where: { employeeId: id, status: 'active' }, transaction: t, lock: t.LOCK.UPDATE });
      if (activeContract) {
        const contractUpdate = { updatedAt: new Date() };
        if (sanitized.salary !== undefined) contractUpdate.salary = sanitized.salary;
        if (sanitized.paymentFrequency !== undefined) contractUpdate.paymentFrequency = sanitized.paymentFrequency;
        await activeContract.update(contractUpdate, { transaction: t });
      }

      await logActivity(actorId, 'employee-updated', 'HRMS', {
        referenceType: 'Employee', referenceId: id,
        description: `Updated employee ${emp.firstName} ${emp.lastName} (${emp.employeeNo})`,
        oldData,
        newData: {
          departmentId: emp.departmentId,
          positionId: emp.positionId,
          salary: emp.salary,
          paymentFrequency: emp.paymentFrequency,
          employmentType: emp.employmentType,
          status: emp.status,
        },
      }, t);

      await t.commit();

      return this.getById(id);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async delete(id, actorId = null) {
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const emp = await Employee.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!emp) throw ApiError.notFound('Employee not found');
      const oldData = { employeeNo: emp.employeeNo, status: emp.status, departmentId: emp.departmentId, positionId: emp.positionId };
      if (emp.userId) {
        const user = await User.findByPk(emp.userId, { transaction: t });
        if (user) await user.update({ isActive: false }, { transaction: t });
      }
      await emp.destroy({ transaction: t });
      await logActivity(actorId, 'employee-deleted', 'HRMS', {
        referenceType: 'Employee', referenceId: id,
        description: `Deleted employee ${emp.firstName} ${emp.lastName} (${emp.employeeNo})`,
        oldData,
      }, t);
      await t.commit();
      return { message: 'Employee deleted' };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async approve(id, actorId = null) {
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const emp = await Employee.findByPk(id, {
        include: [
          { association: 'department', attributes: ['id', 'name'] },
          { association: 'position', attributes: ['id', 'title'] },
          { association: 'schedule', attributes: ['id', 'name', 'startTime', 'endTime'] },
        ],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!emp) throw ApiError.notFound('Employee not found');
      const oldData = { status: emp.status };
      await emp.update({ status: 'active', approvedAt: new Date() }, { transaction: t });
      await logActivity(actorId, 'employee-approved', 'HRMS', { referenceType: 'Employee', referenceId: id, description: `Approved employee ${emp.firstName} ${emp.lastName}`, oldData, newData: { status: 'active' } }, t);

      await t.commit();

      try {
        const { sendEmail } = require('../../utils/mailer');
        const { employeeApprovedEmail, formatDate } = require('../../utils/emailTemplates');
        const user = emp.userId ? await User.findByPk(emp.userId) : null;
        const tempPassword = user ? 'employee123' : null;
        if (user && tempPassword) {
          await user.update({ password: tempPassword, isActive: true });
        }
        const startDateFormatted = formatDate(emp.hireDate);
        const scheduleInfo = emp.schedule ? `${emp.schedule.name} (${emp.schedule.startTime} — ${emp.schedule.endTime})` : '';
        await sendEmail({
          to: emp.email,
          subject: 'Welcome to MiniMart — Your Account is Ready',
          html: employeeApprovedEmail(emp.firstName || emp.email, emp.employeeNo, tempPassword, {
            startDate: startDateFormatted,
            department: emp.department?.name || '',
            position: emp.position?.title || '',
            schedule: scheduleInfo,
          }),
        }).catch(() => {});
      } catch (e) { console.error('[EMAIL] Employee approve email failed:', e.message); }

      return this.getById(id);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async reject(id, actorId = null) {
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const emp = await Employee.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!emp) throw ApiError.notFound('Employee not found');
      const oldData = { status: emp.status };
      await emp.update({ status: 'inactive' }, { transaction: t });
      if (emp.userId) {
        const user = await User.findByPk(emp.userId, { transaction: t });
        if (user) await user.update({ isActive: false }, { transaction: t });
      }
      await logActivity(actorId, 'employee-rejected', 'HRMS', { referenceType: 'Employee', referenceId: id, description: `Rejected employee ${emp.firstName} ${emp.lastName}`, oldData, newData: { status: 'inactive' } }, t);

      await t.commit();

      try {
        const { sendEmail } = require('../../utils/mailer');
        const { employeeRejectedEmail } = require('../../utils/emailTemplates');
        await sendEmail({
          to: emp.email,
          subject: 'Employment Application Update — MiniMart POS',
          html: employeeRejectedEmail(emp.firstName || emp.email),
        }).catch(() => {});
      } catch (e) { console.error('[EMAIL] Employee reject email failed:', e.message); }

      return emp;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async terminate(id, data = {}, actorId = null) {
    const emp = await Employee.findByPk(id);
    if (!emp) throw ApiError.notFound('Employee not found');
    if (emp.status === 'inactive') throw ApiError.badRequest('Employee is already terminated');

    const { ShiftAssignment, LeaveRequest, Notification, sequelize } = require('../../models');
    const today = new Date().toISOString().split('T')[0];

    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const empLocked = await Employee.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!empLocked) throw ApiError.notFound('Employee not found');

      await Contract.update(
        { status: 'terminated' },
        { where: { employeeId: id, status: { [Op.in]: ['active', 'pending'] } } },
        { transaction: t }
      );

      await ShiftAssignment.destroy({ where: { employeeId: id }, transaction: t });

      if (empLocked.userId) {
        await User.update({ isActive: false }, { where: { id: empLocked.userId }, transaction: t });
      }

      await empLocked.update({
        status: 'inactive',
        scheduleId: null,
        terminationType: data.terminationType || 'end-of-contract',
        terminationDate: data.terminationDate || today,
      }, { transaction: t });

      await t.commit();

      await logActivity(actorId, 'employee-terminated', 'HRMS', { referenceType: 'Employee', referenceId: id, description: `Terminated employee ${emp.firstName} ${emp.lastName} (${emp.employeeNo})` });

      await Notification.create({
        userId: emp.userId,
        type: 'hrms_contract_terminated',
        title: 'Employee Terminated',
        message: `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeNo}) has been terminated.`,
      });

      try {
        const { sendEmail } = require('../../utils/mailer');
        const { employeeTerminatedEmail } = require('../../utils/emailTemplates');
        await sendEmail({
          to: emp.email,
          subject: 'Employment Termination Notice — MiniMart POS',
          html: employeeTerminatedEmail(emp.firstName || emp.email, (data.terminationType || 'end-of-contract').replace(/-/g, ' '), data.terminationDate || today),
        }).catch(() => {});
      } catch (e) { console.error('[EMAIL] Employee terminate email failed:', e.message); }

      return { message: 'Employee terminated. Attendance and payslip records preserved for audit.' };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async updateProfile(userId, data) {
    const emp = await Employee.findOne({ where: { userId } });
    if (!emp) throw ApiError.notFound('Employee profile not found');

    const allowed = ['phone', 'address', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation', 'bankName', 'bankAccountNumber'];
    const updates = {};
    for (const key of allowed) {
      if (data[key] !== undefined) updates[key] = data[key];
    }
    if (Object.keys(updates).length > 0) {
      await emp.update(updates);
    }
    return this.getById(emp.id);
  }

  async assignPosAccess(id, data, actorId = null) {
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const emp = await Employee.findByPk(id, { include: [{ association: 'user', include: [{ association: 'role' }] }], transaction: t, lock: t.LOCK.UPDATE });
      if (!emp) throw ApiError.notFound('Employee not found');
      if (!emp.userId) throw ApiError.badRequest('Employee has no user account. Approve the employee first.');

      const POS_ROLES = ['cashier', 'manager', 'inventory_staff'];
      const { roleSlug } = data;
      if (!roleSlug) throw ApiError.badRequest('roleSlug is required');
      if (!POS_ROLES.includes(roleSlug)) throw ApiError.badRequest(`Invalid POS role. Allowed: ${POS_ROLES.join(', ')}`);

      const role = await Role.findOne({ where: { slug: roleSlug }, transaction: t });
      if (!role) throw ApiError.notFound('Role not found');

      const user = await User.findByPk(emp.userId, { transaction: t });
      if (!user) throw ApiError.notFound('User account not found');

      await user.update({ roleId: role.id }, { transaction: t });
      await logActivity(actorId, 'employee-pos-access', 'HRMS', {
        referenceType: 'Employee', referenceId: id,
        description: `Assigned POS role "${roleSlug}" to ${emp.firstName} ${emp.lastName}`,
        newData: { roleSlug, userId: user.id },
      }, t);

      await t.commit();

      return this.getById(id);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async revokePosAccess(id, actorId = null) {
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const emp = await Employee.findByPk(id, { include: [{ association: 'user', include: [{ association: 'role' }] }], transaction: t, lock: t.LOCK.UPDATE });
      if (!emp) throw ApiError.notFound('Employee not found');
      if (!emp.userId) throw ApiError.badRequest('Employee has no user account');

      const employeeRole = await Role.findOne({ where: { slug: 'employee' }, transaction: t });
      if (!employeeRole) throw ApiError.notFound('Employee role not found');

      const user = await User.findByPk(emp.userId, { transaction: t });
      if (!user) throw ApiError.notFound('User account not found');

      await user.update({ roleId: employeeRole.id }, { transaction: t });
      await logActivity(actorId, 'employee-pos-revoke', 'HRMS', {
        referenceType: 'Employee', referenceId: id,
        description: `Revoked POS access from ${emp.firstName} ${emp.lastName}`,
        newData: { userId: user.id },
      }, t);

      await t.commit();

      return this.getById(id);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async getPosStaff(query) {
    const POS_ROLES = ['cashier', 'manager', 'inventory_staff'];
    const roles = await Role.findAll({ where: { slug: POS_ROLES }, attributes: ['id', 'slug', 'name'] });
    const roleIds = roles.map(r => r.id);
    const roleMap = {};
    roles.forEach(r => { roleMap[r.id] = r.slug; });

    const users = await User.findAll({
      where: { roleId: roleIds, isActive: true },
      attributes: ['id', 'firstName', 'lastName', 'email', 'roleId', 'branchId'],
      include: [
        { model: Employee, as: 'employee', attributes: ['id', 'employeeNo', 'departmentId', 'positionId'],
          include: [
            { association: 'department', attributes: ['id', 'name'] },
            { association: 'position', attributes: ['id', 'title'] },
          ],
        },
      ],
      order: [['firstName', 'ASC']],
    });

    return users.map(u => ({
      userId: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      roleSlug: roleMap[u.roleId] || 'unknown',
      roleName: roles.find(r => r.id === u.roleId)?.name || 'Unknown',
      branchId: u.branchId,
      employee: u.employee || null,
    }));
  }

  async exportCSV(query) {
    const where = {};
    if (query.status) where.status = query.status;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.employmentType) where.employmentType = query.employmentType;

    const employees = await Employee.findAll({
      where,
      include: [
        { association: 'department', attributes: ['name'] },
        { association: 'position', attributes: ['title'] },
      ],
      order: [['employeeNo', 'ASC']],
    });

    const header = 'Employee No,First Name,Last Name,Email,Phone,Department,Position,Employment Type,Status,Hire Date,Salary\n';
    const rows = employees.map(e => {
      return [
        e.employeeNo,
        `"${(e.firstName || '').replace(/"/g, '""')}"`,
        `"${(e.lastName || '').replace(/"/g, '""')}"`,
        e.email,
        e.phone || '',
        e.department?.name || '',
        e.position?.title || '',
        e.employmentType,
        e.status,
        e.hireDate || '',
        e.salary || 0,
      ].join(',');
    }).join('\n');

    return header + rows;
  }
}

module.exports = new EmployeeService();
