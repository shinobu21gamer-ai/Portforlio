module.exports = (sequelize, DataTypes) => {
  const Supplier = sequelize.define('Supplier', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    contactPerson: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'contact_person',
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    mobile: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    province: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    postalCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'postal_code',
    },
    taxId: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'tax_id',
    },
    paymentTerms: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'payment_terms',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
    },
    website: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'other',
    },
    leadTimeDays: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'lead_time_days',
    },
    minimumOrderAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'minimum_order_amount',
    },
    rating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },
    bankName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'bank_name',
    },
    bankAccount: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'bank_account',
    },
    registrationNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'registration_number',
    },
  }, {
    tableName: 'suppliers',
    underscored: true,
    paranoid: true,
  });

  Supplier.associate = (models) => {
    Supplier.hasMany(models.Purchase, { foreignKey: 'supplier_id', as: 'purchases' });
  };

  return Supplier;
};
