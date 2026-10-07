import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

export function useAuth() {
  return {
    login: (email, password) => api.post('/auth/login', { email, password }).then(r => r.data.data),
    register: (data) => api.post('/auth/register', data).then(r => r.data.data),
    logout: () => api.post('/auth/logout').then(r => r.data),
    getProfile: () => api.get('/auth/profile').then(r => r.data.data),
    updateProfile: (data) => api.put('/auth/profile', data).then(r => r.data.data),
    changePassword: (data) => api.post('/auth/change-password', data).then(r => r.data),
    refreshToken: (refreshToken) => api.post('/auth/refresh-token', { refreshToken }).then(r => r.data.data),
  };
}

export function useLogout() {
  return useMutation({
    mutationFn: () => api.post('/auth/logout').then(r => r.data),
  });
}

export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/dashboard').then(r => r.data.data) });
}

export function useProducts(params = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => api.get('/products', { params }).then(r => r.data),
    enabled,
  });
}

export function useProduct(id) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get(`/products/${id}`).then(r => r.data.data.product),
    enabled: !!id,
  });
}

export function useProductByBarcode(barcode) {
  return useQuery({
    queryKey: ['product', 'barcode', barcode],
    queryFn: () => api.get(`/products/barcode/${barcode}`).then(r => r.data.data.product),
    enabled: !!barcode,
  });
}

export function useCategories(params = {}) {
  return useQuery({
    queryKey: ['categories', params],
    queryFn: () => api.get('/categories', { params }).then(r => r.data.data),
  });
}

export function useCategoryTree() {
  return useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: () => api.get('/categories/tree').then(r => r.data.data),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/products', data, { headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {} }).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/products/${id}`, data, { headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {} }).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/products/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useLowStockProducts(params = {}) {
  return useQuery({
    queryKey: ['products', 'low-stock', params],
    queryFn: () => api.get('/products/low-stock', { params }).then(r => r.data),
  });
}

export function useBestSellers(params = {}) {
  return useQuery({
    queryKey: ['products', 'best-sellers', params],
    queryFn: () => api.get('/products/best-sellers', { params }).then(r => r.data.data),
  });
}

export function useSales(params = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['sales', params],
    queryFn: () => api.get('/sales', { params }).then(r => r.data),
    enabled,
  });
}

export function useSale(id) {
  return useQuery({
    queryKey: ['sale', id],
    queryFn: () => api.get(`/sales/${id}`).then(r => r.data.data),
    enabled: !!id,
  });
}

export function useSaleByInvoice(invoiceNo) {
  return useQuery({
    queryKey: ['sale', 'invoice', invoiceNo],
    queryFn: () => api.get(`/sales/invoice/${invoiceNo}`).then(r => r.data.data),
    enabled: !!invoiceNo,
  });
}

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/sales', data).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['finance-report'] });
      qc.invalidateQueries({ queryKey: ['cashflow'] });
    },
  });
}

export function useCreatePendingSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/sales/pending', data).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: (data) => api.post('/payments/create-checkout', data).then(r => r.data.data),
  });
}

export function useCancelPendingSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post(`/sales/pending/${id}/cancel`).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function usePaymentStatus(saleId, options = {}) {
  const { polling, ...queryOptions } = options;
  return useQuery({
    queryKey: ['payment-status', saleId],
    queryFn: () => api.get(`/payments/status/${saleId}`).then(r => r.data.data),
    enabled: !!saleId,
    refetchInterval: polling ? 3000 : false,
    ...queryOptions,
  });
}

export function useVerifyPayment(saleId, sessionId, options = {}) {
  const { refetchInterval: userInterval, ...queryOptions } = options;
  return useQuery({
    queryKey: ['verify-payment', saleId, sessionId],
    queryFn: () => api.get(`/payments/verify/${saleId}`, { params: { sessionId } }).then(r => r.data.data),
    // The server can verify from the session it stamped on the sale, so a
    // missing/placeholder sessionId in the redirect must not disable polling.
    enabled: !!saleId,
    refetchInterval: userInterval ?? false,
    ...queryOptions,
  });
}

// Is the PayMongo account actually wired up? The register asks before offering
// the online (e-wallet) path, instead of failing on the last click.
export function usePaymentConfig() {
  return useQuery({
    queryKey: ['payment-config'],
    queryFn: () => api.get('/payments/config').then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
    retry: 0,
  });
}

export function useCancelSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post(`/sales/${id}/cancel`).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['finance-report'] });
      qc.invalidateQueries({ queryKey: ['cashflow'] });
    },
  });
}

export function useSalesReport(params = {}) {
  return useQuery({
    queryKey: ['sales', 'report', params],
    queryFn: () => api.get('/sales/report', { params }).then(r => r.data.data),
  });
}

export function useCustomers(params = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => api.get('/customers', { params }).then(r => r.data),
    enabled,
  });
}

export function useCustomer(id) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get(`/customers/${id}`).then(r => r.data.data),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/customers', data).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/customers/${id}`, data).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/customers/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useSuppliers(params = {}) {
  return useQuery({
    queryKey: ['suppliers', params],
    queryFn: () => api.get('/suppliers', { params }).then(r => r.data),
  });
}

