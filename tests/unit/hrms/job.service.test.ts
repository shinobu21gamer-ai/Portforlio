import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const models = require('../../../src/models');
const { sequelize, JobPosting, JobApplication, Interview, Department, Position, Schedule, Employee, Contract, User, Role } = models;
const jobService = require('../../../src/services/hrms/job.service');

let departmentId;
let positionId;
let scheduleId;
let jobId;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  const dept = await Department.create({ name: 'Sales' });
  departmentId = dept.id;

  const pos = await Position.create({
    title: 'Sales Representative',
    departmentId,
    minSalary: 35000,
    maxSalary: 55000,
  });
  positionId = pos.id;

  const sched = await Schedule.create({
    name: 'Morning Shift',
    startTime: '09:00',
    endTime: '18:00',
  });
  scheduleId = sched.id;

  // Create roles
  await Role.create({ name: 'Employee', slug: 'employee' });
  await Role.create({ name: 'Manager', slug: 'manager' });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await JobApplication.destroy({ where: {}, force: true });
  await JobPosting.destroy({ where: {}, force: true });
  await Interview.destroy({ where: {}, force: true });
  await Employee.destroy({ where: {}, force: true });
  await Contract.destroy({ where: {}, force: true });
  await User.destroy({ where: {}, force: true });
});

describe('job.service - create', () => {
  it('creates a new job posting', async () => {
    const job = await jobService.create({
      title: 'Sales Manager',
      departmentId,
      positionId,
      scheduleId,
      description: 'Lead sales team',
      requirements: '5+ years experience',
      salaryMin: 40000,
      salaryMax: 60000,
      employmentType: 'full-time',
      openings: 2,
    });

    expect(job.title).toBe('Sales Manager');
    expect(job.status).toBe('pending');
    expect(job.openings).toBe(2);
  });
});

describe('job.service - getAll', () => {
  beforeEach(async () => {
    await jobService.create({
      title: 'Sales Manager',
      departmentId,
      positionId,
      description: 'Lead sales team',
      salaryMin: 40000,
      salaryMax: 60000,
      openings: 1,
    });
  });

  it('returns paginated job postings', async () => {
    const result = await jobService.getAll({ page: 1, limit: 10 });

    expect(result.jobs).toHaveLength(1);
    expect(result.pagination).toBeDefined();
  });

  it('filters by status', async () => {
    const result = await jobService.getAll({ status: 'pending' });

    expect(result.jobs).toHaveLength(1);
  });

  it('searches by title', async () => {
    const result = await jobService.getAll({ search: 'Sales' });

    expect(result.jobs).toHaveLength(1);
  });

  it('includes applicant count', async () => {
    const result = await jobService.getAll({});

    expect(result.jobs[0].applicantCount).toBeDefined();
  });
});

describe('job.service - getById', () => {
  beforeEach(async () => {
    const job = await jobService.create({
      title: 'Sales Manager',
      departmentId,
      positionId,
      description: 'Lead sales team',
      salaryMin: 40000,
      salaryMax: 60000,
      openings: 1,
    });
    jobId = job.id;
  });

  it('returns job posting with details', async () => {
    const job = await jobService.getById(jobId);

    expect(job.id).toBe(jobId);
    expect(job.title).toBe('Sales Manager');
    expect(job.department).toBeDefined();
  });

  it('throws for non-existent job', async () => {
    await expect(jobService.getById(999999)).rejects.toThrow(/not found/i);
  });
});

describe('job.service - update', () => {
  beforeEach(async () => {
    const job = await jobService.create({
      title: 'Sales Manager',
      departmentId,
      positionId,
      description: 'Lead sales team',
      salaryMin: 40000,
      salaryMax: 60000,
      openings: 1,
    });
    jobId = job.id;
  });

  it('updates job posting fields', async () => {
    const updated = await jobService.update(jobId, {
      title: 'Senior Sales Manager',
      salaryMax: 70000,
    });

    expect(updated.title).toBe('Senior Sales Manager');
    expect(updated.salaryMax).toBe(70000);
  });

  it('rejects status field in update', async () => {
    const updated = await jobService.update(jobId, {
      status: 'open',
      title: 'New Title',
    });

    expect(updated.status).toBe('pending');
    expect(updated.title).toBe('New Title');
  });

  it('throws for non-existent job', async () => {
    await expect(jobService.update(999999, { title: 'Test' })).rejects.toThrow(/not found/i);
  });
});

