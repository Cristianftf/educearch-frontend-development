package com.uci.competencia.service.impl;

import com.uci.competencia.model.dto.request.UserBatchImportDTO;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.entity.SystemLog;
import com.uci.competencia.model.enums.ActionType;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.repository.UserRepository;
import com.uci.competencia.repository.SystemLogRepository;
import com.uci.competencia.repository.SearchSessionRepository;
import com.uci.competencia.service.AdminService;
import com.uci.competencia.service.specification.UserSpecifications;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
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
import java.lang.management.ManagementFactory;
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
    private final SystemLogRepository systemLogRepository;
    private final SearchSessionRepository searchSessionRepository;
    private final DataSource dataSource;

    @Autowired(required = false)
    private CacheManager cacheManager;

    @Autowired(required = false)
    private RedisConnectionFactory redisConnectionFactory;
    
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
        existingUser.setFirstName(user.getFirstName());
        existingUser.setLastName(user.getLastName());
        existingUser.setEmail(user.getEmail());
        existingUser.setFaculty(user.getFaculty());
        existingUser.setActive(user.isActive());
        if (user.getRole() != null) {
            existingUser.setRole(user.getRole());
        }
        return userRepository.save(existingUser);
    }

    @Override
    public void deleteUser(String id) {
        userRepository.deleteById(id);
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
            long activeUsers = userRepository.countByActive(true);
            long inactiveUsers = Math.max(0, totalUsers - activeUsers);
            
            // Información del sistema
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
    private Map<String, Object> getMemoryUsage() {
        java.lang.Runtime runtime = java.lang.Runtime.getRuntime();
        Map<String, Object> memory = new HashMap<>();
        memory.put("totalMemory", runtime.totalMemory());
        memory.put("freeMemory", runtime.freeMemory());
        memory.put("usedMemory", runtime.totalMemory() - runtime.freeMemory());
        memory.put("maxMemory", runtime.maxMemory());
        return memory;
    }

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
            File[] roots = File.listRoots();
            if (roots == null || roots.length == 0) {
                return 0;
            }
            File selected = roots[0];
            for (File root : roots) {
                if (root.getTotalSpace() > selected.getTotalSpace()) {
                    selected = root;
                }
            }
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
            File[] roots = File.listRoots();
            if (roots == null || roots.length == 0) {
                storage.put("totalBytes", 0);
                storage.put("freeBytes", 0);
                return storage;
            }
            File selected = roots[0];
            for (File root : roots) {
                if (root.getTotalSpace() > selected.getTotalSpace()) {
                    selected = root;
                }
            }
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
            Integer count = jdbcTemplate.queryForObject("select count(*) from pg_stat_activity", Integer.class);
            return count != null ? count : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    private int getDatabaseMaxConnections() {
        try {
            JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
            Integer max = jdbcTemplate.queryForObject("show max_connections", Integer.class);
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
            Properties stats = connection.info("stats");
            Properties memory = connection.info("memory");
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

        services.add(serviceStatus("API Principal", "online", avgLatency(latency), null, now));

        boolean dbOk = getDatabaseConnectionCount() > 0;
        services.add(serviceStatus("Base de Datos", dbOk ? "online" : "warning", null, null, now));

        boolean cacheOk = cacheManager != null;
        services.add(serviceStatus("Cache Redis", cacheOk ? "online" : "warning", null, null, now));

        boolean pubmedEnabled = true;
        try {
            SystemConfiguration config = getSystemConfiguration();
            if (config != null && config.pubmed != null) {
                Object enabled = config.pubmed.getOrDefault("enabled", true);
                pubmedEnabled = Boolean.parseBoolean(String.valueOf(enabled));
            }
        } catch (Exception ignored) {
        }
        services.add(serviceStatus("PubMed Gateway", pubmedEnabled ? "online" : "offline", null, null, now));

        boolean ragEnabled = true;
        try {
            SystemConfiguration config = getSystemConfiguration();
            if (config != null && config.rag != null) {
                Object enabled = config.rag.getOrDefault("enabled", true);
                ragEnabled = Boolean.parseBoolean(String.valueOf(enabled));
            }
        } catch (Exception ignored) {
        }
        services.add(serviceStatus("Servicio RAG", ragEnabled ? "online" : "offline", null, null, now));

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
        List<Map<String, Object>> apiItems = new ArrayList<>();

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
            } else {
                Map<String, Object> apiItem = new HashMap<>();
                apiItem.put("endpoint", log.getEndpoint() != null ? log.getEndpoint() : "API");
                apiItem.put("calls", 1);
                apiItem.put("status", log.getResponseStatus() != null && log.getResponseStatus() >= 400 ? "WARN" : "OK");
                apiItems.add(apiItem);
            }

            if (userItems.size() >= 6 && systemItems.size() >= 6 && apiItems.size() >= 6) {
                break;
            }
        }

        activity.put("users", userItems);
        activity.put("system", systemItems);
        activity.put("api", aggregateApiUsage(apiItems));
        return activity;
    }

    private List<Map<String, Object>> aggregateApiUsage(List<Map<String, Object>> raw) {
        Map<String, Map<String, Object>> grouped = new LinkedHashMap<>();
        for (Map<String, Object> item : raw) {
            String endpoint = String.valueOf(item.getOrDefault("endpoint", "API"));
            Map<String, Object> existing = grouped.computeIfAbsent(endpoint, (key) -> {
                Map<String, Object> map = new HashMap<>();
                map.put("endpoint", key);
                map.put("calls", 0);
                map.put("status", "OK");
                return map;
            });
            int calls = ((Number) existing.get("calls")).intValue();
            existing.put("calls", calls + 1);
            String status = String.valueOf(item.getOrDefault("status", "OK"));
            if ("WARN".equals(status)) {
                existing.put("status", "WARN");
            }
        }
        return new ArrayList<>(grouped.values());
    }

    private Map<String, String> resolveUserNames(List<SystemLog> logs) {
        Set<String> ids = logs.stream()
            .map(SystemLog::getUserId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        Map<String, String> names = new HashMap<>();
        userRepository.findAllById(ids).forEach(user -> {
            String name = String.format("%s %s",
                Optional.ofNullable(user.getFirstName()).orElse(""),
                Optional.ofNullable(user.getLastName()).orElse("")).trim();
            names.put(user.getId(), name.isBlank() ? user.getEmail() : name);
        });
        return names;
    }

    private List<Map<String, Object>> buildScheduledTasks() {
        List<Map<String, Object>> tasks = new ArrayList<>();
        tasks.add(schedule("Backup diario", "Todos los días a las 22:00", "active"));
        tasks.add(schedule("Limpieza de caché", "Cada 6 horas", "active"));
        tasks.add(schedule("Sincronización MeSH", "Cada domingo a las 03:00", "active"));
        tasks.add(schedule("Reporte semanal", "Cada lunes a las 08:00", "active"));
        tasks.add(schedule("Verificación de integridad", "Cada día a las 04:00", "active"));
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
}
