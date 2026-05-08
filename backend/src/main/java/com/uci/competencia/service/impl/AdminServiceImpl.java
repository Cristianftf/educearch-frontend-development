package com.uci.competencia.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.exception.ResourceNotFoundException;
import com.uci.competencia.model.dto.request.UserBatchImportDTO;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.entity.SystemLog;
import com.uci.competencia.model.enums.ActionType;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.repository.UserRepository;
import com.uci.competencia.repository.SystemLogRepository;
import com.uci.competencia.repository.SearchSessionRepository;
import com.uci.competencia.service.AdminService;
import com.uci.competencia.service.SystemErrorInsightService;
import com.uci.competencia.service.external.OpenAIService;
import com.uci.competencia.service.specification.UserSpecifications;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.lang.management.ManagementFactory;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminServiceImpl implements AdminService {

    private static final double API_LATENCY_WARNING_MS = 700d;
    private static final double API_LATENCY_OFFLINE_MS = 3000d;
    private static final double PUBMED_USAGE_WARNING_PERCENT = 85d;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final SystemLogRepository systemLogRepository;
    private final SearchSessionRepository searchSessionRepository;
    private final SystemErrorInsightService systemErrorInsightService;
    private final DataSource dataSource;
    private final ObjectMapper objectMapper;
    private final OpenAIService openAIService;

    @Autowired(required = false)
    private CacheManager cacheManager;

    @Autowired(required = false)
    private RedisConnectionFactory redisConnectionFactory;
    
    // Almacenamiento en memoria para backups (en producciÃ³n usar BD)
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
    public Page<User> getUsersByStatus(boolean active, Pageable pageable) {
        return userRepository.findByActive(active, pageable);
    }

    @Override
    public Page<User> getUsersByRoleAndStatus(Role role, boolean active, Pageable pageable) {
        return userRepository.findByRoleAndActive(role, active, pageable);
    }

    @Override
    public Page<User> searchUsers(Role role, Boolean active, String search, Pageable pageable) {
        Specification<User> spec = Specification.where(UserSpecifications.hasRole(role))
            .and(UserSpecifications.hasActive(active))
            .and(UserSpecifications.containsSearch(search));
        return userRepository.findAll(spec, pageable);
    }

    @Override
    public User getUserById(String id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found: " + id));
    }

    @Override
    public User createUser(User user) {
        String normalizedEmail = normalizeEmail(user.getEmail());
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException("User already exists with email: " + normalizedEmail);
        }
        user.setEmail(normalizedEmail);

        if (user.getUsername() == null || user.getUsername().trim().isEmpty()) {
            user.setUsername(generateUniqueUsername(user.getEmail()));
        }

        if (user.getPasswordHash() == null || user.getPasswordHash().trim().isEmpty()) {
            String tempPassword = generateTemporaryPassword();
            user.setPasswordHash(passwordEncoder.encode(tempPassword));
        } else if (!isBcryptHash(user.getPasswordHash())) {
            user.setPasswordHash(passwordEncoder.encode(user.getPasswordHash()));
        }
        return userRepository.save(user);
    }

    @Override
    public User updateUser(String id, User user) {
        User existingUser = getUserById(id);
        String normalizedEmail = normalizeEmail(user.getEmail());
        userRepository.findByEmail(normalizedEmail)
            .filter(found -> !Objects.equals(found.getId(), existingUser.getId()))
            .ifPresent(found -> {
                throw new IllegalArgumentException("User already exists with email: " + normalizedEmail);
            });

        existingUser.setFirstName(user.getFirstName());
        existingUser.setLastName(user.getLastName());
        existingUser.setEmail(normalizedEmail);
        existingUser.setFaculty(user.getFaculty());
        existingUser.setActive(user.isActive());
        if (user.getRole() != null) {
            existingUser.setRole(user.getRole());
        }
        return userRepository.save(existingUser);
    }

    @Override
    @Transactional
    public void deleteUser(String id) {
        User existingUser = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));

        try {
            UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid user ID format: " + id, ex);
        }

        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        try {
            // --- Student dependencies ---
            jdbcTemplate.update(
                "DELETE FROM evaluations WHERE submission_id IN (" +
                "SELECT id::text FROM case_submissions WHERE CAST(student_id AS text) = ?)",
                id
            );
            jdbcTemplate.update(
                "DELETE FROM submission_selected_articles WHERE submission_id IN (" +
                "SELECT id FROM case_submissions WHERE CAST(student_id AS text) = ?)",
                id
            );
            jdbcTemplate.update("DELETE FROM case_submissions WHERE CAST(student_id AS text) = ?", id);
            jdbcTemplate.update("DELETE FROM competency_progress WHERE CAST(student_id AS text) = ?", id);
            jdbcTemplate.update("DELETE FROM case_assigned_students WHERE student_id = ?", id);

            // --- Professor dependencies ---
            jdbcTemplate.update(
                "DELETE FROM evaluations WHERE professor_id = ?",
                id
            );
            jdbcTemplate.update(
                "DELETE FROM evaluations WHERE submission_id IN (" +
                "SELECT cs.id::text FROM case_submissions cs " +
                "WHERE cs.case_id IN (" +
                "SELECT c.id FROM case_studies c WHERE c.created_by = ?))",
                id
            );
            jdbcTemplate.update(
                "DELETE FROM submission_selected_articles WHERE submission_id IN (" +
                "SELECT cs.id FROM case_submissions cs " +
                "WHERE cs.case_id IN (" +
                "SELECT c.id FROM case_studies c WHERE c.created_by = ?))",
                id
            );
            jdbcTemplate.update(
                "DELETE FROM case_submissions WHERE case_id IN (" +
                "SELECT c.id FROM case_studies c WHERE c.created_by = ?)",
                id
            );
            jdbcTemplate.update(
                "DELETE FROM case_assigned_students WHERE case_id IN (" +
                "SELECT c.id FROM case_studies c WHERE c.created_by = ?)",
                id
            );
            jdbcTemplate.update(
                "DELETE FROM case_rubric WHERE case_id IN (" +
                "SELECT c.id FROM case_studies c WHERE c.created_by = ?)",
                id
            );
            jdbcTemplate.update(
                "DELETE FROM case_guiding_questions WHERE case_id IN (" +
                "SELECT c.id FROM case_studies c WHERE c.created_by = ?)",
                id
            );
            jdbcTemplate.update(
                "DELETE FROM case_required_articles WHERE case_id IN (" +
                "SELECT c.id FROM case_studies c WHERE c.created_by = ?)",
                id
            );
            jdbcTemplate.update(
                "DELETE FROM case_optional_articles WHERE case_id IN (" +
                "SELECT c.id FROM case_studies c WHERE c.created_by = ?)",
                id
            );
            jdbcTemplate.update(
                "DELETE FROM case_studies WHERE created_by = ?",
                id
            );
            deleteProfessorExpertiseByUserId(jdbcTemplate, id);

            // --- Search/verification dependencies ---
            jdbcTemplate.update(
                "DELETE FROM verification_results WHERE session_context IN (" +
                "SELECT id FROM search_sessions WHERE CAST(user_id AS text) = ?)",
                id
            );
            jdbcTemplate.update("DELETE FROM verification_results WHERE CAST(user_id AS text) = ?", id);
            jdbcTemplate.update(
                "DELETE FROM result_mesh_terms WHERE search_result_id IN (" +
                "SELECT sr.id FROM search_results sr " +
                "JOIN search_sessions ss ON ss.id = sr.session_id " +
                "WHERE CAST(ss.user_id AS text) = ?)",
                id
            );
            jdbcTemplate.update(
                "DELETE FROM search_results WHERE session_id IN (" +
                "SELECT id FROM search_sessions WHERE CAST(user_id AS text) = ?)",
                id
            );
            jdbcTemplate.update("DELETE FROM search_sessions WHERE CAST(user_id AS text) = ?", id);

            // --- Optional user-owned records ---
            jdbcTemplate.update("DELETE FROM bibliographies WHERE user_id = ?", id);

            // --- Inheritance tables ---
            jdbcTemplate.update("DELETE FROM students WHERE CAST(user_id AS text) = ?", id);
            jdbcTemplate.update("DELETE FROM professors WHERE CAST(user_id AS text) = ?", id);
            jdbcTemplate.update("DELETE FROM administrators WHERE CAST(user_id AS text) = ?", id);

            userRepository.deleteById(existingUser.getId());
        } catch (DataIntegrityViolationException ex) {
            throw new IllegalStateException("Cannot delete user due to related records that require cleanup", ex);
        } catch (DataAccessException ex) {
            throw new IllegalStateException("Cannot delete user due to SQL constraint or type mismatch", ex);
        }
    }

    private void deleteProfessorExpertiseByUserId(JdbcTemplate jdbcTemplate, String userId) {
        List<String> candidateColumns = List.of("professor_id", "professor_user_id", "user_id");
        String ownerColumn = candidateColumns.stream()
            .filter(column -> hasColumn(jdbcTemplate, "professor_expertise", column))
            .findFirst()
            .orElse(null);

        if (ownerColumn == null) {
            log.warn("Skipping cleanup for professor_expertise: no owner column found");
            return;
        }

        jdbcTemplate.update("DELETE FROM professor_expertise WHERE CAST(" + ownerColumn + " AS text) = ?", userId);
    }

    private boolean hasColumn(JdbcTemplate jdbcTemplate, String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(1) " +
            "FROM information_schema.columns " +
            "WHERE table_schema = current_schema() " +
            "AND table_name = ? " +
            "AND column_name = ?",
            Integer.class,
            tableName,
            columnName
        );
        return count != null && count > 0;
    }

    @Override
    public Map<String, Object> getSystemHealth() {
        Map<String, Object> health = new HashMap<>();
        LocalDateTime now = LocalDateTime.now();

        double cpu = getCpuUsagePercent();
        double memory = getMemoryUsagePercent();
        double disk = getDiskUsagePercent();
        int dbConnections = getDatabaseConnectionCount();
        double cacheHitRatio = getCacheHitRatio();
        long activeUsers = userRepository.countByActive(true);
        long requestsPerMinute = getRequestsPerMinute(now);

        Map<String, Object> latency = computeLatencyPercentiles(now.minusHours(24));
        Map<String, Object> pubmedUsage = buildPubmedUsage(now);
        List<Map<String, Object>> services = buildServiceStatuses(latency, pubmedUsage);

        String status = dbConnections > 0 ? "UP" : "DEGRADED";
        health.put("status", status);
        health.put("timestamp", System.currentTimeMillis());
        health.put("lastCheck", now.toString());
        health.put("cpu", cpu);
        health.put("memory", memory);
        health.put("disk", disk);
        health.put("dbConnections", dbConnections);
        health.put("cacheHitRatio", cacheHitRatio);
        health.put("apiLatency", latency);
        health.put("activeUsers", activeUsers);
        health.put("requestsPerMinute", requestsPerMinute);
        health.put("services", services);
        health.put("pubmedUsage", pubmedUsage);
        health.put("cache", cacheManager != null ? "AVAILABLE" : "NOT_CONFIGURED");

        return health;
    }

    @Override
    public Map<String, Object> getDashboardData() {
        Map<String, Object> dashboard = new HashMap<>();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startToday = now.toLocalDate().atStartOfDay();
        LocalDateTime startYesterday = startToday.minusDays(1);
        LocalDateTime startLast30 = now.minusDays(30);
        LocalDateTime startPrev30 = now.minusDays(60);

        long searchesToday = searchSessionRepository.countByStartedAtBetween(startToday, now);
        long searchesYesterday = searchSessionRepository.countByStartedAtBetween(startYesterday, startToday);
        long searchesChange = searchesToday - searchesYesterday;
        double searchesChangePercent = calculateChangePercent(searchesToday, searchesYesterday);

        long totalUsers = userRepository.count();
        long totalStudents = countUsersByRole(Role.ROLE_STUDENT);
        long totalProfessors = countUsersByRole(Role.ROLE_PROFESSOR);
        long totalAdmins = countUsersByRole(Role.ROLE_ADMIN);
        long activeStudents = userRepository.countByRoleAndActive(Role.ROLE_STUDENT, true);

        long usersLast30 = userRepository.countByCreatedAtBetween(startLast30, now);
        long usersPrev30 = userRepository.countByCreatedAtBetween(startPrev30, startLast30);
        double usersChangePercent = calculateChangePercent(usersLast30, usersPrev30);

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsers", totalUsers);
        stats.put("students", totalStudents);
        stats.put("professors", totalProfessors);
        stats.put("admins", totalAdmins);
        stats.put("activeStudents", activeStudents);
        stats.put("searchesToday", searchesToday);
        stats.put("searchesYesterday", searchesYesterday);
        stats.put("searchesChange", searchesChange);
        stats.put("searchesChangePercent", searchesChangePercent);
        stats.put("usersLast30Days", usersLast30);
        stats.put("usersPrev30Days", usersPrev30);
        stats.put("usersChangePercent", usersChangePercent);

        Map<String, Object> health = getSystemHealth();
        Map<String, Object> latency = safeMap(health.get("apiLatency"));
        Map<String, Object> pubmedUsage = safeMap(health.get("pubmedUsage"));

        Map<String, Object> resources = new HashMap<>();
        resources.put("cpu", health.getOrDefault("cpu", 0));
        resources.put("memory", health.getOrDefault("memory", 0));
        resources.put("disk", health.getOrDefault("disk", 0));
        resources.put("latency", latency);
        resources.put("pubmedUsage", pubmedUsage);

        Map<String, Object> systemStatus = new HashMap<>();
        systemStatus.put("status", health.getOrDefault("status", "UP"));
        systemStatus.put("lastCheck", now.toString());
        systemStatus.put("uptimeMs", getSystemUptime());

        List<Map<String, Object>> alerts = buildRecentAlerts(now.minusHours(24));
        Map<String, Object> activity = buildRecentActivity();
        List<Map<String, Object>> services = safeList(health.get("services"));

        dashboard.put("stats", stats);
        dashboard.put("resources", resources);
        dashboard.put("systemStatus", systemStatus);
        dashboard.put("alerts", alerts);
        dashboard.put("activity", activity);
        dashboard.put("services", services);

        return dashboard;
    }

    @Override
    public Map<String, Object> getSystemOverview() {
        Map<String, Object> overview = new HashMap<>();
        LocalDateTime now = LocalDateTime.now();

        Map<String, Object> server = new HashMap<>();
        server.put("os", System.getProperty("os.name") + " " + System.getProperty("os.version"));
        server.put("java", System.getProperty("java.version"));
        server.put("uptimeMs", getSystemUptime());
        server.put("runtime", System.getProperty("java.runtime.name"));

        Map<String, Object> database = getDatabaseInfo();
        Map<String, Object> redis = getRedisInfo();
        Map<String, Object> storage = getStorageInfo();
        List<Map<String, Object>> tasks = buildScheduledTasks();

        overview.put("timestamp", now.toString());
        overview.put("server", server);
        overview.put("database", database);
        overview.put("redis", redis);
        overview.put("storage", storage);
        overview.put("scheduledTasks", tasks);

        return overview;
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
                        if (userDTO.getActive() != null) user.setActive(Boolean.TRUE.equals(userDTO.getActive()));
                        
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
                        newUser.setActive(userDTO.getActive() == null || Boolean.TRUE.equals(userDTO.getActive()));
                        
                        // Generar contraseÃ±a temporal si no estÃ¡ proporcionada
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
            
            // Obtener estadÃ­sticas detalladas
            Map<String, Long> usersByRole = new HashMap<>();
            usersByRole.put("ADMIN", countUsersByRole(Role.ROLE_ADMIN));
            usersByRole.put("PROFESSOR", countUsersByRole(Role.ROLE_PROFESSOR));
            usersByRole.put("STUDENT", countUsersByRole(Role.ROLE_STUDENT));
            
            // Contar usuarios activos/inactivos
            long activeUsers = userRepository.countByActive(true);
            long inactiveUsers = Math.max(0, totalUsers - activeUsers);
            
            // InformaciÃ³n del sistema
            stats.put("totalUsers", totalUsers);
            stats.put("usersByRole", usersByRole);
            stats.put("activeUsers", activeUsers);
            stats.put("inactiveUsers", inactiveUsers);
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
            return userRepository.countByRole(role);
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
    @SuppressWarnings("deprecation")
    private Map<String, Object> getMemoryUsage() {
        Map<String, Object> memory = new HashMap<>();
        try {
            java.lang.management.OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
            if (osBean instanceof com.sun.management.OperatingSystemMXBean) {
                com.sun.management.OperatingSystemMXBean sunBean = (com.sun.management.OperatingSystemMXBean) osBean;
                long totalPhysical = sunBean.getTotalPhysicalMemorySize();
                long freePhysical = sunBean.getFreePhysicalMemorySize();
                if (totalPhysical > 0) {
                    memory.put("totalMemory", totalPhysical);
                    memory.put("freeMemory", Math.max(0L, freePhysical));
                    memory.put("usedMemory", Math.max(0L, totalPhysical - freePhysical));
                    memory.put("maxMemory", totalPhysical);
                    return memory;
                }
            }
        } catch (Exception ignored) {
        }

        java.lang.Runtime runtime = java.lang.Runtime.getRuntime();
        memory.put("totalMemory", runtime.totalMemory());
        memory.put("freeMemory", runtime.freeMemory());
        memory.put("usedMemory", runtime.totalMemory() - runtime.freeMemory());
        memory.put("maxMemory", runtime.maxMemory());
        return memory;
    }

    @SuppressWarnings("deprecation")
    private double getCpuUsagePercent() {
        try {
            java.lang.management.OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
            if (osBean instanceof com.sun.management.OperatingSystemMXBean) {
                double load = ((com.sun.management.OperatingSystemMXBean) osBean).getSystemCpuLoad();
                if (load >= 0) {
                    return Math.round(load * 1000d) / 10d;
                }
            }
        } catch (Exception ignored) {
        }
        return 0;
    }

    private double getMemoryUsagePercent() {
        Map<String, Object> memory = getMemoryUsage();
        long used = (long) memory.getOrDefault("usedMemory", 0L);
        long max = (long) memory.getOrDefault("maxMemory", 0L);
        if (max <= 0) return 0;
        return Math.round((used * 1000d / max)) / 10d;
    }

    private double getDiskUsagePercent() {
        try {
            File selected = resolvePrimaryStorageRoot();
            long total = selected.getTotalSpace();
            long free = selected.getFreeSpace();
            if (total <= 0) return 0;
            double usedPercent = ((double) (total - free)) / total * 100d;
            return Math.round(usedPercent * 10d) / 10d;
        } catch (Exception ignored) {
            return 0;
        }
    }

    private Map<String, Object> getStorageInfo() {
        Map<String, Object> storage = new HashMap<>();
        try {
            File selected = resolvePrimaryStorageRoot();
            storage.put("totalBytes", selected.getTotalSpace());
            storage.put("freeBytes", selected.getFreeSpace());
        } catch (Exception e) {
            storage.put("totalBytes", 0);
            storage.put("freeBytes", 0);
        }
        return storage;
    }

    private int getDatabaseConnectionCount() {
        try {
            JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
            Integer count = jdbcTemplate.queryForObject(
                "select count(*) from pg_stat_activity where datname = current_database()",
                Integer.class
            );
            return count != null ? count : 0;
        } catch (Exception e) {
            try {
                JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
                Integer validation = jdbcTemplate.queryForObject("select 1", Integer.class);
                return validation != null ? 1 : 0;
            } catch (Exception ignored) {
                return 0;
            }
        }
    }

    private int getDatabaseMaxConnections() {
        try {
            JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
            Integer max = jdbcTemplate.queryForObject(
                "select current_setting('max_connections')::int",
                Integer.class
            );
            return max != null ? max : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    private Map<String, Object> getDatabaseInfo() {
        Map<String, Object> db = new HashMap<>();
        try {
            JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
            String engine = jdbcTemplate.queryForObject("select version()", String.class);
            Long size = jdbcTemplate.queryForObject("select pg_database_size(current_database())", Long.class);
            int connections = getDatabaseConnectionCount();
            int maxConnections = getDatabaseMaxConnections();

            db.put("engine", engine != null ? engine : "PostgreSQL");
            db.put("sizeBytes", size != null ? size : 0);
            db.put("connections", connections);
            db.put("maxConnections", maxConnections);
        } catch (Exception e) {
            db.put("engine", "PostgreSQL");
            db.put("sizeBytes", 0);
            db.put("connections", 0);
            db.put("maxConnections", 0);
        }
        return db;
    }

    private Map<String, Object> getRedisInfo() {
        Map<String, Object> redis = new HashMap<>();
        redis.put("available", redisConnectionFactory != null);
        if (redisConnectionFactory == null) {
            redis.put("usedBytes", 0);
            redis.put("maxBytes", 0);
            redis.put("hitRate", 0);
            redis.put("keys", 0);
            return redis;
        }
        try (RedisConnection connection = redisConnectionFactory.getConnection()) {
            @SuppressWarnings("deprecation")
            Properties stats = connection.info("stats");
            @SuppressWarnings("deprecation")
            Properties memory = connection.info("memory");
            @SuppressWarnings("deprecation")
            Properties keyspace = connection.info("keyspace");

            long hits = parseLong(stats.getProperty("keyspace_hits"));
            long misses = parseLong(stats.getProperty("keyspace_misses"));
            double ratio = hits + misses > 0 ? (hits * 100d) / (hits + misses) : 0;

            long usedBytes = parseLong(memory.getProperty("used_memory"));
            long maxBytes = parseLong(memory.getProperty("maxmemory"));

            long keys = 0;
            for (String name : keyspace.stringPropertyNames()) {
                String value = keyspace.getProperty(name);
                if (value != null && value.contains("keys=")) {
                    String[] parts = value.split(",");
                    for (String part : parts) {
                        if (part.startsWith("keys=")) {
                            keys += parseLong(part.replace("keys=", ""));
                        }
                    }
                }
            }

            redis.put("usedBytes", usedBytes);
            redis.put("maxBytes", maxBytes);
            redis.put("hitRate", Math.round(ratio * 10d) / 10d);
            redis.put("keys", keys);
        } catch (Exception e) {
            redis.put("usedBytes", 0);
            redis.put("maxBytes", 0);
            redis.put("hitRate", 0);
            redis.put("keys", 0);
        }
        return redis;
    }

    private double getCacheHitRatio() {
        Map<String, Object> redis = getRedisInfo();
        Object value = redis.get("hitRate");
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        return 0;
    }

    private long getRequestsPerMinute(LocalDateTime now) {
        try {
            LocalDateTime start = now.minusMinutes(1);
            return systemLogRepository.countByTimestampBetween(start, now);
        } catch (Exception e) {
            return 0;
        }
    }

    private Map<String, Object> computeLatencyPercentiles(LocalDateTime start) {
        Map<String, Object> latency = new HashMap<>();
        List<Long> responseTimes = systemLogRepository.findResponseTimesSince(
            start,
            PageRequest.of(0, 1000, Sort.by(Sort.Direction.DESC, "timestamp"))
        );
        if (responseTimes.isEmpty()) {
            latency.put("p50", 0);
            latency.put("p75", 0);
            latency.put("p95", 0);
            latency.put("p99", 0);
            return latency;
        }
        List<Long> sorted = responseTimes.stream()
            .filter(Objects::nonNull)
            .sorted()
            .collect(Collectors.toList());
        latency.put("p50", percentile(sorted, 50));
        latency.put("p75", percentile(sorted, 75));
        latency.put("p95", percentile(sorted, 95));
        latency.put("p99", percentile(sorted, 99));
        return latency;
    }

    private double percentile(List<Long> values, int percentile) {
        if (values.isEmpty()) return 0;
        int index = (int) Math.ceil(percentile / 100.0 * values.size()) - 1;
        index = Math.min(Math.max(index, 0), values.size() - 1);
        return values.get(index);
    }

    private double calculateChangePercent(long current, long previous) {
        if (previous <= 0) {
            return current > 0 ? 100 : 0;
        }
        double change = ((double) current - previous) / previous * 100d;
        return Math.round(change * 10d) / 10d;
    }

    private Map<String, Object> buildPubmedUsage(LocalDateTime now) {
        Map<String, Object> usage = new HashMap<>();
        LocalDateTime startToday = now.toLocalDate().atStartOfDay();
        long used = searchSessionRepository.countByStartedAtBetween(startToday, now);
        int limit = 0;
        try {
            SystemConfiguration config = getSystemConfiguration();
            if (config != null && config.pubmed != null) {
                Object limitObj = config.pubmed.getOrDefault("rateLimitPerDay", 0);
                if (limitObj instanceof Number) {
                    limit = ((Number) limitObj).intValue();
                } else if (limitObj != null) {
                    limit = Integer.parseInt(limitObj.toString());
                }
            }
        } catch (Exception ignored) {
        }
        double percent = limit > 0 ? Math.round((used * 1000d / limit)) / 10d : 0;
        usage.put("used", used);
        usage.put("limit", limit);
        usage.put("percent", percent);
        return usage;
    }

    private List<Map<String, Object>> buildServiceStatuses(Map<String, Object> latency, Map<String, Object> pubmedUsage) {
        List<Map<String, Object>> services = new ArrayList<>();
        String now = LocalDateTime.now().toString();

        Double apiLatency = avgLatency(latency);
        String apiStatus = "warning";
        if (apiLatency != null) {
            apiStatus = apiLatency >= API_LATENCY_OFFLINE_MS
                ? "offline"
                : apiLatency >= API_LATENCY_WARNING_MS ? "warning" : "online";
        }
        services.add(serviceStatus("API Principal", apiStatus, apiLatency, formatUptime(getSystemUptime()), now));

        int dbConnections = getDatabaseConnectionCount();
        services.add(serviceStatus(
            "Base de Datos",
            dbConnections > 0 ? "online" : "offline",
            null,
            dbConnections > 0 ? "Activa" : "Sin conexion",
            now
        ));

        boolean redisAvailable = isRedisAvailable();
        String cacheStatus = redisConnectionFactory == null && cacheManager == null
            ? "warning"
            : redisAvailable ? "online" : "warning";
        services.add(serviceStatus(
            "Cache Redis",
            cacheStatus,
            null,
            redisAvailable ? "Disponible" : "Sin telemetria",
            now
        ));

        boolean pubmedEnabled = true;
        try {
            SystemConfiguration config = getSystemConfiguration();
            if (config != null && config.pubmed != null) {
                Object enabled = config.pubmed.getOrDefault("enabled", true);
                pubmedEnabled = Boolean.parseBoolean(String.valueOf(enabled));
            }
        } catch (Exception ignored) {
        }
        double usagePercent = readDouble(pubmedUsage, "percent");
        String pubmedStatus = !pubmedEnabled
            ? "offline"
            : usagePercent >= PUBMED_USAGE_WARNING_PERCENT ? "warning" : "online";
        services.add(serviceStatus(
            "PubMed Gateway",
            pubmedStatus,
            null,
            pubmedEnabled ? "Operativo" : "Deshabilitado",
            now
        ));

        boolean ragEnabled = true;
        try {
            SystemConfiguration config = getSystemConfiguration();
            if (config != null && config.rag != null) {
                Object enabled = config.rag.getOrDefault("enabled", true);
                ragEnabled = Boolean.parseBoolean(String.valueOf(enabled));
            }
        } catch (Exception ignored) {
        }
        services.add(serviceStatus(
            "Servicio RAG",
            ragEnabled ? "online" : "offline",
            null,
            ragEnabled ? "Operativo" : "Deshabilitado",
            now
        ));

        return services;
    }

    private Map<String, Object> serviceStatus(String name, String status, Double latency, String uptime, String lastCheck) {
        Map<String, Object> service = new HashMap<>();
        service.put("name", name);
        service.put("status", status);
        if (latency != null) {
            service.put("latency", latency);
        }
        service.put("uptime", uptime);
        service.put("lastCheck", lastCheck);
        return service;
    }

    private Double avgLatency(Map<String, Object> latency) {
        if (latency == null) return null;
        Object p95 = latency.get("p95");
        if (p95 instanceof Number) {
            return ((Number) p95).doubleValue();
        }
        Object p50 = latency.get("p50");
        if (p50 instanceof Number) {
            return ((Number) p50).doubleValue();
        }
        return null;
    }

    private List<Map<String, Object>> buildRecentAlerts(LocalDateTime start) {
        List<Map<String, Object>> alerts = new ArrayList<>();
        try {
            Page<SystemLog> logs = systemLogRepository.findByTimestampAfter(
                start,
                PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "timestamp"))
            );
            for (SystemLog log : logs.getContent()) {
                if (log.getLevel() == null) continue;
                if (!(log.getLevel() == com.uci.competencia.model.enums.LogLevel.WARN
                    || log.getLevel() == com.uci.competencia.model.enums.LogLevel.ERROR)) {
                    continue;
                }
                Map<String, Object> alert = new HashMap<>();
                alert.put("id", log.getId());
                alert.put("type", log.getLevel() == com.uci.competencia.model.enums.LogLevel.ERROR ? "error" : "warning");
                String message = log.getErrorMessage();
                if (message == null || message.isBlank()) {
                    message = log.getAction() != null ? log.getAction().name() : "Evento del sistema";
                }
                alert.put("message", message);
                alert.put("timestamp", log.getTimestamp() != null ? log.getTimestamp().toString() : null);
                alerts.add(alert);
                if (alerts.size() >= 4) break;
            }
        } catch (Exception ignored) {
        }
        return alerts;
    }

    private Map<String, Object> buildRecentActivity() {
        Map<String, Object> activity = new HashMap<>();
        List<Map<String, Object>> userItems = new ArrayList<>();
        List<Map<String, Object>> systemItems = new ArrayList<>();

        Page<SystemLog> logs = systemLogRepository.findAll(
            PageRequest.of(0, 50, Sort.by(Sort.Direction.DESC, "timestamp"))
        );
        List<SystemLog> content = logs.getContent();
        Map<String, String> userNames = resolveUserNames(content);

        for (SystemLog log : content) {
            if (log.getTimestamp() == null) continue;
            String userLabel = userNames.getOrDefault(log.getUserId(), log.getUserId());
            Map<String, Object> item = new HashMap<>();
            item.put("id", log.getId());
            item.put("action", log.getAction() != null ? log.getAction().name() : "EVENTO");
            item.put("user", userLabel);
            item.put("timestamp", log.getTimestamp().toString());

            ActionType action = log.getAction();
            if (action == ActionType.CREATE_USER || action == ActionType.UPDATE_USER || action == ActionType.DELETE_USER || action == ActionType.LOGIN || action == ActionType.LOGOUT) {
                userItems.add(item);
            } else if (action == ActionType.BACKUP || action == ActionType.RESTORE || action == ActionType.CHANGE_SETTINGS || action == ActionType.GENERATE_REPORT) {
                systemItems.add(item);
            }

            if (userItems.size() >= 6 && systemItems.size() >= 6) {
                break;
            }
        }

        activity.put("users", userItems);
        activity.put("system", systemItems);
        activity.put("api", buildApiUsageToday());
        return activity;
    }

    private List<Map<String, Object>> buildApiUsageToday() {
        try {
            LocalDateTime startToday = LocalDateTime.now().toLocalDate().atStartOfDay();
            List<Object[]> rows = systemLogRepository.summarizeEndpointUsageSince(
                startToday,
                PageRequest.of(0, 6)
            );
            List<Map<String, Object>> items = new ArrayList<>();
            for (Object[] row : rows) {
                if (row == null || row.length < 3) {
                    continue;
                }
                Map<String, Object> item = new HashMap<>();
                item.put("endpoint", row[0] != null ? row[0].toString() : "API");
                item.put("calls", row[1] instanceof Number ? ((Number) row[1]).longValue() : 0L);
                int hasWarnings = row[2] instanceof Number ? ((Number) row[2]).intValue() : 0;
                item.put("status", hasWarnings > 0 ? "WARN" : "OK");
                items.add(item);
            }
            return items;
        } catch (Exception ex) {
            log.warn("Could not build API usage activity: {}", ex.getMessage());
            return List.of();
        }
    }

    private File resolvePrimaryStorageRoot() {
        File workDir = new File(System.getProperty("user.dir", ".")).getAbsoluteFile();
        File current = workDir;
        while (current.getParentFile() != null) {
            current = current.getParentFile();
        }
        if (current.getTotalSpace() > 0) {
            return current;
        }
        File[] roots = File.listRoots();
        if (roots != null && roots.length > 0) {
            return roots[0];
        }
        return workDir;
    }

    private boolean isRedisAvailable() {
        if (redisConnectionFactory == null) {
            return false;
        }
        try (RedisConnection connection = redisConnectionFactory.getConnection()) {
            return connection != null && !connection.isClosed();
        } catch (Exception ex) {
            return false;
        }
    }

    private String formatUptime(long uptimeMs) {
        if (uptimeMs <= 0) {
            return null;
        }
        long totalSeconds = uptimeMs / 1000L;
        long days = totalSeconds / 86400L;
        long hours = (totalSeconds % 86400L) / 3600L;
        long minutes = (totalSeconds % 3600L) / 60L;
        if (days > 0) {
            return days + "d " + hours + "h";
        }
        if (hours > 0) {
            return hours + "h " + minutes + "m";
        }
        return Math.max(1L, minutes) + "m";
    }

    private double readDouble(Map<String, Object> values, String key) {
        if (values == null || key == null) {
            return 0d;
        }
        Object value = values.get(key);
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        if (value == null) {
            return 0d;
        }
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException ex) {
            return 0d;
        }
    }

    private Map<String, String> resolveUserNames(List<SystemLog> logs) {
        Set<String> identifiers = logs.stream()
            .map(SystemLog::getUserId)
            .filter(Objects::nonNull)
            .map(String::trim)
            .filter(value -> !value.isBlank())
            .collect(Collectors.toSet());
        if (identifiers.isEmpty()) return Map.of();

        Map<String, String> names = new HashMap<>();
        Set<String> uuidIds = identifiers.stream()
            .filter(this::isUuid)
            .collect(Collectors.toSet());

        userRepository.findAllById(uuidIds).forEach(user -> {
            String displayName = toDisplayName(user);
            names.put(user.getId(), displayName);
            if (user.getEmail() != null && !user.getEmail().isBlank()) {
                names.putIfAbsent(user.getEmail(), displayName);
            }
            if (user.getUsername() != null && !user.getUsername().isBlank()) {
                names.putIfAbsent(user.getUsername(), displayName);
            }
        });

        identifiers.stream()
            .filter(identifier -> !names.containsKey(identifier))
            .forEach(identifier -> userRepository.findByEmail(identifier)
                .or(() -> userRepository.findByUsername(identifier))
                .ifPresent(user -> names.put(identifier, toDisplayName(user))));

        return names;
    }

    private boolean isUuid(String value) {
        try {
            UUID.fromString(value);
            return true;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private String toDisplayName(User user) {
        String displayName = String.format("%s %s",
            Optional.ofNullable(user.getFirstName()).orElse(""),
            Optional.ofNullable(user.getLastName()).orElse("")).trim();
        return displayName.isBlank() ? user.getEmail() : displayName;
    }

    private List<Map<String, Object>> buildScheduledTasks() {
        List<Map<String, Object>> tasks = new ArrayList<>();
        tasks.add(schedule("Backup diario", "Todos los dias a las 22:00", "active"));
        tasks.add(schedule("Limpieza de cache", "Cada 6 horas", "active"));
        tasks.add(schedule("Sincronizacion MeSH", "Cada domingo a las 03:00", "active"));
        tasks.add(schedule("Reporte semanal", "Cada lunes a las 08:00", "active"));
        tasks.add(schedule("Verificacion de integridad", "Cada dia a las 04:00", "active"));
        tasks.add(schedule("Analisis IA de errores", "Cada 1 minuto", "active"));
        return tasks;
    }

    private Map<String, Object> schedule(String name, String schedule, String status) {
        Map<String, Object> task = new HashMap<>();
        task.put("name", name);
        task.put("schedule", schedule);
        task.put("status", status);
        return task;
    }

    private Map<String, Object> safeMap(Object value) {
        if (value instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = (Map<String, Object>) value;
            return map;
        }
        return new HashMap<>();
    }

    private List<Map<String, Object>> safeList(Object value) {
        if (value instanceof List) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> list = (List<Map<String, Object>>) value;
            return list;
        }
        return new ArrayList<>();
    }

    private long parseLong(String value) {
        if (value == null) return 0;
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            return 0;
        }
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
            // Simular exportaciÃ³n de datos
            Thread.sleep(1000); // Simular tiempo de procesamiento
            
            // Actualizar progreso
            backupStatus.progress = 25;

            // Simular export de usuarios
            Thread.sleep(500);
            backupStatus.progress = 50;

            // Simular export de datos adicionales si estÃ¡ incluido
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
     * Estimar tamaÃ±o de backup
     */
    private long estimateBackupSize() {
        try {
            long userCount = userRepository.count();
            return userCount * 1024; // EstimaciÃ³n aproximada: 1KB por usuario
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

            // Marcar como en restauraciÃ³n
            backupStatus.status = "RESTORING";
            backupStatus.progress = 0;
            
            // Ejecutar restauraciÃ³n en thread separado
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
     * Ejecutar proceso de restauraciÃ³n de datos
     */
    private void executeRestore(String backupId, BackupStatus backupStatus) {
        try {
            // Simular tiempo de restauraciÃ³n
            Thread.sleep(1000);
            backupStatus.progress = 25;

            // Simular restauraciÃ³n de usuarios
            Thread.sleep(500);
            backupStatus.progress = 50;

            // Simular restauraciÃ³n de datos adicionales
            Thread.sleep(500);
            backupStatus.progress = 75;

            // Simular validaciÃ³n
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
            // Si existe configuraciÃ³n guardada, retornarla
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
     * Construir configuraciÃ³n por defecto del sistema
     */
    private static SystemConfiguration buildDefaultConfig() {
        SystemConfiguration config = new SystemConfiguration();
        
        // ConfiguraciÃ³n PubMed
        Map<String, Object> pubmedConfig = new HashMap<>();
        pubmedConfig.put("apiKey", "");
        pubmedConfig.put("baseUrl", "https://pubmed.ncbi.nlm.nih.gov");
        pubmedConfig.put("enabled", true);
        pubmedConfig.put("cacheEnabled", true);
        pubmedConfig.put("cacheTTL", 3600);
        pubmedConfig.put("rateLimitPerDay", 10000);
        config.pubmed = pubmedConfig;
        
        // ConfiguraciÃ³n RAG (Retrieval Augmented Generation)
        Map<String, Object> ragConfig = new HashMap<>();
        ragConfig.put("enabled", true);
        ragConfig.put("modelProvider", "gemini");
        ragConfig.put("temperature", 0.7);
        ragConfig.put("topP", 0.9);
        ragConfig.put("maxTokens", 2000);
        ragConfig.put("contextWindow", 4096);
        ragConfig.put("embeddingModel", "text-embedding-ada-002");
        config.rag = ragConfig;
        
        // ConfiguraciÃ³n PedagÃ³gica
        Map<String, Object> pedagConfig = new HashMap<>();
        pedagConfig.put("competencyFramework", "SCONUL");
        pedagConfig.put("badgesEnabled", true);
        pedagConfig.put("alertsEnabled", true);
        pedagConfig.put("recommendationsEnabled", true);
        pedagConfig.put("hedgesEnabled", true);
        pedagConfig.put("competencyThresholds", Map.of(
            "access", 70,
            "process", 75,
            "communicate", 80
        ));
        pedagConfig.put("feedbackMessages", Map.of(
            "excellent", "Excelente desempeño",
            "good", "Buen trabajo",
            "fair", "Necesitas mejorar",
            "poor", "Requiere atención"
        ));
        config.pedagogical = pedagConfig;
        
        // ConfiguraciÃ³n de Seguridad
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
            // Validar configuraciÃ³n no nula
            if (config == null) {
                throw new IllegalArgumentException("Configuration cannot be null");
            }
            
            // Validar secciones de configuraciÃ³n
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
            
            // Validaciones especÃ­ficas de seguridad
            Integer minLength = parseInteger(config.security.getOrDefault("passwordMinLength", 8), 8);
            if (minLength < 6) {
                log.warn("Password minimum length too short, resetting to 6");
                config.security.put("passwordMinLength", 6);
            }
            
            Integer timeout = parseInteger(config.security.getOrDefault("sessionTimeoutMinutes", 30), 30);
            if (timeout < 1) {
                throw new IllegalArgumentException("Session timeout must be at least 1 minute");
            }
            
            // Guardar configuraciÃ³n
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
     * Genera una contraseÃ±a temporal aleatoria
     */
    private String generateTemporaryPassword() {
        // Generar contraseÃ±a de 8 caracteres con letras y nÃºmeros
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            int index = (int) (Math.random() * chars.length());
            sb.append(chars.charAt(index));
        }
        return sb.toString();
    }

    private Integer parseInteger(Object value, int fallback) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value == null) {
            return fallback;
        }
        try {
            return Integer.parseInt(value.toString().trim());
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private boolean isBcryptHash(String value) {
        if (value == null) return false;
        return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
    }

    private String generateUniqueUsername(String email) {
        String base = "user";
        if (email != null && email.contains("@")) {
            base = email.substring(0, email.indexOf("@"));
        }
        base = base.toLowerCase().replaceAll("[^a-z0-9._-]", "");
        if (base.length() < 3) {
            base = "user";
        }

        String candidate = base;
        int suffix = 1;
        while (userRepository.existsByUsername(candidate)) {
            candidate = base + suffix;
            suffix++;
        }
        return candidate;
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            throw new IllegalArgumentException("Email cannot be null");
        }
        String normalized = email.trim().toLowerCase();
        if (normalized.isBlank() || !normalized.contains("@")) {
            throw new IllegalArgumentException("Invalid email: " + email);
        }
        return normalized;
    }

    // ======================== ALERTS MANAGEMENT ========================

    @Override
    public List<Map<String, Object>> getAlerts() {
        log.info("Retrieving alerts list");
        List<Map<String, Object>> alerts = new ArrayList<>();
        try {
            LocalDateTime start = LocalDateTime.now().minusHours(24);
            Page<SystemLog> logs = systemLogRepository.findByTimestampAfter(
                start,
                PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "timestamp"))
            );
            for (SystemLog logItem : logs.getContent()) {
                if (logItem.getLevel() == null) continue;
                if (!(logItem.getLevel() == com.uci.competencia.model.enums.LogLevel.WARN
                    || logItem.getLevel() == com.uci.competencia.model.enums.LogLevel.ERROR)) {
                    continue;
                }
                Map<String, Object> alert = new HashMap<>();
                alert.put("id", logItem.getId());
                String condition = logItem.getErrorMessage();
                if (condition == null || condition.isBlank()) {
                    condition = logItem.getAction() != null ? logItem.getAction().name() : "SYSTEM_EVENT";
                }
                alert.put("condition", condition);
                alert.put("action", logItem.getAction() != null ? logItem.getAction().name() : "SYSTEM");
                alert.put("severity", logItem.getLevel() == com.uci.competencia.model.enums.LogLevel.ERROR ? "critical" : "warning");
                alert.put("isActive", true);
                alert.put("lastTriggered", logItem.getTimestamp() != null ? logItem.getTimestamp().toString() : null);
                alerts.add(alert);
                if (alerts.size() >= 10) break;
            }
        } catch (Exception e) {
            log.warn("Error retrieving alerts: {}", e.getMessage());
        }
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
        // ImplementaciÃ³n para eliminar alerta de BD
    }

    // ======================== PUBMED CONNECTION ========================

    @Override
    public boolean testPubmedConnection() {
        Map<String, Object> pubmed = checkPubMedProvider("diabetes");
        return "online".equals(pubmed.get("status")) || "warning".equals(pubmed.get("status"));
    }

    @Override
    public Map<String, Object> checkExternalApis(String queryText) {
        String query = normalizeExternalQuery(queryText);

        List<Map<String, Object>> providers = List.of(
            checkPubMedProvider(query),
            checkEuropePmcProvider(query),
            checkClinicalTrialsProvider(query)
        );

        long online = providers.stream()
            .filter(provider -> "online".equals(provider.get("status")))
            .count();
        long warning = providers.stream()
            .filter(provider -> "warning".equals(provider.get("status")))
            .count();
        long offline = providers.stream()
            .filter(provider -> "offline".equals(provider.get("status")))
            .count();

        String status = offline > 0 ? "DOWN" : (warning > 0 ? "DEGRADED" : "UP");

        Map<String, Object> summary = new HashMap<>();
        summary.put("total", providers.size());
        summary.put("online", online);
        summary.put("warning", warning);
        summary.put("offline", offline);

        Map<String, Object> response = new HashMap<>();
        response.put("status", status);
        response.put("testedAt", LocalDateTime.now());
        response.put("query", query);
        response.put("summary", summary);
        response.put("providers", providers);
        return response;
    }

    private Map<String, Object> checkPubMedProvider(String query) {
        String requestUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
            + "?db=pubmed&retmode=json&retmax=1&sort=relevance&term=" + encodeQuery(query);

        return checkProvider(
            "pubmed",
            "PubMed (NCBI E-utilities)",
            requestUrl,
            "https://www.ncbi.nlm.nih.gov/books/NBK25499/",
            "Literatura biomedica revisada por pares",
            this::extractPubMedCount
        );
    }

    private Map<String, Object> checkEuropePmcProvider(String query) {
        String requestUrl = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
            + "?query=" + encodeQuery(query) + "&format=json&resultType=core&pageSize=1";

        return checkProvider(
            "europepmc",
            "Europe PMC",
            requestUrl,
            "https://europepmc.org/RestfulWebService",
            "Indice europeo de publicaciones y preprints biomedicos",
            this::extractEuropePmcCount
        );
    }

    private Map<String, Object> checkClinicalTrialsProvider(String query) {
        String requestUrl = "https://clinicaltrials.gov/api/v2/studies"
            + "?query.term=" + encodeQuery(query) + "&pageSize=1";

        return checkProvider(
            "clinicaltrials",
            "ClinicalTrials.gov API v2",
            requestUrl,
            "https://clinicaltrials.gov/data-api/about-api",
            "Registro oficial de ensayos clinicos",
            this::extractClinicalTrialsCount
        );
    }

    private Map<String, Object> checkProvider(
        String id,
        String name,
        String requestUrl,
        String docsUrl,
        String description,
        Function<String, Long> countExtractor
    ) {
        long startedAt = System.currentTimeMillis();
        int httpStatus = 0;
        long resultCount = 0;
        String message = "Sin respuesta";
        String status = "offline";
        String error = null;

        HttpURLConnection connection = null;
        try {
            URL url = new URI(requestUrl).toURL();
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(8000);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("User-Agent", "uci-competencia-admin-diagnostics/1.0");

            httpStatus = connection.getResponseCode();
            String body = readResponseBody(connection, httpStatus);

            if (httpStatus >= 200 && httpStatus < 300) {
                try {
                    resultCount = countExtractor.apply(body);
                } catch (Exception parseError) {
                    log.debug("Could not parse {} count: {}", name, parseError.getMessage());
                    resultCount = 0;
                }
                status = "online";
                message = resultCount > 0
                    ? "Conectividad y respuesta validadas"
                    : "Conectividad validada, sin resultados para la consulta de prueba";
            } else {
                status = "offline";
                message = "HTTP " + httpStatus;
            }
        } catch (Exception ex) {
            status = "offline";
            message = "Fallo de conectividad";
            error = ex.getMessage();
            log.warn("External API check failed for {}: {}", name, ex.getMessage());
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }

        long latencyMs = Math.max(1, System.currentTimeMillis() - startedAt);

        Map<String, Object> provider = new HashMap<>();
        provider.put("id", id);
        provider.put("name", name);
        provider.put("description", description);
        provider.put("status", status);
        provider.put("httpStatus", httpStatus);
        provider.put("latencyMs", latencyMs);
        provider.put("resultCount", resultCount);
        provider.put("message", message);
        provider.put("error", error);
        provider.put("docsUrl", docsUrl);
        provider.put("requestUrl", requestUrl);
        provider.put("lastCheck", LocalDateTime.now());
        return provider;
    }

    private String readResponseBody(HttpURLConnection connection, int httpStatus) {
        try {
            InputStream stream = httpStatus >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (stream == null) {
                return "";
            }
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception ex) {
            return "";
        }
    }

    private long extractPubMedCount(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return 0;
        }
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            return root.path("esearchresult").path("count").asLong(0);
        } catch (Exception ex) {
            return 0;
        }
    }

    private long extractEuropePmcCount(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return 0;
        }
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            return root.path("hitCount").asLong(0);
        } catch (Exception ex) {
            return 0;
        }
    }

    private long extractClinicalTrialsCount(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return 0;
        }
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            long totalCount = root.path("totalCount").asLong(-1);
            if (totalCount >= 0) {
                return totalCount;
            }
            JsonNode studies = root.path("studies");
            return studies.isArray() ? studies.size() : 0;
        } catch (Exception ex) {
            return 0;
        }
    }

    private String encodeQuery(String query) {
        try {
            return java.net.URLEncoder.encode(query, StandardCharsets.UTF_8);
        } catch (Exception ex) {
            return "evidence";
        }
    }

    private String normalizeExternalQuery(String queryText) {
        if (queryText == null) {
            return "evidence based medicine";
        }
        String normalized = queryText
            .replaceAll("[\\u0000-\\u001f]+", " ")
            .trim()
            .replaceAll("\\s+", " ");
        if (normalized.length() > 180) {
            normalized = normalized.substring(0, 180);
        }
        return normalized.isEmpty() ? "evidence based medicine" : normalized;
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
    public void deleteBackup(String backupId) {
        log.info("Deleting backup: {}", backupId);
        if (backupId == null) {
            throw new RuntimeException("Backup not found: null");
        }
        BackupStatus removed = backupRegistry.remove(backupId);
        if (removed == null) {
            throw new RuntimeException("Backup not found: " + backupId);
        }
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

    @Override
    public Map<String, Object> getErrorMonitoringOverview(int windowMinutes, int limit) {
        return systemErrorInsightService.getMonitoringOverview(windowMinutes, limit);
    }

    @Override
    public Map<String, Object> analyzeRecentErrors(int windowMinutes, int limit) {
        return systemErrorInsightService.analyzeRecentErrors(windowMinutes, limit);
    }

    @Override
    public Map<String, Object> analyzeTestingLogs(Map<String, Object> payload) {
        Map<String, Object> summary = extractTestingSummary(payload);
        String prompt = buildTestingAiPrompt(payload, summary);
        LocalDateTime now = LocalDateTime.now();

        try {
            String raw = openAIService.generateText(prompt, true);
            Map<String, Object> parsed = parseTestingAiResponse(raw);
            if (parsed != null) {
                parsed.put("generatedAt", now.toString());
                parsed.putIfAbsent("summary", buildFallbackSummaryText(summary));
                parsed.putIfAbsent("confidence", 0.55d);
                return parsed;
            }
        } catch (Exception ex) {
            log.warn("AI testing analysis failed: {}", ex.getMessage());
        }

        Map<String, Object> fallback = buildFallbackTestingAnalysis(summary);
        fallback.put("generatedAt", now.toString());
        return fallback;
    }

    // ======================== MAINTENANCE ========================

    @Override
    public void optimizeDatabase() {
        log.info("Database optimization requested");
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        jdbcTemplate.execute("ANALYZE");
    }

    @Override
    public void rebuildSearchIndexes() {
        log.info("Search index rebuild requested");
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        jdbcTemplate.execute("REINDEX INDEX IF EXISTS idx_search_sessions_query_text");
        jdbcTemplate.execute("REINDEX INDEX IF EXISTS idx_system_logs_timestamp");
        jdbcTemplate.execute("REINDEX INDEX IF EXISTS idx_system_logs_user_id");
    }

    @Override
    @Transactional
    public long cleanupLogs(LocalDateTime olderThan) {
        log.info("Cleaning up logs older than {}", olderThan);
        try {
            return systemLogRepository.deleteByTimestampBefore(olderThan);
        } catch (Exception e) {
            log.error("Error cleaning logs: {}", e.getMessage());
            throw e;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> extractTestingSummary(Map<String, Object> payload) {
        Object summaryObj = payload != null ? payload.get("summary") : null;
        Map<String, Object> summary = summaryObj instanceof Map ? new HashMap<>((Map<String, Object>) summaryObj) : new HashMap<>();
        int total = toInt(summary.get("total"), 0);
        int passed = toInt(summary.get("passed"), 0);
        int failed = toInt(summary.get("failed"), 0);
        int skipped = toInt(summary.get("skipped"), 0);
        summary.put("total", Math.max(0, total));
        summary.put("passed", Math.max(0, passed));
        summary.put("failed", Math.max(0, failed));
        summary.put("skipped", Math.max(0, skipped));
        return summary;
    }

    private String buildTestingAiPrompt(Map<String, Object> payload, Map<String, Object> summary) {
        String jsonPayload = safeJson(payload, 7500);
        String summaryText = buildFallbackSummaryText(summary);
        StringBuilder builder = new StringBuilder();
        builder.append("Analiza resultados de pruebas de software XP y devuelve JSON valido sin markdown.\n");
        builder.append("Formato exacto:\n");
        builder.append("{\"summary\":\"...\",\"strengths\":[\"...\"],\"gaps\":[\"...\"],\"improvements\":[\"...\"],");
        builder.append("\"risks\":[\"...\"],\"nextActions\":[\"...\"],\"confidence\":0.0}\n");
        builder.append("Resumen actual: ").append(summaryText).append("\n");
        builder.append("Contexto JSON (logs y plan): ").append(jsonPayload).append("\n");
        builder.append("Condiciones:\n");
        builder.append("1) Responde en espanol tecnico y accionable.\n");
        builder.append("2) Prioriza recomendaciones para pruebas automatizadas primero.\n");
        builder.append("3) Identifica brechas por suite y casos pendientes.\n");
        builder.append("4) No incluyas texto fuera del JSON.\n");
        return builder.toString();
    }

    private Map<String, Object> parseTestingAiResponse(String raw) {
        if (!hasText(raw)) return null;
        String json = extractFirstJsonObject(raw);
        if (!hasText(json)) return null;
        try {
            JsonNode node = objectMapper.readTree(json);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("summary", trimToLength(node.path("summary").asText(""), 1800));
            result.put("strengths", readStringArray(node.path("strengths"), 12));
            result.put("gaps", readStringArray(node.path("gaps"), 12));
            result.put("improvements", readStringArray(node.path("improvements"), 12));
            result.put("risks", readStringArray(node.path("risks"), 10));
            result.put("nextActions", readStringArray(node.path("nextActions"), 10));
            double confidence = node.path("confidence").asDouble(0.6d);
            confidence = Math.max(0d, Math.min(1d, confidence));
            result.put("confidence", confidence);
            return result;
        } catch (Exception ex) {
            log.debug("Could not parse AI testing JSON response: {}", ex.getMessage());
            return null;
        }
    }

    private Map<String, Object> buildFallbackTestingAnalysis(Map<String, Object> summary) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("summary", buildFallbackSummaryText(summary));
        response.put("strengths", List.of("Existe una base de pruebas unitarias y evidencias en el panel."));
        response.put("gaps", List.of("Brechas en integracion, E2E, resiliencia, seguridad y rendimiento."));
        response.put("improvements", List.of(
            "Automatizar suites B1-B8 y ampliar cobertura de API.",
            "Agregar casos E2E por rol y flujos criticos.",
            "Definir objetivos de rendimiento y medirlos en CI."
        ));
        response.put("risks", List.of(
            "Cobertura incompleta puede ocultar fallos en produccion.",
            "Faltan evidencias automatizadas de resiliencia y seguridad."
        ));
        response.put("nextActions", List.of(
            "Priorizar ejecucion de pruebas criticas (auth, search, verify).",
            "Registrar evidencia manual de las suites pendientes.",
            "Preparar entorno para ejecutar E2E en CI."
        ));
        response.put("confidence", 0.45d);
        return response;
    }

    private String buildFallbackSummaryText(Map<String, Object> summary) {
        int total = toInt(summary.get("total"), 0);
        int passed = toInt(summary.get("passed"), 0);
        int failed = toInt(summary.get("failed"), 0);
        int skipped = toInt(summary.get("skipped"), 0);
        return String.format(
            Locale.US,
            "Total %d pruebas. Pasaron %d, fallaron %d, pendientes %d.",
            total,
            passed,
            failed,
            skipped
        );
    }

    private String safeJson(Object payload, int maxLen) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            if (json.length() <= maxLen) return json;
            return json.substring(0, maxLen) + "...";
        } catch (Exception ex) {
            return "";
        }
    }

    private List<String> readStringArray(JsonNode node, int max) {
        if (node == null || !node.isArray()) return List.of();
        List<String> values = new ArrayList<>();
        for (JsonNode item : node) {
            if (values.size() >= max) break;
            String value = trimToLength(item.asText(""), 420);
            if (hasText(value)) values.add(value);
        }
        return values;
    }

    private String extractFirstJsonObject(String raw) {
        int start = raw.indexOf('{');
        if (start < 0) return null;
        int depth = 0;
        for (int i = start; i < raw.length(); i++) {
            char ch = raw.charAt(i);
            if (ch == '{') depth++;
            if (ch == '}') depth--;
            if (depth == 0) {
                return raw.substring(start, i + 1);
            }
        }
        return null;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String trimToLength(String value, int max) {
        if (value == null) return "";
        if (value.length() <= max) return value.trim();
        return value.substring(0, max).trim();
    }

    private int toInt(Object value, int fallback) {
        if (value instanceof Number) return ((Number) value).intValue();
        if (value instanceof String) {
            try {
                return Integer.parseInt(((String) value).trim());
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }
}