describe('job.service - approve', () => {
  beforeEach(async () => {
    const job = await jobService.create({
      title: 'Sales Manager',
      departmentId,
      positionId,
      description: 'Lead sales team',
      salaryMin: 40000,
      salaryMax: 60000,
      openings: 1,
    });
    jobId = job.id;
  });

  it('approves job posting and sets status to open', async () => {
    const job = await jobService.approve(jobId);

    expect(job.status).toBe('open');
    expect(job.approvedAt).toBeDefined();
  });
});

describe('job.service - reject', () => {
  beforeEach(async () => {
    const job = await jobService.create({
      title: 'Sales Manager',
      departmentId,
      positionId,
      description: 'Lead sales team',
      salaryMin: 40000,
      salaryMax: 60000,
      openings: 1,
    });
    jobId = job.id;
  });

  it('rejects job posting', async () => {
    const job = await jobService.reject(jobId);

    expect(job.status).toBe('rejected');
  });
});

describe('job.service - close', () => {
  beforeEach(async () => {
    const job = await jobService.create({
      title: 'Sales Manager',
      departmentId,
      positionId,
      description: 'Lead sales team',
      salaryMin: 40000,
      salaryMax: 60000,
      openings: 1,
    });
    jobId = job.id;
  });

  it('closes job posting', async () => {
    const job = await jobService.close(jobId);

    expect(job.status).toBe('closed');
  });
});

describe('job.service - delete', () => {
  beforeEach(async () => {
    const job = await jobService.create({
      title: 'Sales Manager',
      departmentId,
      positionId,
      description: 'Lead sales team',
      salaryMin: 40000,
      salaryMax: 60000,
      openings: 1,
    });
    jobId = job.id;
  });

  it('deletes job posting', async () => {
    const result = await jobService.delete(jobId);

    expect(result.message).toContain('deleted');

    const job = await JobPosting.findByPk(jobId);
    expect(job).toBeNull();
  });
});

describe('job.service - apply', () => {
  beforeEach(async () => {
    const job = await jobService.create({
      title: 'Sales Manager',
      departmentId,
      positionId,
      description: 'Lead sales team',
      salaryMin: 40000,
      salaryMax: 60000,
      openings: 1,
    });
    jobId = job.id;

    // Approve job to open it
    await jobService.approve(jobId);
  });

  it('creates job application', async () => {
    const app = await jobService.apply({
      jobId,
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@test.local',
      phone: '555-1234',
    });

    expect(app.jobId).toBe(jobId);
    expect(app.status).toBe('pending');
  });

  it('rejects duplicate application', async () => {
    await jobService.apply({
      jobId,
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@test.local',
      phone: '555-1234',
    });

    await expect(
      jobService.apply({
        jobId,
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@test.local',
        phone: '555-1234',
      })
    ).rejects.toThrow(/already applied/i);
  });

  it('rejects application to closed job', async () => {
    await jobService.close(jobId);

    await expect(
      jobService.apply({
        jobId,
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@test.local',
        phone: '555-1234',
      })
    ).rejects.toThrow(/not open/i);
  });
});

describe('job.service - getApplications', () => {
  beforeEach(async () => {
    const job = await jobService.create({
      title: 'Sales Manager',
      departmentId,
      positionId,
      description: 'Lead sales team',
      salaryMin: 40000,
      salaryMax: 60000,
      openings: 1,
    });
    jobId = job.id;

    await jobService.approve(jobId);

    await jobService.apply({
      jobId,
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@test.local',
      phone: '555-1234',
    });
  });

  it('returns paginated applications', async () => {
    const result = await jobService.getApplications({ page: 1, limit: 10 });

    expect(result.applications).toHaveLength(1);
    expect(result.pagination.totalItems).toBe(1);
  });

  it('filters by status', async () => {
    const result = await jobService.getApplications({ status: 'pending' });

    expect(result.applications).toHaveLength(1);
  });

  it('filters by job', async () => {
    const result = await jobService.getApplications({ jobId });

    expect(result.applications).toHaveLength(1);
  });
});

