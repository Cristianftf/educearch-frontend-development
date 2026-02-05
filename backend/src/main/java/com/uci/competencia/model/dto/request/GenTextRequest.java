package com.uci.competencia.model.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.Map;

/**
 * DTO para solicitud de generación de texto basado en evidencia (GenText)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GenTextRequest {
    
    /**
     * Consulta o prompt para generar texto
     */
    private String query;
    
    /**
     * Contexto adicional para la generación
     */
    private String context;
    
    /**
     * Número máximo de artículos a recuperar como evidencia
     */
    private int maxArticles;
    
    /**
     * Umbral de confianza mínimo para artículos (0-1)
     */
    private double confidenceThreshold;
    
    /**
     * Filtros adicionales para la búsqueda
     */
    private Map<String, Object> filters;
    
    /**
     * Palabras clave de búsqueda
     */
    private List<String> keywords;
    
    /**
     * Rango de años para artículos
     */
    private Integer startYear;
    private Integer endYear;
    
    /**
     * ID del usuario que realiza la solicitud
     */
    private Long userId;
    
    /**
     * ID de sesión para tracking
     */
    private String sessionId;
}
