import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export class TestApiClient {
  private client: AxiosInstance;
  private token?: string;

  constructor(baseURL: string = 'http://localhost:5000/api/v1') {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = undefined;
  }

  async get<T>(url: string, config?: AxiosRequestConfig) {
    return this.client.get<T>(url, config);
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.post<T>(url, data, config);
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.put<T>(url, data, config);
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.patch<T>(url, data, config);
  }

  async delete<T>(url: string, config?: AxiosRequestConfig) {
    return this.client.delete<T>(url, config);
  }

  // Auth helpers
  async login(email: string, password: string) {
    const res = await this.post('/auth/login', { email, password });
    if (res.data.data?.token) {
      this.setToken(res.data.data.token);
    }
    return res;
  }

  async refreshToken() {
    const res = await this.post('/auth/refresh-token');
    if (res.data.data?.token) {
      this.setToken(res.data.data.token);
    }
    return res;
  }

  // POS endpoints
  async getProducts(params?: any) {
    return this.get('/products', { params });
  }

  async createSale(data: any) {
    return this.post('/sales', data);
  }

  async createPendingSale(data: any) {
    return this.post('/sales/pending', data);
  }

  async getSales(params?: any) {
    return this.get('/sales', { params });
  }

  async getDashboard() {
    return this.get('/dashboard');
  }

  async getCategories() {
    return this.get('/categories');
  }

  async getCustomers() {
    return this.get('/customers');
  }

  async getSuppliers() {
    return this.get('/suppliers');
  }

  // HRMS endpoints
  async getEmployees(params?: any) {
    return this.get('/hrms/employees', { params });
  }

  async getDepartments() {
    return this.get('/hrms/departments');
  }

  async getPositions() {
    return this.get('/hrms/positions');
  }

  async getAttendance(params?: any) {
    return this.get('/hrms/attendance', { params });
  }

  async clockIn(data: any) {
    return this.post('/hrms/attendance/clock-in', data);
  }

  async clockOut(data: any) {
    return this.post('/hrms/attendance/clock-out', data);
  }

  async getLeaves(params?: any) {
    return this.get('/hrms/leaves', { params });
  }

  async createLeave(data: any) {
    return this.post('/hrms/leaves', data);
  }

  async getPayrolls(params?: any) {
    return this.get('/hrms/payrolls', { params });
  }

  async generatePayroll(data: any) {
    return this.post('/hrms/payrolls', data);
  }

  async previewPayroll(data: any) {
    return this.post('/hrms/payrolls/preview', data);
  }

  async getJobs(params?: any) {
    return this.get('/hrms/jobs', { params });
  }

  async getMe() {
    return this.get('/hrms/me');
  }

  async getMyAttendance(params?: any) {
    return this.get('/hrms/me/attendance', { params });
  }

  async getMyLeaves(params?: any) {
    return this.get('/hrms/me/leaves', { params });
  }

  async getMyLeaveBalance() {
    return this.get('/hrms/me/leaves/balance');
  }

  async getPendingCounts() {
    return this.get('/hrms/pending-counts');
  }
}

export const api = new TestApiClient();