module.exports = (sequelize, DataTypes) => {
  const ActivityLog = sequelize.define('ActivityLog', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'user_id',
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    module: {
      type: DataTypes.STRING(50),
      allowNull: false,
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
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    requestMethod: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'request_method',
    },
    requestUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'request_url',
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ip_address',
    },
    userAgent: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'user_agent',
    },
    oldData: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'old_data',
    },
    newData: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'new_data',
    },
  }, {
    tableName: 'activity_logs',
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['action'] },
      { fields: ['module'] },
      { fields: ['reference_type', 'reference_id'] },
      { fields: ['created_at'] },
    ],
  });

  ActivityLog.associate = (models) => {
    ActivityLog.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return ActivityLog;
};
