package com.uci.competencia.model.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

/**
 * DTO para solicitud de verificación de claims contra evidencia
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VerificationRequest {
    
    /**
     * El claim (afirmación) a verificar
     */
    private String claim;
    
    /**
     * Contexto de la afirmación
     */
    private String context;
    
    /**
     * ID del caso de estudio relacionado
     */
    private Long caseStudyId;
    
    /**
     * ID del usuario que realiza la solicitud
     */
    private Long userId;
    
    /**
     * Número máximo de artículos a considerar
     */
    private int maxArticles;
    
    /**
     * Umbral de confianza mínimo (0-1)
     */
    private double confidenceThreshold;
    
    /**
     * Términos MeSH para refinar búsqueda
     */
    private List<String> meshTerms;
    
    /**
     * Rango de años para artículos
     */
    private Integer startYear;
    private Integer endYear;
    
    /**
     * ID de sesión para tracking
     */
    private String sessionId;
    
    /**
     * Requerir artículos con texto completo
     */
    private boolean fullTextRequired;
}
