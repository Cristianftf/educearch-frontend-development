package com.uci.competencia.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.request.SearchRequestDTO;
import com.uci.competencia.model.dto.response.SearchResponseDTO;
import com.uci.competencia.model.entity.SearchResult;
import com.uci.competencia.model.entity.SearchSession;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.repository.SearchSessionRepository;
import com.uci.competencia.repository.SearchResultRepository;
import com.uci.competencia.repository.UserRepository;
import com.uci.competencia.service.SearchService;
import com.uci.competencia.service.external.PubMedApiService;
import com.uci.competencia.util.EvidenceLevelMapper;
import com.uci.competencia.util.PubMedQueryBuilder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Slf4j
public class SearchServiceImpl implements SearchService {

    private final SearchSessionRepository searchSessionRepository;
    private final SearchResultRepository searchResultRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final PubMedApiService pubMedApiService;
    private final PubMedQueryBuilder pubMedQueryBuilder;

    public SearchServiceImpl(
        SearchSessionRepository searchSessionRepository,
        SearchResultRepository searchResultRepository,
        UserRepository userRepository,
        ObjectMapper objectMapper,
        PubMedApiService pubMedApiService,
        PubMedQueryBuilder pubMedQueryBuilder
    ) {
        this.searchSessionRepository = searchSessionRepository;
        this.searchResultRepository = searchResultRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
        this.pubMedApiService = pubMedApiService;
        this.pubMedQueryBuilder = pubMedQueryBuilder;
    }

    @Override
    public SearchResponseDTO executeSearch(SearchRequestDTO request) {
        log.info("Executing search with terms: {}", request.getQuery().getTerms());

        SearchResponseDTO response = new SearchResponseDTO();
        response.setSearchId(null);

        List<SearchResponseDTO.SearchResultDTO> results = executePubMedSearch(request);
        if (results.isEmpty()) {
            List<SearchResult> localResults = searchLocalResults(request);
            for (SearchResult result : localResults) {
                results.add(mapToResultDTO(result));
            }
        }
        response.setResults(results);
        
        SearchResponseDTO.SearchMetadataDTO metadata = new SearchResponseDTO.SearchMetadataDTO();
        metadata.setTotalResults(results.size());
        metadata.setSearchTime("0ms");
        response.setMetadata(metadata);

        Integer minSampleSize = request.getFilters() != null ? request.getFilters().getMinSampleSize() : null;
        if (minSampleSize != null && response.getResults() != null && !response.getResults().isEmpty()) {
            response.setResults(
                response.getResults().stream()
                    .filter(result -> result.getSampleSize() != null && result.getSampleSize() >= minSampleSize)
                    .collect(Collectors.toList())
            );
            if (response.getMetadata() != null) {
                response.getMetadata().setTotalResults(response.getResults().size());
            }
        }

        persistSearchSession(request, response);

        return response;
    }

    private List<SearchResponseDTO.SearchResultDTO> executePubMedSearch(SearchRequestDTO request) {
        try {
            if (request == null || request.getQuery() == null || request.getQuery().getTerms() == null) {
                return new ArrayList<>();
            }
            int maxResults = 100;
            if (request.getFilters() != null && request.getFilters().getMaxResults() != null) {
                maxResults = Math.max(1, Math.min(200, request.getFilters().getMaxResults()));
            }
            String pubmedQuery = pubMedQueryBuilder.buildPubMedQuery(request.getQuery(), request.getFilters());
            List<PubMedApiService.PubMedArticle> articles = pubMedApiService.searchArticles(pubmedQuery, maxResults);
            if (articles.isEmpty()) {
                return new ArrayList<>();
            }
            List<SearchResponseDTO.SearchResultDTO> results = new ArrayList<>();
            for (PubMedApiService.PubMedArticle article : articles) {
                results.add(mapToResultDTO(article));
            }
            return results;
        } catch (Exception e) {
            log.warn("Error executing PubMed search", e);
            return new ArrayList<>();
        }
    }

    private List<SearchResult> searchLocalResults(SearchRequestDTO request) {
        if (request == null || request.getQuery() == null || request.getQuery().getTerms() == null) {
            return List.of();
        }
        List<String> terms = request.getQuery().getTerms();
        if (terms.isEmpty()) {
            return List.of();
        }
        List<String> operators = request.getQuery().getOperators();
        int maxResults = 100;
        if (request.getFilters() != null && request.getFilters().getMaxResults() != null) {
            maxResults = Math.max(1, Math.min(500, request.getFilters().getMaxResults()));
        }
        Integer yearFrom = request.getFilters() != null ? request.getFilters().getYearFrom() : null;
        Integer yearTo = request.getFilters() != null ? request.getFilters().getYearTo() : null;
        List<String> studyTypes = request.getFilters() != null ? request.getFilters().getStudyTypes() : null;

        List<SearchResult> results = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        for (String term : terms) {
            if (term == null || term.isBlank()) {
                continue;
            }
            var page = searchResultRepository.findByTitleContainingIgnoreCase(
                term.trim(),
                PageRequest.of(0, maxResults)
            );
            for (SearchResult result : page.getContent()) {
                if (result.getId() == null || seen.contains(result.getId())) {
                    continue;
                }
                if (!matchesQuery(result, terms, operators)) {
                    continue;
                }
                if (!matchesYearRange(result, yearFrom, yearTo)) {
                    continue;
                }
                if (!matchesStudyType(result, studyTypes)) {
                    continue;
                }
                results.add(result);
                seen.add(result.getId());
                if (results.size() >= maxResults) {
                    return results;
                }
            }
        }
        return results;
    }

