package com.uci.competencia.service.impl;

import com.uci.competencia.model.dto.response.SearchHedgeDTO;
import com.uci.competencia.model.dto.response.SearchHedgeTestResultDTO;
import com.uci.competencia.model.entity.SearchHedge;
import com.uci.competencia.repository.SearchHedgeRepository;
import com.uci.competencia.service.SearchHedgeService;
import com.uci.competencia.service.external.PubMedApiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SearchHedgeServiceImpl implements SearchHedgeService {

    private final SearchHedgeRepository searchHedgeRepository;
    private final PubMedApiService pubMedApiService;

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
    public Optional<SearchHedgeDTO> getHedgeById(String id, String professorId) {
        log.info("Getting hedge with id: {}", id);
        return searchHedgeRepository.findByIdAndCreatedBy(id, professorId).map(this::convertToDTO);
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
    public SearchHedgeDTO updateHedge(String id, SearchHedgeDTO hedgeDTO, String professorId) {
        log.info("Updating hedge with id: {}", id);

        SearchHedge hedge = searchHedgeRepository.findByIdAndCreatedBy(id, professorId)
            .orElseThrow(() -> new RuntimeException("Hedge not found or unauthorized: " + id));

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
    public void deleteHedge(String id, String professorId) {
        log.info("Deleting hedge with id: {}", id);
        SearchHedge hedge = searchHedgeRepository.findByIdAndCreatedBy(id, professorId)
            .orElseThrow(() -> new RuntimeException("Hedge not found or unauthorized: " + id));
        searchHedgeRepository.delete(hedge);
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> getCategories() {
        return new ArrayList<>(PREDEFINED_CATEGORIES);
    }

    @Override
    @Transactional(readOnly = true)
    public SearchHedgeTestResultDTO testHedge(String query) {
        log.info("Testing hedge query: {}", query);

        SearchHedgeTestResultDTO result = new SearchHedgeTestResultDTO();
        result.setQuery(query);

        try {
            List<PubMedApiService.PubMedArticle> articles = pubMedApiService.searchArticles(query, 200);
            if (!articles.isEmpty()) {
                int resultCount = articles.size();
                double estimatedPrecision = calculatePrecisionFromResults(articles);
                double estimatedRecall = calculateEstimatedRecall(query, resultCount);

                result.setResultCount(resultCount);
                result.setEstimatedPrecision(estimatedPrecision);
                result.setEstimatedRecall(estimatedRecall);
                result.setStatus("SUCCESS_API");
                result.setMessage("Resultado calculado con datos reales de PubMed.");
                return result;
            }

            int resultCount = simulateQueryExecution(query);
            double estimatedPrecision = calculateEstimatedPrecision(query, resultCount);
            double estimatedRecall = calculateEstimatedRecall(query, resultCount);

            result.setResultCount(resultCount);
            result.setEstimatedPrecision(estimatedPrecision);
            result.setEstimatedRecall(estimatedRecall);
            result.setStatus("FALLBACK");
            result.setMessage("PubMed no devolvio datos. Se aplico simulacion local.");
            return result;
        } catch (Exception e) {
            log.error("Error testing hedge query", e);
            result.setStatus("ERROR");
            result.setMessage("Error testing query: " + e.getMessage());
            result.setResultCount(0);
            result.setEstimatedPrecision(0.0);
            result.setEstimatedRecall(0.0);
            return result;
        }
    }

    private double calculatePrecisionFromResults(List<PubMedApiService.PubMedArticle> articles) {
        if (articles == null || articles.isEmpty()) {
            return 0.0;
        }

        int highEvidenceCount = 0;
        for (PubMedApiService.PubMedArticle article : articles) {
            List<String> publicationTypes = article.publicationTypes();
            if (publicationTypes == null || publicationTypes.isEmpty()) {
                continue;
            }
            boolean highEvidence = publicationTypes.stream().anyMatch(type -> {
                if (type == null) {
                    return false;
                }
                String normalized = type.toLowerCase();
                return normalized.contains("systematic review")
                    || normalized.contains("meta-analysis")
                    || normalized.contains("randomized");
            });
            if (highEvidence) {
                highEvidenceCount++;
            }
        }

        if (highEvidenceCount == 0) {
            return 0.5;
        }
        double precision = (double) highEvidenceCount / articles.size();
        return Math.max(0.1, Math.min(1.0, precision));
    }

    private Integer simulateQueryExecution(String query) {
        if (query == null || query.isEmpty()) {
            return 0;
        }

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
            } else if (!keyword.isEmpty() && !keyword.equals("THE")
                && !keyword.equals("A") && !keyword.equals("AN")) {
                keywordCount++;
            }
        }

        int baseCount = keywordCount * 50;
        int andFactor = (int) (andCount * baseCount * 0.1);
        int orBonus = orCount * 100;
        int notPenalty = notCount * 20;
        int totalCount = Math.max(100, baseCount - andFactor + orBonus - notPenalty);
        return Math.min(totalCount, 5000);
    }

    private double calculateEstimatedPrecision(String query, int resultCount) {
        if (resultCount == 0) return 0.0;

        int operatorCount = countOccurrences(query, "AND") + countOccurrences(query, "NOT");
        double basePrecision = 0.5;
        basePrecision += (operatorCount * 0.05);

        if (resultCount > 1000) {
            basePrecision *= 0.8;
        } else if (resultCount < 100) {
            basePrecision = Math.min(0.95, basePrecision * 1.1);
        }

        return Math.min(1.0, basePrecision);
    }

    private double calculateEstimatedRecall(String query, int resultCount) {
        int orCount = countOccurrences(query, "OR");
        int notCount = countOccurrences(query, "NOT");
        double baseRecall = 0.7;
        baseRecall += (orCount * 0.05);
        baseRecall -= (notCount * 0.05);

        if (resultCount < 100) {
            baseRecall *= 0.8;
        } else if (resultCount > 3000) {
            baseRecall = Math.min(0.98, baseRecall * 1.05);
        }

        return Math.max(0.0, Math.min(1.0, baseRecall));
    }

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

    private SearchHedgeDTO convertToDTO(SearchHedge hedge) {
        if (hedge == null) return null;

        SearchHedgeDTO dto = new SearchHedgeDTO();
        dto.setId(hedge.getId());
        dto.setName(hedge.getName());
        dto.setQuery(hedge.getQuery());
        dto.setCategory(hedge.getCategory());
        dto.setDescription(hedge.getDescription());
        dto.setEstimatedResults(hedge.getEstimatedResults());
        dto.setPrecision(hedge.getPrecision());
        dto.setRecall(hedge.getRecall());
        dto.setCreatedBy(hedge.getCreatedBy());
        dto.setCreatedAt(hedge.getCreatedAt());
        dto.setIsTemplate(hedge.getIsTemplate());
        return dto;
    }
}