describe('job.service - updateApplicationStatus', () => {
  let appId;

  beforeEach(async () => {
    const job = await jobService.create({
      title: 'Sales Manager',
      departmentId,
      positionId,
      description: 'Lead sales team',
      salaryMin: 40000,
      salaryMax: 60000,
      openings: 1,
    });
    jobId = job.id;

    await jobService.approve(jobId);

    const app = await jobService.apply({
      jobId,
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@test.local',
      phone: '555-1234',
    });
    appId = app.id;
  });

  it('transitions application status', async () => {
    const app = await jobService.updateApplicationStatus(appId, 'reviewed');

    expect(app.status).toBe('reviewed');
  });

  it('rejects invalid state transition', async () => {
    await jobService.updateApplicationStatus(appId, 'reviewed');

    await expect(
      jobService.updateApplicationStatus(appId, 'pending')
    ).rejects.toThrow(/cannot transition/i);
  });

  it('creates employee on hire', async () => {
    await jobService.updateApplicationStatus(appId, 'reviewed');
    await jobService.updateApplicationStatus(appId, 'initial-interview');
    await jobService.updateApplicationStatus(appId, 'final-interview');
    await jobService.updateApplicationStatus(appId, 'accepted');

    await jobService.updateApplicationStatus(appId, 'hired');

    const employees = await Employee.findAll({ where: { email: 'jane@test.local' } });
    expect(employees).toHaveLength(1);
    expect(employees[0].status).toBe('active');
  });

  it('rejects hire when position filled', async () => {
    // Create a job with only 1 opening
    const job2 = await jobService.create({
      title: 'Sales Representative',
      departmentId,
      positionId,
      description: 'Sales role',
      salaryMin: 35000,
      salaryMax: 45000,
      openings: 1,
    });

    await jobService.approve(job2.id);

    // Create two applicants
    const app1 = await jobService.apply({
      jobId: job2.id,
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice@test.local',
      phone: '555-1111',
    });

    const app2 = await jobService.apply({
      jobId: job2.id,
      firstName: 'Bob',
      lastName: 'Smith',
      email: 'bob@test.local',
      phone: '555-2222',
    });

    // Advance first applicant to hire
    await jobService.updateApplicationStatus(app1.id, 'reviewed');
    await jobService.updateApplicationStatus(app1.id, 'initial-interview');
    await jobService.updateApplicationStatus(app1.id, 'final-interview');
    await jobService.updateApplicationStatus(app1.id, 'accepted');
    await jobService.updateApplicationStatus(app1.id, 'hired');

    // Advance second applicant to accepted
    await jobService.updateApplicationStatus(app2.id, 'reviewed');
    await jobService.updateApplicationStatus(app2.id, 'initial-interview');
    await jobService.updateApplicationStatus(app2.id, 'final-interview');
    await jobService.updateApplicationStatus(app2.id, 'accepted');

    // Try to hire second applicant - should fail
    await expect(
      jobService.updateApplicationStatus(app2.id, 'hired')
    ).rejects.toThrow(/filled/i);
  });

  it('throws for non-existent application', async () => {
    await expect(
      jobService.updateApplicationStatus(999999, 'reviewed')
    ).rejects.toThrow(/not found/i);
  });
});

