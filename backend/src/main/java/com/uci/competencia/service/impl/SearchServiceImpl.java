package com.uci.competencia.service.impl;

import com.uci.competencia.model.dto.request.SearchRequestDTO;
import com.uci.competencia.model.dto.response.SearchResponseDTO;
import com.uci.competencia.model.entity.SearchResult;
import com.uci.competencia.service.SearchService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
@Slf4j
public class SearchServiceImpl implements SearchService {

    @Override
    public SearchResponseDTO executeSearch(SearchRequestDTO request) {
        log.info("Executing search with terms: {}", request.getQuery().getTerms());

        SearchResponseDTO response = new SearchResponseDTO();
        response.setSearchId("search-" + System.currentTimeMillis());
        
        // Aquí se integraría con PubMed API
        response.setResults(null);
        
        SearchResponseDTO.SearchMetadataDTO metadata = new SearchResponseDTO.SearchMetadataDTO();
        metadata.setTotalResults(0);
        metadata.setSearchTime("0ms");
        response.setMetadata(metadata);

        return response;
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
        
        dto.setStudyType(entity.getStudyType() != null ? entity.getStudyType().toString() : "Unknown");
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
}
