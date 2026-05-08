package com.uci.competencia.controller.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.exception.ResourceNotFoundException;
import com.uci.competencia.model.dto.request.ExternalHealthSearchRequestDTO;
import com.uci.competencia.model.dto.request.SearchAssistantRequestDTO;
import com.uci.competencia.model.dto.request.SearchRequestDTO;
import com.uci.competencia.model.dto.response.ExternalHealthSearchResponseDTO;
import com.uci.competencia.model.dto.response.SearchAssistantResponseDTO;
import com.uci.competencia.model.dto.response.SearchResponseDTO;
import com.uci.competencia.model.entity.SearchResult;
import com.uci.competencia.model.entity.SearchSession;
import com.uci.competencia.repository.SearchResultRepository;
import com.uci.competencia.repository.SearchSessionRepository;
import com.uci.competencia.security.UserIdentityResolver;
import com.uci.competencia.service.SearchAssistantService;
import com.uci.competencia.service.SearchService;
import com.uci.competencia.service.external.HealthSearchProxyService;
import com.uci.competencia.service.external.PubMedApiService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/search")
@Slf4j
public class SearchController {

    @Autowired
    private SearchService searchService;

    @Autowired
    private SearchAssistantService searchAssistantService;

    @Autowired
    private SearchSessionRepository searchSessionRepository;

    @Autowired
    private SearchResultRepository searchResultRepository;

    @Autowired
    private UserIdentityResolver userIdentityResolver;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PubMedApiService pubMedApiService;

    @Autowired
    private HealthSearchProxyService healthSearchProxyService;

