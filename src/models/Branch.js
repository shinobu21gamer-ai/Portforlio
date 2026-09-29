module.exports = (sequelize, DataTypes) => {
  const Branch = sequelize.define('Branch', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
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
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    managerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'manager_id',
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
  }, {
    tableName: 'branches',
    underscored: true,
    paranoid: true,
  });

  Branch.associate = (models) => {
    Branch.belongsTo(models.User, { foreignKey: 'managerId', as: 'manager' });
    Branch.hasMany(models.Product, { foreignKey: 'branchId', as: 'products' });
    Branch.hasMany(models.Sale, { foreignKey: 'branchId', as: 'sales' });
    Branch.hasMany(models.User, { foreignKey: 'branchId', as: 'users' });
  };

  return Branch;
};
