package com.uci.competencia.service;

import com.uci.competencia.model.dto.response.SearchHedgeDTO;
import com.uci.competencia.model.dto.response.SearchHedgeTestResultDTO;

import java.util.List;
import java.util.Optional;

public interface SearchHedgeService {
    
    /**
     * Obtiene todos los hedges de búsqueda para un profesor
     * @param professorId ID del profesor
     * @param category Categoría opcional para filtrar
     * @return Lista de SearchHedgeDTO
     */
    List<SearchHedgeDTO> getAllHedges(String professorId, String category);
    
    /**
     * Obtiene un hedge de búsqueda por ID
     * @param id ID del hedge
     * @return Optional del SearchHedgeDTO
     */
    Optional<SearchHedgeDTO> getHedgeById(String id, String professorId);
    
    /**
     * Crea un nuevo hedge de búsqueda
     * @param hedge Datos del hedge a crear
     * @param professorId ID del profesor que crea el hedge
     * @return SearchHedgeDTO creado
     */
    SearchHedgeDTO createHedge(SearchHedgeDTO hedge, String professorId);
    
    /**
     * Actualiza un hedge de búsqueda existente
     * @param id ID del hedge a actualizar
     * @param hedge Nuevos datos del hedge
     * @return SearchHedgeDTO actualizado
     */
    SearchHedgeDTO updateHedge(String id, SearchHedgeDTO hedge, String professorId);
    
    /**
     * Elimina un hedge de búsqueda
     * @param id ID del hedge a eliminar
     */
    void deleteHedge(String id, String professorId);
    
    /**
     * Obtiene todas las categorías disponibles
     * @return Lista de nombres de categorías
     */
    List<String> getCategories();
    
    /**
     * Prueba una consulta de búsqueda
     * @param query Consulta a probar
     * @return SearchHedgeTestResultDTO con los resultados de la prueba
     */
    SearchHedgeTestResultDTO testHedge(String query);
}
