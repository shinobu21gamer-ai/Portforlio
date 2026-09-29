DELETE FROM users;

INSERT INTO users (first_name, last_name, email, password, role_id, is_active, created_at, updated_at) VALUES
('Maria', 'Santos', 'admin@minimart.com', 'TMP_HASH', 1, 1, datetime('now'), datetime('now')),
('Carlos', 'Garcia', 'manager@minimart.com', 'TMP_HASH', 2, 1, datetime('now'), datetime('now')),
('Joy', 'Dela Cruz', 'cashier@minimart.com', 'TMP_HASH', 3, 1, datetime('now'), datetime('now'));