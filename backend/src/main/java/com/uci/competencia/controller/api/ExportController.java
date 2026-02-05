package com.uci.competencia.controller.api;

import com.uci.competencia.model.dto.request.GenerateBibliographyRequestDTO;
import com.uci.competencia.model.dto.response.BibliographyResponseDTO;
import com.uci.competencia.model.entity.Bibliography;
import com.uci.competencia.model.entity.SearchResult;
import com.uci.competencia.repository.BibliographyRepository;
import com.uci.competencia.repository.SearchResultRepository;
import com.uci.competencia.util.CitationFormatter;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/export")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001", "https://frontend.uci.cu"})
@Slf4j
@RequiredArgsConstructor
public class ExportController {

    private final BibliographyRepository bibliographyRepository;
    private final SearchResultRepository searchResultRepository;
    private final CitationFormatter citationFormatter;
    private final ObjectMapper objectMapper;

    @PostMapping("/bibliography")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<BibliographyResponseDTO> exportBibliography(
        @RequestBody GenerateBibliographyRequestDTO request
    ) {
        log.info("Exporting bibliography");

        String userId = getCurrentUserId();
        List<SearchResult> results = new ArrayList<>();
        if (request.getArticleIds() != null) {
            results = searchResultRepository.findAllById(request.getArticleIds());
        }

        String content = buildBibliographyContent(results, request.getFormat());

        Bibliography bibliography = new Bibliography();
        bibliography.setUserId(userId);
        bibliography.setName(request.getName());
        bibliography.setFormat(request.getFormat());
        bibliography.setContent(content);
        bibliography.setArticleIds(serializeArticleIds(request.getArticleIds()));
        bibliography.setArticleCount(results.size());
        bibliography.setCreatedAt(LocalDateTime.now());

        Bibliography saved = bibliographyRepository.save(bibliography);

        BibliographyResponseDTO response = toResponse(saved, results);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/report/progress")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<String> exportProgressReport(@RequestBody String request) {
        log.info("Exporting progress report");
        return ResponseEntity.ok("Progress report export initiated");
    }

    @GetMapping("/download/{id}")
    public ResponseEntity<String> downloadExport(@PathVariable String id) {
        log.info("Downloading export: {}", id);
        return ResponseEntity.ok("Export file");
    }

    private String getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetails) {
            return ((UserDetails) principal).getUsername();
        }
        return principal.toString();
    }

    private BibliographyResponseDTO toResponse(Bibliography bib, List<SearchResult> results) {
        List<BibliographyResponseDTO.ArticleDTO> articles = results.stream()
            .map(this::toArticleDTO)
            .collect(Collectors.toList());

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
        dto.setStudyType(result.getStudyType() != null ? result.getStudyType().name().toLowerCase() : "unknown");
        dto.setEvidenceLevel(result.getEvidenceLevel());
        dto.setSampleSize(result.getSampleSize());
        dto.setHasConflictOfInterest(result.getHasConflictOfInterest() != null ? result.getHasConflictOfInterest() : false);
        dto.setDoi(result.getDoi());
        return dto;
    }

    private String buildBibliographyContent(List<SearchResult> results, String format) {
        String normalized = format != null ? format.toLowerCase() : "apa";
        StringBuilder sb = new StringBuilder();

        int index = 1;
        for (SearchResult result : results) {
            CitationFormatter.Article article = new CitationFormatter.Article();
            article.pmid = result.getPmid();
            article.title = result.getTitle();
            article.journal = result.getJournal();
            article.doi = result.getDoi();
            if (result.getAuthors() != null && !result.getAuthors().isEmpty()) {
                article.authors = List.of(result.getAuthors().split(";\\s*"));
            } else {
                article.authors = List.of();
            }
            if (result.getPublicationDate() != null) {
                article.publicationDate = result.getPublicationDate().toString();
            } else if (result.getPublicationYear() != null) {
                article.publicationDate = String.valueOf(result.getPublicationYear());
            }

            String line;
            switch (normalized) {
                case "vancouver":
                    line = citationFormatter.formatVancouver(article);
                    break;
                case "bibtex":
                    line = citationFormatter.formatBibTeX(article, result.getPmid() != null ? result.getPmid() : "ref" + index);
                    break;
                case "xml":
                    line = citationFormatter.formatXML(article);
                    break;
                case "apa":
                default:
                    line = citationFormatter.formatAPA(article);
                    break;
            }

            sb.append(index++).append(". ").append(line).append("\n\n");
        }

        return sb.toString().trim();
    }

    private String serializeArticleIds(List<String> articleIds) {
        if (articleIds == null) {
            return "[]";
        }
        try {
            return objectMapper.writeValueAsString(articleIds);
        } catch (Exception e) {
            log.warn("Error serializing bibliography article IDs, storing fallback string", e);
            return articleIds.toString();
        }
    }
}
