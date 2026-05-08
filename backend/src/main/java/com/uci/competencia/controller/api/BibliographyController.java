package com.uci.competencia.controller.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.exception.ResourceNotFoundException;
import com.uci.competencia.model.dto.response.BibliographyResponseDTO;
import com.uci.competencia.model.entity.Bibliography;
import com.uci.competencia.model.entity.SearchResult;
import com.uci.competencia.repository.BibliographyRepository;
import com.uci.competencia.repository.SearchResultRepository;
import com.uci.competencia.security.UserIdentityResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/api/bibliography")
@Slf4j
@RequiredArgsConstructor
public class BibliographyController {

    private final BibliographyRepository bibliographyRepository;
    private final SearchResultRepository searchResultRepository;
    private final UserIdentityResolver userIdentityResolver;
    private final ObjectMapper objectMapper;

    /**
     * Obtener historial de bibliografias del usuario
     * GET /api/bibliography/history
     */
    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<List<BibliographyResponseDTO>> getBibliographyHistory() {
        String userIdentifier = getCurrentUserId();
        Set<String> userIdentifiers = resolveUserIdentifiers(userIdentifier);
        log.info("Getting bibliography history for user: {}", userIdentifier);

        List<Bibliography> bibliographies = loadBibliographiesForUserIdentifiers(userIdentifiers);

        List<BibliographyResponseDTO> result = new ArrayList<>();
        for (Bibliography bib : bibliographies) {
            List<SearchResult> results = findArticles(bib.getArticleIds());
            result.add(toResponse(bib, results));
        }

        log.info("Retrieved {} bibliographies for user {}", result.size(), userIdentifier);
        return ResponseEntity.ok(result);
    }

    /**
     * Descargar bibliografia
     * GET /api/bibliography/{id}/download?format={format}
     */
    @GetMapping("/{id}/download")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<byte[]> downloadBibliography(
        @PathVariable String id,
        @RequestParam(required = false, defaultValue = "txt") String format
    ) {
        String userIdentifier = getCurrentUserId();
        Set<String> userIdentifiers = resolveUserIdentifiers(userIdentifier);
        log.info("Downloading bibliography {} in format {} for user {}", id, format, userIdentifier);

        Bibliography bibliography = findBibliographyForUserIdentifiers(id, userIdentifiers)
            .orElseThrow(() -> new ResourceNotFoundException("Bibliography not found: " + id));

        byte[] content;
        String fileName;
        MediaType mediaType;

        if ("docx".equalsIgnoreCase(format)) {
            content = generateDocxContent(bibliography);
            fileName = bibliography.getName() + ".docx";
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        } else {
            content = bibliography.getContent().getBytes(StandardCharsets.UTF_8);
            fileName = bibliography.getName() + ".txt";
            mediaType = MediaType.TEXT_PLAIN;
        }

        log.info("Bibliography {} downloaded successfully for user {}", id, userIdentifier);

        return ResponseEntity.ok()
            .contentType(mediaType)
            .header(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + fileName + "\"")
            .body(content);
    }

    private String getCurrentUserId() {
        return userIdentityResolver.getCurrentPrincipalIdentifier().orElse(null);
    }

    private Set<String> resolveUserIdentifiers(String userIdentifier) {
        LinkedHashSet<String> identifiers = new LinkedHashSet<>();
        if (userIdentifier == null || userIdentifier.isBlank()) {
            return identifiers;
        }

        identifiers.add(userIdentifier.trim());
        identifiers.addAll(userIdentityResolver.resolveUserIdentifiers(userIdentifier));
        return identifiers;
    }

    private List<Bibliography> loadBibliographiesForUserIdentifiers(Set<String> userIdentifiers) {
        if (userIdentifiers == null || userIdentifiers.isEmpty()) {
            return List.of();
        }

        Map<String, Bibliography> merged = new LinkedHashMap<>();
        for (String identifier : userIdentifiers) {
            if (identifier == null || identifier.isBlank()) {
                continue;
            }
            try {
                List<Bibliography> entries = bibliographyRepository.findByUserIdOrderByCreatedAtDesc(identifier);
                for (Bibliography entry : entries) {
                    if (entry != null && entry.getId() != null) {
                        merged.putIfAbsent(entry.getId(), entry);
                    }
                }
            } catch (Exception ex) {
                log.debug("Unable to load bibliography list with identifier {}", identifier, ex);
            }
        }

        return merged.values().stream()
            .sorted((left, right) -> {
                if (left.getCreatedAt() == null && right.getCreatedAt() == null) return 0;
                if (left.getCreatedAt() == null) return 1;
                if (right.getCreatedAt() == null) return -1;
                return right.getCreatedAt().compareTo(left.getCreatedAt());
            })
            .toList();
    }

