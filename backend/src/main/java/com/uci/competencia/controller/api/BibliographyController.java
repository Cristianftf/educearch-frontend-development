package com.uci.competencia.controller.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.response.BibliographyResponseDTO;
import com.uci.competencia.model.entity.Bibliography;
import com.uci.competencia.model.entity.SearchResult;
import com.uci.competencia.repository.BibliographyRepository;
import com.uci.competencia.repository.SearchResultRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/bibliography")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001", "https://frontend.uci.cu"})
@Slf4j
@RequiredArgsConstructor
public class BibliographyController {

    private final BibliographyRepository bibliographyRepository;
    private final SearchResultRepository searchResultRepository;
    private final ObjectMapper objectMapper;

    /**
     * Obtener historial de bibliografias del usuario
     * GET /api/bibliography/history
     */
    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<List<BibliographyResponseDTO>> getBibliographyHistory() {
        String userId = getCurrentUserId();
        log.info("Getting bibliography history for user: {}", userId);

        try {
            List<Bibliography> bibliographies = bibliographyRepository.findByUserIdOrderByCreatedAtDesc(userId);

            List<BibliographyResponseDTO> result = new ArrayList<>();
            for (Bibliography bib : bibliographies) {
                List<SearchResult> results = findArticles(bib.getArticleIds());
                result.add(toResponse(bib, results));
            }

            log.info("Retrieved {} bibliographies for user {}", result.size(), userId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error retrieving bibliography history for user {}", userId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
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
        String userId = getCurrentUserId();
        log.info("Downloading bibliography {} in format {} for user {}", id, format, userId);

        try {
            Bibliography bibliography = bibliographyRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new RuntimeException("Bibliography not found or access denied: " + id));

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

            log.info("Bibliography {} downloaded successfully for user {}", id, userId);

            return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename=\"" + fileName + "\"")
                .body(content);

        } catch (RuntimeException e) {
            log.warn("Error downloading bibliography {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        } catch (Exception e) {
            log.error("Error generating bibliography download for id {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private String getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetails) {
            return ((UserDetails) principal).getUsername();
        }
        return principal.toString();
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
