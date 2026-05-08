package com.uci.competencia.controller.api;

import com.uci.competencia.model.dto.request.GenerateBibliographyRequestDTO;
import com.uci.competencia.model.dto.response.BibliographyResponseDTO;
import com.uci.competencia.model.entity.Bibliography;
import com.uci.competencia.model.entity.SearchResult;
import com.uci.competencia.repository.BibliographyRepository;
import com.uci.competencia.repository.SearchResultRepository;
import com.uci.competencia.security.UserIdentityResolver;
import com.uci.competencia.util.CitationFormatter;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/export")
@Slf4j
@RequiredArgsConstructor
public class ExportController {

    private final BibliographyRepository bibliographyRepository;
    private final SearchResultRepository searchResultRepository;
    private final CitationFormatter citationFormatter;
    private final ObjectMapper objectMapper;
    private final UserIdentityResolver userIdentityResolver;

    @PostMapping("/bibliography")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<BibliographyResponseDTO> exportBibliography(
        @RequestBody GenerateBibliographyRequestDTO request
    ) {
        log.info("Exporting bibliography");

        String userId = getCurrentUserId();
        List<SearchResult> results = new ArrayList<>();
        if (request.getArticleIds() != null && !request.getArticleIds().isEmpty()) {
            // Separar IDs UUID (formato estándar) de IDs no-UUID (ej. PMID numéricos como "42023181")
            List<String> uuidIds = new ArrayList<>();
            List<String> nonUuidIds = new ArrayList<>();
            for (String id : request.getArticleIds()) {
                if (id == null || id.isBlank()) continue;
                if (isValidUuid(id)) {
                    uuidIds.add(id);
                } else {
                    nonUuidIds.add(id);
                }
            }
            // Buscar por UUID (IDs de entidades JPA)
            if (!uuidIds.isEmpty()) {
                results.addAll(searchResultRepository.findAllById(uuidIds));
            }
            // Buscar por PMID para IDs no-UUID (ej. PubMed IDs numéricos)
            for (String nonUuidId : nonUuidIds) {
                searchResultRepository.findByPmid(nonUuidId)
                    .filter(r -> results.stream().noneMatch(existing -> existing.getId().equals(r.getId())))
                    .ifPresent(results::add);
            }
        }

        List<GenerateBibliographyRequestDTO.ArticleDTO> requestedArticles =
            request.getArticles() != null ? request.getArticles() : List.of();

        List<SearchResult> persistedResults = persistRequestedArticles(requestedArticles);
        List<SearchResult> allResults = mergeResults(results, persistedResults);

        List<CitationFormatter.Article> orderedArticles = resolveOrderedArticles(
            request.getArticleIds(),
            allResults,
            requestedArticles
        );

        String content = buildBibliographyContent(orderedArticles, request.getFormat());

        Bibliography bibliography = new Bibliography();
        bibliography.setUserId(userId);
        bibliography.setName(request.getName());
        bibliography.setFormat(request.getFormat());
        bibliography.setContent(content);
        bibliography.setArticleIds(serializeArticleIds(resolveArticleIds(request.getArticleIds(), requestedArticles, persistedResults)));
        bibliography.setArticleCount(orderedArticles.size());
        bibliography.setCreatedAt(LocalDateTime.now());

        Bibliography saved = bibliographyRepository.save(bibliography);

        BibliographyResponseDTO response = toResponse(saved, allResults, orderedArticles);
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
        return userIdentityResolver.getCurrentPrincipalIdentifier().orElse(null);
    }

