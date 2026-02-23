package com.uci.competencia.controller.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.request.ExternalHealthSearchRequestDTO;
import com.uci.competencia.model.dto.request.SearchAssistantRequestDTO;
import com.uci.competencia.model.dto.request.SearchRequestDTO;
import com.uci.competencia.model.dto.response.ExternalHealthSearchResponseDTO;
import com.uci.competencia.model.dto.response.SearchAssistantResponseDTO;
import com.uci.competencia.model.dto.response.SearchResponseDTO;
import com.uci.competencia.model.entity.SearchSession;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.repository.SearchSessionRepository;
import com.uci.competencia.repository.UserRepository;
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
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
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
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001", "https://frontend.uci.cu"})
@Slf4j
public class SearchController {

    @Autowired
    private SearchService searchService;

    @Autowired
    private SearchAssistantService searchAssistantService;

    @Autowired
    private SearchSessionRepository searchSessionRepository;

    @Autowired
    private UserRepository userRepository;

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
    public ResponseEntity<String> getEvidencePyramid(@PathVariable String searchId) {
        log.info("Getting evidence pyramid for search: {}", searchId);
        return ResponseEntity.ok("Evidence pyramid data");
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

        return findSessionForUser(searchId, userIds)
            .map(session -> {
                Object favorite = updates.get("isFavorite");
                if (favorite instanceof Boolean) {
                    session.setIsFavorite((Boolean) favorite);
                }
                SearchSession saved = searchSessionRepository.save(session);
                return ResponseEntity.ok(mapSessionToSearchQuery(saved));
            })
            .orElse(ResponseEntity.notFound().build());
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

        var session = findSessionForUser(searchId, userIds);
        if (session.isEmpty()) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND).build();
        }
        searchSessionRepository.delete(session.get());
        return ResponseEntity.noContent().build();
    }

    /**
     * Obtener ID del usuario autenticado
     */
    private String getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetails) {
            return ((UserDetails) principal).getUsername();
        }
        return principal.toString();
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

        return findSessionForUser(sessionId, userIds)
            .map(session -> {
                Map<String, Object> query = mapSessionToSearchQuery(session);
                Map<String, Object> response = new HashMap<>();
                response.put("id", session.getId());
                response.put("query", query);
                response.put("results", List.of());
                response.put("totalResults", session.getResultsCount() != null ? session.getResultsCount() : 0);
                String executedAt = session.getCompletedAt() != null
                    ? session.getCompletedAt().toString()
                    : session.getStartedAt() != null ? session.getStartedAt().toString() : null;
                response.put("executedAt", executedAt);
                return ResponseEntity.ok(response);
            })
            .orElse(ResponseEntity.notFound().build());
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
        findUserByIdentifier(userIdentifier)
            .map(User::getId)
            .ifPresentOrElse(userIds::add, () -> userIds.add(userIdentifier.trim()));
        return userIds;
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


