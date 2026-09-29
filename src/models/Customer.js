module.exports = (sequelize, DataTypes) => {
  const Customer = sequelize.define('Customer', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'first_name',
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'last_name',
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
      unique: true,
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
    birthDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'birth_date',
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other'),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    loyaltyPoints: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'loyalty_points',
    },
    totalPurchases: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      field: 'total_purchases',
    },
    visitCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'visit_count',
    },
    lastVisit: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_visit',
    },
    discountRate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      field: 'discount_rate',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
    },
  }, {
    tableName: 'customers',
    underscored: true,
    paranoid: true,
  });

  Customer.associate = (models) => {
    Customer.hasMany(models.Sale, { foreignKey: 'customer_id', as: 'sales' });
    Customer.hasMany(models.LoyaltyPoint, { foreignKey: 'customer_id', as: 'loyaltyPointLogs' });
  };

  return Customer;
};
