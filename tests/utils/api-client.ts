// API Client - Typed HTTP client for integration/E2E tests
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { createAuthHeaders, TokenPayload, generateTokens } from './auth-helper';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

export class TestApiClient {
  private client: AxiosInstance;
  private baseURL: string;
  private currentToken: string | null = null;

  constructor(baseURL: string = 'http://localhost:5000') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL: `${baseURL}/api/v1`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
      validateStatus: () => true, // Don't throw on non-2xx
    });
  }

  setToken(token: string) {
    this.currentToken = token;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearToken() {
    this.currentToken = null;
    delete this.client.defaults.headers.common['Authorization'];
  }

  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    const response = await this.client.post('/auth/login', { email, password });
    
    if (response.data.success && response.data.data.token) {
      const { accessToken, refreshToken } = response.data.data;
      this.setToken(accessToken);
      return { accessToken, refreshToken, user: response.data.data.user };
    }
    
    throw new Error(`Login failed: ${response.data.message}`);
  }

  async loginAsRole(role: 'admin' | 'cashier' | 'hr' | 'employee' | 'inventory'): Promise<{ accessToken: string; user: any }> {
    const credentials: Record<string, { email: string; password: string }> = {
      admin: { email: 'admin@test.com', password: 'password123' },
      cashier: { email: 'cashier@test.com', password: 'password123' },
      hr: { email: 'hr@test.com', password: 'password123' },
      employee: { email: 'employee@test.com', password: 'password123' },
      inventory: { email: 'inventory@test.com', password: 'password123' },
    };

    return this.login(credentials[role].email, credentials[role].password);
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<any>> {
    return this.client.get(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<any>> {
    return this.client.post(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<any>> {
    return this.client.put(url, data, config);
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<any>> {
    return this.client.patch(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<any>> {
    return this.client.delete(url, config);
  }

  // POS API Endpoints
  async getProducts(params?: Record<string, any>) {
    return this.get('/products', { params });
  }

  async getProduct(id: number) {
    return this.get(`/products/${id}`);
  }

  async createProduct(data: any) {
    return this.post('/products', data);
  }

  async updateProduct(id: number, data: any) {
    return this.put(`/products/${id}`, data);
  }

  async deleteProduct(id: number) {
    return this.delete(`/products/${id}`);
  }

  async getCategories() {
    return this.get('/categories');
  }

  async getCategoriesTree() {
    return this.get('/categories/tree');
  }

  async getCustomers(params?: Record<string, any>) {
    return this.get('/customers', { params });
  }

  async getSuppliers(params?: Record<string, any>) {
    return this.get('/suppliers', { params });
  }

  async getSales(params?: Record<string, any>) {
    return this.get('/sales', { params });
  }

  async getSale(id: number) {
    return this.get(`/sales/${id}`);
  }

  async createSale(data: any) {
    return this.post('/sales', data);
  }

  async createPendingSale(data: any) {
    return this.post('/sales/pending', data);
  }

  async cancelSale(id: number) {
    return this.post(`/sales/${id}/cancel`);
  }

  async getPurchases(params?: Record<string, any>) {
    return this.get('/purchases', { params });
  }

  async getInventoryMovements(params?: Record<string, any>) {
    return this.get('/inventory/movements', { params });
  }

  async checkLowStock() {
    return this.get('/inventory/check-low-stock');
  }

  async checkExpiring() {
    return this.get('/inventory/check-expiring');
  }

  async getExpenses(params?: Record<string, any>) {
    return this.get('/expenses', { params });
  }

  async getDiscounts(params?: Record<string, any>) {
    return this.get('/discounts', { params });
  }

  async validateDiscount(code: string, subtotal: number) {
    return this.get('/discounts/validate', { params: { code, subtotal } });
  }

  async getPettyCash() {
    return this.get('/petty-cash');
  }

  async getBranches() {
    return this.get('/branches');
  }

  async getDashboard() {
    return this.get('/dashboard');
  }

  async getNotifications(params?: Record<string, any>) {
    return this.get('/notifications', { params });
  }

  async getUsers(params?: Record<string, any>) {
    return this.get('/users', { params });
  }

  async getRoles() {
    return this.get('/roles');
  }

  async getSettings() {
    return this.get('/settings');
  }

  async getFinanceCashflow() {
    return this.get('/finance/cashflow');
  }

  async getFinanceReport() {
    return this.get('/finance/report');
  }

  // HRMS API Endpoints
  async getHrmsEmployees(params?: Record<string, any>) {
    return this.get('/hrms/employees', { params });
  }

  async getHrmsEmployee(id: number) {
    return this.get(`/hrms/employees/${id}`);
  }

  async createHrmsEmployee(data: any) {
    return this.post('/hrms/employees', data);
  }

  async updateHrmsEmployee(id: number, data: any) {
    return this.put(`/hrms/employees/${id}`, data);
  }

  async getHrmsDepartments() {
    return this.get('/hrms/departments');
  }

  async getHrmsPositions() {
    return this.get('/hrms/positions');
  }

  async getHrmsAttendance(params?: Record<string, any>) {
    return this.get('/hrms/attendance', { params });
  }

  async getHrmsAttendanceToday() {
    return this.get('/hrms/attendance/today');
  }

  async getHrmsAttendanceCalendar(params?: Record<string, any>) {
    return this.get('/hrms/attendance/calendar', { params });
  }

  async clockIn(data: any) {
    return this.post('/hrms/attendance/clock-in', data);
  }

  async clockOut(data: any) {
    return this.post('/hrms/attendance/clock-out', data);
  }

  async getHrmsLeaves(params?: Record<string, any>) {
    return this.get('/hrms/leaves', { params });
  }

  async getHrmsLeaveBalance(employeeId: number) {
    return this.get(`/hrms/leaves/balance/${employeeId}`);
  }

  async getHrmsMyLeaves(params?: Record<string, any>) {
    return this.get('/hrms/me/leaves', { params });
  }

  async getHrmsMyLeaveBalance() {
    return this.get('/hrms/me/leaves/balance');
  }

  async createLeaveRequest(data: any) {
    return this.post('/hrms/me/leaves', data);
  }

  async getHrmsPayrolls(params?: Record<string, any>) {
    return this.get('/hrms/payrolls', { params });
  }

  async getHrmsPayrollPreview(data: any) {
    return this.get('/hrms/payrolls/preview', { params: data });
  }

  async getHrmsJobs(params?: Record<string, any>) {
    return this.get('/hrms/jobs', { params });
  }

  async getHrmsContracts(params?: Record<string, any>) {
    return this.get('/hrms/contracts', { params });
  }

  async getHrmsSchedules(params?: Record<string, any>) {
    return this.get('/hrms/schedules', { params });
  }

  async getHrmsPendingCounts() {
    return this.get('/hrms/pending-counts');
  }

  async getHrmsNotifications(params?: Record<string, any>) {
    return this.get('/hrms/notifications', { params });
  }

  async getHrmsMyProfile() {
    return this.get('/hrms/me/profile');
  }

  async getHrmsMyAttendance(params?: Record<string, any>) {
    return this.get('/hrms/me/attendance', { params });
  }

  async getHrmsMyContracts() {
    return this.get('/hrms/me/contracts');
  }

  async getHrmsMyPayslips() {
    return this.get('/hrms/me/payslips');
  }

  async clockInMe() {
    return this.post('/hrms/me/attendance/clock-in');
  }

  async clockOutMe() {
    return this.post('/hrms/me/attendance/clock-out');
  }

  // Public Endpoints
  async getPublicJobs() {
    return this.get('/public/jobs');
  }

  async applyForJob(data: FormData) {
    return this.client.post('/public/jobs/apply', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
}

export function createAuthenticatedClient(baseURL: string, token: string): TestApiClient {
  const client = new TestApiClient(baseURL);
  client.setToken(token);
  return client;
}

export async function createRoleClients(baseURL: string): Promise<Record<string, any>> {
  const roles = ['admin', 'cashier', 'hr', 'employee', 'inventory'] as const;
  const clients: Record<string, any> = {};
  
  for (const role of roles) {
    const roleClient = new TestApiClient(baseURL);
    try {
      await roleClient.loginAsRole(role);
      clients[role] = roleClient;
    } catch (e) {
      console.warn(`Failed to login as ${role}:`, e);
    }
  }
  
  return clients;
}