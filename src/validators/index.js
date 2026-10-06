const Joi = require('joi');

const stripHtml = (value, _helpers) => {
  if (typeof value === 'string') {
    return value.replace(/<[^>]*>/g, '');
  }
  return value;
};

const htmlField = () => Joi.string().custom(stripHtml, 'HTML strip');

// Cross-field rule ("a discount value requires a discount type") as a FIELD-level
// .when() — the documented Joi pattern for sibling refs. (An object-level
// .when('discountValue') on the root schema throws "Invalid reference exceeds
// the schema root" and 500s every request; attached to an item OBJECT inside
// .items() it silently always takes the "then" branch. sale.routes tests pin this.)
const discountTypeField = Joi.string().valid('percentage', 'fixed')
  .when('discountValue', {
    is: Joi.number().min(1),
    then: Joi.string().required(),
    otherwise: Joi.string().optional(),
  });

const schemas = {
  // ─── Auth ───────────────────────────────────────────────
  register: Joi.object({
    firstName: htmlField().min(2).max(100).required(),
    lastName: htmlField().min(2).max(100).required(),
    email: Joi.string().email().max(150).required(),
    password: Joi.string().min(8).max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({ 'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number' }),
    phone: Joi.string().min(7).max(20).optional().allow(''),
  }),

  // Admin-created users carry the hierarchy fields (role, branch, reports-to).
  // NOTE: POST /users must NOT reuse `register` — stripUnknown would silently
  // drop roleId and every user create would 400 with "User.roleId cannot be null".
  createUser: Joi.object({
    firstName: htmlField().min(2).max(100).required(),
    lastName: htmlField().min(2).max(100).required(),
    email: Joi.string().email().max(150).required(),
    password: Joi.string().min(8).max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({ 'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number' }),
    phone: Joi.string().min(7).max(20).optional().allow(''),
    roleId: Joi.number().integer().positive().required(),
    branchId: Joi.number().integer().positive().optional().allow(null),
    reportsToId: Joi.number().integer().positive().optional().allow(null),
    isActive: Joi.boolean().optional(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({ 'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number' }),
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required(),
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    password: Joi.string().min(8).max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({ 'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number' }),
  }),

  updateProfile: Joi.object({
    firstName: htmlField().min(2).max(100).optional(),
    lastName: htmlField().min(2).max(100).optional(),
    phone: Joi.string().min(7).max(20).optional().allow(''),
    avatar: Joi.string().optional(),
  }),

  // ─── Category ───────────────────────────────────────────
  createCategory: Joi.object({
    name: htmlField().min(2).max(100).required(),
    description: htmlField().optional().allow(''),
    parentId: Joi.number().integer().positive().optional().allow(null),
  }),

  updateCategory: Joi.object({
    name: htmlField().min(2).max(100).optional(),
    description: htmlField().optional().allow(''),
    parentId: Joi.number().integer().positive().optional().allow(null),
    isActive: Joi.boolean().optional(),
  }),

  // ─── Product ────────────────────────────────────────────
  createProduct: Joi.object({
    name: htmlField().min(2).max(255).required(),
    description: htmlField().optional().allow(''),
    categoryId: Joi.number().integer().positive().required(),
    brand: Joi.string().max(100).optional().allow(''),
    unit: Joi.string().max(50).optional().default('pcs'),
    buyingPrice: Joi.number().min(0).required(),
    sellingPrice: Joi.number().min(0).required(),
    wholesalePrice: Joi.number().min(0).optional().allow(null),
    stockQuantity: Joi.number().integer().min(0).optional().default(0),
    minStockLevel: Joi.number().integer().min(0).optional().default(10),
    barcode: Joi.string().optional().allow(''),
    sku: Joi.string().optional().allow(''),
    taxRate: Joi.number().min(0).max(100).optional().default(0),
    expiryDate: Joi.date().optional().allow(null),
  }),

  updateProduct: Joi.object({
    name: htmlField().min(2).max(255).optional(),
    description: htmlField().optional().allow(''),
    categoryId: Joi.number().integer().positive().optional(),
    brand: Joi.string().max(100).optional().allow(''),
    unit: Joi.string().max(50).optional(),
    buyingPrice: Joi.number().min(0).optional(),
    sellingPrice: Joi.number().min(0).optional(),
    wholesalePrice: Joi.number().min(0).optional().allow(null),
    stockQuantity: Joi.number().integer().min(0).optional(),
    minStockLevel: Joi.number().integer().min(0).optional(),
    barcode: Joi.string().optional().allow(''),
    sku: Joi.string().optional().allow(''),
    taxRate: Joi.number().min(0).max(100).optional(),
    expiryDate: Joi.date().optional().allow(null),
    isActive: Joi.boolean().optional(),
  }),

  // ─── Supplier ───────────────────────────────────────────
  createSupplier: Joi.object({
    name: htmlField().min(2).max(200).required(),
    contactPerson: htmlField().max(100).optional().allow(''),
    email: Joi.string().email().max(150).optional().allow(''),
    phone: Joi.string().min(7).max(20).optional().allow(''),
    mobile: Joi.string().max(20).optional().allow(''),
    address: htmlField().optional().allow(''),
    city: Joi.string().max(100).optional().allow(''),
    province: Joi.string().max(100).optional().allow(''),
    postalCode: Joi.string().max(20).optional().allow(''),
    taxId: Joi.string().max(50).optional().allow(''),
    paymentTerms: Joi.string().max(100).optional().allow(''),
    notes: htmlField().optional().allow(''),
    latitude: Joi.number().min(-90).max(90).optional().allow(null),
    longitude: Joi.number().min(-180).max(180).optional().allow(null),
    website: Joi.string().max(200).optional().allow(''),
    category: Joi.string().valid('raw_material', 'equipment', 'service', 'packaging', 'other').optional().default('other'),
    leadTimeDays: Joi.number().integer().min(0).optional().allow(null),
    minimumOrderAmount: Joi.number().min(0).optional().allow(null),
    rating: Joi.number().min(1).max(5).optional().allow(null),
    bankName: Joi.string().max(100).optional().allow(''),
    bankAccount: Joi.string().max(50).pattern(/^\d*$/).optional().allow(''),
    registrationNumber: Joi.string().max(50).optional().allow(''),
  }),

  updateSupplier: Joi.object({
    name: htmlField().min(2).max(200).optional(),
    contactPerson: htmlField().max(100).optional().allow(''),
    email: Joi.string().email().max(150).optional().allow(''),
    phone: Joi.string().min(7).max(20).optional().allow(''),
    mobile: Joi.string().max(20).optional().allow(''),
    address: htmlField().optional().allow(''),
    city: Joi.string().max(100).optional().allow(''),
    province: Joi.string().max(100).optional().allow(''),
    postalCode: Joi.string().max(20).optional().allow(''),
    taxId: Joi.string().max(50).optional().allow(''),
    paymentTerms: Joi.string().max(100).optional().allow(''),
    notes: htmlField().optional().allow(''),
    latitude: Joi.number().min(-90).max(90).optional().allow(null),
    longitude: Joi.number().min(-180).max(180).optional().allow(null),
    isActive: Joi.boolean().optional(),
    website: Joi.string().max(200).optional().allow(''),
    category: Joi.string().valid('raw_material', 'equipment', 'service', 'packaging', 'other').optional(),
    leadTimeDays: Joi.number().integer().min(0).optional().allow(null),
    minimumOrderAmount: Joi.number().min(0).optional().allow(null),
    rating: Joi.number().min(1).max(5).optional().allow(null),
    bankName: Joi.string().max(100).optional().allow(''),
    bankAccount: Joi.string().max(50).pattern(/^\d*$/).optional().allow(''),
    registrationNumber: Joi.string().max(50).optional().allow(''),
  }),

  // ─── Customer ───────────────────────────────────────────
  createCustomer: Joi.object({
    firstName: htmlField().min(2).max(100).required(),
    lastName: htmlField().min(2).max(100).required(),
    email: Joi.string().email().max(150).optional().allow(''),
    phone: Joi.string().min(7).max(20).optional().allow(''),
    mobile: Joi.string().max(20).optional().allow(''),
    address: htmlField().optional().allow(''),
    city: Joi.string().max(100).optional().allow(''),
    province: Joi.string().max(100).optional().allow(''),
    postalCode: Joi.string().max(20).optional().allow(''),
    birthDate: Joi.date().optional().allow(null),
    gender: Joi.string().valid('male', 'female', 'other').optional(),
    notes: htmlField().optional().allow(''),
    discountRate: Joi.number().min(0).max(100).optional().default(0),
  }),

  updateCustomer: Joi.object({
    firstName: htmlField().min(2).max(100).optional(),
    lastName: htmlField().min(2).max(100).optional(),
    email: Joi.string().email().max(150).optional().allow(''),
    phone: Joi.string().min(7).max(20).optional().allow(''),
    mobile: Joi.string().max(20).optional().allow(''),
    address: htmlField().optional().allow(''),
    city: Joi.string().max(100).optional().allow(''),
    province: Joi.string().max(100).optional().allow(''),
    postalCode: Joi.string().max(20).optional().allow(''),
    birthDate: Joi.date().optional().allow(null),
    gender: Joi.string().valid('male', 'female', 'other').optional(),
    notes: htmlField().optional().allow(''),
    discountRate: Joi.number().min(0).max(100).optional(),
    loyaltyPoints: Joi.number().integer().min(0).optional(),
    isActive: Joi.boolean().optional(),
  }),

  // ─── Sale ───────────────────────────────────────────────
  createSale: Joi.object({
    customerId: Joi.number().integer().positive().optional().allow(null),
    items: Joi.array()
      .items(
        Joi.object({
          productId: Joi.number().integer().positive().required(),
          quantity: Joi.number().integer().min(1).required(),
          discountType: discountTypeField,
          discountValue: Joi.number().min(0).optional().default(0),
        })
      )
      .min(1)
      .required(),
    discountType: discountTypeField,
    discountValue: Joi.number().min(0).optional().default(0),
    discountId: Joi.number().integer().positive().allow(null).optional(),
    paymentMethod: Joi.string()
      .valid('cash', 'gcash', 'maya', 'credit_card', 'debit_card', 'bank_transfer', 'other', 'split')
      .required(),
    paymentReference: Joi.string().optional().allow(''),
    cashAmount: Joi.number().min(0).optional(),
    // Split payment: 2+ legs whose amounts sum exactly to the total.
    // The overall paymentMethod must be 'split' when this is provided.
    payments: Joi.array()
      .items(
        Joi.object({
          paymentMethod: Joi.string().valid('cash', 'gcash', 'maya', 'credit_card', 'debit_card', 'bank_transfer', 'other').required(),
          amount: Joi.number().positive().required(),
          reference: Joi.string().optional().allow(''),
        })
      )
      .min(2)
      .max(6)
      .optional(),
    shippingFee: Joi.number().min(0).optional().default(0),
    notes: htmlField().optional().allow(''),
  }).custom((value) => {
    if (value.paymentMethod === 'split' && (!value.payments || value.payments.length < 2)) {
      throw new Error('Split payment requires at least two legs in payments[]');
    }
    return value;
  }, 'split legs'),

  // Refund a completed sale: omit items for a full refund; otherwise list
  // per-line quantities. Reason is always required (audit trail).
  refundSale: Joi.object({
    items: Joi.array()
      .items(
        Joi.object({
          saleItemId: Joi.number().integer().positive().required(),
          quantity: Joi.number().integer().positive().required(),
        })
      )
      .max(50)
      .optional(),
    reason: Joi.string().trim().min(3).max(500).required(),
  }),

  // ─── Purchase ───────────────────────────────────────────
  createPurchase: Joi.object({
    supplierId: Joi.number().integer().positive().required(),
    orderDate: Joi.date().optional(),
    expectedDate: Joi.date().optional().allow(null),
    items: Joi.array()
      .items(
        Joi.object({
          productId: Joi.number().integer().positive().required(),
          quantity: Joi.number().integer().min(1).required(),
          unitCost: Joi.number().min(0).required(),
          discount: Joi.number().min(0).optional().default(0),
          taxRate: Joi.number().min(0).max(100).optional().default(0),
          expiryDate: Joi.date().optional().allow(null),
        })
      )
      .min(1)
      .required(),
    discount: Joi.number().min(0).optional().default(0),
    shippingFee: Joi.number().min(0).optional().default(0),
    notes: htmlField().optional().allow(''),
  }),

  payPurchase: Joi.object({
    amount: Joi.number().positive().required(),
    fundId: Joi.number().integer().positive().optional().allow(null),
    // Recorded on the purchase so the payment method is auditable; petty_cash
    // is derived from fundId and must not be sent directly.
    paymentSource: Joi.string()
      .valid('cash', 'bank_transfer', 'credit', 'other')
      .optional(),
  }),

  // ─── Inventory ──────────────────────────────────────────
  stockIn: Joi.object({
    productId: Joi.number().integer().positive().required(),
    quantity: Joi.number().integer().min(1).required(),
    notes: htmlField().optional().allow(''),
  }),

  stockOut: Joi.object({
    productId: Joi.number().integer().positive().required(),
    quantity: Joi.number().integer().min(1).required(),
    notes: htmlField().optional().allow(''),
  }),

  adjustStock: Joi.object({
    productId: Joi.number().integer().positive().required(),
    newQuantity: Joi.number().integer().min(0).required(),
    reason: htmlField().optional().allow(''),
    type: Joi.string().valid('adjustment', 'damage', 'expired').optional().default('adjustment'),
  }),

  // ─── Expense ────────────────────────────────────────────
  createExpense: Joi.object({
    expenseCategoryId: Joi.number().integer().positive().required(),
    amount: Joi.number().min(0).required(),
    description: htmlField().optional().allow(''),
    reference: Joi.string().max(100).optional().allow(''),
    expenseDate: Joi.date().optional(),
    paymentMethod: Joi.string()
      .valid('cash', 'gcash', 'maya', 'credit_card', 'debit_card', 'bank_transfer')
      .optional()
      .default('cash'),
    isRecurring: Joi.boolean().optional().default(false),
    recurringInterval: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly').optional(),
    notes: htmlField().optional().allow(''),
  }),

  updateExpense: Joi.object({
    expenseCategoryId: Joi.number().integer().positive().optional(),
    amount: Joi.number().min(0).optional(),
    description: htmlField().optional().allow(''),
    reference: Joi.string().max(100).optional().allow(''),
    expenseDate: Joi.date().optional(),
    paymentMethod: Joi.string()
      .valid('cash', 'gcash', 'maya', 'credit_card', 'debit_card', 'bank_transfer')
      .optional(),
    isRecurring: Joi.boolean().optional(),
    recurringInterval: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly').optional(),
    notes: htmlField().optional().allow(''),
  }),

  // ─── Expense Category ───────────────────────────────────
  createExpenseCategory: Joi.object({
    name: htmlField().min(2).max(100).required(),
    description: htmlField().optional().allow(''),
  }),

  // ─── Notification ───────────────────────────────────────
  markRead: Joi.object({
    ids: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
  }),

  // ─── User (admin) ──────────────────────────────────────
  updateUser: Joi.object({
    firstName: htmlField().min(2).max(100).optional(),
    lastName: htmlField().min(2).max(100).optional(),
    email: Joi.string().email().max(150).optional(),
    phone: Joi.string().min(7).max(20).optional().allow(''),
    roleId: Joi.number().integer().positive().optional(),
    branchId: Joi.number().integer().positive().optional().allow(null),
    reportsToId: Joi.number().integer().positive().optional().allow(null),
    isActive: Joi.boolean().optional(),
    password: Joi.string().min(8).max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .messages({ 'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number' })
      .optional(),
  }),

  // ─── Discount ──────────────────────────────────────────
  createDiscount: Joi.object({
    code: Joi.string().min(2).max(50).required(),
    name: htmlField().min(2).max(100).required(),
    description: htmlField().optional().allow(''),
    type: Joi.string().valid('percentage', 'fixed').required(),
    value: Joi.number().min(0).required(),
    minPurchaseAmount: Joi.number().min(0).optional().allow(null),
    maxDiscountAmount: Joi.number().min(0).optional().allow(null),
    usageLimit: Joi.number().integer().min(1).optional().allow(null),
    startDate: Joi.date().optional().allow(null),
    endDate: Joi.date().optional().allow(null),
    isActive: Joi.boolean().optional(),
  }),

  updateDiscount: Joi.object({
    code: Joi.string().min(2).max(50).optional(),
    name: htmlField().min(2).max(100).optional(),
    description: htmlField().optional().allow(''),
    type: Joi.string().valid('percentage', 'fixed').optional(),
    value: Joi.number().min(0).optional(),
    minPurchaseAmount: Joi.number().min(0).optional().allow(null),
    maxDiscountAmount: Joi.number().min(0).optional().allow(null),
    usageLimit: Joi.number().integer().min(1).optional().allow(null),
    startDate: Joi.date().optional().allow(null),
    endDate: Joi.date().optional().allow(null),
    isActive: Joi.boolean().optional(),
  }),

  // ─── Petty Cash ─────────────────────────────────────────
  createPettyCashFund: Joi.object({
    name: htmlField().min(2).max(200).required(),
    description: htmlField().optional().allow(''),
    initialBalance: Joi.number().min(0).optional().default(0),
  }),

  updatePettyCashFund: Joi.object({
    name: htmlField().min(2).max(200).optional(),
    description: htmlField().optional().allow(''),
  }),

  pettyCashDeposit: Joi.object({
    amount: Joi.number().positive().required(),
    description: htmlField().optional().allow(''),
    referenceType: Joi.string().max(50).optional().allow(''),
    referenceId: Joi.number().integer().positive().optional(),
  }),

  pettyCashWithdraw: Joi.object({
    amount: Joi.number().positive().required(),
    description: htmlField().optional().allow(''),
    referenceType: Joi.string().max(50).optional().allow(''),
    referenceId: Joi.number().integer().positive().optional(),
  }),

  // ─── Branch ─────────────────────────────────────────────
  createBranch: Joi.object({
    name: htmlField().min(2).max(100).required(),
    code: Joi.string().max(20).optional().allow(''),
    address: htmlField().max(255).optional().allow(''),
    city: htmlField().max(100).optional().allow(''),
    province: htmlField().max(100).optional().allow(''),
    phone: Joi.string().min(7).max(20).optional().allow(''),
    email: Joi.string().email().max(150).optional().allow(''),
    latitude: Joi.number().min(-90).max(90).optional().allow(null),
    longitude: Joi.number().min(-180).max(180).optional().allow(null),
    geofenceRadiusMeters: Joi.number().integer().min(10).max(100000).optional().allow(null),
    enforceGeofence: Joi.boolean().optional(),
  }),

  updateBranch: Joi.object({
    name: htmlField().min(2).max(100).optional(),
    code: Joi.string().max(20).optional().allow(''),
    address: htmlField().max(255).optional().allow(''),
    city: htmlField().max(100).optional().allow(''),
    province: htmlField().max(100).optional().allow(''),
    phone: Joi.string().min(7).max(20).optional().allow(''),
    email: Joi.string().email().max(150).optional().allow(''),
    latitude: Joi.number().min(-90).max(90).optional().allow(null),
    longitude: Joi.number().min(-180).max(180).optional().allow(null),
    geofenceRadiusMeters: Joi.number().integer().min(10).max(100000).optional().allow(null),
    enforceGeofence: Joi.boolean().optional(),
    isActive: Joi.boolean().optional(),
  }),

  // ─── Shifts ─────────────────────────────────────────────
  openShift: Joi.object({
    openingFloat: Joi.number().min(0).optional().default(0),
  }),
  closeShift: Joi.object({
    countedCash: Joi.number().min(0).required(),
    notes: Joi.string().max(500).optional().allow(''),
  }),

  // ─── Payment ────────────────────────────────────────────
  createCheckout: Joi.object({
    amount: Joi.number().positive().optional(),
    description: Joi.string().max(255).optional().allow(''),
    items: Joi.array().items(Joi.object({
      name: Joi.string().max(100).required(),
      amount: Joi.number().positive().optional(),
      price: Joi.number().positive().optional(),
      quantity: Joi.number().integer().min(1).required(),
    })).optional(),
    saleId: Joi.number().integer().positive().optional(),
  }),

  // ─── Settings ───────────────────────────────────────────
  updateSettings: Joi.object({
    storeName: htmlField().max(100).optional(),
    address: Joi.string().allow('').max(255).optional(),
    phone: Joi.string().allow('').max(50).optional(),
    gcashNumber: Joi.string().allow('').max(50).optional(),
    mayaNumber: Joi.string().allow('').max(50).optional(),
    storeAddress: htmlField().max(255).optional(),
    storePhone: Joi.string().max(20).optional().allow(''),
    allowPublicRegistration: Joi.boolean().optional(),
    onboardingDismissedAt: Joi.string().isoDate().allow('', null).optional(),
    storeEmail: Joi.string().email().max(150).optional().allow(''),
    taxRate: Joi.number().min(0).max(100).optional().messages({
      'number.max': 'taxRate must be a percentage between 0 and 100',
      'number.base': 'taxRate must be a number',
    }),
    currency: Joi.string().max(10).optional(),
    lowStockThreshold: Joi.number().integer().min(0).optional(),
    receiptHeader: htmlField().max(255).optional().allow(''),
    receiptFooter: htmlField().max(255).optional().allow(''),
  }),

  // ─── Admin diagnostics ────────────────────────────────────
  // Target defaults to the calling admin's own address, so a mis-click cannot
  // mail a customer. `to` is validated by the same Joi schema as any payload.
  sendTestEmail: Joi.object({
    to: Joi.string().email().max(150).optional().allow(''),
    subject: Joi.string().max(150).optional().allow(''),
    message: Joi.string().max(1000).optional().allow(''),
  }),

  // ─── Loyalty ──────────────────────────────────────────────
  redeemLoyaltyPoints: Joi.object({
    customerId: Joi.number().integer().positive().required(),
    points: Joi.number().integer().min(1).required(),
    notes: Joi.string().max(255).optional().allow(''),
  }),
};

module.exports = schemas;
