module.exports = (sequelize, DataTypes) => {
  const JobApplication = sequelize.define('JobApplication', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    jobId: { type: DataTypes.INTEGER, allowNull: false, field: 'job_id' },
    firstName: { type: DataTypes.STRING(100), allowNull: false, field: 'first_name' },
    middleName: { type: DataTypes.STRING(100), allowNull: true, field: 'middle_name' },
    lastName: { type: DataTypes.STRING(100), allowNull: false, field: 'last_name' },
    email: { type: DataTypes.STRING(150), allowNull: false },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    resumePath: { type: DataTypes.STRING(255), allowNull: true, field: 'resume_path' },
    coverLetter: { type: DataTypes.TEXT, allowNull: true, field: 'cover_letter' },
    status: {
      type: DataTypes.ENUM('pending', 'reviewed', 'initial-interview', 'final-interview', 'accepted', 'rejected', 'hired'),
      allowNull: false,
      defaultValue: 'pending',
    },
    notes: { type: DataTypes.TEXT, allowNull: true },
  }, {
    tableName: 'job_applications',
    underscored: true,
    paranoid: true,
  });

  JobApplication.associate = (models) => {
    JobApplication.belongsTo(models.JobPosting, { foreignKey: 'job_id', as: 'job' });
    JobApplication.hasMany(models.Interview, { foreignKey: 'application_id', as: 'interviews' });
  };

  return JobApplication;
};
