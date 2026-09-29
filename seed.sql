-- Seed data for Cloudflare D1
INSERT OR IGNORE INTO roles (id, name, slug) VALUES
(1, 'Admin', 'admin'),
(2, 'Manager', 'manager'),
(3, 'Cashier', 'cashier'),
(4, 'Inventory Staff', 'inventory_staff'),
(5, 'HR', 'hr');

-- Admin user (password: admin123)
INSERT OR IGNORE INTO users (first_name, last_name, email, password, role_id, is_active) VALUES
('Maria', 'Santos', 'admin@minimart.com', '$2a$10$8K1p/a0dURXAm7QiTRqUzuJ1XvQGZzWjJrYqKJzMxJpKjYqJzJzJzJ', 1, 1),
('Carlos', 'Garcia', 'manager@minimart.com', '$2a$10$8K1p/a0dURXAm7QiTRqUzuJ1XvQGZzWjJrYqKJzMxJpKjYqJzJzJzJ', 2, 1),
('Joy', 'Dela Cruz', 'cashier@minimart.com', '$2a$10$8K1p/a0dURXAm7QiTRqUzuJ1XvQGZzWjJrYqKJzMxJpKjYqJzJzJzJ', 3, 1);

-- Categories
INSERT OR IGNORE INTO categories (name, slug) VALUES
('Beverages', 'beverages'),
('Snacks', 'snacks'),
('Dairy', 'dairy'),
('Bread & Bakery', 'bread-bakery'),
('Meat & Seafood', 'meat-seafood'),
('Fruits & Vegetables', 'fruits-vegetables'),
('Rice & Grains', 'rice-grains'),
('Canned Goods', 'canned-goods'),
('Condiments & Sauces', 'condiments-sauces'),
('Frozen Foods', 'frozen-foods');

-- Expense categories
INSERT OR IGNORE INTO expense_categories (name, slug) VALUES
('Rent', 'rent'),
('Utilities', 'utilities'),
('Salaries', 'salaries'),
('Supplies', 'supplies'),
('Maintenance', 'maintenance'),
('Marketing', 'marketing'),
('Transportation', 'transportation'),
('Miscellaneous', 'miscellaneous');