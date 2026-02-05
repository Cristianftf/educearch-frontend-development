package com.uci.competencia.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.request.SearchRequestDTO;
import com.uci.competencia.model.dto.response.SearchResponseDTO;
import com.uci.competencia.model.entity.SearchResult;
import com.uci.competencia.model.entity.SearchSession;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.repository.SearchSessionRepository;
import com.uci.competencia.repository.UserRepository;
import com.uci.competencia.service.SearchService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Optional;

@Service
@Slf4j
public class SearchServiceImpl implements SearchService {

    private final SearchSessionRepository searchSessionRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public SearchServiceImpl(
        SearchSessionRepository searchSessionRepository,
        UserRepository userRepository,
        ObjectMapper objectMapper
    ) {
        this.searchSessionRepository = searchSessionRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public SearchResponseDTO executeSearch(SearchRequestDTO request) {
        log.info("Executing search with terms: {}", request.getQuery().getTerms());

        SearchResponseDTO response = new SearchResponseDTO();
        response.setSearchId(null);
        
        // Aquí se integraría con PubMed API
        response.setResults(new ArrayList<>());
        
        SearchResponseDTO.SearchMetadataDTO metadata = new SearchResponseDTO.SearchMetadataDTO();
        metadata.setTotalResults(0);
        metadata.setSearchTime("0ms");
        response.setMetadata(metadata);

        persistSearchSession(request, response);

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

            String userId = getCurrentUserId();
            if (userId != null) {
                Optional<User> user = userRepository.findById(userId);
                user.ifPresent(session::setUser);
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

    private String getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetails) {
            return ((UserDetails) principal).getUsername();
        }
        return principal != null ? principal.toString() : null;
    }
}
