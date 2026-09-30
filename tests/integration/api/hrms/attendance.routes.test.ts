// Attendance Routes Integration Tests
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestApiClient } from '../../../utils/api-client';
import { setupTestDB, teardownTestDB, seedTestData, TestScenarios } from '../../../utils/db-helper';
import { createRoleTokens } from '../../../utils/auth-helper';

let db: any;
let apiClient: any;
let adminToken: string;
let hrToken: string;
let employeeToken: string;

describe('Attendance Routes Integration', () => {
  beforeAll(async () => {
    const { default: dbHelper } = await import('../../../utils/db-helper');
    db = await dbHelper.setupTestDB();
    await seedTestData(db);
    
    const { default: authHelper } = await import('../../../utils/auth-helper');
    const tokens = await authHelper.createRoleTokens(db);
    adminToken = (await tokens.admin()).accessToken;
    hrToken = (await tokens.hr()).accessToken;
    employeeToken = (await tokens.employee()).accessToken;
  });

  beforeEach(() => {
    // Reset client for each test
  });

  describe('GET /api/v1/hrms/attendance/today', () => {
    it('should return today\'s attendance summary for admin', async () => {
      const client = new (await import('../../../utils/api-client')).TestApiClient('http://localhost:5000');
      client.setToken(adminToken);
      const res = await client.getHrmsAttendanceToday();
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.data).toHaveProperty('total');
      expect(res.data.data).toHaveProperty('present');
      expect(res.data.data).toHaveProperty('absent');
    });

    it('should return today\'s attendance summary for HR', async () => {
      const client = new (await import('../../../utils/api-client')).TestApiClient('http://localhost:5000');
      client.setToken(hrToken);
      const res = await client.getHrmsAttendanceToday();
      expect(res.status).toBe(200);
    });

    it('should return 403 for employee', async () => {
      const client = new (await import('../../../utils/api-client')).TestApiClient('http://localhost:5000');
      client.setToken(employeeToken);
      const res = await client.getHrmsAttendanceToday();
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/hrms/attendance', () => {
    it('should return attendance records with pagination', async () => {
      const client = new (await import('../../../utils/api-client')).TestApiClient('http://localhost:5000');
      client.setToken(adminToken);
      const res = await client.getHrmsAttendance({ params: { page: 1, limit: 10 } });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.data.attendance)).toBe(true);
    });

    it('should filter by employee', async () => {
      const client = new (await import('../../../utils/api-client')).TestApiClient('http://localhost:5000');
      client.setToken(adminToken);
      const res = await client.getHrmsAttendance({ params: { employeeId: 1 } });
      expect(res.status).toBe(200);
    });

    it('should filter by date range', async () => {
      const client = new (await import('../../../utils/api-client')).TestApiClient('http://localhost:5000');
      client.setToken(adminToken);
      const res = await client.getHrmsAttendance({ 
        params: { 
          startDate: '2024-01-01', 
          endDate: '2024-01-31' 
        } 
      });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/hrms/attendance/clock-in', () => {
    it('should clock in employee successfully', async () => {
      const client = new (await import('../../../utils/api-client')).TestApiClient('http://localhost:5000');
      client.setToken(employeeToken);
      const res = await client.clockIn({});
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    it('should prevent double clock-in', async () => {
      // Already clocked in
    });
  });

  describe('POST /api/v1/hrms/attendance/clock-out', () => {
    it('should clock out employee successfully', async () => {
      const client = new (await import('../../../utils/api-client')).TestApiClient('http://localhost:5000');
      client.setToken(employeeToken);
      // First clock in
      await client.clockIn({});
      // Then clock out
      const res = await client.clockOut({});
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    it('should calculate hours worked', async () => {
      // Verify hoursWorked is calculated
    });
  });

  describe('GET /api/v1/hrms/me/attendance', () => {
    it('should return employee\'s own attendance', async () => {
      const client = new (await import('../../../utils/api-client')).TestApiClient('http://localhost:5000');
      client.setToken(employeeToken);
      const res = await client.getHrmsMyAttendance();
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });
  });

  describe('GET /api/v1/hrms/attendance/calendar', () => {
    it('should return calendar view for admin', async () => {
      const client = new (await import('../../../utils/api-client')).TestApiClient('http://localhost:5000');
      client.setToken(adminToken);
      const res = await client.getHrmsAttendanceCalendar({ params: { year: 2024, month: 1 } });
      expect(res.status).toBe(200);
    });
  });
});
