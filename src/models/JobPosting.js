module.exports = (sequelize, DataTypes) => {
  const JobPosting = sequelize.define('JobPosting', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(150), allowNull: false },
    departmentId: { type: DataTypes.INTEGER, allowNull: false, field: 'department_id' },
    positionId: { type: DataTypes.INTEGER, allowNull: true, field: 'position_id' },
    description: { type: DataTypes.TEXT, allowNull: false },
    requirements: { type: DataTypes.TEXT, allowNull: true },
    salaryMin: { type: DataTypes.DECIMAL(15, 2), allowNull: true, field: 'salary_min' },
    salaryMax: { type: DataTypes.DECIMAL(15, 2), allowNull: true, field: 'salary_max' },
    employmentType: {
      type: DataTypes.ENUM('full-time', 'part-time', 'contract'),
      allowNull: false,
      defaultValue: 'full-time',
      field: 'employment_type',
    },
    paymentFrequency: {
      type: DataTypes.ENUM('monthly', 'semi-monthly'),
      allowNull: false,
      defaultValue: 'monthly',
      field: 'payment_frequency',
    },
    openings: { type: DataTypes.INTEGER, defaultValue: 1 },
    scheduleId: { type: DataTypes.INTEGER, allowNull: true, field: 'schedule_id' },
    status: {
      type: DataTypes.ENUM('pending', 'open', 'closed', 'filled', 'rejected'),
      allowNull: false,
      defaultValue: 'pending',
    },
    approvedAt: { type: DataTypes.DATE, allowNull: true, field: 'approved_at' },
    closingDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'closing_date' },
    location: { type: DataTypes.STRING(100), allowNull: true },
    postedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'posted_by' },
  }, {
    tableName: 'job_postings',
    underscored: true,
    paranoid: true,
  });

  JobPosting.associate = (models) => {
    JobPosting.belongsTo(models.Department, { foreignKey: 'department_id', as: 'department' });
    JobPosting.belongsTo(models.Position, { foreignKey: 'position_id', as: 'position' });
    JobPosting.belongsTo(models.Schedule, { foreignKey: 'schedule_id', as: 'schedule' });
    JobPosting.hasMany(models.JobApplication, { foreignKey: 'job_id', as: 'applications' });
  };

  return JobPosting;
};
