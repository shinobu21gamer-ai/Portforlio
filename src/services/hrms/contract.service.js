const { Contract, Employee, Notification } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta, escapeLike, sanitizeObject } = require('../../utils/helpers');
const { Op } = require('sequelize');
const { logActivity } = require('../../utils/audit');

class ContractService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};
    if (query.status) where.status = query.status;
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.contractType) where.contractType = query.contractType;

    const include = [{
      association: 'employee',
      attributes: ['id', 'employeeNo', 'firstName', 'lastName'],
      include: [
        { association: 'department', attributes: ['id', 'name'] },
        { association: 'position', attributes: ['id', 'title'] },
      ],
    }];

    if (query.search) {
      const safeSearch = escapeLike(query.search);
      include[0].where = {
        [Op.or]: [
          { firstName: { [Op.like]: `%${safeSearch}%` } },
          { lastName: { [Op.like]: `%${safeSearch}%` } },
        ],
      };
    }

    const { rows, count } = await Contract.findAndCountAll({
      where, include, offset, limit, order: [['createdAt', 'DESC']],
      distinct: true,
    });
    return { contracts: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getById(id) {
    const contract = await Contract.findByPk(id, {
      include: [{
        association: 'employee',
        attributes: ['id', 'employeeNo', 'firstName', 'lastName', 'email'],
        include: [
          { association: 'department', attributes: ['id', 'name'] },
          { association: 'position', attributes: ['id', 'title'] },
        ],
      }],
    });
    if (!contract) throw ApiError.notFound('Contract not found');
    return contract;
  }

  async create(data) {
    const sanitized = sanitizeObject(data);
    const emp = await Employee.findByPk(sanitized.employeeId);
    if (!emp) throw ApiError.notFound('Employee not found');

    const activeContract = await Contract.findOne({ where: { employeeId: sanitized.employeeId, status: 'active' } });
    if (activeContract) throw ApiError.badRequest('Employee already has an active contract');

    return Contract.create(sanitized);
  }

  async update(id, data) {
    const contract = await Contract.findByPk(id);
    if (!contract) throw ApiError.notFound('Contract not found');
    if (contract.status === 'active') throw ApiError.badRequest('Cannot edit an active contract. Terminate it first.');
    await contract.update(sanitizeObject(data));
    return this.getById(id);
  }

  async approve(id, approvedBy) {
    const contract = await Contract.findByPk(id);
    if (!contract) throw ApiError.notFound('Contract not found');
    if (contract.status !== 'pending') throw ApiError.badRequest('Only pending contracts can be approved');
    await contract.update({ status: 'active', approvedBy, approvedAt: new Date() });

    const emp = await Employee.findByPk(contract.employeeId);
    if (emp) {
      const updates = {};
      if (contract.paymentFrequency) updates.paymentFrequency = contract.paymentFrequency;
      if (contract.salary) updates.salary = contract.salary;
      if (contract.contractType === 'probationary' && contract.endDate) {
        updates.probationaryEndDate = contract.endDate;
      }
      if (Object.keys(updates).length > 0) await emp.update(updates);
    }

    await logActivity(approvedBy, 'contract-approved', 'HRMS', { referenceType: 'Contract', referenceId: id, description: `Approved contract for employee #${contract.employeeId}` });

    try {
      if (emp && emp.email) {
        const { sendEmail } = require('../../utils/mailer');
        const { contractApprovedEmail } = require('../../utils/emailTemplates');
        await sendEmail({
          to: emp.email,
          subject: 'Contract Approved — MiniMart POS',
          html: contractApprovedEmail(emp.firstName || emp.email, contract.contractType, contract.startDate, contract.endDate, contract.salary),
        }).catch(() => {});
      }
    } catch (e) { console.error('[EMAIL] Contract approve email failed:', e.message); }

    return this.getById(id);
  }

  async reject(id, remarks, rejectedBy) {
    const contract = await Contract.findByPk(id);
    if (!contract) throw ApiError.notFound('Contract not found');
    if (contract.status !== 'pending') throw ApiError.badRequest('Only pending contracts can be rejected');
    await contract.update({ status: 'rejected', notes: remarks ? `Rejection reason: ${remarks}` : contract.notes });
    await logActivity(rejectedBy || null, 'contract-rejected', 'HRMS', { referenceType: 'Contract', referenceId: id, description: `Rejected contract for employee #${contract.employeeId}` });

    const emp = await Employee.findByPk(contract.employeeId);
    if (emp && emp.status === 'pending') {
      const otherContracts = await Contract.findOne({
        where: { employeeId: contract.employeeId, id: { [require('sequelize').Op.ne]: contract.id }, status: { [require('sequelize').Op.in]: ['active', 'pending'] } },
      });
      if (!otherContracts) {
        await emp.update({ status: 'inactive' });
        if (emp.userId) {
          const user = await require('../../models').User.findByPk(emp.userId);
          if (user) await user.update({ isActive: false });
        }
      }
    }

    try {
      if (emp && emp.email) {
        const { sendEmail } = require('../../utils/mailer');
        const { contractRejectedEmail } = require('../../utils/emailTemplates');
        await sendEmail({
          to: emp.email,
          subject: 'Contract Rejected — MiniMart POS',
          html: contractRejectedEmail(emp.firstName || emp.email, remarks),
        }).catch(() => {});
      }
    } catch (e) { console.error('[EMAIL] Contract reject email failed:', e.message); }

    return this.getById(id);
  }

  async terminate(id, terminatedBy) {
    const contract = await Contract.findByPk(id);
    if (!contract) throw ApiError.notFound('Contract not found');
    if (contract.status !== 'active') throw ApiError.badRequest('Only active contracts can be terminated');
    await contract.update({ status: 'terminated' });
    await logActivity(terminatedBy || null, 'contract-terminated', 'HRMS', { referenceType: 'Contract', referenceId: id, description: `Terminated contract for employee #${contract.employeeId}` });

    const emp = await Employee.findByPk(contract.employeeId);
    if (emp) {
      const otherActive = await Contract.findOne({
        where: { employeeId: contract.employeeId, id: { [Op.ne]: contract.id }, status: 'active' },
      });
      if (!otherActive) {
        await emp.update({ status: 'inactive', terminationType: 'end-of-contract', terminationDate: new Date().toISOString().split('T')[0] });
        if (emp.userId) {
          const user = await require('../../models').User.findByPk(emp.userId);
          if (user) await user.update({ isActive: false });
        }
      }

      await Notification.create({
        userId: emp.userId || null,
        type: 'hrms_contract_terminated',
        title: 'Contract Terminated',
        message: `Your contract has been terminated. Please contact HR for details.`,
      });

      try {
        if (emp.email) {
          const { sendEmail } = require('../../utils/mailer');
          const { contractTerminatedEmail } = require('../../utils/emailTemplates');
          await sendEmail({
            to: emp.email,
            subject: 'Contract Terminated — MiniMart POS',
            html: contractTerminatedEmail(emp.firstName || emp.email),
          }).catch(() => {});
        }
      } catch (e) { console.error('[EMAIL] Contract terminate email failed:', e.message); }
    }

    return this.getById(id);
  }

  async renew(id, data, approvedBy) {
    const oldContract = await Contract.findByPk(id);
    if (!oldContract) throw ApiError.notFound('Contract not found');
    if (oldContract.status !== 'active') throw ApiError.badRequest('Only active contracts can be renewed');

    await oldContract.update({ status: 'expired' });

    const newContract = await Contract.create({
      employeeId: oldContract.employeeId,
      contractType: data.contractType || 'regular',
      paymentFrequency: data.paymentFrequency || oldContract.paymentFrequency,
      startDate: data.startDate,
      endDate: data.endDate || null,
      salary: data.salary || oldContract.salary,
      terms: data.terms || oldContract.terms,
      notes: data.notes || `Renewed from contract #${oldContract.id}`,
      status: 'pending',
    });

    try {
      const emp = await Employee.findByPk(oldContract.employeeId);
      if (emp && emp.email) {
        const { sendEmail } = require('../../utils/mailer');
        const { contractRenewalEmail } = require('../../utils/emailTemplates');
        await sendEmail({
          to: emp.email,
          subject: 'Contract Renewed — MiniMart POS',
          html: contractRenewalEmail(emp.firstName || emp.email, data.contractType || 'regular', data.startDate, data.endDate || null, data.salary || oldContract.salary),
        }).catch(() => {});
      }
    } catch (e) { console.error('[EMAIL] Contract renewal email failed:', e.message); }

    return this.getById(newContract.id);
  }

  async checkExpired() {
    const today = new Date().toISOString().split('T')[0];
    const expired = await Contract.findAll({
      where: { status: 'active', endDate: { [Op.lt]: today } },
    });

    for (const contract of expired) {
      await contract.update({ status: 'expired' });
      const emp = await Employee.findByPk(contract.employeeId);
      if (emp) {
        const otherActive = await Contract.findOne({
          where: { employeeId: contract.employeeId, id: { [Op.ne]: contract.id }, status: 'active' },
        });
        if (!otherActive) {
          await emp.update({ status: 'inactive', terminationType: 'end-of-contract', terminationDate: today });
        }
        if (emp.userId) {
          await Notification.create({
            userId: emp.userId,
            type: 'hrms_contract_expired',
            title: 'Contract Expired',
            message: `Your contract has expired. Please contact HR.`,
          });
        }

        try {
          if (emp.email) {
            const { sendEmail } = require('../../utils/mailer');
            const { contractExpiryEmail } = require('../../utils/emailTemplates');
            await sendEmail({
              to: emp.email,
              subject: 'Contract Expired — MiniMart POS',
              html: contractExpiryEmail(emp.firstName || emp.email, contract.contractType, contract.endDate),
            }).catch(() => {});
          }
        } catch (e) { console.error('[EMAIL] Contract expired email failed:', e.message); }
      }
    }

    return { expired: expired.length };
  }

  async delete(id) {
    const contract = await Contract.findByPk(id);
    if (!contract) throw ApiError.notFound('Contract not found');
    if (contract.status === 'active') throw ApiError.badRequest('Cannot delete an active contract');
    await contract.destroy();
    return { message: 'Contract deleted' };
  }

  async getExpiring(withinDays = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(withinDays));
    const contracts = await Contract.findAll({
      where: {
        status: 'active',
        endDate: { [Op.and]: [{ [Op.gte]: new Date() }, { [Op.lte]: futureDate }] },
      },
      include: [{
        association: 'employee',
        attributes: ['id', 'employeeNo', 'firstName', 'lastName', 'email'],
      }],
      order: [['endDate', 'ASC']],
    });
    return { contracts, count: contracts.length };
  }
}

module.exports = new ContractService();
