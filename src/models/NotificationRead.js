module.exports = (sequelize, DataTypes) => {
  const NotificationRead = sequelize.define('NotificationRead', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },
    notificationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'notification_id',
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'read_at',
    },
  }, {
    tableName: 'notification_reads',
    underscored: true,
    timestamps: true,
    indexes: [
      { unique: true, fields: ['user_id', 'notification_id'] },
      { fields: ['user_id'] },
    ],
  });

  NotificationRead.associate = (models) => {
    NotificationRead.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    NotificationRead.belongsTo(models.Notification, { foreignKey: 'notification_id', as: 'notification' });
  };

  return NotificationRead;
};
