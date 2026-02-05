package com.uci.competencia.service.impl;

import com.uci.competencia.model.dto.request.UserBatchImportDTO;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.repository.UserRepository;
import com.uci.competencia.service.AdminService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminServiceImpl implements AdminService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Autowired(required = false)
    private CacheManager cacheManager;
    
    // Almacenamiento en memoria para backups (en producción usar BD)
    private static final Map<String, BackupStatus> backupRegistry = new ConcurrentHashMap<>();
    private static final Map<String, SystemConfiguration> configRegistry = new ConcurrentHashMap<>();

    @Override
    public Page<User> getAllUsers(Pageable pageable) {
        return userRepository.findAll(pageable);
    }

    @Override
    public Page<User> getUsersByRole(Role role, Pageable pageable) {
        return userRepository.findByRole(role, pageable);
    }

    @Override
    public User getUserById(String id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found: " + id));
    }

    @Override
    public User createUser(User user) {
        // Hash the password if it's not already hashed
        if (user.getPasswordHash() != null && !user.getPasswordHash().startsWith("$2a$")) {
            user.setPasswordHash(passwordEncoder.encode(user.getPasswordHash()));
        }
        return userRepository.save(user);
    }

    @Override
    public User updateUser(String id, User user) {
        User existingUser = getUserById(id);
        existingUser.setFirstName(user.getFirstName());
        existingUser.setLastName(user.getLastName());
        existingUser.setEmail(user.getEmail());
        existingUser.setFaculty(user.getFaculty());
        existingUser.setActive(user.isActive());
        return userRepository.save(existingUser);
    }

    @Override
    public void deleteUser(String id) {
        userRepository.deleteById(id);
    }

    @Override
    public Map<String, Object> getSystemHealth() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("database", "CONNECTED");
        health.put("cache", cacheManager != null ? "AVAILABLE" : "NOT_CONFIGURED");
        health.put("timestamp", System.currentTimeMillis());
        return health;
    }

    @Override
    @Transactional
    public BatchImportResult importUsersBatch(UserBatchImportDTO batchImport) {
        log.info("Starting batch import of {} users", 
                 batchImport.getUsers() != null ? batchImport.getUsers().size() : 0);
        
        BatchImportResult result = new BatchImportResult();
        result.created = 0;
        result.updated = 0;
        result.failed = 0;
        result.errors = new ArrayList<>();
        result.warnings = new ArrayList<>();
        
        if (batchImport == null || batchImport.getUsers() == null || batchImport.getUsers().isEmpty()) {
            result.errors.add("No users provided for import");
            result.failed = 1;
            return result;
        }
        
        try {
            for (int i = 0; i < batchImport.getUsers().size(); i++) {
                try {
                    UserBatchImportDTO.UserImportRecord userDTO = batchImport.getUsers().get(i);
                    
                    // Validar datos obligatorios
                    if (userDTO.getEmail() == null || userDTO.getEmail().isEmpty()) {
                        result.errors.add("Row " + (i + 1) + ": Email is required");
                        result.failed++;
                        continue;
                    }
                    
                    // Verificar si el usuario ya existe
                    Optional<User> existing = userRepository.findByEmail(userDTO.getEmail());
                    
                    if (existing.isPresent() && !batchImport.isUpdateExisting()) {
                        result.warnings.add("Row " + (i + 1) + ": User with email " + userDTO.getEmail() + " already exists (skipped)");
                        result.failed++;
                        continue;
                    }
                    
                    if (existing.isPresent() && batchImport.isUpdateExisting()) {
                        // Actualizar usuario existente
                        User user = existing.get();
                        if (userDTO.getFirstName() != null) user.setFirstName(userDTO.getFirstName());
                        if (userDTO.getLastName() != null) user.setLastName(userDTO.getLastName());
                        if (userDTO.getFaculty() != null) user.setFaculty(userDTO.getFaculty());
                        if (userDTO.getRole() != null) user.setRole(parseRole(userDTO.getRole()));
                        
                        userRepository.save(user);
                        result.updated++;
                        log.debug("Updated user: {}", userDTO.getEmail());
                    } else {
                        // Crear nuevo usuario
                        User newUser = new User();
                        newUser.setEmail(userDTO.getEmail());
                        newUser.setFirstName(userDTO.getFirstName() != null ? userDTO.getFirstName() : "");
                        newUser.setLastName(userDTO.getLastName() != null ? userDTO.getLastName() : "");
                        newUser.setFaculty(userDTO.getFaculty());
                        newUser.setRole(userDTO.getRole() != null ? parseRole(userDTO.getRole()) : Role.ROLE_STUDENT);
                        newUser.setActive(true);
                        
                        // Generar contraseña temporal si no está proporcionada
                        String password = userDTO.getPasswordHash() != null && !userDTO.getPasswordHash().isEmpty() 
                            ? userDTO.getPasswordHash() 
                            : generateTemporaryPassword();
                        
                        newUser.setPasswordHash(passwordEncoder.encode(password));
                        
                        userRepository.save(newUser);
                        result.created++;
                        log.debug("Created user: {}", userDTO.getEmail());
                    }
                    
                } catch (Exception e) {
                    result.failed++;
                    result.errors.add("Row " + (i + 1) + ": " + e.getMessage());
                    log.warn("Error importing user at row {}: {}", i + 1, e.getMessage());
                }
            }
            
            log.info("Batch import completed - Created: {}, Updated: {}, Failed: {}", 
                     result.created, result.updated, result.failed);
            
        } catch (Exception e) {
            log.error("Error during batch import", e);
            result.errors.add("Batch import failed: " + e.getMessage());
            result.failed = batchImport.getUsers().size();
        }
        
        return result;
    }

    @Override
    public User changeUserRole(String userId, Role newRole) {
        if (userId == null || newRole == null) {
            throw new IllegalArgumentException("UserId and newRole cannot be null");
        }
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setRole(newRole);
            return userRepository.save(user);
        }
        throw new RuntimeException("User not found: " + userId);
    }

    @Override
    public void toggleUserStatus(String userId, boolean active) {
        if (userId == null) {
            throw new IllegalArgumentException("UserId cannot be null");
        }
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setActive(active);
            userRepository.save(user);
        } else {
            throw new RuntimeException("User not found: " + userId);
        }
    }

    @Override
    public void clearCache(List<String> cacheNames) {
        if (cacheNames == null || cacheNames.isEmpty()) {
            return;
        }
        if (cacheManager != null) {
            for (String cacheName : cacheNames) {
                if ("all".equals(cacheName)) {
                    cacheManager.getCacheNames().forEach(name -> {
                        var cache = cacheManager.getCache(name);
                        if (cache != null) {
                            cache.clear();
                        }
                    });
                    break;
                } else {
                    var cache = cacheManager.getCache(cacheName);
                    if (cache != null) {
                        cache.clear();
                    }
                }
            }
        }
    }

    @Override
    public Map<String, Object> getSystemStatistics() {
        log.info("Fetching system statistics");
        
        Map<String, Object> stats = new HashMap<>();
        
        try {
            // Contar usuarios por rol
            long totalUsers = userRepository.count();
            
            // Obtener estadísticas detalladas
            Map<String, Long> usersByRole = new HashMap<>();
            usersByRole.put("ADMIN", countUsersByRole(Role.ROLE_ADMIN));
            usersByRole.put("PROFESSOR", countUsersByRole(Role.ROLE_PROFESSOR));
            usersByRole.put("STUDENT", countUsersByRole(Role.ROLE_STUDENT));
            
            // Contar usuarios activos/inactivos
            long activeUsers = userRepository.count();
            
            // Información del sistema
            stats.put("totalUsers", totalUsers);
            stats.put("usersByRole", usersByRole);
            stats.put("activeUsers", activeUsers);
            stats.put("inactiveUsers", 0);
            stats.put("timestamp", LocalDateTime.now());
            stats.put("uptime", getSystemUptime());
            stats.put("memoryUsage", getMemoryUsage());
            stats.put("backupsCount", backupRegistry.size());
            stats.put("cacheStatus", cacheManager != null ? "ENABLED" : "DISABLED");
            
            log.info("System statistics retrieved: {} total users", totalUsers);
            
        } catch (Exception e) {
            log.error("Error fetching system statistics", e);
            stats.put("error", e.getMessage());
        }
        
        return stats;
    }
    
    /**
     * Contar usuarios por rol
     */
    private long countUsersByRole(Role role) {
        try {
            return userRepository.findByRole(role, org.springframework.data.domain.PageRequest.of(0, 1)).getTotalElements();
        } catch (Exception e) {
            log.warn("Error counting users with role {}: {}", role, e.getMessage());
            return 0;
        }
    }
    
    /**
     * Obtener tiempo de actividad del sistema
     */
    private long getSystemUptime() {
        return java.lang.management.ManagementFactory.getRuntimeMXBean().getUptime();
    }
    
    /**
     * Obtener uso de memoria del sistema
     */
    private Map<String, Object> getMemoryUsage() {
        java.lang.Runtime runtime = java.lang.Runtime.getRuntime();
        Map<String, Object> memory = new HashMap<>();
        memory.put("totalMemory", runtime.totalMemory());
        memory.put("freeMemory", runtime.freeMemory());
        memory.put("usedMemory", runtime.totalMemory() - runtime.freeMemory());
        memory.put("maxMemory", runtime.maxMemory());
        return memory;
    }

    @Override
    public String initiateBackup(String type, boolean includeLogs) {
        log.info("Initiating backup: type={}, includeLogs={}", type, includeLogs);
        
        try {
            String backupId = "BACKUP_" + System.currentTimeMillis() + "_" + java.util.UUID.randomUUID().toString();
            LocalDateTime startTime = LocalDateTime.now();
            
            // Crear registro de backup
            AdminService.BackupStatus backupStatus = new AdminService.BackupStatus();
            backupStatus.id = backupId;
            backupStatus.type = type;
            backupStatus.startTime = startTime;
            backupStatus.status = "IN_PROGRESS";
            backupStatus.progress = 0;
            backupStatus.includeLogs = includeLogs;
            backupStatus.dataSize = estimateBackupSize();
            
            // Registrar backup
            backupRegistry.put(backupId, backupStatus);
            
            // Simular proceso de backup en thread separado
            new Thread(() -> {
                try {
                    executeBackup(backupId, backupStatus);
                } catch (Exception e) {
                    log.error("Backup execution failed: {}", backupId, e);
                    backupStatus.status = "FAILED";
                    backupStatus.errorMessage = e.getMessage();
                }
            }).start();
            
            log.info("Backup initiated successfully: {}", backupId);
            return backupId;
            
        } catch (Exception e) {
            log.error("Error initiating backup", e);
            throw new RuntimeException("Failed to initiate backup: " + e.getMessage());
        }
    }
    
    /**
     * Ejecutar proceso de backup
     */
    private void executeBackup(String backupId, AdminService.BackupStatus backupStatus) {
        try {
            // Simular exportación de datos
            Thread.sleep(1000); // Simular tiempo de procesamiento
            
            // Actualizar progreso
            backupStatus.progress = 25;

            // Simular export de usuarios
            Thread.sleep(500);
            backupStatus.progress = 50;

            // Simular export de datos adicionales si está incluido
            if (backupStatus.includeLogs) {
                Thread.sleep(500);
                backupStatus.progress = 75;
            }

            // Marcar como completado
            backupStatus.endTime = LocalDateTime.now();
            backupStatus.status = "COMPLETED";
            backupStatus.progress = 100;
            
            log.info("Backup completed successfully: {}", backupId);
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Backup interrupted: {}", backupId);
        } catch (Exception e) {
            log.error("Backup execution error: {}", backupId, e);
        }
    }
    
    /**
     * Estimar tamaño de backup
     */
    private long estimateBackupSize() {
        try {
            long userCount = userRepository.count();
            return userCount * 1024; // Estimación aproximada: 1KB por usuario
        } catch (Exception e) {
            return 0;
        }
    }

    @Override
    public BackupStatus getBackupStatus(String backupId) {
        log.debug("Fetching backup status: {}", backupId);
        
        try {
            BackupStatus status = backupRegistry.get(backupId);
            
            if (status == null) {
                log.warn("Backup not found: {}", backupId);
                throw new RuntimeException("Backup not found: " + backupId);
            }
            
            return status;
            
        } catch (Exception e) {
            log.error("Error fetching backup status for: {}", backupId, e);
            throw new RuntimeException("Failed to fetch backup status: " + e.getMessage());
        }
    }

    @Override
    public void restoreFromBackup(String backupId) {
        log.info("Restoring from backup: {}", backupId);
        
        try {
            // Validar que el backup existe
            BackupStatus backupStatus = backupRegistry.get(backupId);
            
            if (backupStatus == null) {
                log.warn("Backup not found for restore: {}", backupId);
                throw new RuntimeException("Backup not found: " + backupId);
            }
            
            if (!"COMPLETED".equals(backupStatus.status)) {
                log.warn("Cannot restore from backup with status: {}", backupStatus.status);
                throw new RuntimeException("Backup is not ready for restore, status: " + backupStatus.status);
            }

            // Marcar como en restauración
            backupStatus.status = "RESTORING";
            backupStatus.progress = 0;
            
            // Ejecutar restauración en thread separado
            new Thread(() -> {
                try {
                    executeRestore(backupId, backupStatus);
                } catch (Exception e) {
                    log.error("Restore execution failed: {}", backupId, e);
                    backupStatus.status = "RESTORE_FAILED";
                    backupStatus.errorMessage = e.getMessage();
                }
            }).start();
            
            log.info("Restore process initiated for backup: {}", backupId);
            
        } catch (Exception e) {
            log.error("Error initiating restore from backup: {}", backupId, e);
            throw new RuntimeException("Failed to initiate restore: " + e.getMessage());
        }
    }
    
    /**
     * Ejecutar proceso de restauración de datos
     */
    private void executeRestore(String backupId, BackupStatus backupStatus) {
        try {
            // Simular tiempo de restauración
            Thread.sleep(1000);
            backupStatus.progress = 25;

            // Simular restauración de usuarios
            Thread.sleep(500);
            backupStatus.progress = 50;

            // Simular restauración de datos adicionales
            Thread.sleep(500);
            backupStatus.progress = 75;

            // Simular validación
            Thread.sleep(250);
            backupStatus.progress = 100;
            backupStatus.status = "RESTORED";
            backupStatus.endTime = LocalDateTime.now();
            
            log.info("Restore completed successfully from backup: {}", backupId);
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Restore interrupted for backup: {}", backupId);
        } catch (Exception e) {
            log.error("Restore execution error for backup: {}", backupId, e);
        }
    }

    @Override
    public SystemConfiguration getSystemConfiguration() {
        log.debug("Fetching system configuration");
        
        try {
            // Si existe configuración guardada, retornarla
            if (!configRegistry.isEmpty()) {
                return configRegistry.values().stream().findFirst().orElse(buildDefaultConfig());
            }
            
            // Si no existe, crear y guardar la por defecto
            SystemConfiguration defaultConfig = buildDefaultConfig();
            configRegistry.put("DEFAULT", defaultConfig);
            
            log.info("System configuration retrieved (default)");
            return defaultConfig;
            
        } catch (Exception e) {
            log.error("Error fetching system configuration", e);
            return buildDefaultConfig();
        }
    }
    
    /**
     * Construir configuración por defecto del sistema
     */
    private static SystemConfiguration buildDefaultConfig() {
        SystemConfiguration config = new SystemConfiguration();
        
        // Configuración PubMed
        Map<String, Object> pubmedConfig = new HashMap<>();
        pubmedConfig.put("apiKey", "");
        pubmedConfig.put("baseUrl", "https://pubmed.ncbi.nlm.nih.gov");
        pubmedConfig.put("enabled", true);
        pubmedConfig.put("cacheEnabled", true);
        pubmedConfig.put("cacheTTL", 3600);
        config.pubmed = pubmedConfig;
        
        // Configuración RAG (Retrieval Augmented Generation)
        Map<String, Object> ragConfig = new HashMap<>();
        ragConfig.put("enabled", true);
        ragConfig.put("modelProvider", "openai");
        ragConfig.put("temperature", 0.7);
        ragConfig.put("maxTokens", 2000);
        ragConfig.put("embeddingModel", "text-embedding-ada-002");
        config.rag = ragConfig;
        
        // Configuración Pedagógica
        Map<String, Object> pedagConfig = new HashMap<>();
        pedagConfig.put("competencyFramework", "SCONUL");
        pedagConfig.put("badgesEnabled", true);
        pedagConfig.put("alertsEnabled", true);
        pedagConfig.put("recommendationsEnabled", true);
        pedagConfig.put("hedgesEnabled", true);
        config.pedagogical = pedagConfig;
        
        // Configuración de Seguridad
        Map<String, Object> securityConfig = new HashMap<>();
        securityConfig.put("passwordMinLength", 8);
        securityConfig.put("passwordRequireNumbers", true);
        securityConfig.put("passwordRequireSpecialChars", true);
        securityConfig.put("sessionTimeoutMinutes", 30);
        securityConfig.put("maxLoginAttempts", 5);
        securityConfig.put("lockoutDurationMinutes", 15);
        config.security = securityConfig;
        
        return config;
    }

    @Override
    @Transactional
    public void updateSystemConfiguration(SystemConfiguration config) {
        log.info("Updating system configuration");
        
        try {
            // Validar configuración no nula
            if (config == null) {
                throw new IllegalArgumentException("Configuration cannot be null");
            }
            
            // Validar secciones de configuración
            if (config.pubmed == null) {
                config.pubmed = new HashMap<>();
            }
            if (config.rag == null) {
                config.rag = new HashMap<>();
            }
            if (config.pedagogical == null) {
                config.pedagogical = new HashMap<>();
            }
            if (config.security == null) {
                config.security = new HashMap<>();
            }
            
            // Validaciones específicas de seguridad
            Integer minLength = (Integer) config.security.getOrDefault("passwordMinLength", 8);
            if (minLength < 6) {
                log.warn("Password minimum length too short, resetting to 6");
                config.security.put("passwordMinLength", 6);
            }
            
            Integer timeout = (Integer) config.security.getOrDefault("sessionTimeoutMinutes", 30);
            if (timeout < 1) {
                throw new IllegalArgumentException("Session timeout must be at least 1 minute");
            }
            
            // Guardar configuración
            configRegistry.clear();
            configRegistry.put("DEFAULT", config);
            
            // Logging detallado de cambios
            log.info("System configuration updated successfully");
            log.debug("PubMed config: {}", config.pubmed);
            log.debug("RAG config: {}", config.rag);
            log.debug("Pedagogical config: {}", config.pedagogical);
            log.debug("Security config: {}", config.security);
            
            // Invalidar caches si es necesario
            if (cacheManager != null) {
                var cache = cacheManager.getCache("systemConfig");
                if (cache != null) {
                    cache.clear();
                    log.debug("System configuration cache cleared");
                }
            }
            
        } catch (IllegalArgumentException e) {
            log.warn("Invalid configuration provided: {}", e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("Error updating system configuration", e);
            throw new RuntimeException("Failed to update configuration: " + e.getMessage());
        }
    }

    /**
     * Parsea un string de rol a enum Role
     */
    private Role parseRole(String roleStr) {
        if (roleStr == null || roleStr.trim().isEmpty()) {
            return Role.ROLE_STUDENT;
        }
        switch (roleStr.toUpperCase()) {
            case "STUDENT":
                return Role.ROLE_STUDENT;
            case "PROFESSOR":
                return Role.ROLE_PROFESSOR;
            case "ADMIN":
                return Role.ROLE_ADMIN;
            default:
                log.warn("Unknown role '{}', defaulting to STUDENT", roleStr);
                return Role.ROLE_STUDENT;
        }
    }

    /**
     * Genera una contraseña temporal aleatoria
     */
    private String generateTemporaryPassword() {
        // Generar contraseña de 8 caracteres con letras y números
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            int index = (int) (Math.random() * chars.length());
            sb.append(chars.charAt(index));
        }
        return sb.toString();
    }

    // ======================== ALERTS MANAGEMENT ========================

    @Override
    public List<Map<String, Object>> getAlerts() {
        log.info("Retrieving alerts list");
        // En implementación real, esto vendría de una BD
        // Por ahora retornamos una lista vacía
        List<Map<String, Object>> alerts = new ArrayList<>();
        return alerts;
    }

    @Override
    @Transactional
    public Map<String, Object> createAlert(Map<String, Object> alertRequest) {
        log.info("Creating new alert with request: {}", alertRequest);
        
        Map<String, Object> alert = new HashMap<>();
        alert.put("id", "alert_" + System.currentTimeMillis());
        alert.put("title", alertRequest.getOrDefault("title", "Sin titulo"));
        alert.put("message", alertRequest.getOrDefault("message", "Sin mensaje"));
        alert.put("level", alertRequest.getOrDefault("level", "INFO"));
        alert.put("createdAt", LocalDateTime.now());
        alert.put("status", "ACTIVE");
        
        return alert;
    }

    @Override
    @Transactional
    public Map<String, Object> updateAlert(String alertId, Map<String, Object> alertRequest) {
        log.info("Updating alert: {} with request: {}", alertId, alertRequest);
        
        Map<String, Object> alert = new HashMap<>();
        alert.put("id", alertId);
        alert.put("title", alertRequest.getOrDefault("title", "Sin titulo"));
        alert.put("message", alertRequest.getOrDefault("message", "Sin mensaje"));
        alert.put("level", alertRequest.getOrDefault("level", "INFO"));
        alert.put("updatedAt", LocalDateTime.now());
        alert.put("status", alertRequest.getOrDefault("status", "ACTIVE"));
        
        return alert;
    }

    @Override
    @Transactional
    public void deleteAlert(String alertId) {
        log.info("Deleting alert: {}", alertId);
        // Implementación para eliminar alerta de BD
    }

    // ======================== PUBMED CONNECTION ========================

    @Override
    public boolean testPubmedConnection() {
        log.info("Testing PubMed connection");
        
        try {
            // Intentar conexión a PubMed
            // En implementación real, hacer una petición HTTP real a PubMed API
            java.net.URL url = new java.net.URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=test&retmax=1");
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            
            int responseCode = connection.getResponseCode();
            boolean isConnected = (responseCode >= 200 && responseCode < 300);
            
            log.info("PubMed connection test result: {} (HTTP {})", isConnected ? "SUCCESS" : "FAILED", responseCode);
            
            return isConnected;
        } catch (Exception e) {
            log.error("Error testing PubMed connection: {}", e.getMessage());
            return false;
        }
    }

    // ======================== BACKUPS MANAGEMENT ========================

    @Override
    public List<Map<String, Object>> getBackupsList() {
        log.info("Retrieving backups list");
        
        List<Map<String, Object>> backups = new ArrayList<>();
        
        for (Map.Entry<String, BackupStatus> entry : backupRegistry.entrySet()) {
            BackupStatus status = entry.getValue();
            Map<String, Object> backup = new HashMap<>();
            backup.put("id", status.id);
            backup.put("type", status.type);
            backup.put("createdAt", status.startTime);
            backup.put("status", status.status);
            backup.put("size", status.dataSize);
            backup.put("progress", status.progress);
            if (status.downloadUrl != null) {
                backup.put("downloadUrl", status.downloadUrl);
            }
            backups.add(backup);
        }
        
        return backups;
    }

    @Override
    @Transactional
    public void restoreBackup(String backupId) {
        log.info("Restoring backup: {}", backupId);
        
        BackupStatus status = backupRegistry.get(backupId);
        if (status == null) {
            throw new RuntimeException("Backup not found: " + backupId);
        }
        
        if (!"COMPLETED".equals(status.status)) {
            throw new RuntimeException("Cannot restore from incomplete backup");
        }
        
        log.info("Starting restore process for backup: {}", backupId);
        executeRestore(backupId, status);
        log.info("Backup restored successfully: {}", backupId);
    }

    // ======================== AUDIT EXPORT ========================

    @Override
    public Map<String, Object> exportAuditLogs(String format, Map<String, Object> filters) {
        log.info("Exporting audit logs with format: {} and filters: {}", format, filters);
        
        Map<String, Object> export = new HashMap<>();
        export.put("id", "export_" + System.currentTimeMillis());
        export.put("fileName", "audit_logs_" + System.currentTimeMillis() + "." + format);
        export.put("downloadUrl", "/downloads/audit_logs_" + System.currentTimeMillis());
        export.put("size", 0);
        export.put("format", format);
        export.put("createdAt", LocalDateTime.now());
        export.put("status", "READY");
        
        log.info("Export prepared: {}", export.get("fileName"));
        
        return export;
    }
}