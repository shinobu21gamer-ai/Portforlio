const crypto = require('crypto');
const { Sequelize, Op } = require('sequelize');
const { JobPosting, JobApplication, Department, Position, Interview, Employee, Contract, Attendance, Notification } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta, sanitizeObject, generateEmployeeNo, escapeLike } = require('../../utils/helpers');

const VALID_TRANSITIONS = {
  'pending': ['reviewed', 'rejected'],
  'reviewed': ['initial-interview', 'rejected'],
  'initial-interview': ['final-interview', 'rejected'],
  'final-interview': ['accepted', 'rejected'],
  'accepted': ['hired', 'rejected'],
  'rejected': [],
  'hired': [],
};

class JobPostingService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.title = { [Op.like]: `%${escapeLike(query.search)}%` };
    }
    const { rows, count } = await JobPosting.findAndCountAll({
      where, offset, limit, order: [['createdAt', 'DESC']],
      include: [
        { association: 'department', attributes: ['id', 'name'] },
        { association: 'position', attributes: ['id', 'title'] },
        { association: 'schedule', attributes: ['id', 'name', 'startTime', 'endTime'] },
        { association: 'applications', attributes: ['id'], required: false },
      ],
      attributes: {
        include: [[Sequelize.fn('COUNT', Sequelize.col('applications.id')), 'applicantCount']],
      },
      group: ['JobPosting.id'],
      subQuery: false,
    });
    const jobs = rows.map(j => {
      const plain = j.toJSON();
      if (!plain.applications) plain.applicantCount = 0;
      delete plain.applications;
      return plain;
    });
    return { jobs, pagination: getPaginationMeta(count, page, limit) };
  }

  async getById(id) {
    const job = await JobPosting.findByPk(id, {
      include: [
        { association: 'department', attributes: ['id', 'name'] },
        { association: 'position', attributes: ['id', 'title'] },
        { association: 'schedule', attributes: ['id', 'name', 'startTime', 'endTime'] },
        { association: 'applications', attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'status', 'resumePath', 'createdAt'] },
      ],
    });
    if (!job) throw ApiError.notFound('Job posting not found');
    return job;
  }

  async create(data) {
    const sanitized = sanitizeObject(data);
    return JobPosting.create(sanitized);
  }

  async update(id, data) {
    const job = await JobPosting.findByPk(id);
    if (!job) throw ApiError.notFound('Job posting not found');

    const sanitized = sanitizeObject(data);
    const { status, approvedAt, ...rest } = sanitized;
    const allowedFields = ['title', 'departmentId', 'positionId', 'scheduleId', 'description', 'requirements', 'salaryMin', 'salaryMax', 'employmentType', 'openings'];
    const safeData = {};
    for (const key of allowedFields) {
      if (rest[key] !== undefined) safeData[key] = rest[key];
    }

    await job.update(safeData);
    return job;
  }

  async close(id) {
    const job = await JobPosting.findByPk(id);
    if (!job) throw ApiError.notFound('Job posting not found');
    await job.update({ status: 'closed' });
    return job;
  }

  async delete(id) {
    const job = await JobPosting.findByPk(id);
    if (!job) throw ApiError.notFound('Job posting not found');
    await job.destroy();
    return { message: 'Job posting deleted' };
  }

  async approve(id) {
    const job = await JobPosting.findByPk(id);
    if (!job) throw ApiError.notFound('Job posting not found');
    await job.update({ status: 'open', approvedAt: new Date() });
    return job;
  }

  async reject(id) {
    const job = await JobPosting.findByPk(id);
    if (!job) throw ApiError.notFound('Job posting not found');
    await job.update({ status: 'rejected' });
    return job;
  }

  async apply(data) {
    const sanitized = sanitizeObject(data);
    const job = await JobPosting.findByPk(sanitized.jobId);
    if (!job) throw ApiError.notFound('Job posting not found');
    if (job.status !== 'open') throw ApiError.badRequest('Job posting is not open');
    // Check for duplicate application (only block if same email has an active application)
    const existing = await JobApplication.findOne({ where: { jobId: sanitized.jobId, email: sanitized.email, status: ['pending', 'reviewed', 'initial-interview', 'final-interview', 'accepted'] } });
    if (existing) throw ApiError.badRequest('You have already applied for this position');
    const application = await JobApplication.create(sanitized);

    try {
      const { sendEmail } = require('../../utils/mailer');
      const { applicationStatusEmail } = require('../../utils/emailTemplates');
      await sendEmail({
        to: application.email,
        subject: 'Application Received — MiniMart POS',
        html: applicationStatusEmail(application.firstName || application.email, job.title, 'pending'),
      }).catch(() => {});
    } catch (e) { /* email errors should not block application */ }

    return application;
  }

  async getApplications(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};
    if (query.status) where.status = query.status;
    if (query.jobId) where.jobId = query.jobId;
    const { rows, count } = await JobApplication.findAndCountAll({
      where, offset, limit, order: [['createdAt', 'DESC']],
      attributes: { include: ['resumePath'] },
      include: [{ association: 'job', attributes: ['id', 'title'] }],
    });
    return { applications: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async updateApplicationStatus(id, status, notes) {
    const app = await JobApplication.findByPk(id, {
      include: [{ association: 'job' }],
    });
    if (!app) throw ApiError.notFound('Application not found');

    // Validate transition
    const allowed = VALID_TRANSITIONS[app.status] || [];
    if (!allowed.includes(status)) {
      throw ApiError.badRequest(`Cannot transition from "${app.status}" to "${status}". Allowed: ${allowed.join(', ') || 'none'}`);
    }

    // Declared at function scope because the onboarding email below needs
    // them, and the block that populates them is scoped to `status === 'hired'`.
    let hiredDetails = null;

    if (status === 'hired') {
      const job = app.job;
      if (!job) throw ApiError.badRequest('Job posting not found for this application');

      // Check if position is already filled
      const hiredCount = await JobApplication.count({ where: { jobId: job.id, status: 'hired' } });
      if (hiredCount >= (job.openings || 1)) {
        throw ApiError.badRequest('This position has already been filled');
      }

      const { Department, Position, Schedule, sequelize } = require('../../models');
      const validDept = await Department.findByPk(job.departmentId);
      const validPos = job.positionId ? await Position.findByPk(job.positionId) : null;

      let effectiveScheduleId = job.scheduleId;
      if (!effectiveScheduleId) {
        const defaultSched = await Schedule.findOne({ where: { name: 'Morning Shift' } });
        effectiveScheduleId = defaultSched ? defaultSched.id : null;
      }

      const employeeNo = await generateEmployeeNo(sequelize);
      const hireDate = new Date().toISOString().split('T')[0];
      const probationEndDate = new Date();
      probationEndDate.setMonth(probationEndDate.getMonth() + 6);

      const { User, Role } = require('../../models');
      const tempPassword = 'employee123';
      let role = validPos?.roleSlug ? await Role.findOne({ where: { slug: validPos.roleSlug } }) : null;
      if (!role) role = await Role.findOne({ where: { slug: 'employee' } });

      let user = await User.findOne({ where: { email: app.email } });

      const t = await sequelize.transaction();
      try {
        const employee = await Employee.create({
          employeeNo,
          firstName: app.firstName,
          middleName: app.middleName || null,
          lastName: app.lastName,
          email: app.email,
          phone: app.phone || null,
          hireDate,
          probationaryEndDate: probationEndDate.toISOString().split('T')[0],
          departmentId: validDept ? job.departmentId : null,
          positionId: validPos ? job.positionId : null,
          scheduleId: effectiveScheduleId,
          salary: job.salaryMin || 0,
          employmentType: job.employmentType || 'full-time',
          paymentFrequency: job.paymentFrequency || 'monthly',
          status: 'active',
          approvedAt: new Date(),
        }, { transaction: t });

        if (user) {
          await user.update({ password: tempPassword, roleId: role.id }, { transaction: t });
        } else {
          user = await User.create({
            firstName: app.firstName,
            lastName: app.lastName,
            email: app.email,
            password: tempPassword,
            roleId: role.id,
          }, { transaction: t });
        }
        await employee.update({ userId: user.id }, { transaction: t });

        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 6);
        await Contract.create({
          employeeId: employee.id,
          contractType: 'probationary',
          paymentFrequency: job.paymentFrequency || 'monthly',
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          salary: job.salaryMin || 0,
          terms: `Auto-created from job posting: ${job.title}. Probationary period of 6 months. Payment schedule: Monthly.`,
          status: 'active',
          approvedBy: null,
          approvedAt: new Date(),
        }, { transaction: t });

        if (effectiveScheduleId) {
          const { ShiftAssignment } = require('../../models');
          const today = new Date().toISOString().split('T')[0];
          const [assignment, created] = await ShiftAssignment.findOrCreate({
            where: { employeeId: employee.id, date: today },
            defaults: { scheduleId: effectiveScheduleId },
            transaction: t,
          });
          if (!created) await assignment.update({ scheduleId: effectiveScheduleId }, { transaction: t });
        }

        const newOpenings = Math.max(0, job.openings - 1);
        if (newOpenings <= 0) {
          await job.update({ openings: 0, status: 'filled' }, { transaction: t });
        } else {
          await job.update({ openings: newOpenings }, { transaction: t });
        }

        await t.commit();
      } catch (err) {
        await t.rollback();
        throw err;
      }

      hiredDetails = { tempPassword, effectiveScheduleId, validDept, validPos, employeeNo };
    }

    await app.update({ status, notes: notes || app.notes });

    try {
      if (app.email) {
        const { sendEmail } = require('../../utils/mailer');
        const { applicationStatusEmail } = require('../../utils/emailTemplates');
        const job = app.job || await JobPosting.findByPk(app.jobId);

        let emailDetails = {};
        if (status === 'hired' && hiredDetails) {
          const { tempPassword, effectiveScheduleId, validDept, validPos, employeeNo } = hiredDetails;
          const { Schedule } = require('../../models');
          const schedule = effectiveScheduleId ? await Schedule.findByPk(effectiveScheduleId) : null;
          const startDateFormatted = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          emailDetails = {
            email: app.email,
            tempPassword,
            startDate: startDateFormatted,
            department: validDept?.name || '',
            position: validPos?.title || '',
            schedule: schedule ? `${schedule.name} (${schedule.startTime} — ${schedule.endTime})` : '',
            employeeNo,
          };
        }

        await sendEmail({
          to: app.email,
          subject: status === 'hired'
            ? `Welcome to MiniMart — Your Account is Ready`
            : `Application ${status.replace(/-/g, ' ')} — MiniMart POS`,
          html: applicationStatusEmail(app.firstName || app.email, job?.title || 'Position', status, emailDetails),
        }).catch(() => {});
      }
    } catch (e) { console.error('[EMAIL] Application status update email failed:', e.message); }

    return app;
  }

  async scheduleInterview(data) {
    const app = await JobApplication.findByPk(data.applicationId);
    if (!app) throw ApiError.notFound('Application not found');

    // Validate: must be in a schedulable state
    const validForInterview = ['reviewed', 'initial-interview', 'final-interview'];
    if (!validForInterview.includes(app.status)) {
      throw ApiError.badRequest(`Cannot schedule interview for application in "${app.status}" status`);
    }

    // Validate: if date is today, time must not be in the past
    const now = new Date();
    const interviewDate = new Date(data.scheduledDate);
    const todayStr = now.toISOString().split('T')[0];
    const interviewDateStr = interviewDate.toISOString().split('T')[0];
    if (interviewDateStr === todayStr && data.scheduledTime) {
      const [h, m] = data.scheduledTime.split(':').map(Number);
      const interviewMinutes = h * 60 + m;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (interviewMinutes <= nowMinutes) {
        throw ApiError.badRequest('Interview time cannot be in the past for today');
      }
    }

    // Check for existing scheduled interview of the same type (not completed/rejected)
    const existingScheduled = await Interview.findOne({
      where: {
        applicationId: data.applicationId,
        type: data.type,
      },
    });
    if (existingScheduled) {
      throw ApiError.badRequest(`A ${data.type} interview is already scheduled`);
    }

    // For final interviews, ensure an initial interview exists and is passed (skip if status was manually advanced to final-interview)
    if (data.type === 'final' && app.status !== 'final-interview') {
      const initialInterview = await Interview.findOne({
        where: { applicationId: data.applicationId, type: 'initial' },
      });
      if (!initialInterview) {
        throw ApiError.badRequest('Cannot schedule final interview without an initial interview');
      }
      if (initialInterview.result !== 'pass') {
        throw ApiError.badRequest('Initial interview must be passed before scheduling final interview');
      }
    }

    const interviewData = {
      applicationId: parseInt(data.applicationId),
      type: data.type,
      scheduledDate: typeof data.scheduledDate === 'string' ? data.scheduledDate : new Date(data.scheduledDate).toISOString().split('T')[0],
      scheduledTime: data.scheduledTime,
      interviewer: data.interviewer,
      location: data.location || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      notes: data.notes || null,
    };

    const interview = await Interview.create(interviewData);
    await app.update({ status: data.type === 'initial' ? 'initial-interview' : 'final-interview' });

    await Notification.create({
      userId: app.userId || null,
      type: 'hrms_interview_scheduled',
      title: 'Interview Scheduled',
      message: `Interview scheduled for ${app.firstName} ${app.lastName} (${data.type}) on ${data.scheduledDate} at ${data.scheduledTime}`,
    });

    try {
      if (app.email) {
        const { sendEmail } = require('../../utils/mailer');
        const { applicationStatusEmail } = require('../../utils/emailTemplates');
        const job = await JobPosting.findByPk(app.jobId);
        const statusLabel = data.type === 'initial' ? 'initial-interview' : 'final-interview';
        await sendEmail({
          to: app.email,
          subject: `Interview Scheduled — MiniMart POS`,
          html: applicationStatusEmail(app.firstName || app.email, job?.title || 'Position', statusLabel, {
            scheduledDate: data.scheduledDate,
            scheduledTime: data.scheduledTime,
            location: data.location,
          }),
        }).catch(() => {});
      }
    } catch (e) { console.error('[EMAIL] Interview scheduled email failed:', e.message); }

    const result = await Interview.findByPk(interview.id, {
      include: [{
        association: 'application',
        attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'status'],
        include: [{ association: 'job', attributes: ['id', 'title'] }],
      }],
    });
    return result;
  }

  async getInterviews(query) {
    const { Op } = require('sequelize');
    const where = {};
    if (query.date) where.scheduledDate = query.date;
    if (query.result) where.result = query.result;
    if (query.type) where.type = query.type;

    const include = [{
      association: 'application',
      attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'status'],
      include: [{ association: 'job', attributes: ['id', 'title'] }],
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

    const { page, limit, offset } = getPagination(query.page, query.limit);
    const { rows, count } = await Interview.findAndCountAll({
      where, include, offset, limit,
      order: [['scheduledDate', 'ASC'], ['scheduledTime', 'ASC']],
    });
    return { interviews: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async updateInterviewResult(id, result, feedback) {
    const interview = await Interview.findByPk(id, {
      include: [{ association: 'application' }],
    });
    if (!interview) throw ApiError.notFound('Interview not found');
    if (interview.result !== 'pending') throw ApiError.badRequest('Cannot change result of a completed interview');
    await interview.update({ result, feedback });

    // Auto-cascade to application status
    if (interview.application) {
      const app = interview.application;
      let newStatus = null;
      if (result === 'pass') {
        if (interview.type === 'initial' && app.status === 'initial-interview') {
          await app.update({ status: 'final-interview' });
          newStatus = 'final-interview';
        } else if (interview.type === 'final' && app.status === 'final-interview') {
          await app.update({ status: 'accepted' });
          newStatus = 'accepted';
        }
      } else if (result === 'fail') {
        const terminalStatuses = ['rejected', 'hired'];
        if (!terminalStatuses.includes(app.status)) {
          await app.update({ status: 'rejected' });
          newStatus = 'rejected';
        }
      }

      if (newStatus && app.email) {
        try {
          const { sendEmail } = require('../../utils/mailer');
          const { applicationStatusEmail } = require('../../utils/emailTemplates');
          const job = await JobPosting.findByPk(app.jobId);
          await sendEmail({
            to: app.email,
            subject: `Application ${newStatus.replace(/-/g, ' ')} — MiniMart POS`,
            html: applicationStatusEmail(app.firstName || app.email, job?.title || 'Position', newStatus),
          }).catch(() => {});
        } catch (e) { console.error('[EMAIL] Application status email failed:', e.message); }
      }
    }

    return interview;
  }

  async updateInterview(id, data) {
    const interview = await Interview.findByPk(id);
    if (!interview) throw ApiError.notFound('Interview not found');
    if (interview.result !== 'pending') throw ApiError.badRequest('Cannot edit a completed interview');

    // Validate: if date is today, time must not be in the past
    const checkDate = data.scheduledDate || interview.scheduledDate;
    const checkTime = data.scheduledTime || interview.scheduledTime;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const checkDateStr = new Date(checkDate).toISOString().split('T')[0];
    if (checkDateStr === todayStr && checkTime) {
      const [h, m] = checkTime.split(':').map(Number);
      const interviewMinutes = h * 60 + m;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (interviewMinutes <= nowMinutes) {
        throw ApiError.badRequest('Interview time cannot be in the past for today');
      }
    }

    const allowed = {};
    if (data.scheduledDate !== undefined) allowed.scheduledDate = data.scheduledDate;
    if (data.scheduledTime !== undefined) allowed.scheduledTime = data.scheduledTime;
    if (data.interviewer !== undefined) allowed.interviewer = data.interviewer;
    if (data.location !== undefined) allowed.location = data.location;
    if (data.latitude !== undefined) allowed.latitude = data.latitude;
    if (data.longitude !== undefined) allowed.longitude = data.longitude;
    if (data.notes !== undefined) allowed.notes = data.notes;
    await interview.update(allowed);
    return interview;
  }

  async deleteInterview(id) {
    const interview = await Interview.findByPk(id);
    if (!interview) throw ApiError.notFound('Interview not found');
    if (interview.result !== 'pending') throw ApiError.badRequest('Cannot delete a completed interview');
    await interview.destroy();
    return { message: 'Interview deleted' };
  }
}

module.exports = new JobPostingService();
