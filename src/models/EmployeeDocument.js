module.exports = (sequelize, DataTypes) => {
  const EmployeeDocument = sequelize.define('EmployeeDocument', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    employeeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'employee_id',
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'other',
    },
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'original_name',
    },
    filename: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'mime_type',
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    uploadedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'uploaded_by',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'employee_documents',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['employee_id'] },
      { fields: ['type'] },
    ],
  });

  EmployeeDocument.associate = (models) => {
    EmployeeDocument.belongsTo(models.Employee, { foreignKey: 'employee_id', as: 'employee' });
    EmployeeDocument.belongsTo(models.User, { foreignKey: 'uploaded_by', as: 'uploader' });
  };

  return EmployeeDocument;
};
