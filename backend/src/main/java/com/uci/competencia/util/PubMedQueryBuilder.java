package com.uci.competencia.util;

import com.uci.competencia.model.dto.request.SearchRequestDTO;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Utilidad para construir queries de PubMed en sintaxis correcta
 * Convierte búsquedas simples a queries optimizadas para PubMed
 * 
 * Ejemplo:
 * - Input: ["diabetes", "metformin"] with operators ["AND"]
 * - Output: "diabetes[MeSH] AND metformin[MeSH] AND publisher[sb]"
 */
@Component
public class PubMedQueryBuilder {
    
    private final MeshMapper meshMapper;
    
    public PubMedQueryBuilder(MeshMapper meshMapper) {
        this.meshMapper = meshMapper;
    }
    
    /**
     * Construye query PubMed a partir de términos y operadores
     */
    public String buildPubMedQuery(SearchRequestDTO.SearchQueryDTO queryDTO, 
                                    SearchRequestDTO.SearchFiltersDTO filters) {
        StringBuilder pubmedQuery = new StringBuilder();
        
        // 1. Transformar términos a MeSH
        List<String> meshTerms = convertToMeshTerms(queryDTO.getTerms());
        
        // 2. Aplicar operadores booleanos
        applyBooleanOperators(pubmedQuery, meshTerms, queryDTO.getOperators());
        
        // 3. Aplicar agrupaciones si existen
        if (queryDTO.getGroupings() != null && !queryDTO.getGroupings().isEmpty()) {
            applyGroupings(pubmedQuery, queryDTO.getGroupings());
        }
        
        // 4. Añadir filtros de búsqueda
        if (filters != null) {
            addFilters(pubmedQuery, filters);
        }
        
        return pubmedQuery.toString();
    }
    
    /**
     * Convierte términos simples a términos MeSH
     * Si un término no existe en MeSH, usa búsqueda de texto libre
     */
    private List<String> convertToMeshTerms(List<String> terms) {
        return terms.stream()
            .map(term -> {
                String meshTerm = meshMapper.mapToMeshTerm(term);
                if (meshTerm != null) {
                    return meshTerm + "[MeSH]";
                } else {
                    // Fallback a búsqueda de texto libre en título/abstract
                    return "\"" + term + "\"[tiab]";
                }
            })
            .collect(Collectors.toList());
    }
    
    /**
     * Aplica operadores booleanos entre términos
     */
    private void applyBooleanOperators(StringBuilder query, List<String> terms, 
                                      List<String> operators) {
        if (terms.isEmpty()) return;
        
        query.append("(").append(terms.get(0));
        
        for (int i = 1; i < terms.size(); i++) {
            String operator = (operators != null && i - 1 < operators.size()) 
                ? operators.get(i - 1).toUpperCase() 
                : "AND";
            
            // Validar que sea un operador válido
            if (!operator.matches("(AND|OR|NOT)")) {
                operator = "AND";
            }
            
            query.append(" ").append(operator).append(" ").append(terms.get(i));
        }
        
        query.append(")");
    }
    
    /**
     * Aplica agrupaciones (paréntesis) a la query
     */
    private void applyGroupings(StringBuilder query, List<?> groupings) {
        // Las agrupaciones se envuelven con paréntesis adicionales
        if (groupings != null && !groupings.isEmpty()) {
            query.insert(0, "(").append(")");
        }
    }
    
    /**
     * Añade filtros a la query
     */
    private void addFilters(StringBuilder query, SearchRequestDTO.SearchFiltersDTO filters) {
        // Filtro de rango de años
        if (filters.getYearFrom() != null || filters.getYearTo() != null) {
            query.append(" AND ").append(formatDateFilter(filters.getYearFrom(), filters.getYearTo()));
        }
        
        // Filtro de tipos de estudio
        if (filters.getStudyTypes() != null && !filters.getStudyTypes().isEmpty()) {
            query.append(" AND (");
            String studyFilter = filters.getStudyTypes().stream()
                .map(this::mapStudyTypeToPubMed)
                .collect(Collectors.joining(" OR "));
            query.append(studyFilter).append(")");
        }
        
        // Filtro de texto completo disponible
        if (filters.getHasFullText() != null && filters.getHasFullText()) {
            query.append(" AND free full text[filter]");
        }
        
        // Filtro de idioma
        if (filters.getLanguage() != null && !filters.getLanguage().isEmpty()) {
            query.append(" AND ").append(filters.getLanguage().toLowerCase()).append("[lang]");
        }
    }
    
    /**
     * Formatea filtro de fechas para PubMed
     */
    private String formatDateFilter(Integer yearFrom, Integer yearTo) {
        if (yearFrom != null && yearTo != null) {
            return yearFrom + ":" + yearTo + "[PDAT]";
        } else if (yearFrom != null) {
            return yearFrom + ":3000[PDAT]";
        } else if (yearTo != null) {
            return "1900:" + yearTo + "[PDAT]";
        }
        return "";
    }
    
    /**
     * Mapea tipos de estudio a Publication Type de PubMed
     */
    private String mapStudyTypeToPubMed(String studyType) {
        if (studyType == null || studyType.isBlank()) {
            return "\"publication\"[Publication Type]";
        }
        String normalized = studyType.trim().toLowerCase().replaceAll("[\\s-]+", "_");
        return switch (normalized) {
            case "systematic_review" -> "\"systematic review\"[Publication Type]";
            case "meta_analysis" -> "\"meta-analysis\"[Publication Type]";
            case "randomized_controlled_trial", "rct" -> "\"randomized controlled trial\"[Publication Type]";
            case "cohort", "cohort_study" -> "\"cohort studies\"[MeSH]";
            case "case_control" -> "\"case-control studies\"[MeSH]";
            case "cross_sectional" -> "\"cross-sectional studies\"[MeSH]";
            case "clinical_trial" -> "\"clinical trial\"[Publication Type]";
            case "case_report" -> "\"case reports\"[Publication Type]";
            case "editorial" -> "\"editorial\"[Publication Type]";
            default -> "\"" + studyType + "\"[Publication Type]";
        };
    }
    
    /**
     * Valida que la query no sea demasiado compleja
     */
    public boolean isValidQuery(String query) {
        if (query == null || query.trim().isEmpty()) {
            return false;
        }
        
        // Verificar paréntesis balanceados
        int openCount = 0;
        for (char c : query.toCharArray()) {
            if (c == '(') openCount++;
            if (c == ')') openCount--;
            if (openCount < 0) return false;
        }
        
        return openCount == 0;
    }
    
    /**
     * Limpia y normaliza una query
     */
    public String cleanQuery(String query) {
        if (query == null) return "";
        
        // Eliminar espacios múltiples
        query = query.replaceAll("\\s+", " ");
        
        // Eliminar caracteres especiales peligrosos
        query = query.replaceAll("[<>\"'%;]", "");
        
        return query.trim();
    }
}
