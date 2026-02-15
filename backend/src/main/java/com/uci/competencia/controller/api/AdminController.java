package com.uci.competencia.controller.api;

import com.uci.competencia.model.dto.request.UserBatchImportDTO;
import com.uci.competencia.model.dto.response.AuditLogDTO;
import com.uci.competencia.model.dto.response.UserDTO;
import com.uci.competencia.model.entity.SystemLog;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.LogLevel;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.repository.SystemLogRepository;
import com.uci.competencia.service.AdminService;
import com.uci.competencia.service.parser.UserFileParser;
import com.uci.competencia.service.specification.SystemLogSpecifications;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001", "https://frontend.uci.cu"})
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class AdminController {

    private final AdminService adminService;
    private final List<UserFileParser> fileParsers;
    private final SystemLogRepository systemLogRepository;

    @GetMapping("/users")
    public ResponseEntity<Map<String, Object>> getUsers(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search) {

        log.info("Getting users list - page: {}, limit: {}, role: {}, status: {}, search: {}", page, limit, role, status, search);

        if (page < 1) page = 1;
        if (limit < 1) limit = 50;
        if (limit > 200) limit = 200;

        Pageable pageable = PageRequest.of(page - 1, limit, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<User> userPage;

        Role parsedRole = null;
        Boolean active = null;

        if (status != null && !status.isEmpty() && "pending".equalsIgnoreCase(status)) {
            userPage = Page.empty(pageable);
        } else {
            if (role != null && !role.isEmpty()) {
                try {
                    parsedRole = parseRole(role);
                } catch (IllegalArgumentException e) {
                    Map<String, Object> error = new HashMap<>();
                    error.put("error", "Invalid role");
                    error.put("message", e.getMessage());
                    return ResponseEntity.badRequest().body(error);
                }
            }
            if (status != null && !status.isEmpty()) {
                active = "active".equalsIgnoreCase(status);
            }
            userPage = adminService.searchUsers(parsedRole, active, search, pageable);
        }

        List<UserDTO> userDTOs = userPage.getContent().stream()
                .map(this::convertToUserDTO)
                .collect(Collectors.toList());

        Map<String, Object> systemStats = adminService.getSystemStatistics();
        @SuppressWarnings("unchecked")
        Map<String, Long> usersByRole = (Map<String, Long>) systemStats.getOrDefault("usersByRole", Map.of());

        Map<String, Object> response = new HashMap<>();
        response.put("users", userDTOs);
        response.put("total", userPage.getTotalElements());
        response.put("page", page);
        response.put("limit", limit);
        response.put("totalPages", userPage.getTotalPages());
        response.put("stats", Map.of(
            "totalUsers", asLong(systemStats.get("totalUsers")),
            "students", usersByRole.getOrDefault("STUDENT", 0L),
            "professors", usersByRole.getOrDefault("PROFESSOR", 0L),
            "admins", usersByRole.getOrDefault("ADMIN", 0L),
            "active", asLong(systemStats.get("activeUsers")),
            "inactive", asLong(systemStats.get("inactiveUsers")),
            "pending", 0
        ));

        return ResponseEntity.ok(response);
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<UserDTO> getUserById(@PathVariable String id) {
        log.info("Getting user by ID: {}", id);

        User user = adminService.getUserById(id);
        UserDTO userDTO = convertToUserDTO(user);

        return ResponseEntity.ok(userDTO);
    }

    @PostMapping("/users")
    public ResponseEntity<UserDTO> createUser(@RequestBody UserDTO userDTO) {
        log.info("Creating new user: {}", userDTO.getEmail());

        User user;
        try {
            user = convertToUserEntity(userDTO);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
        User savedUser = adminService.createUser(user);
        UserDTO responseDTO = convertToUserDTO(savedUser);

        return ResponseEntity.status(201).body(responseDTO);
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<UserDTO> updateUser(@PathVariable String id, @RequestBody UserDTO userDTO) {
        log.info("Updating user: {}", id);

        User user;
        try {
            user = convertToUserEntity(userDTO);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
        User updatedUser = adminService.updateUser(id, user);
        UserDTO responseDTO = convertToUserDTO(updatedUser);

        return ResponseEntity.ok(responseDTO);
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable String id) {
        log.info("Deleting user: {}", id);

        adminService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/users/{id}/role")
    public ResponseEntity<UserDTO> changeUserRole(@PathVariable String id, @RequestBody Map<String, String> request) {
        String roleStr = request.get("role");
        if (roleStr == null) {
            return ResponseEntity.badRequest().build();
        }

        log.info("Changing role for user {} to {}", id, roleStr);

        Role newRole;
        try {
            newRole = parseRole(roleStr);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
        User updatedUser = adminService.changeUserRole(id, newRole);
        UserDTO userDTO = convertToUserDTO(updatedUser);

        return ResponseEntity.ok(userDTO);
    }

    @PutMapping("/users/{id}/status")
    public ResponseEntity<Void> changeUserStatus(@PathVariable String id, @RequestBody Map<String, Object> request) {
        Object activeObj = request.get("active");
        if (activeObj == null) {
            return ResponseEntity.badRequest().build();
        }
        boolean active = Boolean.parseBoolean(activeObj.toString());

        log.info("Changing status for user {} to {}", id, active ? "active" : "inactive");

        adminService.toggleUserStatus(id, active);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/users/import")
    public ResponseEntity<AdminService.BatchImportResult> importUsers(@RequestParam("file") MultipartFile file,
                                                                        @RequestParam(defaultValue = "false") boolean updateExisting) {
        log.info("Importing users from file: {}, updateExisting: {}", file.getOriginalFilename(), updateExisting);

        try {
            // Validar archivo
            if (file == null || file.isEmpty()) {
                log.warn("Import attempt with empty file");
                return ResponseEntity.badRequest().build();
            }

            // Encontrar parser apropiado para el tipo de archivo
            String filename = file.getOriginalFilename();
            UserFileParser parser = fileParsers.stream()
                .filter(p -> p.supports(filename))
                .findFirst()
                .orElse(null);

            if (parser == null) {
                log.warn("No parser available for file: {}", filename);
                AdminService.BatchImportResult errorResult = new AdminService.BatchImportResult();
                errorResult.created = 0;
                errorResult.updated = 0;
                errorResult.failed = 1;
                errorResult.errors = List.of("Formato de archivo no soportado. Use CSV");
                errorResult.warnings = List.of();
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResult);
            }

            // Parsear archivo
            UserBatchImportDTO importDTO = parser.parse(file);
            importDTO.setUpdateExisting(updateExisting);

            // Ejecutar importacion
            AdminService.BatchImportResult result = adminService.importUsersBatch(importDTO);
            
            log.info("Import completed: created={}, updated={}, failed={}", 
                result.created, result.updated, result.failed);
            
            return ResponseEntity.ok(result);
            
        } catch (IOException e) {
            log.error("Error reading import file: {}", e.getMessage());
            AdminService.BatchImportResult errorResult = new AdminService.BatchImportResult();
            errorResult.created = 0;
            errorResult.updated = 0;
            errorResult.failed = 1;
            errorResult.errors = List.of("Error leyendo archivo: " + e.getMessage());
            errorResult.warnings = List.of();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResult);
        } catch (Exception e) {
            log.error("Unexpected error during import: {}", e.getMessage(), e);
            AdminService.BatchImportResult errorResult = new AdminService.BatchImportResult();
            errorResult.created = 0;
            errorResult.updated = 0;
            errorResult.failed = 1;
            errorResult.errors = List.of("Error durante la importacion: " + e.getMessage());
            errorResult.warnings = List.of();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResult);
        }
    }

    @PostMapping("/users/import-csv")
    public ResponseEntity<AdminService.BatchImportResult> importUsersCsv(@RequestBody Map<String, Object> request) {
        log.info("Importing users from CSV payload");

        try {
            Object usersObj = request.get("users");
            if (!(usersObj instanceof List)) {
                return ResponseEntity.badRequest().build();
            }

            boolean updateExisting = Boolean.parseBoolean(request.getOrDefault("updateExisting", "false").toString());
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> users = (List<Map<String, Object>>) usersObj;

            List<UserBatchImportDTO.UserImportRecord> records = new ArrayList<>();
            for (Map<String, Object> user : users) {
                String email = Objects.toString(user.get("email"), "").trim();
                if (email.isEmpty()) {
                    continue;
                }

                String name = Objects.toString(user.get("name"), "").trim();
                String firstName = Objects.toString(user.get("firstName"), "").trim();
                String lastName = Objects.toString(user.get("lastName"), "").trim();
                if (!name.isEmpty() && (firstName.isEmpty() && lastName.isEmpty())) {
                    String[] parts = name.split("\\s+");
                    firstName = parts.length > 0 ? parts[0] : "";
                    lastName = parts.length > 1 ? String.join(" ", Arrays.copyOfRange(parts, 1, parts.length)) : "";
                }

                UserBatchImportDTO.UserImportRecord record = UserBatchImportDTO.UserImportRecord.builder()
                    .email(email)
                    .firstName(firstName)
                    .lastName(lastName)
                    .role(Objects.toString(user.get("role"), "STUDENT").toUpperCase())
                    .faculty(Objects.toString(user.get("faculty"), null))
                    .passwordHash(Objects.toString(user.get("password"), Objects.toString(user.get("passwordHash"), "")))
                    .build();

                records.add(record);
            }

            UserBatchImportDTO importDTO = UserBatchImportDTO.builder()
                .users(records)
                .sourceType("CSV")
                .updateExisting(updateExisting)
                .build();

            AdminService.BatchImportResult result = adminService.importUsersBatch(importDTO);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error importing users from CSV payload: {}", e.getMessage(), e);
            AdminService.BatchImportResult errorResult = new AdminService.BatchImportResult();
            errorResult.created = 0;
            errorResult.updated = 0;
            errorResult.failed = 1;
            errorResult.errors = List.of("Error durante la importacion: " + e.getMessage());
            errorResult.warnings = List.of();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResult);
        }
    }

    @GetMapping("/audit/logs")
    public ResponseEntity<Map<String, Object>> getAuditLogs(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "100") int limit,
            @RequestParam(required = false) String level,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "timestamp") String orderBy,
            @RequestParam(defaultValue = "DESC") String order) {

        log.info("Getting audit logs - page: {}, limit: {}, level: {}, userId: {}, action: {}, search: {}, startDate: {}, endDate: {}", 
            page, limit, level, userId, action, search, startDate, endDate);

        try {
            // Validar limites
            if (page < 1) page = 1;
            if (limit < 1) limit = 100;
            if (limit > 500) limit = 500; // Limite maximo para evitar carga

            // Construir especificacion de busqueda dinamicamente
            Specification<SystemLog> baseSpec = (root, query, cb) -> cb.conjunction();

            if (userId != null && !userId.isEmpty()) {
                baseSpec = baseSpec.and(SystemLogSpecifications.hasUserId(userId));
            }

            if (action != null && !action.isEmpty()) {
                try {
                    baseSpec = baseSpec.and(SystemLogSpecifications.hasAction(
                        com.uci.competencia.model.enums.ActionType.valueOf(action.toUpperCase())
                    ));
                } catch (IllegalArgumentException e) {
                    log.warn("Invalid action type: {}", action);
                }
            }

            if (search != null && !search.isEmpty()) {
                baseSpec = baseSpec.and(SystemLogSpecifications.containsSearch(search));
            }

            LocalDateTime start = parseDateParam(startDate, false);
            LocalDateTime end = parseDateParam(endDate, true);
            if (startDate != null && !startDate.isBlank() && start == null) {
                log.warn("Invalid startDate format: {}. Use yyyy-MM-dd or yyyy-MM-ddTHH:mm:ss", startDate);
            }
            if (endDate != null && !endDate.isBlank() && end == null) {
                log.warn("Invalid endDate format: {}. Use yyyy-MM-dd or yyyy-MM-ddTHH:mm:ss", endDate);
            }
            baseSpec = baseSpec.and(SystemLogSpecifications.fromTimestamp(start));
            baseSpec = baseSpec.and(SystemLogSpecifications.toTimestamp(end));

            Specification<SystemLog> filteredSpec = baseSpec;
            if (level != null && !level.isEmpty()) {
                try {
                    filteredSpec = filteredSpec.and(SystemLogSpecifications.hasLevel(LogLevel.valueOf(level.toUpperCase())));
                } catch (IllegalArgumentException e) {
                    log.warn("Invalid log level: {}", level);
                }
            }

            // Configurar paginación y ordenamiento
            Sort.Direction sortDirection;
            try {
                sortDirection = Sort.Direction.valueOf(order.toUpperCase());
            } catch (IllegalArgumentException e) {
                sortDirection = Sort.Direction.DESC;
            }
            String safeOrderBy = switch (orderBy) {
                case "timestamp", "level", "responseStatus", "action" -> orderBy;
                default -> "timestamp";
            };
            Pageable pageable = PageRequest.of(page - 1, limit, Sort.by(sortDirection, safeOrderBy));

            // Ejecutar búsqueda
            Page<SystemLog> logPage = systemLogRepository.findAll(filteredSpec, pageable);

            // Convertir a DTOs
            List<AuditLogDTO> logDTOs = logPage.getContent().stream()
                .map(this::convertToAuditLogDTO)
                .collect(Collectors.toList());

            Map<String, Object> stats = new HashMap<>();
            stats.put("info", systemLogRepository.count(baseSpec.and(SystemLogSpecifications.hasLevel(LogLevel.INFO))));
            stats.put("warn", systemLogRepository.count(baseSpec.and(SystemLogSpecifications.hasLevel(LogLevel.WARN))));
            stats.put("error", systemLogRepository.count(baseSpec.and(SystemLogSpecifications.hasLevel(LogLevel.ERROR))));

            // Construir respuesta
            Map<String, Object> response = new HashMap<>();
            response.put("logs", logDTOs);
            response.put("total", logPage.getTotalElements());
            response.put("page", page);
            response.put("limit", limit);
            response.put("totalPages", logPage.getTotalPages());
            response.put("hasMore", logPage.hasNext());
            response.put("stats", stats);

            log.info("Audit logs retrieved: {} records from {} total", logDTOs.size(), logPage.getTotalElements());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error retrieving audit logs: {}", e.getMessage(), e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error al recuperar logs");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> getSystemHealth() {
        log.info("Getting system health");

        Map<String, Object> health = adminService.getSystemHealth();
        return ResponseEntity.ok(health);
    }

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboardData() {
        log.info("Getting admin dashboard data");

        Map<String, Object> dashboard = adminService.getDashboardData();
        return ResponseEntity.ok(dashboard);
    }

    @GetMapping("/system/overview")
    public ResponseEntity<Map<String, Object>> getSystemOverview() {
        log.info("Getting system overview");

        Map<String, Object> overview = adminService.getSystemOverview();
        return ResponseEntity.ok(overview);
    }

    @GetMapping("/settings")
    public ResponseEntity<AdminService.SystemConfiguration> getSettings() {
        log.info("Getting system settings");

        AdminService.SystemConfiguration config = adminService.getSystemConfiguration();
        return ResponseEntity.ok(config);
    }

    @PutMapping("/settings")
    public ResponseEntity<Void> updateSettings(@RequestBody AdminService.SystemConfiguration config) {
        log.info("Updating system settings");

        adminService.updateSystemConfiguration(config);
        return ResponseEntity.ok().build();
    }

    // ======================== BACKUP ENDPOINTS ========================
    
    @PostMapping("/backup")
    public ResponseEntity<Map<String, Object>> createBackup(@RequestBody Map<String, Object> backupOptions) {
        log.info("Creating backup with options: {}", backupOptions);

        try {
            boolean includeLogs = Boolean.parseBoolean(backupOptions.getOrDefault("includeLogs", "false").toString());
            boolean includeUsers = Boolean.parseBoolean(backupOptions.getOrDefault("includeUsers", "false").toString());
            
            String backupId = adminService.initiateBackup("FULL", includeLogs);

            Map<String, Object> response = new HashMap<>();
            response.put("backupId", backupId);
            response.put("status", "INITIATED");
            response.put("message", "Backup iniciado correctamente");

            return ResponseEntity.status(201).body(response);
        } catch (Exception e) {
            log.error("Error creating backup: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error al crear backup");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @GetMapping("/backups")
    public ResponseEntity<Map<String, Object>> getBackups() {
        log.info("Getting list of backups");

        try {
            List<Map<String, Object>> backups = adminService.getBackupsList();
            
            Map<String, Object> response = new HashMap<>();
            response.put("backups", backups);
            response.put("count", backups.size());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error retrieving backups: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error al recuperar backups");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @PostMapping("/backups/{backupId}/restore")
    public ResponseEntity<Map<String, Object>> restoreBackup(@PathVariable String backupId) {
        log.info("Restoring backup: {}", backupId);

        try {
            adminService.restoreBackup(backupId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("backupId", backupId);
            response.put("status", "RESTORED");
            response.put("message", "Backup restaurado correctamente");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error restoring backup: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error al restaurar backup");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @DeleteMapping("/backups/{backupId}")
    public ResponseEntity<Void> deleteBackup(@PathVariable String backupId) {
        log.info("Deleting backup: {}", backupId);

        try {
            adminService.deleteBackup(backupId);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            log.error("Error deleting backup: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    // ======================== ALERTS ENDPOINTS ========================

    @GetMapping("/alerts")
    public ResponseEntity<Map<String, Object>> getAlerts() {
        log.info("Getting alerts list");

        try {
            List<Map<String, Object>> alerts = adminService.getAlerts();
            
            Map<String, Object> response = new HashMap<>();
            response.put("alerts", alerts);
            response.put("count", alerts.size());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error retrieving alerts: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error al recuperar alertas");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @PostMapping("/alerts")
    public ResponseEntity<Map<String, Object>> createAlert(@RequestBody Map<String, Object> alertRequest) {
        log.info("Creating new alert: {}", alertRequest);

        try {
            Map<String, Object> alert = adminService.createAlert(alertRequest);
            
            return ResponseEntity.status(201).body(alert);
        } catch (Exception e) {
            log.error("Error creating alert: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error al crear alerta");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
        }
    }

    @PutMapping("/alerts/{alertId}")
    public ResponseEntity<Map<String, Object>> updateAlert(
            @PathVariable String alertId,
            @RequestBody Map<String, Object> alertRequest) {
        log.info("Updating alert: {}", alertId);

        try {
            Map<String, Object> alert = adminService.updateAlert(alertId, alertRequest);
            
            return ResponseEntity.ok(alert);
        } catch (Exception e) {
            log.error("Error updating alert: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error al actualizar alerta");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
        }
    }

    @DeleteMapping("/alerts/{alertId}")
    public ResponseEntity<Void> deleteAlert(@PathVariable String alertId) {
        log.info("Deleting alert: {}", alertId);

        try {
            adminService.deleteAlert(alertId);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            log.error("Error deleting alert: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    // ======================== PUBMED ENDPOINTS ========================

    @PostMapping("/test-pubmed")
    public ResponseEntity<Map<String, Object>> testPubmedConnection() {
        log.info("Testing PubMed connection");

        try {
            boolean isConnected = adminService.testPubmedConnection();
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", isConnected);
            response.put("message", isConnected ? "Conexion exitosa a PubMed" : "No se pudo conectar a PubMed");
            response.put("timestamp", LocalDateTime.now());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error testing PubMed connection: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Error al probar conexion PubMed: " + e.getMessage());
            errorResponse.put("timestamp", LocalDateTime.now());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    // ======================== AUDIT EXPORT ENDPOINT ========================

    @GetMapping("/audit/export")
    public ResponseEntity<Map<String, Object>> exportAuditLogs(
            @RequestParam(required = false, defaultValue = "json") String format,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String level,
            @RequestParam(required = false) String userId) {
        
        log.info("Exporting audit logs - format: {}, startDate: {}, endDate: {}", format, startDate, endDate);

        try {
            // Validar formato
            if (!format.matches("pdf|excel|json|csv")) {
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("error", "Formato no valido");
                errorResponse.put("message", "Use: pdf, excel, json o csv");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
            }

            // Preparar parametros de filtro
            Map<String, Object> filters = new HashMap<>();
            if (startDate != null && !startDate.isEmpty()) filters.put("startDate", startDate);
            if (endDate != null && !endDate.isEmpty()) filters.put("endDate", endDate);
            if (level != null && !level.isEmpty()) filters.put("level", level);
            if (userId != null && !userId.isEmpty()) filters.put("userId", userId);

            Map<String, Object> export = adminService.exportAuditLogs(format, filters);
            
            Map<String, Object> response = new HashMap<>();
            response.put("id", export.getOrDefault("id", "export_" + System.currentTimeMillis()));
            response.put("fileName", export.getOrDefault("fileName", "audit_logs." + format));
            response.put("downloadUrl", export.getOrDefault("downloadUrl", "/downloads/" + export.getOrDefault("id", "export")));
            response.put("size", export.getOrDefault("size", 0));
            response.put("format", format);
            response.put("createdAt", LocalDateTime.now());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error exporting audit logs: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error al exportar logs");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @PostMapping("/audit/export")
    public ResponseEntity<Map<String, Object>> exportAuditLogsPost(@RequestBody Map<String, Object> request) {
        String format = Objects.toString(request.getOrDefault("format", "json"), "json");
        String startDate = Objects.toString(request.getOrDefault("startDate", null), null);
        String endDate = Objects.toString(request.getOrDefault("endDate", null), null);
        String level = Objects.toString(request.getOrDefault("level", null), null);
        String userId = Objects.toString(request.getOrDefault("userId", request.getOrDefault("user", null)), null);

        log.info("Exporting audit logs (POST) - format: {}, startDate: {}, endDate: {}", format, startDate, endDate);

        try {
            if (!format.matches("pdf|excel|json|csv")) {
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("error", "Formato no valido");
                errorResponse.put("message", "Use: pdf, excel, json o csv");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
            }

            Map<String, Object> filters = new HashMap<>();
            if (startDate != null && !startDate.isEmpty()) filters.put("startDate", startDate);
            if (endDate != null && !endDate.isEmpty()) filters.put("endDate", endDate);
            if (level != null && !level.isEmpty()) filters.put("level", level);
            if (userId != null && !userId.isEmpty()) filters.put("userId", userId);

            Map<String, Object> export = adminService.exportAuditLogs(format, filters);

            Map<String, Object> response = new HashMap<>();
            response.put("id", export.getOrDefault("id", "export_" + System.currentTimeMillis()));
            response.put("fileName", export.getOrDefault("fileName", "audit_logs." + format));
            response.put("downloadUrl", export.getOrDefault("downloadUrl", "/downloads/" + export.getOrDefault("id", "export")));
            response.put("size", export.getOrDefault("size", 0));
            response.put("format", format);
            response.put("createdAt", LocalDateTime.now());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error exporting audit logs (POST): {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error al exportar logs");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    // ======================== MAINTENANCE ENDPOINTS ========================

    @PostMapping("/cache/clear")
    public ResponseEntity<Map<String, Object>> clearCache(@RequestBody Map<String, Object> request) {
        log.info("Clearing cache with request: {}", request);
        try {
            Object names = request.getOrDefault("cacheNames", List.of("all"));
            List<String> cacheNames;
            if (names instanceof List) {
                cacheNames = ((List<?>) names).stream().map(String::valueOf).collect(Collectors.toList());
            } else {
                cacheNames = List.of(String.valueOf(names));
            }
            adminService.clearCache(cacheNames);
            Map<String, Object> response = new HashMap<>();
            response.put("status", "OK");
            response.put("cleared", cacheNames);
            response.put("timestamp", LocalDateTime.now());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error clearing cache: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error al limpiar cache");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @PostMapping("/db/optimize")
    public ResponseEntity<Map<String, Object>> optimizeDatabase() {
        log.info("Optimizing database");
        try {
            adminService.optimizeDatabase();
            Map<String, Object> response = new HashMap<>();
            response.put("status", "OK");
            response.put("message", "Optimizacion iniciada");
            response.put("timestamp", LocalDateTime.now());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error optimizing database: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error al optimizar base de datos");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @PostMapping("/logs/cleanup")
    public ResponseEntity<Map<String, Object>> cleanupLogs(@RequestBody Map<String, Object> request) {
        log.info("Cleaning logs with request: {}", request);
        try {
            int olderThanDays = Integer.parseInt(request.getOrDefault("olderThanDays", 30).toString());
            LocalDateTime cutoff = LocalDateTime.now().minusDays(Math.max(1, olderThanDays));
            long deleted = adminService.cleanupLogs(cutoff);
            Map<String, Object> response = new HashMap<>();
            response.put("status", "OK");
            response.put("deleted", deleted);
            response.put("olderThanDays", olderThanDays);
            response.put("timestamp", LocalDateTime.now());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error cleaning logs: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error al limpiar logs");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @PostMapping("/search/reindex")
    public ResponseEntity<Map<String, Object>> rebuildSearchIndexes() {
        log.info("Rebuilding search indexes");
        try {
            adminService.rebuildSearchIndexes();
            Map<String, Object> response = new HashMap<>();
            response.put("status", "OK");
            response.put("message", "Reindexacion iniciada");
            response.put("timestamp", LocalDateTime.now());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error rebuilding search indexes: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error al regenerar indices");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    private long asLong(Object value) {
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        if (value == null) {
            return 0;
        }
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private LocalDateTime parseDateParam(String value, boolean endOfDay) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            if (value.contains("T")) {
                return LocalDateTime.parse(value, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            }
            LocalDate date = LocalDate.parse(value, DateTimeFormatter.ISO_LOCAL_DATE);
            return endOfDay ? LocalDateTime.of(date, LocalTime.MAX) : date.atStartOfDay();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private UserDTO convertToUserDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setEmail(user.getEmail());
        String fullName = (String.format("%s %s",
            Optional.ofNullable(user.getFirstName()).orElse(""),
            Optional.ofNullable(user.getLastName()).orElse(""))).trim();
        dto.setName(fullName.isBlank() ? user.getEmail() : fullName);
        dto.setFirstName(user.getFirstName());
        dto.setLastName(user.getLastName());
        dto.setRole(user.getRole().name().toLowerCase().replace("role_", ""));
        dto.setAvatar(user.getAvatar());
        dto.setFaculty(user.getFaculty());
        dto.setActive(user.isActive());
        dto.setCreatedAt(user.getCreatedAt() != null ? user.getCreatedAt().toString() : null);
        dto.setLastLogin(user.getLastLogin() != null ? user.getLastLogin().toString() : null);
        return dto;
    }

    private User convertToUserEntity(UserDTO dto) {
        User user = new User();
        user.setEmail(dto.getEmail());
        user.setFirstName(dto.getFirstName());
        user.setLastName(dto.getLastName());
        if (dto.getRole() != null) {
            user.setRole(parseRole(dto.getRole()));
        }
        user.setFaculty(dto.getFaculty());
        user.setActive(dto.isActive());
        return user;
    }

    private Role parseRole(String roleStr) {
        if (roleStr == null || roleStr.trim().isEmpty()) {
            throw new IllegalArgumentException("Role cannot be empty");
        }
        String normalized = roleStr.trim().toUpperCase();
        if (normalized.startsWith("ROLE_")) {
            normalized = normalized.substring("ROLE_".length());
        }
        switch (normalized) {
            case "STUDENT":
                return Role.ROLE_STUDENT;
            case "PROFESSOR":
                return Role.ROLE_PROFESSOR;
            case "ADMIN":
                return Role.ROLE_ADMIN;
            default:
                throw new IllegalArgumentException("Invalid role: " + roleStr);
        }
    }

    /**
     * Convierte SystemLog a AuditLogDTO
     */
    private AuditLogDTO convertToAuditLogDTO(SystemLog log) {
        return AuditLogDTO.builder()
            .id(log.getId())
            .timestamp(log.getTimestamp())
            .level(log.getLevel() != null ? log.getLevel().name() : null)
            .userId(log.getUserId())
            .userRole(log.getUserRole())
            .ipAddress(log.getIpAddress())
            .userAgent(log.getUserAgent())
            .action(log.getAction() != null ? log.getAction().name() : null)
            .endpoint(log.getEndpoint())
            .responseTime(log.getResponseTime())
            .responseStatus(log.getResponseStatus())
            .errorMessage(log.getErrorMessage())
            .build();
    }
}
