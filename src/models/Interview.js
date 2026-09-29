module.exports = (sequelize, DataTypes) => {
  const Interview = sequelize.define('Interview', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    applicationId: { type: DataTypes.INTEGER, allowNull: false, field: 'application_id' },
    type: {
      type: DataTypes.ENUM('initial', 'final'),
      allowNull: false,
    },
    scheduledDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'scheduled_date' },
    scheduledTime: { type: DataTypes.STRING(10), allowNull: false, field: 'scheduled_time' },
    interviewer: { type: DataTypes.STRING(150), allowNull: false },
    location: { type: DataTypes.STRING(255), allowNull: true },
    latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    result: {
      type: DataTypes.ENUM('pending', 'pass', 'fail', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    feedback: { type: DataTypes.TEXT, allowNull: true },
    conductedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'conducted_by' },
  }, {
    tableName: 'interviews',
    underscored: true,
    paranoid: true,
  });

  Interview.associate = (models) => {
    Interview.belongsTo(models.JobApplication, { foreignKey: 'application_id', as: 'application' });
  };

  return Interview;
};
