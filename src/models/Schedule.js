module.exports = (sequelize, DataTypes) => {
  const Schedule = sequelize.define('Schedule', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    startTime: { type: DataTypes.TIME, allowNull: false, field: 'start_time' },
    endTime: { type: DataTypes.TIME, allowNull: false, field: 'end_time' },
    daysOfWeek: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '1,2,3,4,5',
      field: 'days_of_week',
      get() {
        const raw = this.getDataValue('daysOfWeek');
        if (!raw) return [1,2,3,4,5];
        return raw.split(',').map(Number);
      },
      set(val) {
        this.setDataValue('daysOfWeek', Array.isArray(val) ? val.join(',') : val);
      },
    },
    breakMinutes: { type: DataTypes.INTEGER, defaultValue: 60, field: 'break_minutes' },
    description: { type: DataTypes.TEXT, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, {
    tableName: 'schedules',
    underscored: true,
    paranoid: true,
  });

  Schedule.associate = (models) => {
    Schedule.hasMany(models.ShiftAssignment, { foreignKey: 'schedule_id', as: 'assignments' });
  };

  return Schedule;
};
