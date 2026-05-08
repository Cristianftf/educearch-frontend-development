package com.uci.competencia.service.external;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.request.ExternalHealthSearchRequestDTO;
import com.uci.competencia.model.dto.response.ExternalHealthSearchResponseDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class HealthSearchProxyServiceImpl implements HealthSearchProxyService {

    private final PubMedApiService pubMedApiService;
    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;

    @Value("${app.external-health.timeout-ms:7000}")
    private long timeoutMs;

    @Value("${app.external-health.max-retries:2}")
    private int maxRetries;

    @Value("${app.external-health.cache-ttl-ms:1800000}")
    private long cacheTtlMs;

    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();

    @Override
    public ExternalHealthSearchResponseDTO search(String queryText, int maxResults, ExternalHealthSearchRequestDTO request) {
        String normalizedQuery = normalizeQuery(queryText);
        int safeMaxResults = Math.max(4, Math.min(maxResults, 30));
        FilterCriteria criteria = buildFilterCriteria(request);
        String cacheKey = normalizedQuery + "|" + safeMaxResults + "|" + criteria.cacheKeySegment();
        long now = System.currentTimeMillis();

        CacheEntry cachedEntry = cache.get(cacheKey);
        if (cachedEntry != null && cachedEntry.expiresAt > now) {
            ExternalHealthSearchResponseDTO value = cachedEntry.response;
            return new ExternalHealthSearchResponseDTO(
                value.getProvider(),
                value.getResults(),
                value.getTotalResults(),
                true,
                value.getGeneratedAt()
            );
        }

        if (cachedEntry != null && cachedEntry.expiresAt <= now) {
            cache.remove(cacheKey);
        }
        pruneExpiredEntries(now);

        List<ProviderBatch> providerBatches = executeProvidersInParallel(normalizedQuery, safeMaxResults, criteria);
        List<ExternalHealthSearchResponseDTO.ExternalHealthResultDTO> aggregated = providerBatches.stream()
            .flatMap(batch -> batch.results().stream())
            .collect(Collectors.toCollection(ArrayList::new));
        List<String> providers = providerBatches.stream()
            .filter(batch -> !batch.results().isEmpty())
            .map(ProviderBatch::provider)
            .toList();

        List<ExternalHealthSearchResponseDTO.ExternalHealthResultDTO> deduped = dedupeResults(aggregated, safeMaxResults);
        String providerLabel = providers.isEmpty() ? "none" : String.join(" + ", providers);
        ExternalHealthSearchResponseDTO response = new ExternalHealthSearchResponseDTO(
            providerLabel,
            deduped,
            deduped.size(),
            false,
            Instant.now().toString()
        );

        if (!deduped.isEmpty()) {
            cache.put(cacheKey, new CacheEntry(response, now + Math.max(30_000, cacheTtlMs)));
        }

        return response;
    }

    private List<ProviderBatch> executeProvidersInParallel(
        String normalizedQuery,
        int safeMaxResults,
        FilterCriteria criteria
    ) {
        CompletableFuture<ProviderBatch> pubMedFuture = CompletableFuture.supplyAsync(() ->
            new ProviderBatch(
                "PubMed",
                executeWithRetry(() -> fetchPubMedResults(normalizedQuery, safeMaxResults, criteria), "PubMed")
            )
        );
        CompletableFuture<ProviderBatch> europePmcFuture = CompletableFuture.supplyAsync(() ->
            new ProviderBatch(
                "Europe PMC",
                executeWithRetry(() -> fetchEuropePmcResults(normalizedQuery, safeMaxResults, criteria), "Europe PMC")
            )
        );
        CompletableFuture<ProviderBatch> clinicalTrialsFuture = CompletableFuture.supplyAsync(() ->
            new ProviderBatch(
                "ClinicalTrials.gov",
                executeWithRetry(
                    () -> fetchClinicalTrialsResults(normalizedQuery, safeMaxResults, criteria),
                    "ClinicalTrials.gov"
                )
            )
        );

        return CompletableFuture.allOf(pubMedFuture, europePmcFuture, clinicalTrialsFuture)
            .thenApply(ignored -> List.of(pubMedFuture.join(), europePmcFuture.join(), clinicalTrialsFuture.join()))
            .exceptionally(ignored -> List.of(
                safeJoin(pubMedFuture, "PubMed"),
                safeJoin(europePmcFuture, "Europe PMC"),
                safeJoin(clinicalTrialsFuture, "ClinicalTrials.gov")
            ))
            .join();
    }

    private ProviderBatch safeJoin(CompletableFuture<ProviderBatch> future, String provider) {
        try {
            return future.join();
        } catch (Exception ex) {
            log.warn("Provider {} failed during parallel execution: {}", provider, ex.getMessage());
            return new ProviderBatch(provider, List.of());
        }
    }

    private List<ExternalHealthSearchResponseDTO.ExternalHealthResultDTO> fetchPubMedResults(
        String query,
        int maxResults,
        FilterCriteria criteria
    ) {
        String effectiveQuery = buildPubMedQuery(query, criteria);
        List<PubMedApiService.PubMedArticle> articles = pubMedApiService.searchArticles(effectiveQuery, maxResults);
        if (articles.isEmpty()) {
            return List.of();
        }
        List<ExternalHealthSearchResponseDTO.ExternalHealthResultDTO> mapped = new ArrayList<>();
        for (PubMedApiService.PubMedArticle article : articles) {
            String pmid = article.pmid() != null ? article.pmid().trim() : "";
            if (pmid.isEmpty()) continue;
            String doi = article.doi() != null ? article.doi().trim() : null;
            String studyType = firstOrDefault(article.publicationTypes(), "Journal Article");
            mapped.add(new ExternalHealthSearchResponseDTO.ExternalHealthResultDTO(
                pmid,
                pmid,
                valueOrDefault(article.title(), "Untitled PubMed article"),
                valueOrDefault(article.abstractText(), "Abstract available in PubMed detail page."),
                article.authors() != null ? article.authors() : List.of(),
                valueOrDefault(article.journal(), "PubMed"),
                parseYear(article.publicationDate()),
                studyType,
                mapEvidenceLevel(studyType),
                extractSampleSize(article.abstractText()),
                Boolean.FALSE,
                doi,
                "PubMed",
                "https://pubmed.ncbi.nlm.nih.gov/" + pmid + "/"
            ));
        }
        return applyPostFilters(mapped, criteria);
    }

    private List<ExternalHealthSearchResponseDTO.ExternalHealthResultDTO> fetchEuropePmcResults(
        String query,
        int maxResults,
        FilterCriteria criteria
    ) {
        try {
            String effectiveQuery = buildEuropePmcQuery(query, criteria);
            WebClient client = webClientBuilder.baseUrl("https://www.ebi.ac.uk").build();
            String response = client.get()
                .uri(uriBuilder -> uriBuilder
                    .path("/europepmc/webservices/rest/search")
                    .queryParam("query", effectiveQuery)
                    .queryParam("format", "json")
                    .queryParam("resultType", "core")
                    .queryParam("pageSize", maxResults)
                    .build())
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofMillis(timeoutMs))
                .retryWhen(Retry.fixedDelay(maxRetries, Duration.ofMillis(250)))
                .block();

            if (response == null || response.isBlank()) {
                return List.of();
            }

            JsonNode root = objectMapper.readTree(response);
            JsonNode resultsNode = root.path("resultList").path("result");
            if (!resultsNode.isArray()) {
                return List.of();
            }

            List<ExternalHealthSearchResponseDTO.ExternalHealthResultDTO> mapped = new ArrayList<>();
            for (JsonNode node : resultsNode) {
                String pmid = node.path("pmid").asText("");
                String id = node.path("id").asText("");
                String doi = cleanDoi(node.path("doi").asText(null));
                String source = node.path("source").asText("");
                String recordId = !id.isBlank() ? id : (!pmid.isBlank() ? pmid : String.valueOf(System.nanoTime()));
                String studyType = node.path("pubType").asText("Journal Article");
                String sourceUrl = !pmid.isBlank()
                    ? "https://pubmed.ncbi.nlm.nih.gov/" + pmid + "/"
                    : (doi != null ? "https://doi.org/" + doi : (!source.isBlank() && !id.isBlank()
                        ? "https://europepmc.org/article/" + source + "/" + id
                        : null));
                mapped.add(new ExternalHealthSearchResponseDTO.ExternalHealthResultDTO(
                    recordId,
                    pmid,
                    valueOrDefault(node.path("title").asText(null), "Untitled Europe PMC record"),
                    valueOrDefault(node.path("abstractText").asText(null), "Abstract not available in Europe PMC response."),
                    splitAuthors(node.path("authorString").asText(null)),
                    valueOrDefault(node.path("journalTitle").asText(null), "Europe PMC"),
                    parseYear(node.path("pubYear").asText(null)),
                    studyType,
                    mapEvidenceLevel(studyType),
                    null,
                    Boolean.FALSE,
                    doi,
                    "Europe PMC",
                    sourceUrl
                ));
            }
            return applyPostFilters(mapped, criteria);
        } catch (Exception e) {
            log.debug("Europe PMC provider failed: {}", e.getMessage());
            return List.of();
        }
    }

    private List<ExternalHealthSearchResponseDTO.ExternalHealthResultDTO> fetchClinicalTrialsResults(
        String query,
        int maxResults,
        FilterCriteria criteria
    ) {
        try {
            String effectiveQuery = buildClinicalTrialsQuery(query, criteria);
            WebClient client = webClientBuilder.baseUrl("https://clinicaltrials.gov").build();
            String response = client.get()
                .uri(uriBuilder -> uriBuilder
                    .path("/api/v2/studies")
                    .queryParam("query.term", effectiveQuery)
                    .queryParam("pageSize", Math.max(5, Math.min(maxResults, 20)))
                    .build())
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofMillis(timeoutMs))
                .retryWhen(Retry.fixedDelay(maxRetries, Duration.ofMillis(250)))
                .block();

            if (response == null || response.isBlank()) {
                return List.of();
            }

            JsonNode root = objectMapper.readTree(response);
            JsonNode studies = root.path("studies");
            if (!studies.isArray()) {
                return List.of();
            }

            List<ExternalHealthSearchResponseDTO.ExternalHealthResultDTO> mapped = new ArrayList<>();
            for (JsonNode study : studies) {
                JsonNode protocolSection = study.path("protocolSection");
                JsonNode identification = protocolSection.path("identificationModule");
                String nctId = identification.path("nctId").asText("");
                if (nctId.isBlank()) {
                    continue;
                }
                String title = identification.path("briefTitle").asText("");
                if (title.isBlank()) {
                    title = identification.path("officialTitle").asText("Clinical trial");
                }
                String summary = protocolSection.path("descriptionModule").path("briefSummary").asText("");
                String sponsor = protocolSection.path("sponsorCollaboratorsModule")
                    .path("leadSponsor")
                    .path("name")
                    .asText("");
                JsonNode status = protocolSection.path("statusModule");
                String startDate = status.path("startDateStruct").path("date").asText("");
                String completionDate = status.path("completionDateStruct").path("date").asText("");
                String studyType = protocolSection.path("designModule").path("studyType").asText("Interventional");
                Integer sampleSize = asInteger(protocolSection.path("designModule").path("enrollmentInfo").path("count").asText(null));

                mapped.add(new ExternalHealthSearchResponseDTO.ExternalHealthResultDTO(
                    nctId,
                    "",
                    title,
                    valueOrDefault(summary, "Summary not available in ClinicalTrials.gov response."),
                    sponsor.isBlank() ? List.of("ClinicalTrials.gov") : List.of(sponsor),
                    "ClinicalTrials.gov",
                    parseYear(!startDate.isBlank() ? startDate : completionDate),
                    studyType,
                    mapEvidenceLevel(studyType),
                    sampleSize,
                    Boolean.FALSE,
                    null,
                    "ClinicalTrials.gov",
                    "https://clinicaltrials.gov/study/" + nctId
                ));
            }
            return applyPostFilters(mapped, criteria);
        } catch (Exception e) {
            log.debug("ClinicalTrials provider failed: {}", e.getMessage());
            return List.of();
        }
    }

    private FilterCriteria buildFilterCriteria(ExternalHealthSearchRequestDTO request) {
        if (request == null) {
            return new FilterCriteria(null, null, List.of(), null, false, null);
        }

        Integer from = normalizeYear(request.getYearFrom());
        Integer to = normalizeYear(request.getYearTo());
        if (from != null && to != null && from > to) {
            int tmp = from;
            from = to;
            to = tmp;
        }

        List<String> studyTypes = request.getStudyTypes() == null
            ? List.of()
            : request.getStudyTypes().stream()
                .filter(item -> item != null && !item.isBlank())
                .map(this::normalizeStudyType)
                .distinct()
                .collect(Collectors.toList());

        String language = request.getLanguage() != null && !request.getLanguage().isBlank()
            ? request.getLanguage().trim().toLowerCase(Locale.ROOT)
            : null;

        boolean hasFullText = Boolean.TRUE.equals(request.getHasFullText());
        Integer minSampleSize = request.getMinSampleSize() != null && request.getMinSampleSize() > 0
            ? request.getMinSampleSize()
            : null;

        return new FilterCriteria(from, to, studyTypes, language, hasFullText, minSampleSize);
    }

    private String buildPubMedQuery(String baseQuery, FilterCriteria criteria) {
        StringBuilder query = new StringBuilder();
        query.append("(").append(baseQuery).append(")");

        if (criteria.yearFrom != null || criteria.yearTo != null) {
            int from = criteria.yearFrom != null ? criteria.yearFrom : 1900;
            int to = criteria.yearTo != null ? criteria.yearTo : 3000;
            query.append(" AND ").append(from).append(":").append(to).append("[PDAT]");
        }

        if (criteria.language != null) {
            query.append(" AND ").append(criteria.language).append("[lang]");
        }

        if (criteria.hasFullText) {
            query.append(" AND free full text[filter]");
        }

        if (!criteria.studyTypes.isEmpty()) {
            String studyClause = criteria.studyTypes.stream()
                .map(this::mapStudyTypeToPubMedFilter)
                .collect(Collectors.joining(" OR "));
            query.append(" AND (").append(studyClause).append(")");
        }

        return query.toString();
    }

    private String buildEuropePmcQuery(String baseQuery, FilterCriteria criteria) {
        StringBuilder query = new StringBuilder(baseQuery);

        if (criteria.yearFrom != null || criteria.yearTo != null) {
            int from = criteria.yearFrom != null ? criteria.yearFrom : 1900;
            int to = criteria.yearTo != null ? criteria.yearTo : LocalDate.now().getYear();
            query.append(" AND PUB_YEAR:[").append(from).append(" TO ").append(to).append("]");
        }

        if (criteria.language != null) {
            query.append(" AND LANG:").append(criteria.language);
        }

        if (criteria.hasFullText) {
            query.append(" AND HAS_FREE_FULLTEXT:y");
        }

        if (!criteria.studyTypes.isEmpty()) {
            String studyClause = criteria.studyTypes.stream()
                .map(this::mapStudyTypeToEuropePmcFilter)
                .collect(Collectors.joining(" OR "));
            query.append(" AND (").append(studyClause).append(")");
        }

        return query.toString();
    }

    private String buildClinicalTrialsQuery(String baseQuery, FilterCriteria criteria) {
        if (criteria.studyTypes.isEmpty()) {
            return baseQuery;
        }
        String suffix = criteria.studyTypes.stream()
            .map(this::mapStudyTypeToClinicalKeyword)
            .filter(value -> value != null && !value.isBlank())
            .distinct()
            .collect(Collectors.joining(" "));
        if (suffix.isBlank()) {
            return baseQuery;
        }
        return baseQuery + " " + suffix;
    }

    private List<ExternalHealthSearchResponseDTO.ExternalHealthResultDTO> applyPostFilters(
        List<ExternalHealthSearchResponseDTO.ExternalHealthResultDTO> items,
        FilterCriteria criteria
    ) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        return items.stream()
            .filter(item -> matchesYear(item, criteria))
            .filter(item -> matchesStudyType(item, criteria))
            .filter(item -> matchesMinSample(item, criteria))
            .collect(Collectors.toList());
    }

    private boolean matchesYear(ExternalHealthSearchResponseDTO.ExternalHealthResultDTO item, FilterCriteria criteria) {
        if (criteria.yearFrom == null && criteria.yearTo == null) {
            return true;
        }
        Integer year = item.getYear();
        if (year == null) {
            return false;
        }
        if (criteria.yearFrom != null && year < criteria.yearFrom) {
            return false;
        }
        if (criteria.yearTo != null && year > criteria.yearTo) {
            return false;
        }
        return true;
    }

    private boolean matchesStudyType(ExternalHealthSearchResponseDTO.ExternalHealthResultDTO item, FilterCriteria criteria) {
        if (criteria.studyTypes.isEmpty()) {
            return true;
        }
        String normalized = normalizeStudyType(item.getStudyType());
        return criteria.studyTypes.contains(normalized);
    }

    private boolean matchesMinSample(ExternalHealthSearchResponseDTO.ExternalHealthResultDTO item, FilterCriteria criteria) {
        if (criteria.minSampleSize == null) {
            return true;
        }
        Integer sampleSize = item.getSampleSize();
        return sampleSize != null && sampleSize >= criteria.minSampleSize;
    }

    private String mapStudyTypeToPubMedFilter(String studyType) {
        return switch (normalizeStudyType(studyType)) {
            case "systematic_review" -> "\"systematic review\"[Publication Type]";
            case "meta_analysis" -> "\"meta-analysis\"[Publication Type]";
            case "rct" -> "\"randomized controlled trial\"[Publication Type]";
            case "cohort" -> "\"cohort studies\"[MeSH]";
            case "case_control" -> "\"case-control studies\"[MeSH]";
            case "case_report" -> "\"case reports\"[Publication Type]";
            default -> "\"" + studyType + "\"[Publication Type]";
        };
    }

    private String mapStudyTypeToEuropePmcFilter(String studyType) {
        return switch (normalizeStudyType(studyType)) {
            case "systematic_review" -> "PUB_TYPE:\"systematic review\"";
            case "meta_analysis" -> "PUB_TYPE:\"meta analysis\"";
            case "rct" -> "PUB_TYPE:\"randomized controlled trial\"";
            case "cohort" -> "PUB_TYPE:\"cohort study\"";
            case "case_control" -> "PUB_TYPE:\"case-control study\"";
            case "case_report" -> "PUB_TYPE:\"case report\"";
            default -> "PUB_TYPE:\"" + studyType.replace("_", " ") + "\"";
        };
    }

    private String mapStudyTypeToClinicalKeyword(String studyType) {
        return switch (normalizeStudyType(studyType)) {
            case "systematic_review" -> "\"systematic review\"";
            case "meta_analysis" -> "\"meta analysis\"";
            case "rct" -> "\"randomized\"";
            case "cohort" -> "\"cohort\"";
            case "case_control" -> "\"case-control\"";
            case "case_report" -> "\"case report\"";
            default -> studyType.replace("_", " ");
        };
    }

    private String normalizeStudyType(String value) {
        if (value == null || value.isBlank()) {
            return "unknown";
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT).replaceAll("[\\s-]+", "_");
        if (normalized.contains("systematic")) return "systematic_review";
        if (normalized.contains("meta")) return "meta_analysis";
        if (normalized.contains("randomized") || normalized.contains("interventional") || normalized.equals("clinical_trial")) return "rct";
        if (normalized.contains("cohort")) return "cohort";
        if (normalized.contains("case_control") || normalized.contains("casecontrol")) return "case_control";
        if (normalized.contains("case_report")) return "case_report";
        return normalized;
    }

    private Integer normalizeYear(Integer year) {
        if (year == null) return null;
        if (year < 1900) return 1900;
        if (year > 2100) return 2100;
        return year;
    }

    private Integer asInteger(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private List<ExternalHealthSearchResponseDTO.ExternalHealthResultDTO> dedupeResults(
        List<ExternalHealthSearchResponseDTO.ExternalHealthResultDTO> items,
        int limit
    ) {
        Set<String> seen = new HashSet<>();
        List<ExternalHealthSearchResponseDTO.ExternalHealthResultDTO> deduped = new ArrayList<>();
        for (ExternalHealthSearchResponseDTO.ExternalHealthResultDTO item : items) {
            String key = normalizeQuery(
                valueOrDefault(item.getPmid(), "") + "|" +
                valueOrDefault(item.getDoi(), "") + "|" +
                valueOrDefault(item.getId(), "") + "|" +
                valueOrDefault(item.getTitle(), "")
            );
            if (key.isBlank() || seen.contains(key)) {
                continue;
            }
            seen.add(key);
            deduped.add(item);
            if (deduped.size() >= limit) {
                break;
            }
        }
        return deduped;
    }

    private List<ExternalHealthSearchResponseDTO.ExternalHealthResultDTO> executeWithRetry(
        Supplier<List<ExternalHealthSearchResponseDTO.ExternalHealthResultDTO>> operation,
        String provider
    ) {
        int attempts = Math.max(1, maxRetries + 1);
        Exception lastError = null;
        for (int i = 1; i <= attempts; i++) {
            try {
                List<ExternalHealthSearchResponseDTO.ExternalHealthResultDTO> result = operation.get();
                if (result != null && !result.isEmpty()) {
                    return result;
                }
                if (i < attempts) {
                    sleepQuietly(150L * i);
                    continue;
                }
                return List.of();
            } catch (Exception e) {
                lastError = e;
                if (i < attempts) {
                    sleepQuietly(150L * i);
                }
            }
        }
        if (lastError != null) {
            log.warn("Provider {} failed after {} attempts: {}", provider, attempts, lastError.getMessage());
        }
        return List.of();
    }

    private void pruneExpiredEntries(long now) {
        cache.entrySet().removeIf(entry -> entry.getValue().expiresAt <= now);
    }

    private void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
    }

    private String normalizeQuery(String value) {
        if (value == null) return "";
        return value.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    private String firstOrDefault(List<String> values, String fallback) {
        if (values == null || values.isEmpty()) {
            return fallback;
        }
        String value = values.get(0);
        return value != null && !value.isBlank() ? value : fallback;
    }

    private String valueOrDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private List<String> splitAuthors(String authorString) {
        if (authorString == null || authorString.isBlank()) {
            return List.of();
        }
        String[] raw = authorString.split("[,;]");
        List<String> authors = new ArrayList<>();
        for (String author : raw) {
            if (author != null) {
                String trimmed = author.trim();
                if (!trimmed.isBlank()) {
                    authors.add(trimmed);
                }
            }
            if (authors.size() >= 8) {
                break;
            }
        }
        return authors;
    }

    private String cleanDoi(String value) {
        if (value == null || value.isBlank()) return null;
        return value.replaceFirst("(?i)^https?://doi.org/", "").trim();
    }

    private Integer parseYear(String value) {
        if (value == null || value.isBlank()) {
            return LocalDate.now().getYear();
        }
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("\\b(19|20)\\d{2}\\b").matcher(value);
        if (matcher.find()) {
            try {
                return Integer.parseInt(matcher.group());
            } catch (NumberFormatException ignored) {
                return LocalDate.now().getYear();
            }
        }
        return LocalDate.now().getYear();
    }

    private Integer mapEvidenceLevel(String studyType) {
        if (studyType == null || studyType.isBlank()) return 4;
        String normalized = studyType.toLowerCase(Locale.ROOT);
        if (normalized.contains("meta") || normalized.contains("systematic")) return 1;
        if (normalized.contains("randomized") || normalized.contains("interventional") || normalized.contains("clinical trial")) return 2;
        if (normalized.contains("cohort") || normalized.contains("longitudinal")) return 3;
        if (normalized.contains("case-control")) return 4;
        return 5;
    }

    private Integer extractSampleSize(String abstractText) {
        if (abstractText == null || abstractText.isBlank()) {
            return null;
        }
        java.util.regex.Matcher matcher =
            java.util.regex.Pattern.compile("\\b(n|sample size)\\s*=?\\s*(\\d{2,6})\\b", java.util.regex.Pattern.CASE_INSENSITIVE)
                .matcher(abstractText);
        if (matcher.find()) {
            try {
                return Integer.parseInt(matcher.group(2));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private record FilterCriteria(
        Integer yearFrom,
        Integer yearTo,
        List<String> studyTypes,
        String language,
        boolean hasFullText,
        Integer minSampleSize
    ) {
        private String cacheKeySegment() {
            String studyTypesKey = studyTypes == null || studyTypes.isEmpty()
                ? "-"
                : String.join(",", studyTypes);
            return (yearFrom != null ? yearFrom : "-") + ":" +
                (yearTo != null ? yearTo : "-") + ":" +
                (language != null ? language : "-") + ":" +
                hasFullText + ":" +
                (minSampleSize != null ? minSampleSize : "-") + ":" +
                studyTypesKey;
        }
    }

    private record ProviderBatch(
        String provider,
        List<ExternalHealthSearchResponseDTO.ExternalHealthResultDTO> results
    ) {}

    private record CacheEntry(ExternalHealthSearchResponseDTO response, long expiresAt) {}
}
