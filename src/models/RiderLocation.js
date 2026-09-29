module.exports = (sequelize, DataTypes) => {
  const RiderLocation = sequelize.define('RiderLocation', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    deliveryId: { type: DataTypes.INTEGER, allowNull: false },
    riderId: { type: DataTypes.STRING(50), allowNull: true },
    lat: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
    lng: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
  }, {
    tableName: 'rider_locations',
    underscored: true,
    timestamps: true,
  });

  RiderLocation.associate = (models) => {
    RiderLocation.belongsTo(models.Delivery, { foreignKey: 'deliveryId', as: 'delivery' });
  };

  return RiderLocation;
};
