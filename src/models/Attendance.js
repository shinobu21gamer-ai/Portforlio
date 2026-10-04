module.exports = (sequelize, DataTypes) => {
  const Attendance = sequelize.define('Attendance', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.INTEGER, allowNull: false, field: 'employee_id' },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    clockIn: { type: DataTypes.DATE, allowNull: true, field: 'clock_in' },
    clockOut: { type: DataTypes.DATE, allowNull: true, field: 'clock_out' },
    status: {
      type: DataTypes.ENUM('present', 'absent', 'late', 'undertime', 'half-day', 'on-leave'),
      allowNull: false,
      defaultValue: 'present',
    },
    totalHours: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0, field: 'total_hours' },
    // Where the employee was when they clocked in, and how far that was from
    // the branch. Recorded even when the branch does not enforce a geofence, so
    // a suspicious clock-in is still reviewable after the fact.
    clockInLat: { type: DataTypes.DECIMAL(10, 7), allowNull: true, field: 'clock_in_lat' },
    clockInLng: { type: DataTypes.DECIMAL(10, 7), allowNull: true, field: 'clock_in_lng' },
    geofenceDistanceMeters: { type: DataTypes.INTEGER, allowNull: true, field: 'geofence_distance_meters' },
    isGeofenceVerified: { type: DataTypes.BOOLEAN, allowNull: true, field: 'is_geofence_verified' },
    overtime: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    nightShiftHours: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0, field: 'night_shift_hours' },
    mealBreakMinutes: { type: DataTypes.INTEGER, defaultValue: 60, field: 'meal_break_minutes' },
    lateMinutes: { type: DataTypes.INTEGER, defaultValue: 0, field: 'late_minutes' },
    isRestDay: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_rest_day' },
    holidayType: {
      type: DataTypes.ENUM('none', 'regular', 'special'),
      allowNull: false,
      defaultValue: 'none',
      field: 'holiday_type',
    },
    isOvertimeApproved: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_overtime_approved' },
    notes: { type: DataTypes.TEXT, allowNull: true },
  }, {
    tableName: 'attendances',
    underscored: true,
    paranoid: true,
    indexes: [
      { fields: ['employee_id', 'date'], unique: true },
    ],
  });

  Attendance.associate = (models) => {
    Attendance.belongsTo(models.Employee, { foreignKey: 'employee_id', as: 'employee' });
  };

  return Attendance;
};