    @PostMapping("/execute")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<SearchResponseDTO> executeSearch(@Valid @RequestBody SearchRequestDTO request) {
        log.info("Executing search with query: {}", request.getQuery().getTerms());
        SearchResponseDTO response = searchService.executeSearch(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/assistant")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<SearchAssistantResponseDTO> askSearchAssistant(
            @Valid @RequestBody SearchAssistantRequestDTO request) {
        SearchAssistantResponseDTO response = searchAssistantService.generateResponse(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/external-fallback")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<ExternalHealthSearchResponseDTO> executeExternalFallback(
            @RequestBody ExternalHealthSearchRequestDTO request) {
        String queryText = buildExternalQuery(request);
        if (queryText.isBlank()) {
            return ResponseEntity.ok(new ExternalHealthSearchResponseDTO(
                "none",
                List.of(),
                0,
                false,
                java.time.Instant.now().toString()
            ));
        }
        int maxResults = request != null && request.getMaxResults() != null ? request.getMaxResults() : 14;
        ExternalHealthSearchResponseDTO response = healthSearchProxyService.search(queryText, maxResults, request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/mesh/suggestions")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<List<Map<String, String>>> getMeshSuggestions(@RequestParam String term) {
        log.info("Getting MeSH suggestions for term: {}", term);
        List<Map<String, String>> suggestions = new ArrayList<>();
        if (term == null || term.isBlank()) {
            return ResponseEntity.ok(suggestions);
        }
        try {
            List<PubMedApiService.MeshSuggestion> results = pubMedApiService.getSuggestedMeshTerms(term, 10);
            for (PubMedApiService.MeshSuggestion result : results) {
                Map<String, String> entry = new HashMap<>();
                entry.put("id", result.id());
                entry.put("term", result.term());
                entry.put("description", result.description());
                suggestions.add(entry);
            }
        } catch (Exception ex) {
            log.warn("Error fetching MeSH suggestions, using fallback", ex);
            Map<String, String> entry = new HashMap<>();
            entry.put("id", term.toUpperCase());
            entry.put("term", term);
            entry.put("description", "Suggested term");
            suggestions.add(entry);
        }
        return ResponseEntity.ok(suggestions);
    }

    @GetMapping("/results/{searchId}/evidence-pyramid")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<Map<String, Object>> getEvidencePyramid(@PathVariable String searchId) {
        String userIdentifier = getCurrentUserId();
        Set<String> userIds = resolveUserIds(userIdentifier);
        log.info("Getting evidence pyramid for search: {} and user: {}", searchId, userIdentifier);

        SearchSession session = findSessionForUser(searchId, userIds)
            .orElseThrow(() -> new ResourceNotFoundException("Search session not found: " + searchId));
        List<SearchResponseDTO.SearchResultDTO> results = searchResultRepository.findBySessionId(searchId).stream()
            .map(this::mapEntityToResultDTO)
            .toList();
        String source = "session_cache";

        SearchRequestDTO request = buildSearchRequestFromSession(session);
        if (results.isEmpty()) {
            SearchResponseDTO liveResponse = searchService.executeSearch(request, false);
            results = liveResponse.getResults() != null ? liveResponse.getResults() : List.of();
            source = "live_recomputed";
        }

        return ResponseEntity.ok(buildEvidencePyramidResponse(searchId, request, results, source));
    }

    /**
     * Obtener historial de búsquedas del usuario
     * GET /api/search/history?page={page}&limit={limit}
     */
    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<Map<String, Object>> getSearchHistory(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit) {
        String userIdentifier = getCurrentUserId();
        Set<String> userIds = resolveUserIds(userIdentifier);
        log.info("Getting search history for user: {}, page: {}, limit: {}", userIdentifier, page, limit);

        if (page < 1) page = 1;
        if (limit < 1 || limit > 100) limit = 10;

        List<SearchSession> sessions = loadSessionsForUserIds(userIds);
        int total = sessions.size();
        int from = Math.min((page - 1) * limit, total);
        int to = Math.min(from + limit, total);
        List<SearchSession> paged = sessions.subList(from, to);

        List<Map<String, Object>> searches = paged.stream()
            .map(this::mapSessionToSearchQuery)
            .toList();

        Map<String, Object> response = new HashMap<>();
        response.put("searches", searches);
        response.put("total", total);

        return ResponseEntity.ok(response);
    }

    /**
     * Marcar/desmarcar búsqueda como favorita
     * PUT /api/search/{searchId}
     */
    @PutMapping("/{searchId}")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<Map<String, Object>> updateSearch(
            @PathVariable String searchId,
            @RequestBody Map<String, Object> updates) {
        String userIdentifier = getCurrentUserId();
        Set<String> userIds = resolveUserIds(userIdentifier);
        log.info("Updating search {} for user: {}", searchId, userIdentifier);

        SearchSession session = findSessionForUser(searchId, userIds)
            .orElseThrow(() -> new ResourceNotFoundException("Search session not found: " + searchId));

        Object favorite = updates.get("isFavorite");
        if (favorite instanceof Boolean) {
            session.setIsFavorite((Boolean) favorite);
        }
        SearchSession saved = searchSessionRepository.save(session);
        return ResponseEntity.ok(mapSessionToSearchQuery(saved));
    }

    /**
     * Eliminar una bÃºsqueda del historial
     * DELETE /api/search/{searchId}
     */
    @DeleteMapping("/{searchId}")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<Void> deleteSearch(@PathVariable String searchId) {
        String userIdentifier = getCurrentUserId();
        Set<String> userIds = resolveUserIds(userIdentifier);
        log.info("Deleting search {} for user: {}", searchId, userIdentifier);

        SearchSession session = findSessionForUser(searchId, userIds)
            .orElseThrow(() -> new ResourceNotFoundException("Search session not found: " + searchId));
        searchSessionRepository.delete(session);
        return ResponseEntity.noContent().build();
    }

    /**
     * Obtener ID del usuario autenticado
     */
    private String getCurrentUserId() {
        return userIdentityResolver.getCurrentPrincipalIdentifier().orElse(null);
    }

    /**
     * Obtener una sesión de búsqueda por ID
     * GET /api/search/sessions/{sessionId}
     */
    @GetMapping("/sessions/{sessionId}")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<Map<String, Object>> getSearchSession(@PathVariable String sessionId) {
        String userIdentifier = getCurrentUserId();
        Set<String> userIds = resolveUserIds(userIdentifier);
        log.info("Getting search session {} for user: {}", sessionId, userIdentifier);

        SearchSession session = findSessionForUser(sessionId, userIds)
            .orElseThrow(() -> new ResourceNotFoundException("Search session not found: " + sessionId));

        Map<String, Object> query = mapSessionToSearchQuery(session);
        List<SearchResponseDTO.SearchResultDTO> results = searchResultRepository.findBySessionId(sessionId).stream()
            .map(this::mapEntityToResultDTO)
            .toList();

        Map<String, Object> response = new HashMap<>();
        response.put("id", session.getId());
        response.put("query", query);
        response.put("results", results);
        response.put(
            "totalResults",
            session.getResultsCount() != null ? Math.max(session.getResultsCount(), results.size()) : results.size()
        );
        String executedAt = session.getCompletedAt() != null
            ? session.getCompletedAt().toString()
            : session.getStartedAt() != null ? session.getStartedAt().toString() : null;
        response.put("executedAt", executedAt);
        return ResponseEntity.ok(response);
    }

    private SearchRequestDTO buildSearchRequestFromSession(SearchSession session) {
        SearchRequestDTO parsed = null;
        if (session.getFiltersApplied() != null && !session.getFiltersApplied().isBlank()) {
            try {
                parsed = objectMapper.readValue(session.getFiltersApplied(), SearchRequestDTO.class);
            } catch (Exception ex) {
                log.warn("Unable to parse stored search request for session {}", session.getId(), ex);
            }
        }
        return sanitizeSearchRequest(parsed, session);
    }

    private SearchRequestDTO sanitizeSearchRequest(SearchRequestDTO request, SearchSession session) {
        SearchRequestDTO resolved = request != null ? request : new SearchRequestDTO();
        if (resolved.getQuery() == null) {
            resolved.setQuery(new SearchRequestDTO.SearchQueryDTO());
        }

        List<String> terms = resolved.getQuery().getTerms();
        if (terms == null || terms.isEmpty()) {
            String originalQuery = session.getOriginalQuery() != null ? session.getOriginalQuery().trim() : "";
            if (!originalQuery.isBlank()) {
                terms = List.of(originalQuery);
            } else {
                terms = List.of("evidence based medicine");
            }
            resolved.getQuery().setTerms(terms);
        }

        if (resolved.getQuery().getOperators() == null) {
            resolved.getQuery().setOperators(List.of());
        }
        if (resolved.getQuery().getMeshTerms() == null) {
            resolved.getQuery().setMeshTerms(List.of());
        }

        if (resolved.getFilters() == null) {
            resolved.setFilters(new SearchRequestDTO.SearchFiltersDTO());
        }
        if (resolved.getFilters().getMaxResults() == null) {
            resolved.getFilters().setMaxResults(100);
        }

        if (resolved.getContext() == null) {
            resolved.setContext(new SearchRequestDTO.SearchContextDTO());
        }
        resolved.getContext().setSessionId(session.getId());

        return resolved;
    }

    private Map<String, Object> buildEvidencePyramidResponse(
        String searchId,
        SearchRequestDTO request,
        List<SearchResponseDTO.SearchResultDTO> results,
        String source
    ) {
        List<SearchResponseDTO.SearchResultDTO> safeResults = results != null ? results : List.of();
        int totalStudies = safeResults.size();
        Map<Integer, List<SearchResponseDTO.SearchResultDTO>> grouped = new LinkedHashMap<>();
        for (int level = 1; level <= 6; level++) {
            grouped.put(level, new ArrayList<>());
        }

        for (SearchResponseDTO.SearchResultDTO result : safeResults) {
            int level = resolveEvidenceLevel(result);
            grouped.computeIfAbsent(level, ignored -> new ArrayList<>()).add(result);
        }

        int l1 = grouped.getOrDefault(1, List.of()).size();
        int l2 = grouped.getOrDefault(2, List.of()).size();
        int l3 = grouped.getOrDefault(3, List.of()).size();
        int l4 = grouped.getOrDefault(4, List.of()).size();
        int l5 = grouped.getOrDefault(5, List.of()).size();
        int l6 = grouped.getOrDefault(6, List.of()).size();
        double score = totalStudies == 0
            ? 0.0
            : ((6.0 * l1) + (5.0 * l2) + (4.0 * l3) + (3.0 * l4) + (2.0 * l5) + (1.0 * l6))
                / (6.0 * totalStudies);

        String strengthCode;
        String strengthDescription;
        if (totalStudies == 0) {
            strengthCode = "NO_EVIDENCE";
            strengthDescription = "No hay evidencia";
        } else if (score >= 0.80) {
            strengthCode = "VERY_HIGH";
            strengthDescription = "Evidencia muy alta";
        } else if (score >= 0.60) {
            strengthCode = "HIGH";
            strengthDescription = "Evidencia alta";
        } else if (score >= 0.40) {
            strengthCode = "MODERATE";
            strengthDescription = "Evidencia moderada";
        } else {
            strengthCode = "LOW";
            strengthDescription = "Evidencia baja";
        }

        List<Map<String, Object>> levels = new ArrayList<>();
        for (int level = 1; level <= 6; level++) {
            List<SearchResponseDTO.SearchResultDTO> levelStudies = grouped.getOrDefault(level, List.of());
            Map<String, Object> levelPayload = new LinkedHashMap<>();
            levelPayload.put("level", level);
            levelPayload.put("label", evidenceLevelLabel(level));
            levelPayload.put("count", levelStudies.size());
            double percentage = totalStudies == 0 ? 0.0 : (levelStudies.size() * 100.0) / totalStudies;
            levelPayload.put("percentage", Math.round(percentage * 100.0) / 100.0);
            levelPayload.put(
                "studies",
                levelStudies.stream().limit(20).map(this::mapStudySummary).toList()
            );
            levels.add(levelPayload);
        }

        Map<String, Object> strength = new LinkedHashMap<>();
        strength.put("code", strengthCode);
        strength.put("description", strengthDescription);
        strength.put("score", Math.round(score * 10000.0) / 10000.0);

        Map<String, Object> query = new LinkedHashMap<>();
        List<String> terms = request != null && request.getQuery() != null && request.getQuery().getTerms() != null
            ? request.getQuery().getTerms()
            : List.of();
        query.put("terms", terms);
        query.put("raw", String.join(" ", terms));
        query.put("filters", request != null ? request.getFilters() : null);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("searchId", searchId);
        payload.put("source", source);
        payload.put("generatedAt", java.time.Instant.now().toString());
        payload.put("query", query);
        payload.put("totalStudies", totalStudies);
        payload.put("strength", strength);
        payload.put("levels", levels);
        return payload;
    }

    private Map<String, Object> mapStudySummary(SearchResponseDTO.SearchResultDTO result) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", result.getId());
        payload.put("pmid", result.getPmid());
        payload.put("title", result.getTitle());
        payload.put("year", result.getYear());
        payload.put("studyType", result.getStudyType());
        payload.put("evidenceLevel", resolveEvidenceLevel(result));
        payload.put("sampleSize", result.getSampleSize());
        payload.put("hasConflictOfInterest", Boolean.TRUE.equals(result.getHasConflictOfInterest()));
        payload.put("authors", result.getAuthors() != null ? result.getAuthors() : List.of());
        payload.put("journal", result.getJournal());
        payload.put("doi", result.getDoi());
        payload.put("sourceUrl", result.getFullTextUrl());
        return payload;
    }

    private int resolveEvidenceLevel(SearchResponseDTO.SearchResultDTO result) {
        if (result == null) {
            return 6;
        }
        Integer level = result.getEvidenceLevel();
        if (level != null && level >= 1 && level <= 6) {
            return level;
        }
        String studyType = result.getStudyType() != null ? result.getStudyType().toLowerCase() : "";
        if (studyType.contains("systematic") || studyType.contains("meta")) return 1;
        if (studyType.contains("randomized") || studyType.contains("trial") || studyType.contains("rct")) return 2;
        if (studyType.contains("cohort")) return 3;
        if (studyType.contains("case_control") || studyType.contains("case-control")) return 4;
        if (studyType.contains("case_report") || studyType.contains("case report") || studyType.contains("series")) return 5;
        return 6;
    }

    private String evidenceLevelLabel(int level) {
        return switch (level) {
            case 1 -> "Revisiones sistematicas y metaanalisis";
            case 2 -> "Ensayos clinicos aleatorizados";
            case 3 -> "Estudios de cohorte";
            case 4 -> "Estudios de casos y controles";
            case 5 -> "Series y reportes de casos";
            default -> "Opinion de expertos y otros";
        };
    }

    private SearchResponseDTO.SearchResultDTO mapEntityToResultDTO(SearchResult entity) {
        SearchResponseDTO.SearchResultDTO dto = new SearchResponseDTO.SearchResultDTO();
        dto.setId(entity.getId());
        dto.setPmid(entity.getPmid());
        dto.setTitle(entity.getTitle());
        dto.setAbstractText(entity.getAbstractText());
        if (entity.getAuthors() != null && !entity.getAuthors().isBlank()) {
            String delimiter = entity.getAuthors().contains(";") ? ";\\s*" : ",\\s*";
            dto.setAuthors(java.util.Arrays.stream(entity.getAuthors().split(delimiter)).toList());
        } else {
            dto.setAuthors(List.of());
        }
        dto.setJournal(entity.getJournal());
        if (entity.getPublicationYear() != null) {
            dto.setYear(entity.getPublicationYear());
        } else if (entity.getPublicationDate() != null) {
            dto.setYear(entity.getPublicationDate().getYear());
        }
        dto.setStudyType(entity.getStudyType() != null ? entity.getStudyType().name().toLowerCase() : "unknown");
        dto.setEvidenceLevel(entity.getEvidenceLevel());
        dto.setSampleSize(entity.getSampleSize());
        dto.setHasConflictOfInterest(entity.getHasConflictOfInterest() != null ? entity.getHasConflictOfInterest() : false);
        dto.setDoi(entity.getDoi());
        dto.setRelevanceScore(entity.getRelevanceScore());
        dto.setFullTextUrl(entity.getFullTextUrl());
        dto.setMeshTerms(entity.getMeshTerms() != null ? entity.getMeshTerms() : List.of());
        return dto;
    }

    private List<SearchSession> loadSessionsForUserIds(Set<String> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return List.of();
        }
        var pageable = org.springframework.data.domain.PageRequest.of(
            0,
            1000,
            Sort.by(Sort.Direction.DESC, "startedAt")
        );
        Map<String, SearchSession> merged = new LinkedHashMap<>();
        for (String userId : userIds) {
            searchSessionRepository.findByUser_Id(userId, pageable)
                .forEach(session -> merged.putIfAbsent(session.getId(), session));
        }
        return merged.values().stream()
            .sorted((left, right) -> {
                var leftTime = left.getStartedAt();
                var rightTime = right.getStartedAt();
                if (leftTime == null && rightTime == null) return 0;
                if (leftTime == null) return 1;
                if (rightTime == null) return -1;
                return rightTime.compareTo(leftTime);
            })
            .toList();
    }

    private Optional<SearchSession> findSessionForUser(String sessionId, Set<String> userIds) {
        if (sessionId == null || sessionId.isBlank() || userIds == null || userIds.isEmpty()) {
            return Optional.empty();
        }
        for (String userId : userIds) {
            Optional<SearchSession> session = searchSessionRepository.findByIdAndUser_Id(sessionId, userId);
            if (session.isPresent()) {
                return session;
            }
        }
        return Optional.empty();
    }

    private Set<String> resolveUserIds(String userIdentifier) {
        if (userIdentifier == null || userIdentifier.isBlank()) {
            return Set.of();
        }
        LinkedHashSet<String> userIds = new LinkedHashSet<>();
        String canonicalUserId = userIdentityResolver.resolveCanonicalUserId(userIdentifier);
        if (canonicalUserId != null && !canonicalUserId.isBlank()) {
            userIds.add(canonicalUserId);
        }
        return userIds;
    }

    private Map<String, Object> mapSessionToSearchQuery(SearchSession session) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", session.getId());
        response.put("rawQuery", session.getOriginalQuery());
        response.put("createdAt", session.getStartedAt() != null ? session.getStartedAt().toString() : null);
        response.put("resultCount", session.getResultsCount());
        response.put("isFavorite", session.getIsFavorite() != null ? session.getIsFavorite() : false);
        response.put("operators", List.of());
        response.put("filters", Map.of());
        response.put("terms", List.of());

        if (session.getFiltersApplied() != null && !session.getFiltersApplied().isBlank()) {
            try {
                Map<String, Object> stored = objectMapper.readValue(
                    session.getFiltersApplied(),
                    new TypeReference<Map<String, Object>>() {}
                );
                Map<String, Object> query = asMap(stored.get("query"));
                Map<String, Object> filters = asMap(stored.get("filters"));

                List<String> terms = asStringList(query.get("terms"));
                List<String> meshTerms = asStringList(query.get("meshTerms"));
                List<Map<String, Object>> termObjects = new ArrayList<>();
                for (int i = 0; i < terms.size(); i++) {
                    String term = terms.get(i);
                    String id = i < meshTerms.size() ? meshTerms.get(i) : term.toUpperCase();
                    termObjects.add(Map.of(
                        "id", id,
                        "term", term,
                        "description", ""
                    ));
                }

                if (termObjects.isEmpty() && session.getOriginalQuery() != null && !session.getOriginalQuery().isBlank()) {
                    termObjects.add(Map.of(
                        "id", session.getOriginalQuery().toUpperCase(),
                        "term", session.getOriginalQuery(),
                        "description", ""
                    ));
                }

                response.put("terms", termObjects);
                response.put("operators", asStringList(query.get("operators")));
                response.put("filters", mapFilters(filters));
                response.put("rawQuery", session.getOriginalQuery() != null && !session.getOriginalQuery().isBlank()
                    ? session.getOriginalQuery()
                    : String.join(" ", terms));
            } catch (Exception e) {
                log.warn("Error parsing stored search session filters", e);
            }
        }

        if (((List<?>) response.get("terms")).isEmpty() && session.getOriginalQuery() != null && !session.getOriginalQuery().isBlank()) {
            response.put("terms", List.of(Map.of(
                "id", session.getOriginalQuery().toUpperCase(),
                "term", session.getOriginalQuery(),
                "description", ""
            )));
        }

        return response;
    }

    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map) {
            Map<?, ?> raw = (Map<?, ?>) value;
            Map<String, Object> mapped = new HashMap<>();
            for (Map.Entry<?, ?> entry : raw.entrySet()) {
                mapped.put(String.valueOf(entry.getKey()), entry.getValue());
            }
            return mapped;
        }
        return Map.of();
    }

    private List<String> asStringList(Object value) {
        if (value instanceof List) {
            List<?> list = (List<?>) value;
            List<String> result = new ArrayList<>();
            for (Object item : list) {
                if (item != null) {
                    result.add(item.toString());
                }
            }
            return result;
        }
        return List.of();
    }

    private Map<String, Object> mapFilters(Map<String, Object> filters) {
        Map<String, Object> mapped = new HashMap<>();
        Integer yearFrom = asInteger(filters.get("yearFrom"));
        Integer yearTo = asInteger(filters.get("yearTo"));
        if (yearFrom != null || yearTo != null) {
            Integer start = yearFrom != null ? yearFrom : yearTo;
            Integer end = yearTo != null ? yearTo : yearFrom;
            mapped.put("yearRange", new Integer[] { start, end });
        }
        List<String> studyTypes = asStringList(filters.get("studyTypes"));
        if (!studyTypes.isEmpty()) {
            mapped.put("studyTypes", studyTypes);
        }
        String language = filters.get("language") != null ? filters.get("language").toString() : null;
        if (language != null && !language.isBlank()) {
            mapped.put("languages", List.of(language));
        }
        Integer minSampleSize = asInteger(filters.get("minSampleSize"));
        if (minSampleSize != null) {
            mapped.put("minSampleSize", minSampleSize);
        }
        Boolean hasFullText = asBoolean(filters.get("hasFullText"));
        if (hasFullText != null) {
            mapped.put("hasFullText", hasFullText);
        }
        Integer maxResults = asInteger(filters.get("maxResults"));
        if (maxResults != null) {
            mapped.put("maxResults", maxResults);
        }
        return mapped;
    }

    private Integer asInteger(Object value) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String) {
            try {
                return Integer.parseInt((String) value);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private Boolean asBoolean(Object value) {
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        if (value instanceof String) {
            String normalized = ((String) value).trim().toLowerCase();
            if ("true".equals(normalized)) return true;
            if ("false".equals(normalized)) return false;
        }
        return null;
    }

    private String buildExternalQuery(ExternalHealthSearchRequestDTO request) {
        if (request == null) {
            return "";
        }
        if (request.getQueryText() != null && !request.getQueryText().isBlank()) {
            return request.getQueryText().trim();
        }
        if (request.getTerms() == null || request.getTerms().isEmpty()) {
            return "";
        }
        return request.getTerms().stream()
            .filter(item -> item != null && !item.isBlank())
            .map(String::trim)
            .collect(Collectors.joining(" "));
    }
}


