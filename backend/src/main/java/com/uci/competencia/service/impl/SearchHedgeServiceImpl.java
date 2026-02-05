package com.uci.competencia.service.impl;

import com.uci.competencia.model.dto.response.SearchHedgeDTO;
import com.uci.competencia.model.dto.response.SearchHedgeTestResultDTO;
import com.uci.competencia.model.entity.SearchHedge;
import com.uci.competencia.repository.SearchHedgeRepository;
import com.uci.competencia.service.SearchHedgeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SearchHedgeServiceImpl implements SearchHedgeService {
    
    private final SearchHedgeRepository searchHedgeRepository;
    
    // Categorías predefinidas
    private static final List<String> PREDEFINED_CATEGORIES = Arrays.asList(
        "Enfermedades Metabólicas",
        "Cardiología",
        "Enfermedades Infecciosas",
        "Oncología",
        "Neurología",
        "Pediatría",
        "Farmacología"
    );
    
    @Override
    @Transactional(readOnly = true)
    public List<SearchHedgeDTO> getAllHedges(String professorId, String category) {
        log.info("Getting hedges for professor: {} with category: {}", professorId, category);
        
        List<SearchHedge> hedges;
        if (category != null && !category.isEmpty()) {
            hedges = searchHedgeRepository.findByCreatedByAndCategory(professorId, category);
        } else {
            hedges = searchHedgeRepository.findByCreatedBy(professorId);
        }
        
        return hedges.stream()
            .map(this::convertToDTO)
            .sorted(Comparator.comparing(SearchHedgeDTO::getCreatedAt).reversed())
            .collect(Collectors.toList());
    }
    
    @Override
    @Transactional(readOnly = true)
    public Optional<SearchHedgeDTO> getHedgeById(String id) {
        log.info("Getting hedge with id: {}", id);
        return searchHedgeRepository.findById(id)
            .map(this::convertToDTO);
    }
    
    @Override
    @Transactional
    public SearchHedgeDTO createHedge(SearchHedgeDTO hedgeDTO, String professorId) {
        log.info("Creating new hedge: {} for professor: {}", hedgeDTO.getName(), professorId);
        
        SearchHedge hedge = new SearchHedge();
        hedge.setName(hedgeDTO.getName());
        hedge.setCategory(hedgeDTO.getCategory());
        hedge.setQuery(hedgeDTO.getQuery());
        hedge.setDescription(hedgeDTO.getDescription());
        hedge.setEstimatedResults(hedgeDTO.getEstimatedResults());
        hedge.setPrecision(hedgeDTO.getPrecision());
        hedge.setRecall(hedgeDTO.getRecall());
        hedge.setCreatedBy(professorId);
        hedge.setIsTemplate(hedgeDTO.getIsTemplate() != null ? hedgeDTO.getIsTemplate() : false);
        
        SearchHedge saved = searchHedgeRepository.save(hedge);
        log.info("Hedge created with id: {}", saved.getId());
        
        return convertToDTO(saved);
    }
    
    @Override
    @Transactional
    public SearchHedgeDTO updateHedge(String id, SearchHedgeDTO hedgeDTO) {
        log.info("Updating hedge with id: {}", id);
        
        SearchHedge hedge = searchHedgeRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Hedge not found: " + id));
        
        hedge.setName(hedgeDTO.getName());
        hedge.setCategory(hedgeDTO.getCategory());
        hedge.setQuery(hedgeDTO.getQuery());
        hedge.setDescription(hedgeDTO.getDescription());
        hedge.setEstimatedResults(hedgeDTO.getEstimatedResults());
        hedge.setPrecision(hedgeDTO.getPrecision());
        hedge.setRecall(hedgeDTO.getRecall());
        
        SearchHedge updated = searchHedgeRepository.save(hedge);
        log.info("Hedge updated: {}", id);
        
        return convertToDTO(updated);
    }
    
    @Override
    @Transactional
    public void deleteHedge(String id) {
        log.info("Deleting hedge with id: {}", id);
        
        SearchHedge hedge = searchHedgeRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Hedge not found: " + id));
        
        searchHedgeRepository.delete(hedge);
        log.info("Hedge deleted: {}", id);
    }
    
    @Override
    @Transactional(readOnly = true)
    public List<String> getCategories() {
        log.info("Getting all categories");
        return new ArrayList<>(PREDEFINED_CATEGORIES);
    }
    
    @Override
    @Transactional(readOnly = true)
    public SearchHedgeTestResultDTO testHedge(String query) {
        log.info("Testing hedge query: {}", query);
        
        SearchHedgeTestResultDTO result = new SearchHedgeTestResultDTO();
        result.setQuery(query);
        
        try {
            // Implementar lógica real de prueba de query
            // Simular la ejecución basada en análisis de la query
            int resultCount = simulateQueryExecution(query);
            
            // Calcular métricas estimadas basadas en la complejidad de la query
            double estimatedPrecision = calculateEstimatedPrecision(query, resultCount);
            double estimatedRecall = calculateEstimatedRecall(query, resultCount);
            
            result.setResultCount(resultCount);
            result.setEstimatedPrecision(estimatedPrecision);
            result.setEstimatedRecall(estimatedRecall);
            result.setStatus("SUCCESS");
            result.setMessage("Query test completed successfully");
            
            log.info("Hedge test completed - estimated results: {}, precision: {}, recall: {}", 
                     resultCount, estimatedPrecision, estimatedRecall);
        } catch (Exception e) {
            log.error("Error testing hedge query", e);
            result.setStatus("ERROR");
            result.setMessage("Error testing query: " + e.getMessage());
            result.setResultCount(0);
            result.setEstimatedPrecision(0.0);
            result.setEstimatedRecall(0.0);
        }
        
        return result;
    }

    /**
     * Simula la ejecución de una query de búsqueda
     * Implementar con lógica real de búsqueda
     * Por ahora usa heurística: cantidad de términos clave y operadores booleanos
     */
    private Integer simulateQueryExecution(String query) {
        if (query == null || query.isEmpty()) {
            return 0;
        }
        
        // Contar palabras clave principales
        String[] keywords = query.split("\\s+");
        int keywordCount = 0;
        int andCount = 0;
        int orCount = 0;
        int notCount = 0;
        
        for (String keyword : keywords) {
            keyword = keyword.toUpperCase();
            if (keyword.equals("AND")) {
                andCount++;
            } else if (keyword.equals("OR")) {
                orCount++;
            } else if (keyword.equals("NOT")) {
                notCount++;
            } else if (!keyword.isEmpty() && !keyword.equals("THE") && 
                      !keyword.equals("A") && !keyword.equals("AN")) {
                keywordCount++;
            }
        }
        
        // Fórmula heurística:
        // Base: 50 resultados por palabra clave
        // AND multiplica por 0.8 (reduce resultados)
        // OR suma 100 por cada OR
        // NOT resta 20 por cada NOT (con mínimo de 100)
        int baseCount = keywordCount * 50;
        int andFactor = (int) (andCount * baseCount * 0.1); // Cada AND reduce un 10%
        int orBonus = orCount * 100;
        int notPenalty = notCount * 20;
        
        int totalCount = Math.max(100, baseCount - andFactor + orBonus - notPenalty);
        
        return Math.min(totalCount, 5000); // Máximo 5000 resultados simulados
    }

    /**
     * Calcula la precisión estimada basada en complejidad de la query
     * Más específica = mayor precisión
     */
    private double calculateEstimatedPrecision(String query, int resultCount) {
        // Queries más específicas tienen mejor precisión
        if (resultCount == 0) return 0.0;
        
        // Contar operadores booleanos (indican especificidad)
        int operatorCount = countOccurrences(query, "AND") + countOccurrences(query, "NOT");
        
        // Base: 0.5 (50% de precisión promedio)
        double basePrecision = 0.5;
        
        // Aumentar por operadores AND (especificidad)
        basePrecision += (operatorCount * 0.05);
        
        // Disminuir si hay muchos resultados (menos específica)
        if (resultCount > 1000) {
            basePrecision *= 0.8;
        } else if (resultCount < 100) {
            basePrecision = Math.min(0.95, basePrecision * 1.1);
        }
        
        return Math.min(1.0, basePrecision);
    }

    /**
     * Calcula el recall estimado basado en complejidad de la query
     */
    private double calculateEstimatedRecall(String query, int resultCount) {
        // Queries más permisivas tienen mejor recall
        int orCount = countOccurrences(query, "OR");
        int notCount = countOccurrences(query, "NOT");
        
        // Base: 0.7 (70% de recall promedio)
        double baseRecall = 0.7;
        
        // Aumentar por operadores OR (amplitud)
        baseRecall += (orCount * 0.05);
        
        // Disminuir por operadores NOT (restricción)
        baseRecall -= (notCount * 0.05);
        
        // Penalizar si hay pocos resultados (puede estar muy restrictiva)
        if (resultCount < 100) {
            baseRecall *= 0.8;
        } else if (resultCount > 3000) {
            baseRecall = Math.min(0.98, baseRecall * 1.05);
        }
        
        return Math.max(0.0, Math.min(1.0, baseRecall));
    }

    /**
     * Cuenta ocurrencias de una palabra en una string
     */
    private int countOccurrences(String text, String word) {
        if (text == null || word == null) return 0;
        
        int count = 0;
        String[] parts = text.toUpperCase().split("\\s+");
        for (String part : parts) {
            if (part.equals(word.toUpperCase())) {
                count++;
            }
        }
        return count;
    }
    
    /**
     * Convierte entidad SearchHedge a DTO
     */
    private SearchHedgeDTO convertToDTO(SearchHedge hedge) {
        if (hedge == null) return null;
        
        SearchHedgeDTO dto = new SearchHedgeDTO();
        dto.setId(hedge.getId());
        dto.setName(hedge.getName());
        dto.setQuery(hedge.getQuery());
        dto.setCategory(hedge.getCategory());
        dto.setDescription(hedge.getDescription());
        dto.setCreatedAt(hedge.getCreatedAt());
        
        return dto;
    }
}
