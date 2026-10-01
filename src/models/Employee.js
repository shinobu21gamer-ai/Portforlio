module.exports = (sequelize, DataTypes) => {
  const SENSITIVE_FIELDS = [
    'tinNumber', 'sssNumber', 'philHealthNumber', 'pagIbigNumber',
    'bankAccountNumber', 'birthDate', 'civilStatus', 'address',
    'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation',
  ];

  const Employee = sequelize.define('Employee', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeNo: { type: DataTypes.STRING(50), allowNull: false, unique: true, field: 'employee_no' },
    firstName: { type: DataTypes.STRING(100), allowNull: false, field: 'first_name' },
    middleName: { type: DataTypes.STRING(100), allowNull: true, field: 'middle_name' },
    lastName: { type: DataTypes.STRING(100), allowNull: false, field: 'last_name' },
    email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    civilStatus: { type: DataTypes.ENUM('single', 'married', 'widowed', 'separated', 'divorced'), allowNull: true, field: 'civil_status' },
    nationality: { type: DataTypes.STRING(50), allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    gender: { type: DataTypes.ENUM('male', 'female', 'other'), allowNull: true },
    birthDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'birth_date' },
    hireDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'hire_date' },
    regularizationDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'regularization_date' },
    probationaryEndDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'probationary_end_date' },
    departmentId: { type: DataTypes.INTEGER, allowNull: true, field: 'department_id' },
    positionId: { type: DataTypes.INTEGER, allowNull: true, field: 'position_id' },
    reportsToId: { type: DataTypes.INTEGER, allowNull: true, field: 'reports_to_id' },
    salary: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    scheduleId: { type: DataTypes.INTEGER, allowNull: true, field: 'schedule_id' },
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
    tinNumber: { type: DataTypes.STRING(20), allowNull: true, field: 'tin_number' },
    sssNumber: { type: DataTypes.STRING(20), allowNull: true, field: 'sss_number' },
    philHealthNumber: { type: DataTypes.STRING(20), allowNull: true, field: 'phil_health_number' },
    pagIbigNumber: { type: DataTypes.STRING(20), allowNull: true, field: 'pag_ibig_number' },
    bankName: { type: DataTypes.STRING(100), allowNull: true, field: 'bank_name' },
    bankAccountNumber: { type: DataTypes.STRING(50), allowNull: true, field: 'bank_account_number' },
    emergencyContactName: { type: DataTypes.STRING(150), allowNull: true, field: 'emergency_contact_name' },
    emergencyContactPhone: { type: DataTypes.STRING(20), allowNull: true, field: 'emergency_contact_phone' },
    emergencyContactRelation: { type: DataTypes.STRING(50), allowNull: true, field: 'emergency_contact_relation' },
    educationLevel: { type: DataTypes.STRING(100), allowNull: true, field: 'education_level' },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'inactive', 'on-leave'),
      allowNull: false,
      defaultValue: 'pending',
    },
    terminationType: { type: DataTypes.ENUM('resignation', 'for-cause', 'end-of-contract', 'retrenchment', 'retirement'), allowNull: true, field: 'termination_type' },
    terminationDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'termination_date' },
    approvedAt: { type: DataTypes.DATE, allowNull: true, field: 'approved_at' },
    avatar: { type: DataTypes.STRING(255), allowNull: true },
    userId: { type: DataTypes.INTEGER, allowNull: true, field: 'user_id' },
  }, {
    tableName: 'employees',
    underscored: true,
    paranoid: true,
    defaultScope: {
      attributes: { exclude: SENSITIVE_FIELDS },
    },
    scopes: {
      withSensitive: {
        attributes: { include: SENSITIVE_FIELDS },
      },
    },
  });

  Employee.SENSITIVE_FIELDS = SENSITIVE_FIELDS;

  Employee.associate = (models) => {
    Employee.belongsTo(models.Department, { foreignKey: 'department_id', as: 'department' });
    Employee.belongsTo(models.Position, { foreignKey: 'position_id', as: 'position' });
    Employee.belongsTo(models.Schedule, { foreignKey: 'schedule_id', as: 'schedule' });
    Employee.hasMany(models.Attendance, { foreignKey: 'employee_id', as: 'attendance' });
    Employee.hasMany(models.ShiftAssignment, { foreignKey: 'employee_id', as: 'shiftAssignments' });
    Employee.hasMany(models.Payslip, { foreignKey: 'employee_id', as: 'payslips' });
    Employee.hasMany(models.Contract, { foreignKey: 'employee_id', as: 'contracts' });
    Employee.hasMany(models.LeaveRequest, { foreignKey: 'employee_id', as: 'leaves' });
    Employee.hasMany(models.LeaveBalance, { foreignKey: 'employee_id', as: 'leaveBalances' });
    Employee.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Employee.belongsTo(models.Employee, { foreignKey: 'reports_to_id', as: 'reportsTo' });
  };

  return Employee;
};