    private boolean matchesQuery(SearchResult result, List<String> terms, List<String> operators) {
        if (terms == null || terms.isEmpty()) {
            return true;
        }
        String haystack = ((result.getTitle() != null ? result.getTitle() : "") + " " +
            (result.getAbstractText() != null ? result.getAbstractText() : "")).toLowerCase();
        boolean current = haystack.contains(terms.get(0).toLowerCase());
        for (int i = 1; i < terms.size(); i++) {
            String operator = (operators != null && i - 1 < operators.size())
                ? operators.get(i - 1)
                : "AND";
            String normalized = operator != null ? operator.trim().toUpperCase() : "AND";
            boolean termPresent = haystack.contains(terms.get(i).toLowerCase());
            switch (normalized) {
                case "OR":
                    current = current || termPresent;
                    break;
                case "NOT":
                    current = current && !termPresent;
                    break;
                case "AND":
                default:
                    current = current && termPresent;
                    break;
            }
        }
        return current;
    }

    private boolean matchesYearRange(SearchResult result, Integer yearFrom, Integer yearTo) {
        if (yearFrom == null && yearTo == null) {
            return true;
        }
        Integer year = result.getPublicationYear();
        if (year == null && result.getPublicationDate() != null) {
            year = result.getPublicationDate().getYear();
        }
        if (year == null) {
            return false;
        }
        if (yearFrom != null && year < yearFrom) {
            return false;
        }
        if (yearTo != null && year > yearTo) {
            return false;
        }
        return true;
    }

    private boolean matchesStudyType(SearchResult result, List<String> studyTypes) {
        if (studyTypes == null || studyTypes.isEmpty()) {
            return true;
        }
        String normalized = normalizeStudyType(result.getStudyType());
        for (String filter : studyTypes) {
            if (filter != null && filter.equalsIgnoreCase(normalized)) {
                return true;
            }
        }
        return false;
    }

    private String normalizeStudyType(com.uci.competencia.model.enums.StudyType studyType) {
        if (studyType == null) {
            return "unknown";
        }
        return switch (studyType) {
            case SYSTEMATIC_REVIEW -> "systematic_review";
            case META_ANALYSIS -> "meta_analysis";
            case RANDOMIZED_CONTROLLED_TRIAL -> "rct";
            case COHORT_STUDY -> "cohort";
            case CASE_CONTROL -> "case_control";
            case CASE_REPORT -> "case_report";
            default -> studyType.name().toLowerCase();
        };
    }

    /**
     * Convierte una entidad SearchResult a DTO SearchResultDTO
     * Garantiza coherencia con el formato esperado por el frontend
     */
    public SearchResponseDTO.SearchResultDTO mapToResultDTO(SearchResult entity) {
        SearchResponseDTO.SearchResultDTO dto = new SearchResponseDTO.SearchResultDTO();
        
        dto.setId(entity.getId());
        dto.setPmid(entity.getPmid());
        dto.setTitle(entity.getTitle());
        dto.setAbstractText(entity.getAbstractText());        
        
        // Convertir autores de String a List
        if (entity.getAuthors() != null && !entity.getAuthors().isEmpty()) {
            dto.setAuthors(entity.getAuthors().split(";\\s*") != null ? 
                java.util.Arrays.asList(entity.getAuthors().split(";\\s*")) : 
                java.util.List.of());
        } else {
            dto.setAuthors(java.util.List.of());
        }
        
        dto.setJournal(entity.getJournal());
        
        // Usar publicationYear si existe, sino extraer del publicationDate
        if (entity.getPublicationYear() != null) {
            dto.setYear(entity.getPublicationYear());
        } else if (entity.getPublicationDate() != null) {
            dto.setYear(entity.getPublicationDate().getYear());
        } else {
            dto.setYear(LocalDate.now().getYear());
        }
        
        dto.setStudyType(mapStudyType(entity.getStudyType()));
        dto.setEvidenceLevel(entity.getEvidenceLevel());
        dto.setSampleSize(entity.getSampleSize());
        dto.setHasConflictOfInterest(entity.getHasConflictOfInterest() != null ? entity.getHasConflictOfInterest() : false);
        dto.setDoi(entity.getDoi());
        
        // Campos opcionales
        dto.setRelevanceScore(entity.getRelevanceScore());
        dto.setFullTextUrl(entity.getFullTextUrl());
        dto.setMeshTerms(entity.getMeshTerms());
        
        return dto;
    }

