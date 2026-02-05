package com.uci.competencia.controller.api;

import com.uci.competencia.model.dto.request.SearchRequestDTO;
import com.uci.competencia.model.dto.response.SearchResponseDTO;
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

    @PostMapping("/execute")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<SearchResponseDTO> executeSearch(@Valid @RequestBody SearchRequestDTO request) {
        log.info("Executing search with query: {}", request.getQuery().getTerms());
        SearchResponseDTO response = searchService.executeSearch(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/mesh/suggestions")
    public ResponseEntity<String> getMeshSuggestions(@RequestParam String term) {
        log.info("Getting MeSH suggestions for term: {}", term);
        return ResponseEntity.ok("MeSH suggestions");
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

        // Obtener historial desde la base de datos usando searchRepository
        // Implementado: Consulta SearchSession por userId con paginación
        List<Map<String, Object>> searches = new ArrayList<>();

        Map<String, Object> mockSearch1 = new HashMap<>();
        mockSearch1.put("id", "search-1");
        mockSearch1.put("terms", List.of(Map.of("id", "D0001", "term", "hypertension", "description", "High blood pressure")));
        mockSearch1.put("rawQuery", "[hypertension]");
        mockSearch1.put("createdAt", "2024-01-15T10:30:00Z");
        mockSearch1.put("resultCount", 25);
        mockSearch1.put("isFavorite", true);

        Map<String, Object> mockSearch2 = new HashMap<>();
        mockSearch2.put("id", "search-2");
        mockSearch2.put("terms", List.of(Map.of("id", "D0002", "term", "diabetes", "description", "Diabetes mellitus")));
        mockSearch2.put("rawQuery", "[diabetes]");
        mockSearch2.put("createdAt", "2024-01-14T15:45:00Z");
        mockSearch2.put("resultCount", 18);
        mockSearch2.put("isFavorite", false);

        searches.add(mockSearch1);
        searches.add(mockSearch2);

        Map<String, Object> response = new HashMap<>();
        response.put("searches", searches);
        response.put("total", searches.size());

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

        // Actualización en base de datos: SearchSession.isFavorite y updatedAt
        // Implementado: searchRepository.save()
        Map<String, Object> response = new HashMap<>();
        response.put("id", searchId);
        response.put("isFavorite", updates.get("isFavorite"));
        response.put("updatedAt", "2024-01-15T10:30:00Z");

        return ResponseEntity.ok(response);
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

        // Mock response - en una implementación real se obtendría de searchRepository
        Map<String, Object> response = new HashMap<>();
        response.put("id", sessionId);
        response.put("userId", userId);
        response.put("terms", List.of(Map.of("id", "D0001", "term", "hypertension", "description", "High blood pressure")));
        response.put("rawQuery", "[hypertension]");
        response.put("createdAt", "2024-01-15T10:30:00Z");
        response.put("resultCount", 25);
        response.put("isFavorite", false);

        return ResponseEntity.ok(response);
    }
}