describe('job.service - scheduleInterview', () => {
  let appId;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  beforeEach(async () => {
    const job = await jobService.create({
      title: 'Sales Manager',
      departmentId,
      positionId,
      description: 'Lead sales team',
      salaryMin: 40000,
      salaryMax: 60000,
      openings: 1,
    });
    jobId = job.id;

    await jobService.approve(jobId);

    const app = await jobService.apply({
      jobId,
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@test.local',
      phone: '555-1234',
    });
    appId = app.id;

    await jobService.updateApplicationStatus(appId, 'reviewed');
  });

  it('schedules initial interview', async () => {
    const interview = await jobService.scheduleInterview({
      applicationId: appId,
      type: 'initial',
      scheduledDate: tomorrowStr,
      scheduledTime: '10:00',
      interviewer: 'John Doe',
      location: 'Meeting Room A',
    });

    expect(interview.type).toBe('initial');
    expect(interview.result).toBe('pending');
  });

  it('rejects scheduling same interview twice', async () => {
    await jobService.scheduleInterview({
      applicationId: appId,
      type: 'initial',
      scheduledDate: tomorrowStr,
      scheduledTime: '10:00',
      interviewer: 'John Doe',
    });

    await expect(
      jobService.scheduleInterview({
        applicationId: appId,
        type: 'initial',
        scheduledDate: tomorrowStr,
        scheduledTime: '11:00',
        interviewer: 'John Doe',
      })
    ).rejects.toThrow(/already scheduled/i);
  });

  it('rejects past time for today', async () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const pastTime = '08:00'; // Assuming test runs after 8 AM

    await expect(
      jobService.scheduleInterview({
        applicationId: appId,
        type: 'initial',
        scheduledDate: todayStr,
        scheduledTime: pastTime,
        interviewer: 'John Doe',
      })
    ).rejects.toThrow(/cannot be in the past/i);
  });

  it('throws for non-existent application', async () => {
    await expect(
      jobService.scheduleInterview({
        applicationId: 999999,
        type: 'initial',
        scheduledDate: tomorrowStr,
        scheduledTime: '10:00',
        interviewer: 'John Doe',
      })
    ).rejects.toThrow(/not found/i);
  });
});

describe('job.service - updateInterviewResult', () => {
  let interviewId;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  beforeEach(async () => {
    const job = await jobService.create({
      title: 'Sales Manager',
      departmentId,
      positionId,
      description: 'Lead sales team',
      salaryMin: 40000,
      salaryMax: 60000,
      openings: 1,
    });
    jobId = job.id;

    await jobService.approve(jobId);

    const app = await jobService.apply({
      jobId,
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@test.local',
      phone: '555-1234',
    });

    await jobService.updateApplicationStatus(app.id, 'reviewed');

    const interview = await jobService.scheduleInterview({
      applicationId: app.id,
      type: 'initial',
      scheduledDate: tomorrowStr,
      scheduledTime: '10:00',
      interviewer: 'John Doe',
    });

    interviewId = interview.id;
  });

  it('updates interview result to pass', async () => {
    const interview = await jobService.updateInterviewResult(interviewId, 'pass', 'Strong candidate');

    expect(interview.result).toBe('pass');
    expect(interview.feedback).toBe('Strong candidate');
  });

  it('updates interview result to fail', async () => {
    const interview = await jobService.updateInterviewResult(interviewId, 'fail', 'Not qualified');

    expect(interview.result).toBe('fail');
  });

  it('auto-advances application on pass', async () => {
    await jobService.updateInterviewResult(interviewId, 'pass');

    const app = await JobApplication.findOne({ where: { email: 'jane@test.local' } });
    expect(app.status).toBe('final-interview');
  });

  it('rejects result of completed interview', async () => {
    await jobService.updateInterviewResult(interviewId, 'pass');

    await expect(
      jobService.updateInterviewResult(interviewId, 'fail')
    ).rejects.toThrow(/cannot change/i);
  });

  it('throws for non-existent interview', async () => {
    await expect(
      jobService.updateInterviewResult(999999, 'pass')
    ).rejects.toThrow(/not found/i);
  });
});

describe('job.service - getInterviews', () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  beforeEach(async () => {
    const job = await jobService.create({
      title: 'Sales Manager',
      departmentId,
      positionId,
      description: 'Lead sales team',
      salaryMin: 40000,
      salaryMax: 60000,
      openings: 1,
    });
    jobId = job.id;

    await jobService.approve(jobId);

    const app = await jobService.apply({
      jobId,
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@test.local',
      phone: '555-1234',
    });

    await jobService.updateApplicationStatus(app.id, 'reviewed');

    await jobService.scheduleInterview({
      applicationId: app.id,
      type: 'initial',
      scheduledDate: tomorrowStr,
      scheduledTime: '10:00',
      interviewer: 'John Doe',
    });
  });

  it('returns paginated interviews', async () => {
    const result = await jobService.getInterviews({ page: 1, limit: 10 });

    expect(result.interviews).toHaveLength(1);
  });

  it('filters by date', async () => {
    const result = await jobService.getInterviews({ date: tomorrowStr });

    expect(result.interviews).toHaveLength(1);
  });

  it('searches by applicant name', async () => {
    const result = await jobService.getInterviews({ search: 'Jane' });

    expect(result.interviews).toHaveLength(1);
  });
});