    public SearchResponseDTO.SearchResultDTO mapToResultDTO(PubMedApiService.PubMedArticle article) {
        SearchResponseDTO.SearchResultDTO dto = new SearchResponseDTO.SearchResultDTO();
        dto.setId(article.pmid() != null ? article.pmid() : "result-" + System.currentTimeMillis());
        dto.setPmid(article.pmid());
        dto.setTitle(article.title());
        dto.setAbstractText(article.abstractText());
        dto.setAuthors(article.authors() != null ? article.authors() : List.of());
        dto.setJournal(article.journal());
        dto.setYear(extractYear(article.publicationDate()));

        var studyType = EvidenceLevelMapper.mapStudyType(article.publicationTypes());
        dto.setStudyType(mapStudyType(studyType));
        dto.setEvidenceLevel(EvidenceLevelMapper.evidenceLevelForStudyType(studyType));

        dto.setSampleSize(extractSampleSize(article.abstractText()));
        dto.setHasConflictOfInterest(false);
        dto.setDoi(article.doi());
        dto.setMeshTerms(article.meshTerms());
        dto.setFullTextUrl(article.doi() != null ? "https://doi.org/" + article.doi() : null);
        return dto;
    }

    private Integer extractSampleSize(String abstractText) {
        if (abstractText == null || abstractText.isBlank()) {
            return null;
        }
        String text = abstractText.toLowerCase();
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("\\b(n|sample size)\\s*=?\\s*(\\d{2,6})\\b");
        java.util.regex.Matcher matcher = pattern.matcher(text);
        if (matcher.find()) {
            try {
                return Integer.parseInt(matcher.group(2));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private Integer extractYear(String publicationDate) {
        if (publicationDate == null || publicationDate.isBlank()) {
            return null;
        }
        if (publicationDate.length() >= 4) {
            try {
                return Integer.parseInt(publicationDate.substring(0, 4));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private String mapStudyType(com.uci.competencia.model.enums.StudyType studyType) {
        if (studyType == null) {
            return "unknown";
        }
        return switch (studyType) {
            case SYSTEMATIC_REVIEW -> "systematic_review";
            case META_ANALYSIS -> "meta_analysis";
            case RANDOMIZED_CONTROLLED_TRIAL -> "rct";
            case COHORT_STUDY -> "cohort";
            case CASE_CONTROL -> "case_control";
            case CASE_REPORT -> "case_report";
            default -> studyType.name().toLowerCase();
        };
    }

    private void persistSearchSession(SearchRequestDTO request, SearchResponseDTO response) {
        try {
            SearchSession session = new SearchSession();
            session.setOriginalQuery(buildOriginalQuery(request));
            session.setTransformedQuery(null);
            session.setResultsCount(response.getMetadata() != null ? response.getMetadata().getTotalResults() : 0);
            session.setSearchEngine("pubmed");
            session.setStartedAt(LocalDateTime.now());
            session.setCompletedAt(LocalDateTime.now());
            session.setIsPractice(request.getContext() != null && Boolean.TRUE.equals(request.getContext().getIsPractice()));
            session.setFiltersApplied(objectMapper.writeValueAsString(request));

            String userIdentifier = getCurrentUserIdentifier();
            if (userIdentifier != null && !userIdentifier.isBlank()) {
                findUserByIdentifier(userIdentifier).ifPresent(session::setUser);
            }

            SearchSession saved = searchSessionRepository.save(session);
            response.setSearchId(saved.getId());
        } catch (Exception e) {
            log.warn("Error persisting search session", e);
            if (response.getSearchId() == null) {
                response.setSearchId("search-" + System.currentTimeMillis());
            }
        }
    }

    private String buildOriginalQuery(SearchRequestDTO request) {
        if (request == null || request.getQuery() == null || request.getQuery().getTerms() == null) {
            return "";
        }
        return String.join(" ", request.getQuery().getTerms());
    }

    private String getCurrentUserIdentifier() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetails) {
            return ((UserDetails) principal).getUsername();
        }
        return principal != null ? principal.toString() : null;
    }

    private Optional<User> findUserByIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return Optional.empty();
        }

        String normalized = identifier.trim();
        try {
            Optional<User> byId = userRepository.findById(normalized);
            if (byId.isPresent()) {
                return byId;
            }
        } catch (Exception e) {
            log.debug("Identifier {} is not a direct user ID", normalized);
        }

        Optional<User> byEmail = userRepository.findByEmail(normalized);
        if (byEmail.isPresent()) {
            return byEmail;
        }

        return userRepository.findByUsername(normalized);
    }
}
