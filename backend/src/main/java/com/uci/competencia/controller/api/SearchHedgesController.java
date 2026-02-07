package com.uci.competencia.controller.api;

import com.uci.competencia.model.dto.response.SearchHedgeDTO;
import com.uci.competencia.model.dto.response.SearchHedgeTestResultDTO;
import com.uci.competencia.service.SearchHedgeService;
import com.uci.competencia.util.SecurityUtils;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/hedges")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001", "https://frontend.uci.cu"})
@PreAuthorize("hasRole('PROFESSOR')")
@RequiredArgsConstructor
@Slf4j
public class SearchHedgesController {
    
    private final SearchHedgeService hedgeService;
    
    /**
     * GET /api/hedges
     * Obtiene todos los hedges del profesor
     * @param category Categoría opcional para filtrar
     * @return Lista de SearchHedgeDTO
     */
    @GetMapping
    public ResponseEntity<List<SearchHedgeDTO>> getAllHedges(
            @RequestParam(required = false) String category) {
        log.info("Getting all hedges for category: {}", category);
        String professorId = SecurityUtils.getCurrentUserId();
        List<SearchHedgeDTO> hedges = hedgeService.getAllHedges(professorId, category);
        return ResponseEntity.ok(hedges);
    }
    
    /**
     * GET /api/hedges/{id}
     * Obtiene un hedge específico por ID
     * @param id ID del hedge
     * @return SearchHedgeDTO
     */
    @GetMapping("/{id}")
    public ResponseEntity<SearchHedgeDTO> getHedgeById(@PathVariable String id) {
        log.info("Getting hedge with id: {}", id);
        return hedgeService.getHedgeById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * POST /api/hedges
     * Crea un nuevo hedge de búsqueda
     * @param hedge Datos del hedge a crear
     * @return SearchHedgeDTO creado con HTTP 201
     */
    @PostMapping
    public ResponseEntity<SearchHedgeDTO> createHedge(@RequestBody SearchHedgeDTO hedge) {
        log.info("Creating new hedge: {}", hedge.getName());
        String professorId = SecurityUtils.getCurrentUserId();
        SearchHedgeDTO created = hedgeService.createHedge(hedge, professorId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
    
    /**
     * PUT /api/hedges/{id}
     * Actualiza un hedge de búsqueda existente
     * @param id ID del hedge a actualizar
     * @param hedge Nuevos datos del hedge
     * @return SearchHedgeDTO actualizado
     */
    @PutMapping("/{id}")
    public ResponseEntity<SearchHedgeDTO> updateHedge(
            @PathVariable String id,
            @RequestBody SearchHedgeDTO hedge) {
        log.info("Updating hedge with id: {}", id);
        SearchHedgeDTO updated = hedgeService.updateHedge(id, hedge);
        return ResponseEntity.ok(updated);
    }
    
    /**
     * DELETE /api/hedges/{id}
     * Elimina un hedge de búsqueda
     * @param id ID del hedge a eliminar
     * @return HTTP 204 No Content
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteHedge(@PathVariable String id) {
        log.info("Deleting hedge with id: {}", id);
        hedgeService.deleteHedge(id);
        return ResponseEntity.noContent().build();
    }
    
    /**
     * GET /api/hedges/categories
     * Obtiene todas las categorías disponibles
     * @return Lista de nombres de categorías
     */
    @GetMapping("/categories")
    public ResponseEntity<List<String>> getCategories() {
        log.info("Getting all available categories");
        List<String> categories = hedgeService.getCategories();
        return ResponseEntity.ok(categories);
    }
    
    /**
     * POST /api/hedges/test
     * Prueba una consulta de búsqueda
     * @param request Contiene la query a probar
     * @return SearchHedgeTestResultDTO con los resultados de la prueba
     */
    @PostMapping("/test")
    public ResponseEntity<SearchHedgeTestResultDTO> testHedge(@RequestBody TestHedgeRequest request) {
        log.info("Testing hedge query");
        SearchHedgeTestResultDTO result = hedgeService.testHedge(request.getQuery());
        return ResponseEntity.ok(result);
    }
    
    /**
     * DTO para peticiones de prueba de hedges
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TestHedgeRequest {
        private String query;
    }
}
