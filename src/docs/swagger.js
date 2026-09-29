const swaggerJsdoc = require('swagger-jsdoc');
const config = require('../config');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MiniMart POS API',
      version: '1.0.0',
      description: 'Production-ready Mini Mart Point of Sale System REST API',
      contact: {
        name: 'Developer',
        email: 'dev@minimartpos.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}${config.apiPrefix}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            errors: { type: 'array', items: { type: 'string' } },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            totalItems: { type: 'integer' },
            totalPages: { type: 'integer' },
            hasNextPage: { type: 'boolean' },
            hasPrevPage: { type: 'boolean' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            role: { type: 'object' },
            isActive: { type: 'boolean' },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            sku: { type: 'string' },
            barcode: { type: 'string' },
            buyingPrice: { type: 'number' },
            sellingPrice: { type: 'number' },
            stockQuantity: { type: 'integer' },
            category: { type: 'object' },
          },
        },
        Sale: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            invoiceNo: { type: 'string' },
            subtotal: { type: 'number' },
            discountAmount: { type: 'number' },
            taxAmount: { type: 'number' },
            total: { type: 'number' },
            paymentMethod: { type: 'string' },
            status: { type: 'string' },
            items: { type: 'array', items: { type: 'object' } },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user: { $ref: '#/components/schemas/User' },
                token: { type: 'string' },
                refreshToken: { type: 'string' },
              },
            },
          },
        },
      },
    },
    paths: {
      '/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Login user',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
          },
          responses: { 200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } }, 401: { description: 'Invalid credentials' } },
        },
      },
      '/auth/register': {
        post: {
          tags: ['Authentication'],
          summary: 'Register new user',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          responses: { 201: { description: 'User registered' } },
        },
      },
      '/auth/profile': {
        get: {
          tags: ['Authentication'],
          summary: 'Get current user profile',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'User profile' } },
        },
        put: {
          tags: ['Authentication'],
          summary: 'Update profile',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Profile updated' } },
        },
      },
      '/auth/change-password': {
        post: {
          tags: ['Authentication'],
          summary: 'Change password',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Password changed' } },
        },
      },
      '/auth/forgot-password': {
        post: {
          tags: ['Authentication'],
          summary: 'Request password reset',
          responses: { 200: { description: 'Reset email sent' } },
        },
      },
      '/dashboard': {
        get: {
          tags: ['Dashboard'],
          summary: 'Get dashboard data',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Dashboard data' } },
        },
      },
      '/products': {
        get: {
          tags: ['Products'],
          summary: 'List all products',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'page', schema: { type: 'integer' } },
            { in: 'query', name: 'limit', schema: { type: 'integer' } },
            { in: 'query', name: 'search', schema: { type: 'string' } },
            { in: 'query', name: 'categoryId', schema: { type: 'integer' } },
          ],
          responses: { 200: { description: 'Products list' } },
        },
        post: {
          tags: ['Products'],
          summary: 'Create product',
          security: [{ bearerAuth: [] }],
          responses: { 201: { description: 'Product created' } },
        },
      },
      '/products/{id}': {
        get: {
          tags: ['Products'],
          summary: 'Get product by ID',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Product details' } },
        },
        put: {
          tags: ['Products'],
          summary: 'Update product',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Product updated' } },
        },
        delete: {
          tags: ['Products'],
          summary: 'Delete product',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Product deleted' } },
        },
      },
      '/products/barcode/{barcode}': {
        get: {
          tags: ['Products'],
          summary: 'Find product by barcode',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'barcode', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Product found' } },
        },
      },
      '/products/low-stock': {
        get: {
          tags: ['Products'],
          summary: 'Get low stock products',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Low stock products' } },
        },
      },
      '/products/best-sellers': {
        get: {
          tags: ['Products'],
          summary: 'Get best selling products',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Best sellers' } },
        },
      },
      '/categories': {
        get: {
          tags: ['Categories'],
          summary: 'List categories',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Categories list' } },
        },
        post: {
          tags: ['Categories'],
          summary: 'Create category',
          security: [{ bearerAuth: [] }],
          responses: { 201: { description: 'Category created' } },
        },
      },
      '/categories/tree': {
        get: {
          tags: ['Categories'],
          summary: 'Get category tree',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Category tree' } },
        },
      },
      '/customers': {
        get: {
          tags: ['Customers'],
          summary: 'List customers',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Customers list' } },
        },
        post: {
          tags: ['Customers'],
          summary: 'Create customer',
          security: [{ bearerAuth: [] }],
          responses: { 201: { description: 'Customer created' } },
        },
      },
      '/suppliers': {
        get: {
          tags: ['Suppliers'],
          summary: 'List suppliers',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Suppliers list' } },
        },
        post: {
          tags: ['Suppliers'],
          summary: 'Create supplier',
          security: [{ bearerAuth: [] }],
          responses: { 201: { description: 'Supplier created' } },
        },
      },
      '/sales': {
        get: {
          tags: ['Sales'],
          summary: 'List sales',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Sales list' } },
        },
        post: {
          tags: ['Sales'],
          summary: 'Create sale',
          security: [{ bearerAuth: [] }],
          responses: { 201: { description: 'Sale completed' } },
        },
      },
      '/sales/report': {
        get: {
          tags: ['Sales'],
          summary: 'Get sales report',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'startDate', required: true, schema: { type: 'string', format: 'date' } },
            { in: 'query', name: 'endDate', required: true, schema: { type: 'string', format: 'date' } },
          ],
          responses: { 200: { description: 'Sales report' } },
        },
      },
      '/sales/{id}/cancel': {
        post: {
          tags: ['Sales'],
          summary: 'Cancel sale',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Sale cancelled' } },
        },
      },
      '/purchases': {
        get: {
          tags: ['Purchases'],
          summary: 'List purchases',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Purchases list' } },
        },
        post: {
          tags: ['Purchases'],
          summary: 'Create purchase order',
          security: [{ bearerAuth: [] }],
          responses: { 201: { description: 'Purchase created' } },
        },
      },
      '/purchases/{id}/receive': {
        put: {
          tags: ['Purchases'],
          summary: 'Receive purchase order',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Purchase received' } },
        },
      },
      '/inventory/stock-in': {
        post: {
          tags: ['Inventory'],
          summary: 'Add stock',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Stock added' } },
        },
      },
      '/inventory/stock-out': {
        post: {
          tags: ['Inventory'],
          summary: 'Remove stock',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Stock removed' } },
        },
      },
      '/inventory/adjust': {
        post: {
          tags: ['Inventory'],
          summary: 'Adjust stock',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Stock adjusted' } },
        },
      },
      '/inventory/movements': {
        get: {
          tags: ['Inventory'],
          summary: 'Get stock movements',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Stock movements' } },
        },
      },
      '/expenses': {
        get: {
          tags: ['Expenses'],
          summary: 'List expenses',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Expenses list' } },
        },
        post: {
          tags: ['Expenses'],
          summary: 'Create expense',
          security: [{ bearerAuth: [] }],
          responses: { 201: { description: 'Expense created' } },
        },
      },
      '/expenses/report': {
        get: {
          tags: ['Expenses'],
          summary: 'Get expense report',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'startDate', required: true, schema: { type: 'string', format: 'date' } },
            { in: 'query', name: 'endDate', required: true, schema: { type: 'string', format: 'date' } },
          ],
          responses: { 200: { description: 'Expense report' } },
        },
      },
      '/notifications': {
        get: {
          tags: ['Notifications'],
          summary: 'List notifications',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Notifications list' } },
        },
      },
      '/notifications/unread-count': {
        get: {
          tags: ['Notifications'],
          summary: 'Get unread notification count',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Unread count' } },
        },
      },
      '/activity-logs': {
        get: {
          tags: ['Activity Logs'],
          summary: 'List activity logs',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Activity logs' } },
        },
      },
      '/users': {
        get: {
          tags: ['Users'],
          summary: 'List users (admin only)',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Users list' } },
        },
        post: {
          tags: ['Users'],
          summary: 'Create user (admin only)',
          security: [{ bearerAuth: [] }],
          responses: { 201: { description: 'User created' } },
        },
      },
      '/users/{id}': {
        get: {
          tags: ['Users'],
          summary: 'Get user by ID',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'User details' } },
        },
        put: {
          tags: ['Users'],
          summary: 'Update user',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'User updated' } },
        },
        delete: {
          tags: ['Users'],
          summary: 'Delete user (admin only, cannot delete admins)',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'User deleted' }, 403: { description: 'Cannot delete admin users' } },
        },
      },
      '/roles': {
        get: {
          tags: ['Roles'],
          summary: 'List roles',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Roles list' } },
        },
        post: {
          tags: ['Roles'],
          summary: 'Create role (admin)',
          security: [{ bearerAuth: [] }],
          responses: { 201: { description: 'Role created' } },
        },
      },
      '/discounts': {
        get: {
          tags: ['Discounts'],
          summary: 'List discounts',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'page', schema: { type: 'integer' } },
            { in: 'query', name: 'limit', schema: { type: 'integer' } },
            { in: 'query', name: 'search', schema: { type: 'string' } },
            { in: 'query', name: 'isActive', schema: { type: 'boolean' } },
          ],
          responses: { 200: { description: 'Discounts list' } },
        },
        post: {
          tags: ['Discounts'],
          summary: 'Create discount',
          security: [{ bearerAuth: [] }],
          responses: { 201: { description: 'Discount created' } },
        },
      },
      '/discounts/{id}': {
        put: {
          tags: ['Discounts'],
          summary: 'Update discount',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Discount updated' } },
        },
        delete: {
          tags: ['Discounts'],
          summary: 'Delete discount',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Discount deleted' } },
        },
      },
      '/discounts/validate': {
        post: {
          tags: ['Discounts'],
          summary: 'Validate discount code',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Discount valid' } },
        },
      },
      '/expense-categories': {
        get: {
          tags: ['Expenses'],
          summary: 'List expense categories',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Expense categories list' } },
        },
        post: {
          tags: ['Expenses'],
          summary: 'Create expense category',
          security: [{ bearerAuth: [] }],
          responses: { 201: { description: 'Category created' } },
        },
      },
      '/finance/report': {
        get: {
          tags: ['Finance'],
          summary: 'Get finance report (admin/manager)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'startDate', required: true, schema: { type: 'string', format: 'date' } },
            { in: 'query', name: 'endDate', required: true, schema: { type: 'string', format: 'date' } },
          ],
          responses: { 200: { description: 'Finance report' } },
        },
      },
      '/finance/cashflow': {
        get: {
          tags: ['Finance'],
          summary: 'Get cashflow report (admin/manager)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'startDate', required: true, schema: { type: 'string', format: 'date' } },
            { in: 'query', name: 'endDate', required: true, schema: { type: 'string', format: 'date' } },
          ],
          responses: { 200: { description: 'Cashflow report' } },
        },
      },
      '/petty-cash': {
        get: {
          tags: ['Petty Cash'],
          summary: 'List petty cash funds',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Petty cash funds' } },
        },
        post: {
          tags: ['Petty Cash'],
          summary: 'Create petty cash fund',
          security: [{ bearerAuth: [] }],
          responses: { 201: { description: 'Fund created' } },
        },
      },
      '/petty-cash/summary': {
        get: {
          tags: ['Petty Cash'],
          summary: 'Get petty cash summary',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Petty cash summary' } },
        },
      },
      '/petty-cash/transactions': {
        get: {
          tags: ['Petty Cash'],
          summary: 'List petty cash transactions',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Petty cash transactions' } },
        },
        post: {
          tags: ['Petty Cash'],
          summary: 'Record petty cash transaction (deposit/withdraw)',
          security: [{ bearerAuth: [] }],
          responses: { 201: { description: 'Transaction recorded' } },
        },
      },
      '/loyalty/{customerId}': {
        get: {
          tags: ['Loyalty'],
          summary: 'Get loyalty points history for customer',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'customerId', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Loyalty history' } },
        },
      },
      '/loyalty/redeem': {
        post: {
          tags: ['Loyalty'],
          summary: 'Redeem loyalty points',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { customerId: { type: 'integer' }, points: { type: 'integer' } } } } },
          },
          responses: { 200: { description: 'Points redeemed' } },
        },
      },
      '/branches': {
        get: {
          tags: ['Branches'],
          summary: 'List branches',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Branches list' } },
        },
        post: {
          tags: ['Branches'],
          summary: 'Create branch (admin)',
          security: [{ bearerAuth: [] }],
          responses: { 201: { description: 'Branch created' } },
        },
      },
      '/settings': {
        get: {
          tags: ['Settings'],
          summary: 'Get system settings',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'System settings' } },
        },
        put: {
          tags: ['Settings'],
          summary: 'Update system settings (admin)',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Settings updated' } },
        },
      },
      '/payments/create-checkout': {
        post: {
          tags: ['Payments'],
          summary: 'Create PayMongo checkout session',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Checkout URL' } },
        },
      },
    },
    tags: [
      { name: 'Authentication', description: 'Auth endpoints' },
      { name: 'Users', description: 'User management' },
      { name: 'Roles', description: 'Role management' },
      { name: 'Dashboard', description: 'Dashboard data' },
      { name: 'Products', description: 'Product management' },
      { name: 'Categories', description: 'Category management' },
      { name: 'Customers', description: 'Customer management' },
      { name: 'Suppliers', description: 'Supplier management' },
      { name: 'Sales', description: 'Sales transactions' },
      { name: 'Purchases', description: 'Purchase orders' },
      { name: 'Inventory', description: 'Inventory management' },
      { name: 'Expenses', description: 'Expense management' },
      { name: 'Discounts', description: 'Discount management' },
      { name: 'Finance', description: 'Finance and cashflow reports' },
      { name: 'Petty Cash', description: 'Petty cash management' },
      { name: 'Loyalty', description: 'Customer loyalty points' },
      { name: 'Branches', description: 'Branch management' },
      { name: 'Settings', description: 'System settings' },
      { name: 'Payments', description: 'PayMongo payment integration' },
      { name: 'Notifications', description: 'Notifications' },
      { name: 'Activity Logs', description: 'Audit trail' },
    ],
  },
  apis: [],
};

module.exports = swaggerJsdoc(options);
