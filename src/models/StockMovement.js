module.exports = (sequelize, DataTypes) => {
  const StockMovement = sequelize.define('StockMovement', {
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
      type: DataTypes.ENUM('in', 'out', 'adjustment'),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    previousStock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'previous_stock',
    },
    newStock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'new_stock',
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
    tableName: 'stock_movements',
    underscored: true,
    indexes: [
      { fields: ['product_id'] },
      { fields: ['created_at'] },
    ],
  });

  StockMovement.associate = (models) => {
    StockMovement.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
    StockMovement.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return StockMovement;
};
