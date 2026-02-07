package com.uci.competencia.controller.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.request.SearchRequestDTO;
import com.uci.competencia.model.dto.response.SearchResponseDTO;
import com.uci.competencia.model.entity.SearchSession;
import com.uci.competencia.repository.SearchSessionRepository;
import com.uci.competencia.service.SearchService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/search")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001", "https://frontend.uci.cu"})
@Slf4j
public class SearchController {

    @Autowired
    private SearchService searchService;

    @Autowired
    private SearchSessionRepository searchSessionRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @PostMapping("/execute")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<SearchResponseDTO> executeSearch(@Valid @RequestBody SearchRequestDTO request) {
        log.info("Executing search with query: {}", request.getQuery().getTerms());
        SearchResponseDTO response = searchService.executeSearch(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/mesh/suggestions")
    public ResponseEntity<List<Map<String, String>>> getMeshSuggestions(@RequestParam String term) {
        log.info("Getting MeSH suggestions for term: {}", term);
        // Placeholder response until PubMed integration is implemented
        List<Map<String, String>> suggestions = new ArrayList<>();
        if (term != null && !term.isBlank()) {
            Map<String, String> entry = new HashMap<>();
            entry.put("id", term.toUpperCase());
            entry.put("term", term);
            entry.put("description", "Suggested MeSH term");
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
        String userId = getCurrentUserId();
        log.info("Getting search history for user: {}, page: {}, limit: {}", userId, page, limit);

        if (page < 1) page = 1;
        if (limit < 1 || limit > 100) limit = 10;

        var pageable = org.springframework.data.domain.PageRequest.of(page - 1, limit);
        var sessions = searchSessionRepository.findByUser_Id(userId, pageable);

        List<Map<String, Object>> searches = sessions.getContent().stream()
            .map(this::mapSessionToSearchQuery)
            .toList();

        Map<String, Object> response = new HashMap<>();
        response.put("searches", searches);
        response.put("total", sessions.getTotalElements());

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
        String userId = getCurrentUserId();
        log.info("Updating search {} for user: {}", searchId, userId);

        return searchSessionRepository.findByIdAndUser_Id(searchId, userId)
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
        String userId = getCurrentUserId();
        log.info("Deleting search {} for user: {}", searchId, userId);

        var session = searchSessionRepository.findByIdAndUser_Id(searchId, userId);
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
        String userId = getCurrentUserId();
        log.info("Getting search session {} for user: {}", sessionId, userId);

        return searchSessionRepository.findByIdAndUser_Id(sessionId, userId)
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
}


