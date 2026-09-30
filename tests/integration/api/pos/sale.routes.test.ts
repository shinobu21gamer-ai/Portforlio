// Sale Routes Integration Tests
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestApiClient } from '../../../utils/api-client';
import { setupTestDB, teardownTestDB, seedTestData } from '../../../utils/db-helper';
import { createRoleTokens } from '../../../utils/auth-helper';

let db: any;
let apiClient: TestApiClient;
let adminToken: string;
let cashierToken: string;

describe('Sale Routes Integration', () => {
  beforeAll(async () => {
    const { default: dbHelper } = await import('../../../utils/db-helper');
    db = await dbHelper.setupTestDB();
    await seedTestData(db);
    
    apiClient = new TestApiClient('http://localhost:5000');
    const tokens = await createRoleTokens(db);
    adminToken = (await tokens.admin()).accessToken;
    cashierToken = (await tokens.cashier()).accessToken;
  });

  afterAll(async () => {
    const { teardownTestDB } = await import('../../../utils/db-helper');
    await teardownTestDB();
  });

  beforeEach(async () => {
    apiClient.clearToken();
  });

  describe('GET /api/v1/sales', () => {
    it('should return sales list for admin', async () => {
      apiClient.setToken(adminToken);
      const res = await apiClient.getSales();
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.data.sales)).toBe(true);
    });

    it('should return sales list for cashier (own sales only)', async () => {
      apiClient.setToken(cashierToken);
      const res = await apiClient.getSales();
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    it('should support pagination', async () => {
      apiClient.setToken(adminToken);
      const res = await apiClient.getSales({ params: { page: 1, limit: 5 } });
      expect(res.status).toBe(200);
      expect(res.data.pagination).toBeDefined();
    });
  });

  describe('GET /api/v1/sales/pending', () => {
    it('should return pending sales for admin', async () => {
      apiClient.setToken(adminToken);
      const res = await apiClient.get('/sales/pending');
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    it('should return 403 for cashier', async () => {
      apiClient.setToken(cashierToken);
      const res = await apiClient.get('/sales/pending');
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/sales', () => {
    it('should create completed sale with valid data', async () => {
      apiClient.setToken(cashierToken);
      const res = await apiClient.createSale({
        items: [
          { productId: 1, quantity: 2, unitPrice: 20 },
        ],
        paymentMethod: 'cash',
        cashAmount: 100,
      });
      expect(res.status).toBe(201);
      expect(res.data.success).toBe(true);
      expect(res.data.data.status).toBe('completed');
    });

    it('should create pending sale', async () => {
      apiClient.setToken(cashierToken);
      const res = await apiClient.createPendingSale({
        items: [
          { productId: 1, quantity: 1, unitPrice: 20 },
        ],
      });
      expect(res.status).toBe(201);
      expect(res.data.data.status).toBe('pending');
    });

    it('should reject sale with insufficient stock', async () => {
      apiClient.setToken(cashierToken);
      const res = await apiClient.createSale({
        items: [
          { productId: 1, quantity: 9999, unitPrice: 20 },
        ],
        paymentMethod: 'cash',
      });
      expect(res.status).toBe(400);
      expect(res.data.success).toBe(false);
    });

    it('should apply discount correctly', async () => {
      apiClient.setToken(cashierToken);
      const res = await apiClient.createSale({
        items: [{ productId: 1, quantity: 1, unitPrice: 100 }],
        paymentMethod: 'cash',
        discountCode: 'TEST10',
      });
      expect(res.status).toBe(201);
      expect(res.data.data.discountAmount).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/sales/pending/:id/cancel', () => {
    it('should cancel pending sale and restore stock', async () => {
      apiClient.setToken(cashierToken);
      const createRes = await apiClient.createPendingSale({
        items: [{ productId: 1, quantity: 2, unitPrice: 20 }],
      });
      const saleId = createRes.data.data.id;
      
      const cancelRes = await apiClient.post(`/sales/pending/${saleId}/cancel`);
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.data.data.status).toBe('cancelled');
    });
  });

  describe('GET /api/v1/sales/:id', () => {
    it('should return sale details', async () => {
      apiClient.setToken(adminToken);
      const res = await apiClient.getSale(1);
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.data.id).toBe(1);
    });
  });
});
