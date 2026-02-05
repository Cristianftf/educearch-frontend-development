package com.uci.competencia.model.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * DTO para reporte de progreso de estudiante
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentProgressReport {
    
    private Long studentId;
    
    private String studentName;
    
    private LocalDateTime generatedAt;
    
    /**
     * Progreso general (0-100)
     */
    private double overallProgress;
    
    /**
     * Competencias y su progreso
     */
    private Map<String, Double> competencyProgress;
    
    /**
     * Casos resueltos
     */
    private int casesCompleted;
    
    /**
     * Casos totales asignados
     */
    private int totalCases;
    
    /**
     * Calificación promedio
     */
    private double averageGrade;
    
    /**
     * Tiempo invertido (horas)
     */
    private double hoursSpent;
    
    /**
     * Actividades completadas por categoría
     */
    private Map<String, ActivityStats> activityStats;
    
    /**
     * Recomendaciones de mejora
     */
    private List<String> recommendations;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ActivityStats {
        private int completed;
        private int total;
        private double averageScore;
    }
}