    private BibliographyResponseDTO toResponse(
        Bibliography bib,
        List<SearchResult> results,
        List<CitationFormatter.Article> orderedArticles
    ) {
        List<BibliographyResponseDTO.ArticleDTO> articles = new ArrayList<>();
        if (orderedArticles != null && !orderedArticles.isEmpty()) {
            for (CitationFormatter.Article article : orderedArticles) {
                articles.add(toArticleDTO(article));
            }
        } else {
            articles = results.stream()
                .map(this::toArticleDTO)
                .collect(Collectors.toList());
        }

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

    private BibliographyResponseDTO.ArticleDTO toArticleDTO(CitationFormatter.Article article) {
        BibliographyResponseDTO.ArticleDTO dto = new BibliographyResponseDTO.ArticleDTO();
        dto.setId(article.pmid != null ? article.pmid : article.title);
        dto.setPmid(article.pmid);
        dto.setTitle(article.title);
        dto.setAuthors(article.authors != null ? article.authors : List.of());
        dto.setJournal(article.journal);
        if (article.publicationDate != null && article.publicationDate.length() >= 4) {
            try {
                dto.setYear(Integer.parseInt(article.publicationDate.substring(0, 4)));
            } catch (NumberFormatException ignored) {
                dto.setYear(null);
            }
        }
        dto.setDoi(article.doi);
        dto.setStudyType("unknown");
        dto.setEvidenceLevel(null);
        dto.setSampleSize(null);
        dto.setHasConflictOfInterest(false);
        return dto;
    }

    private String buildBibliographyContent(List<CitationFormatter.Article> results, String format) {
        String normalized = format != null ? format.toLowerCase() : "apa";
        StringBuilder sb = new StringBuilder();

        int index = 1;
        for (CitationFormatter.Article article : results) {

            String line;
            switch (normalized) {
                case "vancouver":
                    line = citationFormatter.formatVancouver(article);
                    break;
                case "bibtex":
                    String citationKey = article.pmid != null ? article.pmid : "ref" + index;
                    line = citationFormatter.formatBibTeX(article, citationKey);
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

    private List<CitationFormatter.Article> resolveOrderedArticles(
        List<String> requestedIds,
        List<SearchResult> results,
        List<GenerateBibliographyRequestDTO.ArticleDTO> requestedArticles
    ) {
        List<CitationFormatter.Article> ordered = new ArrayList<>();
        if ((requestedIds == null || requestedIds.isEmpty()) && requestedArticles.isEmpty()) {
            return ordered;
        }

        java.util.Map<String, SearchResult> byId = results.stream()
            .collect(Collectors.toMap(SearchResult::getId, r -> r, (a, b) -> a));
        java.util.Map<String, SearchResult> byPmid = results.stream()
            .filter(r -> r.getPmid() != null)
            .collect(Collectors.toMap(SearchResult::getPmid, r -> r, (a, b) -> a));

        if (requestedIds != null && !requestedIds.isEmpty()) {
            for (String id : requestedIds) {
                SearchResult result = byId.get(id);
                if (result == null) {
                    result = byPmid.get(id);
                }
                if (result != null) {
                    ordered.add(toCitationArticle(result));
                    continue;
                }
                for (GenerateBibliographyRequestDTO.ArticleDTO article : requestedArticles) {
                    if (id != null && (id.equals(article.getId()) || id.equals(article.getPmid()))) {
                        ordered.add(toCitationArticle(article));
                        break;
                    }
                }
            }
        } else {
            for (GenerateBibliographyRequestDTO.ArticleDTO article : requestedArticles) {
                ordered.add(toCitationArticle(article));
            }
        }

        return ordered;
    }

    private List<SearchResult> persistRequestedArticles(List<GenerateBibliographyRequestDTO.ArticleDTO> requestedArticles) {
        if (requestedArticles == null || requestedArticles.isEmpty()) {
            return List.of();
        }

        List<SearchResult> persisted = new ArrayList<>();
        for (GenerateBibliographyRequestDTO.ArticleDTO article : requestedArticles) {
            if (article == null) {
                continue;
            }
            boolean hasIdentity = article.getPmid() != null && !article.getPmid().isBlank();
            boolean hasTitle = article.getTitle() != null && !article.getTitle().isBlank();
            if (!hasIdentity && !hasTitle) {
                continue;
            }
            SearchResult entity = null;
            if (article.getPmid() != null && !article.getPmid().isBlank()) {
                entity = searchResultRepository.findByPmid(article.getPmid()).orElse(null);
            }
            if (entity == null) {
                entity = new SearchResult();
            }
            if (entity.getPmid() == null || entity.getPmid().isBlank()) {
                entity.setPmid(article.getPmid());
            }
            if (entity.getTitle() == null || entity.getTitle().isBlank()) {
                entity.setTitle(article.getTitle());
            }
            if (entity.getAuthors() == null || entity.getAuthors().isBlank()) {
                if (article.getAuthors() != null && !article.getAuthors().isEmpty()) {
                    entity.setAuthors(String.join("; ", article.getAuthors()));
                }
            }
            if (entity.getJournal() == null || entity.getJournal().isBlank()) {
                entity.setJournal(article.getJournal());
            }
            if (entity.getPublicationYear() == null && article.getYear() != null) {
                entity.setPublicationYear(article.getYear());
            }
            if (entity.getDoi() == null || entity.getDoi().isBlank()) {
                entity.setDoi(article.getDoi());
            }
            persisted.add(searchResultRepository.save(entity));
        }

        return persisted;
    }

    private List<SearchResult> mergeResults(List<SearchResult> left, List<SearchResult> right) {
        if ((left == null || left.isEmpty()) && (right == null || right.isEmpty())) {
            return List.of();
        }
        List<SearchResult> merged = new ArrayList<>();
        java.util.Set<String> seen = new java.util.HashSet<>();
        if (left != null) {
            for (SearchResult item : left) {
                if (item == null || item.getId() == null || seen.contains(item.getId())) {
                    continue;
                }
                merged.add(item);
                seen.add(item.getId());
            }
        }
        if (right != null) {
            for (SearchResult item : right) {
                if (item == null || item.getId() == null || seen.contains(item.getId())) {
                    continue;
                }
                merged.add(item);
                seen.add(item.getId());
            }
        }
        return merged;
    }

    private List<String> resolveArticleIds(
        List<String> requestedIds,
        List<GenerateBibliographyRequestDTO.ArticleDTO> requestedArticles,
        List<SearchResult> persistedResults
    ) {
        if (persistedResults != null && !persistedResults.isEmpty()) {
            List<String> ids = new ArrayList<>();
            for (SearchResult result : persistedResults) {
                if (result != null && result.getId() != null && !result.getId().isBlank()) {
                    ids.add(result.getId());
                }
            }
            if (!ids.isEmpty()) {
                return ids;
            }
        }
        if (requestedIds != null && !requestedIds.isEmpty()) {
            return requestedIds;
        }
        if (requestedArticles == null || requestedArticles.isEmpty()) {
            return List.of();
        }
        List<String> ids = new ArrayList<>();
        for (GenerateBibliographyRequestDTO.ArticleDTO article : requestedArticles) {
            if (article.getId() != null && !article.getId().isBlank()) {
                ids.add(article.getId());
            } else if (article.getPmid() != null && !article.getPmid().isBlank()) {
                ids.add(article.getPmid());
            } else {
                ids.add(article.getTitle());
            }
        }
        return ids;
    }

    private CitationFormatter.Article toCitationArticle(SearchResult result) {
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
        return article;
    }

    private CitationFormatter.Article toCitationArticle(GenerateBibliographyRequestDTO.ArticleDTO result) {
        CitationFormatter.Article article = new CitationFormatter.Article();
        article.pmid = result.getPmid();
        article.title = result.getTitle();
        article.journal = result.getJournal();
        article.doi = result.getDoi();
        article.authors = result.getAuthors() != null ? result.getAuthors() : List.of();
        if (result.getYear() != null) {
            article.publicationDate = String.valueOf(result.getYear());
        }
        return article;
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

    /**
     * Valida si un string tiene formato UUID estándar (8-4-4-4-12)
     */
    private boolean isValidUuid(String value) {
        if (value == null || value.isBlank()) return false;
        return value.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");
    }
}