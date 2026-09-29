module.exports = (sequelize, DataTypes) => {
  const Expense = sequelize.define('Expense', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    expenseCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'expense_category_id',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    expenseDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'expense_date',
    },
    paymentMethod: {
      type: DataTypes.ENUM('cash', 'gcash', 'maya', 'credit_card', 'debit_card', 'bank_transfer'),
      allowNull: true,
      defaultValue: 'cash',
      field: 'payment_method',
    },
    isRecurring: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_recurring',
    },
    recurringInterval: {
      type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'yearly'),
      allowNull: true,
      field: 'recurring_interval',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'expenses',
    underscored: true,
    paranoid: true,
    indexes: [
      { fields: ['expense_date'] },
      { fields: ['expense_category_id'] },
    ],
  });

  Expense.associate = (models) => {
    Expense.belongsTo(models.ExpenseCategory, { foreignKey: 'expense_category_id', as: 'category' });
    Expense.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return Expense;
};
