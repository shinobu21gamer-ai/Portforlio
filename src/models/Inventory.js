module.exports = (sequelize, DataTypes) => {
  const Inventory = sequelize.define('Inventory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'product_id',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },
    type: {
      type: DataTypes.ENUM('stock_in', 'stock_out', 'adjustment', 'sale', 'purchase', 'return', 'damage', 'expired'),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    previousStock: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'previous_stock',
    },
    currentStock: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'current_stock',
    },
    referenceType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'reference_type',
    },
    referenceId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'reference_id',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'inventories',
    underscored: true,
  });

  Inventory.associate = (models) => {
    Inventory.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
    Inventory.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return Inventory;
};