    private Optional<Bibliography> findBibliographyForUserIdentifiers(String bibliographyId, Set<String> userIdentifiers) {
        if (bibliographyId == null || bibliographyId.isBlank() || userIdentifiers == null || userIdentifiers.isEmpty()) {
            return Optional.empty();
        }

        for (String identifier : userIdentifiers) {
            if (identifier == null || identifier.isBlank()) {
                continue;
            }
            try {
                Optional<Bibliography> bibliography = bibliographyRepository.findByIdAndUserId(bibliographyId, identifier);
                if (bibliography.isPresent()) {
                    return bibliography;
                }
            } catch (Exception ex) {
                log.debug("Unable to load bibliography {} with identifier {}", bibliographyId, identifier, ex);
            }
        }
        return Optional.empty();
    }

    private List<SearchResult> findArticles(String articleIdsJson) {
        try {
            if (articleIdsJson == null || articleIdsJson.isBlank()) {
                return List.of();
            }
            List<String> ids = parseArticleIds(articleIdsJson);
            if (ids == null || ids.isEmpty()) {
                return List.of();
            }
            return searchResultRepository.findAllById(ids);
        } catch (Exception e) {
            log.warn("Error parsing bibliography article IDs", e);
            return List.of();
        }
    }

    private BibliographyResponseDTO toResponse(Bibliography bib, List<SearchResult> results) {
        List<BibliographyResponseDTO.ArticleDTO> articles = results.stream()
            .map(this::toArticleDTO)
            .toList();

        BibliographyResponseDTO dto = new BibliographyResponseDTO();
        dto.setId(bib.getId());
        dto.setName(bib.getName());
        dto.setFormat(bib.getFormat());
        dto.setContent(bib.getContent());
        dto.setCreatedAt(bib.getCreatedAt() != null ? bib.getCreatedAt().toString() : null);
        dto.setArticleCount(bib.getArticleCount());
        dto.setArticles(articles);
        return dto;
    }

    private BibliographyResponseDTO.ArticleDTO toArticleDTO(SearchResult result) {
        BibliographyResponseDTO.ArticleDTO dto = new BibliographyResponseDTO.ArticleDTO();
        dto.setId(result.getId());
        dto.setPmid(result.getPmid());
        dto.setTitle(result.getTitle());
        dto.setAbstractText(result.getAbstractText());
        if (result.getAuthors() != null && !result.getAuthors().isEmpty()) {
            dto.setAuthors(List.of(result.getAuthors().split(";\\s*")));
        } else {
            dto.setAuthors(List.of());
        }
        dto.setJournal(result.getJournal());
        if (result.getPublicationYear() != null) {
            dto.setYear(result.getPublicationYear());
        } else if (result.getPublicationDate() != null) {
            dto.setYear(result.getPublicationDate().getYear());
        }
        dto.setStudyType(mapStudyType(result.getStudyType()));
        dto.setEvidenceLevel(result.getEvidenceLevel());
        dto.setSampleSize(result.getSampleSize());
        dto.setHasConflictOfInterest(result.getHasConflictOfInterest() != null ? result.getHasConflictOfInterest() : false);
        dto.setDoi(result.getDoi());
        return dto;
    }

    private List<String> parseArticleIds(String raw) throws Exception {
        try {
            return objectMapper.readValue(raw, new TypeReference<List<String>>() {});
        } catch (Exception jsonError) {
            String trimmed = raw.trim();
            if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                trimmed = trimmed.substring(1, trimmed.length() - 1);
            }
            if (trimmed.isBlank()) {
                return List.of();
            }
            String[] parts = trimmed.split(",");
            List<String> ids = new ArrayList<>();
            for (String part : parts) {
                String id = part.trim();
                if (id.startsWith("\"") && id.endsWith("\"") && id.length() >= 2) {
                    id = id.substring(1, id.length() - 1);
                }
                if (!id.isBlank()) {
                    ids.add(id);
                }
            }
            return ids;
        }
    }

    private byte[] generateDocxContent(Bibliography bibliography) {
        String docxHeader = "{\\rtf1\\ansi\\ansicpg1252\\deff0\\deflang1033\n";
        String docxTitle = "{\\fonttbl{\\f0\\fnil\\fcharset0 Calibri;}}\n";
        String docxContent = "{\\colortbl;\\red0\\green0\\blue0;}\n";

        StringBuilder docContent = new StringBuilder();
        docContent.append(docxHeader);
        docContent.append(docxTitle);
        docContent.append(docxContent);

        docContent.append("{\\*\\generator Msftedit 5.41.21.2510;}\\viewkind4\\uc1\\pard\\f0\\fs20 ");
        docContent.append("\\b ").append(bibliography.getName()).append("\\b0\\par\\par");

        docContent.append("Formato: \\b ").append(bibliography.getFormat().toUpperCase()).append("\\b0\\par");
        docContent.append("Cantidad de articulos: \\b ").append(bibliography.getArticleCount()).append("\\b0\\par\\par");

        docContent.append(bibliography.getContent().replace("\n", "\\par "));

        docContent.append("\\par}");

        return docContent.toString().getBytes(StandardCharsets.UTF_8);
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
}