export function useSupplier(id) {
  return useQuery({
    queryKey: ['supplier', id],
    queryFn: () => api.get(`/suppliers/${id}`).then(r => r.data.data),
    enabled: !!id,
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/suppliers', data).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/suppliers/${id}`, data).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/suppliers/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useOutstandingBalances(params = {}) {
  return useQuery({
    queryKey: ['suppliers', 'outstanding-balances', params],
    queryFn: () => api.get('/suppliers/outstanding-balances', { params }).then(r => r.data.data),
  });
}

export function useSupplierSummary(id) {
  return useQuery({
    queryKey: ['supplier', 'summary', id],
    queryFn: () => api.get(`/suppliers/${id}/summary`).then(r => r.data.data),
    enabled: !!id,
  });
}

export function useSupplierPurchases(id, params = {}) {
  return useQuery({
    queryKey: ['supplier', 'purchases', id, params],
    queryFn: () => api.get(`/suppliers/${id}/purchases`, { params }).then(r => r.data),
    enabled: !!id,
  });
}

export function useSupplierAnalytics() {
  return useQuery({
    queryKey: ['suppliers', 'analytics'],
    queryFn: () => api.get('/suppliers/analytics').then(r => r.data.data),
  });
}

export function useImportSuppliers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows) => api.post('/suppliers/import', { rows }).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function usePurchases(params = {}) {
  return useQuery({
    queryKey: ['purchases', params],
    queryFn: () => api.get('/purchases', { params }).then(r => r.data),
  });
}

export function usePurchase(id) {
  return useQuery({
    queryKey: ['purchase', id],
    queryFn: () => api.get(`/purchases/${id}`).then(r => r.data.data),
    enabled: !!id,
  });
}

export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/purchases', data).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['finance-report'] });
      qc.invalidateQueries({ queryKey: ['cashflow'] });
    },
  });
}

export function useReceivePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/purchases/${id}/receive`, data).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['finance-report'] });
      qc.invalidateQueries({ queryKey: ['cashflow'] });
    },
  });
}

export function useCancelPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post(`/purchases/${id}/cancel`).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['finance-report'] });
      qc.invalidateQueries({ queryKey: ['cashflow'] });
    },
  });
}

export function usePayPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.post(`/purchases/${id}/pay`, data).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['finance-report'] });
      qc.invalidateQueries({ queryKey: ['cashflow'] });
    },
  });
}

export function useInventoryMovements(params = {}) {
  return useQuery({
    queryKey: ['inventory', 'movements', params],
    queryFn: () => api.get('/inventory/movements', { params }).then(r => r.data),
  });
}

export function useInventoryLogs(params = {}) {
  return useQuery({
    queryKey: ['inventory', 'logs', params],
    queryFn: () => api.get('/inventory/logs', { params }).then(r => r.data),
  });
}

export function useStockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/inventory/stock-in', data).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useStockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/inventory/stock-out', data).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/inventory/adjust', data).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCheckLowStock() {
  return useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: () => api.get('/inventory/check-low-stock').then(r => r.data.data),
    staleTime: 60000,
  });
}

export function useCheckExpiring(days) {
  return useQuery({
    queryKey: ['inventory', 'expiring', days],
    queryFn: () => api.get('/inventory/check-expiring', { params: { days } }).then(r => r.data.data),
    enabled: !!days,
  });
}

export function useExpenses(params = {}) {
  return useQuery({
    queryKey: ['expenses', params],
    queryFn: () => api.get('/expenses', { params }).then(r => r.data),
  });
}

export function useExpense(id) {
  return useQuery({
    queryKey: ['expense', id],
    queryFn: () => api.get(`/expenses/${id}`).then(r => r.data.data),
    enabled: !!id,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/expenses', data).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['finance-report'] });
      qc.invalidateQueries({ queryKey: ['cashflow'] });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/expenses/${id}`, data).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['finance-report'] });
      qc.invalidateQueries({ queryKey: ['cashflow'] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/expenses/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['finance-report'] });
      qc.invalidateQueries({ queryKey: ['cashflow'] });
    },
  });
}

export function useExpenseReport(params = {}) {
  return useQuery({
    queryKey: ['expenses', 'report', params],
    queryFn: () => api.get('/expenses/report', { params }).then(r => r.data.data),
  });
}

export function useExpenseCategories(params = {}) {
  return useQuery({
    queryKey: ['expense-categories', params],
    queryFn: () => api.get('/expense-categories', { params }).then(r => r.data),
  });
}



export function useNotifications(params = {}) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => api.get('/notifications', { params }).then(r => r.data),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get('/notifications/unread-count').then(r => r.data.data),
    refetchInterval: 60000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids) => api.put('/notifications/mark-read', { ids }).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.put('/notifications/mark-all-read').then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/notifications/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
}

export function useUsers(params = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => api.get('/users', { params }).then(r => r.data),
    enabled,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/users', data).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/users/${id}`, data).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useActivityLogs(params = {}) {
  return useQuery({
    queryKey: ['activity-logs', params],
    queryFn: () => api.get('/activity-logs', { params }).then(r => r.data),
  });
}

