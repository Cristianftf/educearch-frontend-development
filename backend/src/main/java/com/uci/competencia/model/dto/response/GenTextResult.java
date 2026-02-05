package com.uci.competencia.model.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * DTO para resultado de generación de texto basado en evidencia
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GenTextResult {
    
    /**
     * Texto generado
     */
    private String generatedText;
    
    /**
     * Resumen del texto generado
     */
    private String summary;
    
    /**
     * Artículos usados como evidencia
     */
    private List<EvidenceArticle> evidence;
    
    /**
     * Puntuación de confianza general (0-1)
     */
    private double confidenceScore;
    
    /**
     * Número de fuentes utilizadas
     */
    private int sourceCount;
    
    /**
     * Fecha de generación
     */
    private LocalDateTime generatedAt;
    
    /**
     * ID de sesión asociada
     */
    private String sessionId;
    
    /**
     * Estadísticas de la generación
     */
    private GenerationStats stats;
    
    /**
     * Warnings o problemas encontrados
     */
    private List<String> warnings;
    
    /**
     * Metadata adicional
     */
    private Map<String, Object> metadata;
    
    /**
     * Artículo de evidencia utilizado
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class EvidenceArticle {
        private String pubmedId;
        private String title;
        private String authors;
        private int publicationYear;
        private String journal;
        private double relevanceScore;
        private String snippet;
        private String url;
    }
    
    /**
     * Estadísticas de generación
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GenerationStats {
        private long processingTimeMs;
        private int articlesRetrieved;
        private int articlesUsed;
        private int queriesExecuted;
        private double averageRelevance;
    }
}
