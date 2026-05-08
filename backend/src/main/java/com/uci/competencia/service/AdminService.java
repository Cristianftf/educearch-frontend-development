package com.uci.competencia.service;

import com.uci.competencia.model.dto.request.UserBatchImportDTO;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.Role;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Interfaz AdminService - Servicios administrativos del sistema
 * 
 * Responsable de:
 * - Gestión de usuarios en lote
 * - Cambio de roles
 * - Gestión de caché
 * - Backups y restauración
 * - Configuración del sistema
 */
public interface AdminService {

    /**
     * Obtener todos los usuarios con paginación
     */
    Page<User> getAllUsers(Pageable pageable);

    /**
     * Obtener usuarios por rol con paginación
     */
    Page<User> getUsersByRole(Role role, Pageable pageable);

    /**
     * Obtener usuarios por estado activo/inactivo con paginacion
     */
    Page<User> getUsersByStatus(boolean active, Pageable pageable);

    /**
     * Obtener usuarios por rol y estado activo/inactivo con paginacion
     */
    Page<User> getUsersByRoleAndStatus(Role role, boolean active, Pageable pageable);

    /**
     * Buscar usuarios con filtros combinables y paginación
     */
    Page<User> searchUsers(Role role, Boolean active, String search, Pageable pageable);

    /**
     * Obtener usuario por ID
     */
    User getUserById(String id);

    /**
     * Crear nuevo usuario
     */
    User createUser(User user);

    /**
     * Actualizar usuario existente
     */
    User updateUser(String id, User user);

    /**
     * Eliminar usuario
     */
    void deleteUser(String id);

    /**
     * Obtener estado de salud del sistema
     */
    Map<String, Object> getSystemHealth();

    /**
     * Obtener datos consolidados para el dashboard de administraciÃ³n
     */
    Map<String, Object> getDashboardData();

    /**
     * Obtener informaciÃ³n detallada del sistema para la vista de sistema
     */
    Map<String, Object> getSystemOverview();

    /**
     * Importar usuarios en lote desde CSV/JSON
     *
     * @param batchImport Datos de importación
     * @return Resultado con usuarios creados, actualizados y fallidos
     */
    BatchImportResult importUsersBatch(UserBatchImportDTO batchImport);
    
    /**
     * Cambiar rol de un usuario
     * 
     * @param userId ID del usuario
     * @param newRole Nuevo rol
     * @return Usuario actualizado
     */
    User changeUserRole(String userId, Role newRole);
    
    /**
     * Desactivar/Activar usuario
     * 
     * @param userId ID del usuario
     * @param active Estado a establecer
     */
    void toggleUserStatus(String userId, boolean active);
    
    /**
     * Limpiar caché del sistema
     * 
     * @param cacheNames Lista de caché a limpiar ("mesh-terms", "search-results", "all")
     */
    void clearCache(List<String> cacheNames);
    
    /**
     * Obtener estadísticas del sistema
     * 
     * @return Mapa con estadísticas
     */
    Map<String, Object> getSystemStatistics();
    
    /**
     * Iniciar backup del sistema
     * 
     * @param type Tipo de backup (FULL, INCREMENTAL)
     * @param includeLogs Incluir logs
     * @return ID del backup
     */
    String initiateBackup(String type, boolean includeLogs);
    
    /**
     * Obtener estado del backup
     * 
     * @param backupId ID del backup
     * @return Estado actual
     */
    BackupStatus getBackupStatus(String backupId);
    
    /**
     * Restaurar desde backup
     * 
     * @param backupId ID del backup
     */
    void restoreFromBackup(String backupId);
    
    /**
     * Obtener configuración del sistema
     */
    SystemConfiguration getSystemConfiguration();
    
    /**
     * Actualizar configuración del sistema
     */
    void updateSystemConfiguration(SystemConfiguration config);
    
    /**
     * Obtener lista de alertas
     */
    List<Map<String, Object>> getAlerts();
    
    /**
     * Crear alerta
     */
    Map<String, Object> createAlert(Map<String, Object> alertRequest);
    
    /**
     * Actualizar alerta
     */
    Map<String, Object> updateAlert(String alertId, Map<String, Object> alertRequest);
    
    /**
     * Eliminar alerta
     */
    void deleteAlert(String alertId);
    
    /**
     * Probar conexión a PubMed
     */
    boolean testPubmedConnection();

    /**
     * Comprobar conectividad y respuesta de APIs externas de busqueda.
     *
     * @param queryText consulta de prueba opcional
     * @return diagnostico por proveedor y resumen general
     */
    Map<String, Object> checkExternalApis(String queryText);
    
    /**
     * Obtener lista de backups
     */
    List<Map<String, Object>> getBackupsList();

    /**
     * Eliminar backup por ID
     */
    void deleteBackup(String backupId);
    
    /**
     * Restaurar desde backup
     */
    void restoreBackup(String backupId);
    
    /**
     * Exportar logs de auditoría
     */
    Map<String, Object> exportAuditLogs(String format, Map<String, Object> filters);

    /**
     * Obtener vista consolidada de errores de backend para monitoreo administrativo.
     */
    Map<String, Object> getErrorMonitoringOverview(int windowMinutes, int limit);

    /**
     * Ejecutar analisis de errores recientes asistido por IA.
     */
    Map<String, Object> analyzeRecentErrors(int windowMinutes, int limit);

    /**
     * Ejecutar analisis de resultados de pruebas asistido por IA.
     */
    Map<String, Object> analyzeTestingLogs(Map<String, Object> payload);

    /**
     * Optimizar base de datos
     */
    void optimizeDatabase();

    /**
     * Regenerar indices de busqueda
     */
    void rebuildSearchIndexes();

    /**
     * Limpiar logs antiguos
     *
     * @param olderThan Fecha limite
     * @return cantidad de logs eliminados
     */
    long cleanupLogs(LocalDateTime olderThan);
    
    /**
     * Resultado de importación en lote
     */
    class BatchImportResult {
        public int created;
        public int updated;
        public int failed;
        public List<String> errors;
        public List<String> warnings;
    }
    
    /**
     * Estado del backup
     */
    class BackupStatus {
        public String id;
        public String type;
        public LocalDateTime startTime;
        public String status; // RUNNING, COMPLETED, FAILED
        public int progress;
        public boolean includeLogs;
        public long dataSize;
        public String errorMessage;
        public LocalDateTime endTime;
        public String downloadUrl;
    }
    
    /**
     * Configuración del sistema
     */
    class SystemConfiguration {
        public Map<String, Object> pubmed;
        public Map<String, Object> rag;
        public Map<String, Object> pedagogical;
        public Map<String, Object> security;
    }
}