export function useUserActivityLogs(userId, params = {}) {
  return useQuery({
    queryKey: ['activity-logs', 'user', userId, params],
    queryFn: () => api.get(`/activity-logs/user/${userId}`, { params }).then(r => r.data),
    enabled: !!userId,
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then(r => r.data.data.roles),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => {
      const data = r.data.data;
      if (data) {
        localStorage.setItem('minimart_settings', JSON.stringify(data));
      }
      return data;
    }),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.put('/settings', data).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}

// ─── Discounts ──────────────────────────────────────────
export function useDiscounts(params = {}) {
  return useQuery({
    queryKey: ['discounts', params],
    queryFn: () => api.get('/discounts', { params }).then(r => r.data),
  });
}

export function useCreateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/discounts', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discounts'] }),
  });
}

export function useUpdateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/discounts/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discounts'] }),
  });
}

export function useDeleteDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/discounts/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discounts'] }),
  });
}

export function useValidateDiscount() {
  return useMutation({
    mutationFn: (data) => api.post('/discounts/validate', data).then(r => r.data.data),
  });
}

// ─── Finance ──────────────────────────────────────────
export function useFinanceReport(params = {}) {
  return useQuery({
    queryKey: ['finance-report', params],
    queryFn: () => api.get('/finance/report', { params }).then(r => r.data),
  });
}

export function useCashflow(params = {}) {
  return useQuery({
    queryKey: ['cashflow', params],
    queryFn: () => api.get('/finance/cashflow', { params }).then(r => r.data),
  });
}

// ─── Branches ──────────────────────────────────────────
export function useBranches(params = {}) {
  return useQuery({
    queryKey: ['branches', params],
    queryFn: () => api.get('/branches', { params }).then(r => r.data),
  });
}

export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/branches', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/branches/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/branches/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  });
}

// ─── Petty Cash ──────────────────────────────────────────
export function usePettyCashFunds() {
  return useQuery({
    queryKey: ['petty-cash-funds'],
    queryFn: () => api.get('/petty-cash').then(r => r.data),
  });
}

export function usePettyCashFund(id) {
  return useQuery({
    queryKey: ['petty-cash-fund', id],
    queryFn: () => api.get(`/petty-cash/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

export function usePettyCashSummary() {
  return useQuery({
    queryKey: ['petty-cash-summary'],
    queryFn: () => api.get('/petty-cash/summary').then(r => r.data),
  });
}

export function usePettyCashTransactions(fundId, params = {}) {
  return useQuery({
    queryKey: ['petty-cash-transactions', fundId, params],
    queryFn: () => api.get(`/petty-cash/${fundId}/transactions`, { params }).then(r => r.data),
    enabled: !!fundId,
  });
}

export function useCreatePettyCashFund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/petty-cash', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['petty-cash-funds'] }); qc.invalidateQueries({ queryKey: ['petty-cash-summary'] }); },
  });
}

export function useUpdatePettyCashFund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/petty-cash/${id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['petty-cash-funds'] }); qc.invalidateQueries({ queryKey: ['petty-cash-summary'] }); },
  });
}

export function useClosePettyCashFund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.patch(`/petty-cash/${id}/close`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['petty-cash-funds'] }); qc.invalidateQueries({ queryKey: ['petty-cash-summary'] }); },
  });
}

export function usePettyCashDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.post(`/petty-cash/${id}/deposit`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['petty-cash-funds'] }); qc.invalidateQueries({ queryKey: ['petty-cash-summary'] }); qc.invalidateQueries({ queryKey: ['petty-cash-transactions'] }); },
  });
}

export function usePettyCashWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.post(`/petty-cash/${id}/withdraw`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['petty-cash-funds'] }); qc.invalidateQueries({ queryKey: ['petty-cash-summary'] }); qc.invalidateQueries({ queryKey: ['petty-cash-transactions'] }); },
  });
}
export function useDeliveryTracking(deliveryId) {
  return useQuery({
    queryKey: ['tracking', deliveryId],
    queryFn: async () => {
      const { data } = await api.get(`/tracking/delivery/${deliveryId}`);
      return data.data;
    },
    enabled: !!deliveryId,
    refetchInterval: 5000,
  });
}

export function useShipPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ purchaseId, destinationLat, destinationLng }) => {
      const { data } = await api.post(`/tracking/ship/${purchaseId}`, { destinationLat, destinationLng });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchases'] }),
  });
}

export function useDeliveryByPurchase(purchaseId) {
  return useQuery({
    queryKey: ['tracking-by-purchase', purchaseId],
    queryFn: async () => {
      const { data } = await api.get(`/tracking/by-purchase/${purchaseId}`);
      return data.data;
    },
    enabled: !!purchaseId,
    refetchInterval: 5000,
  });
}

export function useSimulateRider() {
  return useMutation({
    mutationFn: async ({ deliveryId, startLat, startLng }) => {
      const { data } = await api.post(`/tracking/simulate/${deliveryId}`, { startLat, startLng });
      return data;
    },
  });
}
