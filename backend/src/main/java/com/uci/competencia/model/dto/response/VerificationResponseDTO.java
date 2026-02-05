package com.uci.competencia.model.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VerificationResponseDTO {
    // Campos principales alineados con frontend
    private String id;  // Nuevo: ID de verificación
    private String claim;  // Nuevo: el claim que se verificó
    private String status;  // 'verified' | 'conflicting' | 'misinformation' | 'pending'
    private Double score;  // Puntuación general
    private List<EvidenceDTO> supportingEvidence;
    private List<EvidenceDTO> conflictingEvidence;
    private String explanation;  // Explicación (renombrado de genText)
    private List<String> recommendations;
    private String verifiedAt;  // Timestamp ISO (renombrado de submittedAt)
    
    // Campos opcionales para metadatos
    private LocalDateTime submittedAt;
    private LocalDateTime estimatedCompletion;
    private String websocketTopic;
    private Double confidence;
    private String verdict;
    private Integer evidenceCount;
    private Map<String, Double> scoreBreakdown;

    @Data
    public static class EvidenceDTO {
        private String articleId;  // Renombrado de pmid
        private String pmid;  // Mantener para compatibilidad
        private String title;
        private String snippet;
        private Boolean supports;  // Renombrado de stance (true/false)
        private String stance;  // Mantener para compatibilidad
        private Double relevanceScore;  // Renombrado de similarity
        private Double similarity;  // Mantener para compatibilidad
        private Integer evidenceLevel;
    }
}

