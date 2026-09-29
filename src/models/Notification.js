module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'user_id',
    },
    type: {
      type: DataTypes.ENUM(
        'low_stock',
        'expiring_product',
        'new_purchase',
        'new_sale',
        'payment_received',
        'system',
        'stock_adjustment',
        'refund',
        'hrms_leave_request',
        'hrms_leave_approved',
        'hrms_leave_rejected',
        'hrms_interview_scheduled',
        'hrms_application_status',
        'hrms_employee_approved',
        'hrms_contract_terminated',
        'hrms_payroll_generated',
        'hrms_payroll_paid'
      ),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    data: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_read',
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'read_at',
    },
  }, {
    tableName: 'notifications',
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['is_read'] },
      { fields: ['created_at'] },
    ],
  });

  Notification.associate = (models) => {
    Notification.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return Notification;
};
