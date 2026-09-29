module.exports = (sequelize, DataTypes) => {
  const ExpenseCategory = sequelize.define('ExpenseCategory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
    },
  }, {
    tableName: 'expense_categories',
    underscored: true,
    paranoid: true,
  });

  ExpenseCategory.associate = (models) => {
    ExpenseCategory.hasMany(models.Expense, { foreignKey: 'expense_category_id', as: 'expenses' });
  };

  return ExpenseCategory;
};
