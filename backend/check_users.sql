-- Verificar usuarios en la BD
SELECT id, username, email, password_hash, role, active, created_at, updated_at 
FROM users;

-- Verificar específicamente nuestros usuarios de prueba
SELECT email, username, password_hash, role, active 
FROM users 
WHERE email IN ('admin@uci.cu', 'professor@uci.cu', 'student@uci.cu', 'student2@uci.cu');

-- Contar total de usuarios
SELECT COUNT(*) as total_users FROM users;
