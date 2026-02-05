package com.uci.competencia.controller.api;

import com.uci.competencia.model.dto.request.UserBatchImportDTO;
import com.uci.competencia.model.dto.response.AuditLogDTO;
import com.uci.competencia.model.dto.response.UserDTO;
import com.uci.competencia.model.entity.SystemLog;
import com.uci.competencia.model.entity.User;
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
import java.time.LocalDateTime;
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
            @RequestParam(required = false) String status) {

        log.info("Getting users list - page: {}, limit: {}, role: {}, status: {}", page, limit, role, status);

        Pageable pageable = PageRequest.of(page - 1, limit);
        Page<User> userPage;

        // Apply filters
        if (role != null && !role.isEmpty()) {
            Role userRole = Role.valueOf(role.toUpperCase());
            userPage = adminService.getUsersByRole(userRole, pageable);
        } else {
            userPage = adminService.getAllUsers(pageable);
        }

        List<UserDTO> userDTOs = userPage.getContent().stream()
                .map(this::convertToUserDTO)
                .collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("users", userDTOs);
        response.put("total", userPage.getTotalElements());
        response.put("page", page);
        response.put("limit", limit);
        response.put("totalPages", userPage.getTotalPages());

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

        User user = convertToUserEntity(userDTO);
        User savedUser = adminService.createUser(user);
        UserDTO responseDTO = convertToUserDTO(savedUser);

        return ResponseEntity.status(201).body(responseDTO);
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<UserDTO> updateUser(@PathVariable String id, @RequestBody UserDTO userDTO) {
        log.info("Updating user: {}", id);

        User user = convertToUserEntity(userDTO);
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

        Role newRole = Role.valueOf(roleStr.toUpperCase());
        User updatedUser = adminService.changeUserRole(id, newRole);
        UserDTO userDTO = convertToUserDTO(updatedUser);

        return ResponseEntity.ok(userDTO);
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

            // Ejecutar importación
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
            errorResult.errors = List.of("Error durante la importación: " + e.getMessage());
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
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "timestamp") String orderBy,
            @RequestParam(defaultValue = "DESC") String order) {

        log.info("Getting audit logs - page: {}, limit: {}, level: {}, userId: {}, action: {}, startDate: {}, endDate: {}", 
            page, limit, level, userId, action, startDate, endDate);

        try {
            // Validar límites
            if (page < 1) page = 1;
            if (limit < 1) limit = 100;
            if (limit > 500) limit = 500; // Límite máximo para evitar carga

            // Construir especificación de búsqueda dinámicamente
            Specification<SystemLog> spec = (root, query, cb) -> cb.conjunction();

            // Filtro por nivel
            if (level != null && !level.isEmpty()) {
                try {
                    spec = spec.and(SystemLogSpecifications.hasLevel(
                        com.uci.competencia.model.enums.LogLevel.valueOf(level.toUpperCase())
                    ));
                } catch (IllegalArgumentException e) {
                    log.warn("Invalid log level: {}", level);
                }
            }

            // Filtro por usuario
            if (userId != null && !userId.isEmpty()) {
                spec = spec.and(SystemLogSpecifications.hasUserId(userId));
            }

            // Filtro por acción
            if (action != null && !action.isEmpty()) {
                try {
                    spec = spec.and(SystemLogSpecifications.hasAction(
                        com.uci.competencia.model.enums.ActionType.valueOf(action.toUpperCase())
                    ));
                } catch (IllegalArgumentException e) {
                    log.warn("Invalid action type: {}", action);
                }
            }

            // Filtro por rango de tiempo
            DateTimeFormatter formatter = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
            LocalDateTime start = null;
            LocalDateTime end = null;

            try {
                if (startDate != null && !startDate.isEmpty()) {
                    start = LocalDateTime.parse(startDate, formatter);
                    spec = spec.and(SystemLogSpecifications.fromTimestamp(start));
                }
                if (endDate != null && !endDate.isEmpty()) {
                    end = LocalDateTime.parse(endDate, formatter);
                    spec = spec.and(SystemLogSpecifications.toTimestamp(end));
                }
            } catch (DateTimeParseException e) {
                log.warn("Invalid date format. Use ISO-8601 format (yyyy-MM-ddTHH:mm:ss): {}", e.getMessage());
            }

            // Configurar paginación y ordenamiento
            Sort.Direction sortDirection = Sort.Direction.valueOf(order.toUpperCase());
            Pageable pageable = PageRequest.of(page - 1, limit, Sort.by(sortDirection, orderBy));

            // Ejecutar búsqueda
            Page<SystemLog> logPage = systemLogRepository.findAll(spec, pageable);

            // Convertir a DTOs
            List<AuditLogDTO> logDTOs = logPage.getContent().stream()
                .map(this::convertToAuditLogDTO)
                .collect(Collectors.toList());

            // Construir respuesta
            Map<String, Object> response = new HashMap<>();
            response.put("logs", logDTOs);
            response.put("total", logPage.getTotalElements());
            response.put("page", page);
            response.put("limit", limit);
            response.put("totalPages", logPage.getTotalPages());
            response.put("hasMore", logPage.hasNext());

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
            response.put("message", isConnected ? "Conexión exitosa a PubMed" : "No se pudo conectar a PubMed");
            response.put("timestamp", LocalDateTime.now());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error testing PubMed connection: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Error al probar conexión PubMed: " + e.getMessage());
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
                errorResponse.put("error", "Formato no válido");
                errorResponse.put("message", "Use: pdf, excel, json o csv");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
            }

            // Preparar parámetros de filtro
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

    private UserDTO convertToUserDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setEmail(user.getEmail());
        dto.setName(user.getFirstName() + " " + user.getLastName());
        dto.setFirstName(user.getFirstName());
        dto.setLastName(user.getLastName());
        dto.setRole(user.getRole().name().toLowerCase());
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
            user.setRole(Role.valueOf(dto.getRole().toUpperCase()));
        }
        user.setFaculty(dto.getFaculty());
        user.setActive(dto.isActive());
        return user;
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
