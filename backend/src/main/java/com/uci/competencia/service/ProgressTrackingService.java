package com.uci.competencia.service;

import com.uci.competencia.model.entity.CompetencyProgress;
import com.uci.competencia.model.dto.response.StudentProgressReport;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Interfaz ProgressTrackingService - Seguimiento de progreso de estudiantes
 * 
 * Responsable de:
 * - Actualizar competencias basadas en acciones
 * - Otorgar badges automáticamente
 * - Generar alertas para profesores
 * - Guardar snapshots de progreso
 * - Generar reportes detallados
 */
public interface ProgressTrackingService {
    
    /**
     * Actualiza las competencias del estudiante basado en una acción
     * 
     * Tipos de acción:
     * - Búsqueda exitosa → competencia ACCESO
     * - Verificación correcta → competencia PROCESAMIENTO
     * - Bibliografía generada → competencia COMUNICACIÓN
     * 
     * @param studentId ID del estudiante
     * @param action Tipo de acción realizada
     * @param metadata Metadatos adicionales (puntaje, tiempo, etc)
     */
    void updateStudentCompetencies(String studentId, StudentAction action, ActionMetadata metadata);
    
    /**
     * Verifica si el estudiante alcanzó nuevos badges
     * 
     * @param studentId ID del estudiante
     * @return Lista de badges nuevamente otorgados
     */
    java.util.List<String> checkAndAwardBadges(String studentId);
    
    /**
     * Verifica si hay alertas a notificar al profesor
     * Alertas: Baja precisión, bajo rendimiento, cambios bruscos
     * 
     * @param studentId ID del estudiante
     * @return Objeto con alertas detectadas
     */
    AlertNotification checkForAlerts(String studentId);
    
    /**
     * Guarda un snapshot de competencia en el historial
     * 
     * @param studentId ID del estudiante
     * @param progress Progreso actual
     */
    void saveCompetencySnapshot(String studentId, CompetencyProgress progress);
    
    /**
     * Genera reporte detallado de progreso del estudiante
     * 
     * @param studentId ID del estudiante
     * @param dateRange Rango de fechas
     * @param detailLevel Nivel de detalle
     * @return Reporte completo
     */
    StudentProgressReport generateProgressReport(
        String studentId, 
        DateRange dateRange,
        ReportDetailLevel detailLevel
    );
    
    /**
     * Calcula percentil del estudiante vs grupo
     * 
     * @param studentId ID del estudiante
     * @param competencyType Tipo de competencia
     * @return Percentil (0-100)
     */
    Integer calculatePercentile(String studentId, CompetencyType competencyType);
    
    /**
     * Obtiene datos para heatmap de actividad
     * 
     * @param studentId ID del estudiante
     * @param days Número de días a incluir
     * @return Matriz de actividades por día/hora
     */
    ActivityHeatmap getActivityHeatmap(String studentId, int days);
    
    /**
     * Tipos de competencia
     */
    enum CompetencyType {
        ACCESS("Acceso a Información"),
        PROCESSING("Procesamiento de Información"),
        COMMUNICATION("Comunicación de Información");
        
        private final String displayName;
        
        CompetencyType(String displayName) {
            this.displayName = displayName;
        }
        
        public String getDisplayName() {
            return displayName;
        }
    }
    
    /**
     * Tipos de acciones
     */
    enum StudentAction {
        SEARCH_PERFORMED,
        SEARCH_SUCCESS,
        VERIFICATION_PERFORMED,
        VERIFICATION_CORRECT,
        BIBLIOGRAPHY_GENERATED,
        CASE_SUBMITTED,
        CASE_GRADED
    }
    
    /**
     * Metadatos de acción
     */
    class ActionMetadata {
        public Double score;
        public Long duration;
        public String details;
        public LocalDateTime timestamp;
    }
    
    /**
     * Alerta a notificar
     */
    class AlertNotification {
        public String studentId;
        public AlertType type;
        public String message;
        public AlertSeverity severity;
        public LocalDateTime timestamp;
    }
    
    enum AlertType {
        LOW_ACCURACY,
        LOW_PERFORMANCE,
        UNUSUAL_PATTERN,
        HELP_REQUIRED
    }
    
    enum AlertSeverity {
        INFO, WARNING, CRITICAL
    }
    
    /**
     * Rango de fechas
     */
    class DateRange {
        public LocalDate from;
        public LocalDate to;
    }
    
    enum ReportDetailLevel {
        SUMMARY,
        DETAILED,
        COMPREHENSIVE
    }
    
    /**
     * Heatmap de actividad
     */
    class ActivityHeatmap {
        public int[][] data; // [día][hora]
        public int maxValue;
        public LocalDate startDate;
        public LocalDate endDate;
    }

    /**
     * Obtiene el progreso detallado de un estudiante
     * 
     * @param studentId ID del estudiante
     * @return Mapa con datos detallados de progreso
     */
    java.util.Map<String, Object> getDetailedProgress(String studentId);
}
