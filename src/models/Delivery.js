module.exports = (sequelize, DataTypes) => {
  const Delivery = sequelize.define('Delivery', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    orderType: { type: DataTypes.ENUM('purchase', 'sale'), allowNull: false },
    orderId: { type: DataTypes.INTEGER, allowNull: false },
    supplierId: { type: DataTypes.INTEGER, allowNull: true },
    customerId: { type: DataTypes.INTEGER, allowNull: true },
    riderId: { type: DataTypes.STRING(50), allowNull: true },
    destinationLat: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    destinationLng: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    status: { type: DataTypes.ENUM('pending', 'in_transit', 'delivered', 'cancelled'), defaultValue: 'pending' },
  }, {
    tableName: 'deliveries',
    underscored: true,
    timestamps: true,
  });

  Delivery.associate = (models) => {
    Delivery.belongsTo(models.Purchase, { foreignKey: 'orderId', as: 'purchase' });
    Delivery.belongsTo(models.Supplier, { foreignKey: 'supplierId', as: 'supplier' });
    Delivery.hasMany(models.RiderLocation, { foreignKey: 'deliveryId', as: 'locations' });
  };

  return Delivery;
};
