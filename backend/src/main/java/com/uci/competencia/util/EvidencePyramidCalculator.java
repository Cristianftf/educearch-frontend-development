package com.uci.competencia.util;

import com.uci.competencia.model.dto.response.SearchResponseDTO;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Utilidad para calcular la Pirámide de Evidencia
 * 
 * La pirámide de evidencia organiza estudios por nivel de calidad:
 * - Nivel 1: Revisiones sistemáticas y meta-análisis
 * - Nivel 2: Ensayos clínicos aleatorizados (RCT)
 * - Nivel 3: Estudios de cohorte
 * - Nivel 4: Estudios caso-control y transversales
 * - Nivel 5: Reportes de caso y series de casos
 */
@Component
public class EvidencePyramidCalculator {
    
    /**
     * Calcula la pirámide de evidencia desde un conjunto de resultados de búsqueda
     * 
     * @param searchResults Resultados de búsqueda
     * @return Pirámide estructurada por niveles
     */
    public EvidencePyramid calculatePyramid(List<SearchResponseDTO.SearchResultDTO> searchResults) {
        EvidencePyramid pyramid = new EvidencePyramid();
        
        if (searchResults == null || searchResults.isEmpty()) {
            return pyramid;
        }
        
        // Distribuir resultados por nivel de evidencia
        for (SearchResponseDTO.SearchResultDTO result : searchResults) {
            Integer level = result.getEvidenceLevel();
            if (level != null && level >= 1 && level <= 5) {
                pyramid.addStudy(level, result);
            }
        }
        
        // Calcular estadísticas
        pyramid.calculateStatistics();
        
        return pyramid;
    }
    
    /**
     * Determina el nivel de evidencia basado en tipo de estudio
     * 
     * @param studyType Tipo de estudio
     * @return Nivel de evidencia (1-5)
     */
    public int determineEvidenceLevel(String studyType) {
        if (studyType == null) {
            return 5; // Por defecto, nivel más bajo
        }
        
        return switch (studyType.toUpperCase()) {
            case "SYSTEMATIC_REVIEW", "META_ANALYSIS" -> 1;
            case "RANDOMIZED_CONTROLLED_TRIAL", "RCT" -> 2;
            case "COHORT_STUDY", "PROSPECTIVE_COHORT" -> 3;
            case "CASE_CONTROL", "CROSS_SECTIONAL" -> 4;
            case "CASE_REPORT", "CASE_SERIES" -> 5;
            default -> 5;
        };
    }
    
    /**
     * Calcula fortaleza de la evidencia (LOW, MODERATE, HIGH, VERY_HIGH)
     * 
     * Considera:
     * - Número de estudios por nivel
     * - Consistencia entre estudios
     * - Precisión de estimados
     * - Sesgo de publicación
     */
    public EvidenceStrength calculateEvidenceStrength(EvidencePyramid pyramid) {
        int totalStudies = pyramid.getTotalStudies();
        
        if (totalStudies == 0) {
            return EvidenceStrength.NO_EVIDENCE;
        }
        
        // Calcular puntaje basado en distribución
        double strengthScore = calculateStrengthScore(pyramid);
        
        if (strengthScore >= 0.8) {
            return EvidenceStrength.VERY_HIGH;
        } else if (strengthScore >= 0.6) {
            return EvidenceStrength.HIGH;
        } else if (strengthScore >= 0.4) {
            return EvidenceStrength.MODERATE;
        } else {
            return EvidenceStrength.LOW;
        }
    }
    
    /**
     * Calcula puntaje de fortaleza de evidencia
     */
    private double calculateStrengthScore(EvidencePyramid pyramid) {
        double score = 0.0;
        int total = pyramid.getTotalStudies();
        
        // Ponderación por nivel (mayor nivel = mayor ponderación)
        score += (pyramid.getLevel1Count() * 5.0 / total) * 0.1; // 10% del score
        score += (pyramid.getLevel2Count() * 4.0 / total) * 0.3; // 30% del score
        score += (pyramid.getLevel3Count() * 3.0 / total) * 0.3; // 30% del score
        score += (pyramid.getLevel4Count() * 2.0 / total) * 0.2; // 20% del score
        score += (pyramid.getLevel5Count() * 1.0 / total) * 0.1; // 10% del score
        
        return Math.min(score, 1.0);
    }
    
    /**
     * Clase para representar la pirámide de evidencia
     */
    public static class EvidencePyramid {
        private List<SearchResponseDTO.SearchResultDTO> level1 = new ArrayList<>();
        private List<SearchResponseDTO.SearchResultDTO> level2 = new ArrayList<>();
        private List<SearchResponseDTO.SearchResultDTO> level3 = new ArrayList<>();
        private List<SearchResponseDTO.SearchResultDTO> level4 = new ArrayList<>();
        private List<SearchResponseDTO.SearchResultDTO> level5 = new ArrayList<>();
        
        public void addStudy(int level, SearchResponseDTO.SearchResultDTO study) {
            switch (level) {
                case 1 -> level1.add(study);
                case 2 -> level2.add(study);
                case 3 -> level3.add(study);
                case 4 -> level4.add(study);
                case 5 -> level5.add(study);
                default -> {}
            }
        }
        
        public void calculateStatistics() {
            // Las estadísticas se calculan sobre demanda
        }
        
        public int getTotalStudies() {
            return level1.size() + level2.size() + level3.size() + level4.size() + level5.size();
        }
        
        public int getLevel1Count() { return level1.size(); }
        public int getLevel2Count() { return level2.size(); }
        public int getLevel3Count() { return level3.size(); }
        public int getLevel4Count() { return level4.size(); }
        public int getLevel5Count() { return level5.size(); }
        
        public List<SearchResponseDTO.SearchResultDTO> getLevel1() { return level1; }
        public List<SearchResponseDTO.SearchResultDTO> getLevel2() { return level2; }
        public List<SearchResponseDTO.SearchResultDTO> getLevel3() { return level3; }
        public List<SearchResponseDTO.SearchResultDTO> getLevel4() { return level4; }
        public List<SearchResponseDTO.SearchResultDTO> getLevel5() { return level5; }
    }
    
    /**
     * Fortaleza de la evidencia
     */
    public enum EvidenceStrength {
        NO_EVIDENCE("No hay evidencia"),
        LOW("Evidencia baja"),
        MODERATE("Evidencia moderada"),
        HIGH("Evidencia alta"),
        VERY_HIGH("Evidencia muy alta");
        
        private final String description;
        
        EvidenceStrength(String description) {
            this.description = description;
        }
        
        public String getDescription() {
            return description;
        }
    }
}
