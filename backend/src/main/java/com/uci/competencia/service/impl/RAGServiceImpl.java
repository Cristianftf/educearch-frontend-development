package com.uci.competencia.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.request.GenTextRequest;
import com.uci.competencia.model.dto.request.ExternalHealthSearchRequestDTO;
import com.uci.competencia.model.dto.request.SearchRequestDTO;
import com.uci.competencia.model.dto.request.VerificationRequest;
import com.uci.competencia.model.dto.response.ExternalHealthSearchResponseDTO;
import com.uci.competencia.model.dto.response.GenTextResult;
import com.uci.competencia.model.dto.response.VerificationResponseDTO;
import com.uci.competencia.model.enums.StudyType;
import com.uci.competencia.model.enums.Verdict;
import com.uci.competencia.service.RAGService;
import com.uci.competencia.service.external.HealthSearchProxyService;
import com.uci.competencia.service.external.OpenAIService;
import com.uci.competencia.service.external.PubMedApiService;
import com.uci.competencia.util.EvidenceLevelMapper;
import com.uci.competencia.util.MeshMapper;
import com.uci.competencia.util.PubMedQueryBuilder;
import com.uci.competencia.util.SimilarityCalculator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class RAGServiceImpl implements RAGService {

    private static final Pattern YEAR_PATTERN = Pattern.compile("(19|20)\\d{2}");

    private final PubMedApiService pubMedApiService;
    private final PubMedQueryBuilder pubMedQueryBuilder;
    private final SimilarityCalculator similarityCalculator;
    private final OpenAIService openAIService;
    private final HealthSearchProxyService healthSearchProxyService;
    private final ObjectMapper objectMapper;
    private final MeshMapper meshMapper;

    @Override
    public GenTextResult generateEvidenceBasedText(GenTextRequest request) {
        long startedAt = System.currentTimeMillis();
        String query = request != null ? safeText(request.getQuery()) : "";
        String context = request != null ? safeText(request.getContext()) : "";
        int maxArticles = request != null && request.getMaxArticles() > 0
            ? Math.min(request.getMaxArticles(), 30)
            : 12;

        if (query.isBlank()) {
            GenTextResult empty = new GenTextResult();
            empty.setGeneratedText("No se proporciono una consulta valida para generar texto basado en evidencia.");
            empty.setSummary("Solicitud incompleta.");
            empty.setGeneratedAt(LocalDateTime.now());
            empty.setEvidence(List.of());
            empty.setConfidenceScore(0.0);
            empty.setSourceCount(0);
            empty.setWarnings(List.of("query_empty"));
            empty.setMetadata(Map.of("usedAi", false, "pipeline", "rag"));
            return empty;
        }

        List<RelevantArticle> semanticArticles = semanticSearch(query, maxArticles);
        List<RelevantArticle> rankedArticles = rerankByEvidenceLevel(semanticArticles);
        List<RelevantArticle> selectedArticles = rankedArticles.stream()
            .limit(Math.min(8, rankedArticles.size()))
            .collect(Collectors.toList());

        String prompt = buildEvidencePrompt(query, context, selectedArticles);
        String aiText = openAIService.generateText(prompt);
        boolean usedAi = aiText != null && !aiText.isBlank();
        String generatedText = usedAi && aiText != null
            ? aiText.trim()
            : buildFallbackGeneratedText(query, selectedArticles);
        String attributed = validateAndAttributeCitations(generatedText, selectedArticles);

        double avgRelevance = selectedArticles.stream()
            .map(article -> article.relevanceScore)
            .filter(score -> score != null && score > 0)
            .mapToDouble(Double::doubleValue)
            .average()
            .orElse(0.0);
        double qualityScore = calculateQualityScore(attributed);
        double confidence = Math.max(0.0, Math.min(1.0, (avgRelevance * 0.6) + (qualityScore * 0.4)));
        long processingMs = Math.max(1L, System.currentTimeMillis() - startedAt);

        GenTextResult result = new GenTextResult();
        result.setGeneratedText(attributed);
        result.setSummary(buildSummary(attributed));
        result.setEvidence(toEvidenceArticles(selectedArticles));
        result.setConfidenceScore(Math.round(confidence * 1000.0) / 1000.0);
        result.setSourceCount(selectedArticles.size());
        result.setGeneratedAt(LocalDateTime.now());
        result.setSessionId(request != null ? request.getSessionId() : null);
        result.setWarnings(usedAi ? List.of() : List.of("ai_unavailable_using_fallback"));
        result.setMetadata(buildGenTextMetadata(usedAi, query, context, selectedArticles.size(), maxArticles));
        result.setStats(
            GenTextResult.GenerationStats.builder()
                .processingTimeMs(processingMs)
                .articlesRetrieved(semanticArticles.size())
                .articlesUsed(selectedArticles.size())
                .queriesExecuted(1)
                .averageRelevance(Math.round(avgRelevance * 1000.0) / 1000.0)
                .build()
        );
        return result;
    }

    @Override
    public VerificationResponseDTO verifyClaimAgainstEvidence(VerificationRequest request) {
        String claim = request != null ? request.getClaim() : null;
        if (claim == null || claim.isBlank()) {
            VerificationResponseDTO empty = new VerificationResponseDTO();
            empty.setStatus("pending");
            empty.setScore(0.0);
            empty.setSupportingEvidence(List.of());
            empty.setContradictingEvidence(List.of());
            empty.setConflictingEvidence(List.of());
            empty.setExplanation("No se proporcion\u00f3 un claim v\u00e1lido.");
            empty.setRecommendations(List.of());
            return empty;
        }

        List<String> terms = extractQueryTerms(claim);
        SearchRequestDTO.SearchQueryDTO queryDTO = new SearchRequestDTO.SearchQueryDTO();
        queryDTO.setTerms(terms);
        queryDTO.setOperators(buildOperators(terms.size()));

        Integer yearFrom = request != null ? request.getStartYear() : null;
        Integer yearTo = request != null ? request.getEndYear() : null;
        SearchRequestDTO.SearchFiltersDTO filters = new SearchRequestDTO.SearchFiltersDTO();
        filters.setYearFrom(yearFrom);
        filters.setYearTo(yearTo);

        String pubmedQuery = pubMedQueryBuilder.buildPubMedQuery(queryDTO, filters);
        int requestedMax = request != null ? request.getMaxArticles() : 0;
        int maxArticles = requestedMax > 0 ? requestedMax : 15;

        List<PubMedApiService.PubMedArticle> articles = pubMedApiService.searchArticles(pubmedQuery, maxArticles);

        List<VerificationResponseDTO.EvidenceDTO> evidence = new ArrayList<>();
        double supportScore = 0.0;
        double contradictScore = 0.0;
        for (PubMedApiService.PubMedArticle article : articles) {
            String evidenceText = (article.title() != null ? article.title() : "") +
                " " + (article.abstractText() != null ? article.abstractText() : "");
            SimilarityCalculator.StanceDetection detection = detectEvidenceStance(claim, terms, evidenceText);

            StudyType studyType = EvidenceLevelMapper.mapStudyType(article.publicationTypes());
            int level = EvidenceLevelMapper.evidenceLevelForStudyType(studyType);
            Integer year = extractYear(article.publicationDate());
            double evidenceWeight = evidenceWeight(level);
            double recencyWeight = recencyWeight(year);
            double weightedScore = detection.score * evidenceWeight * recencyWeight;

            if (weightedScore < 0.18 || detection.stance == SimilarityCalculator.Stance.NEUTRAL) {
                continue;
            }

            VerificationResponseDTO.EvidenceDTO dto = new VerificationResponseDTO.EvidenceDTO();
            dto.setArticleId(article.pmid());
            dto.setPmid(article.pmid());
            dto.setTitle(article.title());
            dto.setSnippet(extractSnippet(article.abstractText(), article.title()));
            dto.setSource(safeText(article.journal()).isBlank() ? "PubMed" : safeText(article.journal()));
            dto.setSourceUrl(buildSourceUrl(article.pmid(), article.doi()));
            if (detection.stance == SimilarityCalculator.Stance.SUPPORT) {
                dto.setSupports(true);
                dto.setStance("support");
                supportScore += weightedScore;
            } else if (detection.stance == SimilarityCalculator.Stance.CONTRADICT) {
                dto.setSupports(false);
                dto.setStance("contradict");
                contradictScore += weightedScore;
            } else {
                dto.setSupports(null);
                dto.setStance("neutral");
            }
            dto.setSimilarity(detection.score);
            dto.setRelevanceScore(Math.round(weightedScore * 1000.0) / 10.0);
            dto.setEvidenceLevel(level);
            evidence.add(dto);
        }

        List<VerificationResponseDTO.EvidenceDTO> supporting = evidence.stream()
            .filter(e -> Boolean.TRUE.equals(e.getSupports()))
            .sorted(Comparator.comparing(VerificationResponseDTO.EvidenceDTO::getRelevanceScore).reversed())
            .limit(6)
            .collect(Collectors.toList());

        List<VerificationResponseDTO.EvidenceDTO> contradicting = evidence.stream()
            .filter(e -> Boolean.FALSE.equals(e.getSupports()))
            .sorted(Comparator.comparing(VerificationResponseDTO.EvidenceDTO::getRelevanceScore).reversed())
            .limit(6)
            .collect(Collectors.toList());

        if (supporting.isEmpty() && contradicting.isEmpty()) {
            List<VerificationResponseDTO.EvidenceDTO> externalEvidence =
                loadExternalEvidenceForClaim(claim, maxArticles, yearFrom, yearTo);
            if (!externalEvidence.isEmpty()) {
                evidence = externalEvidence;
                supporting = externalEvidence.stream()
                    .filter(e -> Boolean.TRUE.equals(e.getSupports()))
                    .sorted(Comparator.comparing(VerificationResponseDTO.EvidenceDTO::getRelevanceScore).reversed())
                    .limit(6)
                    .collect(Collectors.toList());
                contradicting = externalEvidence.stream()
                    .filter(e -> Boolean.FALSE.equals(e.getSupports()))
                    .sorted(Comparator.comparing(VerificationResponseDTO.EvidenceDTO::getRelevanceScore).reversed())
                    .limit(6)
                    .collect(Collectors.toList());
                supportScore = supporting.stream()
                    .map(VerificationResponseDTO.EvidenceDTO::getRelevanceScore)
                    .filter(score -> score != null)
                    .mapToDouble(score -> score / 100.0)
                    .sum();
                contradictScore = contradicting.stream()
                    .map(VerificationResponseDTO.EvidenceDTO::getRelevanceScore)
                    .filter(score -> score != null)
                    .mapToDouble(score -> score / 100.0)
                    .sum();
            }
        }

        double total = supportScore + contradictScore;
        double supportRatio = total > 0 ? supportScore / total : 0.5;
        double heuristicScore = Math.round(supportRatio * 1000.0) / 10.0;
        double heuristicConfidence = Math.abs(supportRatio - 0.5) * 2;

        Verdict heuristicVerdict = resolveVerdict(total, supportRatio, supporting.size() + contradicting.size());
        AIVerdictBundle aiBundle = buildVerdictWithAI(
            claim,
            supporting,
            contradicting,
            heuristicVerdict,
            heuristicScore,
            heuristicConfidence
        );

        Verdict finalVerdict = aiBundle.verdict != null ? aiBundle.verdict : heuristicVerdict;
        String status = mapVerdictToStatus(finalVerdict);
        double finalScore = aiBundle.score != null ? clampScore(aiBundle.score) : heuristicScore;
        double finalConfidence = aiBundle.confidence != null ? clampConfidence(aiBundle.confidence) : heuristicConfidence;

        VerificationResponseDTO response = new VerificationResponseDTO();
        response.setClaim(claim);
        response.setStatus(status);
        response.setScore(finalScore);
        response.setSupportingEvidence(supporting);
        response.setContradictingEvidence(contradicting);
        response.setConflictingEvidence(contradicting);
        response.setExplanation(aiBundle.explanation);
        response.setRecommendations(aiBundle.recommendations);
        response.setVerdict(finalVerdict != null ? finalVerdict.name() : null);
        response.setConfidence(finalConfidence);
        response.setEvidenceCount(evidence.size());
        response.setVerifiedAt(LocalDateTime.now().toString());
        return response;
    }

    private List<VerificationResponseDTO.EvidenceDTO> loadExternalEvidenceForClaim(
        String claim,
        int maxArticles,
        Integer yearFrom,
        Integer yearTo
    ) {
        try {
            ExternalHealthSearchRequestDTO request = new ExternalHealthSearchRequestDTO();
            List<String> terms = extractQueryTerms(claim);
            request.setQueryText(buildEvidenceSearchQuery(claim, terms));
            request.setTerms(terms);
            request.setYearFrom(yearFrom);
            request.setYearTo(yearTo);
            request.setMaxResults(Math.max(4, Math.min(maxArticles, 12)));
            ExternalHealthSearchResponseDTO response = healthSearchProxyService.search(
                request.getQueryText(),
                request.getMaxResults(),
                request
            );
            if (response == null || response.getResults() == null || response.getResults().isEmpty()) {
                return List.of();
            }

            List<VerificationResponseDTO.EvidenceDTO> evidence = new ArrayList<>();
            for (ExternalHealthSearchResponseDTO.ExternalHealthResultDTO article : response.getResults()) {
                String evidenceText = safeText(article.getTitle()) + " " + safeText(article.getAbstractText());
                SimilarityCalculator.StanceDetection detection = detectEvidenceStance(claim, terms, evidenceText);
                if (detection.stance == SimilarityCalculator.Stance.NEUTRAL || detection.score < 0.18) {
                    continue;
                }

                VerificationResponseDTO.EvidenceDTO dto = new VerificationResponseDTO.EvidenceDTO();
                dto.setArticleId(article.getId());
                dto.setPmid(article.getPmid());
                dto.setTitle(article.getTitle());
                dto.setSnippet(extractSnippet(article.getAbstractText(), article.getTitle()));
                dto.setSource(article.getSource() != null && !article.getSource().isBlank()
                    ? article.getSource()
                    : article.getJournal());
                dto.setSourceUrl(article.getSourceUrl());
                dto.setSimilarity(detection.score);
                dto.setRelevanceScore(Math.round(detection.score * 1000.0) / 10.0);
                dto.setEvidenceLevel(article.getEvidenceLevel());
                if (detection.stance == SimilarityCalculator.Stance.SUPPORT) {
                    dto.setSupports(true);
                    dto.setStance("support");
                } else {
                    dto.setSupports(false);
                    dto.setStance("contradict");
                }
                evidence.add(dto);
            }
            if (evidence.isEmpty()) {
                return response.getResults().stream()
                    .limit(4)
                    .map(article -> toFallbackEvidence(article))
                    .collect(Collectors.toList());
            }
            return evidence;
        } catch (Exception ex) {
            log.warn("Unable to load external evidence fallback for verification", ex);
            return List.of();
        }
    }

    private VerificationResponseDTO.EvidenceDTO toFallbackEvidence(
        ExternalHealthSearchResponseDTO.ExternalHealthResultDTO article
    ) {
        VerificationResponseDTO.EvidenceDTO dto = new VerificationResponseDTO.EvidenceDTO();
        dto.setArticleId(article.getId());
        dto.setPmid(article.getPmid());
        dto.setTitle(article.getTitle());
        dto.setSnippet(extractSnippet(article.getAbstractText(), article.getTitle()));
        dto.setSource(article.getSource() != null && !article.getSource().isBlank()
            ? article.getSource()
            : article.getJournal());
        dto.setSourceUrl(article.getSourceUrl());
        dto.setSimilarity(0.24);
        dto.setRelevanceScore(24.0);
        dto.setEvidenceLevel(article.getEvidenceLevel());
        dto.setSupports(true);
        dto.setStance("support");
        return dto;
    }

    @Override
    public List<RelevantArticle> semanticSearch(String query, int maxResults) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        int effectiveMax = maxResults > 0 ? Math.min(maxResults, 50) : 15;

        List<String> terms = extractQueryTerms(query);
        SearchRequestDTO.SearchQueryDTO queryDTO = new SearchRequestDTO.SearchQueryDTO();
        queryDTO.setTerms(terms);
        queryDTO.setOperators(buildOperators(terms.size()));

        SearchRequestDTO.SearchFiltersDTO filtersDTO = new SearchRequestDTO.SearchFiltersDTO();
        filtersDTO.setYearFrom(LocalDateTime.now().getYear() - 12);
        filtersDTO.setYearTo(LocalDateTime.now().getYear());
        filtersDTO.setMaxResults(effectiveMax);

        String pubmedQuery = pubMedQueryBuilder.buildPubMedQuery(queryDTO, filtersDTO);
        List<PubMedApiService.PubMedArticle> articles = pubMedApiService.searchArticles(pubmedQuery, effectiveMax);
        if (articles == null || articles.isEmpty()) {
            return List.of();
        }

        List<RelevantArticle> relevant = new ArrayList<>();
        for (PubMedApiService.PubMedArticle article : articles) {
            String title = safeText(article.title());
            String abstractText = safeText(article.abstractText());
            String combinedText = (title + " " + abstractText).trim();
            SimilarityCalculator.StanceDetection detection = similarityCalculator.detectStance(query, combinedText);

            StudyType studyType = EvidenceLevelMapper.mapStudyType(article.publicationTypes());
            int evidenceLevel = EvidenceLevelMapper.evidenceLevelForStudyType(studyType);
            Integer publicationYear = extractYear(article.publicationDate());
            double weighted = detection.score * evidenceWeight(evidenceLevel) * recencyWeight(publicationYear);
            if (weighted <= 0.10) {
                continue;
            }

            RelevantArticle mapped = new RelevantArticle();
            mapped.pmid = safeText(article.pmid());
            mapped.title = title.isBlank() ? "Untitled article" : title;
            mapped.snippet = extractSnippet(abstractText, title);
            mapped.relevanceScore = Math.round(weighted * 1000.0) / 1000.0;
            mapped.evidenceLevel = evidenceLevel;
            mapped.stance = detection.stance.name();
            mapped.similarityScore = detection.score;
            mapped.publicationYear = publicationYear;
            mapped.journal = safeText(article.journal());
            mapped.authors = joinAuthors(article.authors());
            mapped.sourceUrl = buildSourceUrl(article.pmid(), article.doi());
            relevant.add(mapped);
        }

        return relevant.stream()
            .sorted((left, right) -> Double.compare(
                right.relevanceScore != null ? right.relevanceScore : 0.0,
                left.relevanceScore != null ? left.relevanceScore : 0.0
            ))
            .limit(effectiveMax)
            .collect(Collectors.toList());
    }

    @Override
    public List<RelevantArticle> rerankByEvidenceLevel(List<RelevantArticle> articles) {
        if (articles == null || articles.isEmpty()) {
            return List.of();
        }
        List<RelevantArticle> sorted = new ArrayList<>(articles);
        sorted.sort(Comparator.comparingDouble(this::rerankScore).reversed());
        return sorted;
    }

    @Override
    public String validateAndAttributeCitations(String text, List<RelevantArticle> sourceArticles) {
        if (text == null || text.isBlank()) {
            return "";
        }
        if (sourceArticles == null || sourceArticles.isEmpty()) {
            return text.trim();
        }

        Set<String> sourcePmids = sourceArticles.stream()
            .map(article -> article.pmid)
            .filter(pmid -> pmid != null && !pmid.isBlank())
            .collect(Collectors.toCollection(LinkedHashSet::new));

        if (sourcePmids.isEmpty()) {
            return text.trim();
        }

        String normalized = text.trim();
        Matcher citationMatcher = Pattern.compile("\\[PMID:(\\d+)\\]").matcher(normalized);
        Set<String> citationsInText = new LinkedHashSet<>();
        while (citationMatcher.find()) {
            citationsInText.add(citationMatcher.group(1));
        }

        boolean hasValidCitation = citationsInText.stream().anyMatch(sourcePmids::contains);
        if (hasValidCitation) {
            return normalized;
        }

        String citations = sourcePmids.stream()
            .limit(4)
            .map(pmid -> "[PMID:" + pmid + "]")
            .collect(Collectors.joining(" "));
        return normalized + "\n\nFuentes: " + citations;
    }

    @Override
    public Double calculateQualityScore(String genText) {
        if (genText == null || genText.isBlank()) {
            return 0.0;
        }
        String normalized = genText.trim();
        int length = normalized.length();
        int sentenceCount = normalized.split("[.!?]+").length;

        Matcher matcher = Pattern.compile("\\[PMID:(\\d+)\\]").matcher(normalized);
        Set<String> uniqueCitations = new LinkedHashSet<>();
        while (matcher.find()) {
            uniqueCitations.add(matcher.group(1));
        }

        double lengthScore = Math.min(1.0, length / 950.0);
        double structureScore = sentenceCount >= 3 ? 1.0 : sentenceCount >= 2 ? 0.75 : 0.5;
        double citationScore = Math.min(1.0, uniqueCitations.size() / 4.0);

        double score = (lengthScore * 0.35) + (structureScore * 0.25) + (citationScore * 0.40);
        return Math.round(score * 1000.0) / 1000.0;
    }

    private List<String> extractQueryTerms(String claim) {
        if (claim == null) {
            return List.of();
        }
        String normalized = claim.toLowerCase().replaceAll("[^a-z0-9\\s]", " ");
        String[] tokens = normalized.split("\\s+");
        java.util.Set<String> stopwords = java.util.Set.of(
            "the", "and", "or", "but", "with", "from", "that", "this",
            "para", "como", "donde", "sobre", "entre", "desde", "segun",
            "con", "sin", "por", "que", "los", "las", "del", "una", "uno"
        );

        List<String> candidates = new ArrayList<>();
        for (int i = 0; i < tokens.length; i++) {
            String token = tokens[i];
            if (token.length() < 4 || stopwords.contains(token)) continue;
            candidates.add(token);
            if (i + 1 < tokens.length) {
                String next = tokens[i + 1];
                if (next.length() >= 4 && !stopwords.contains(next)) {
                    candidates.add(token + " " + next);
                }
            }
        }

        java.util.LinkedHashSet<String> terms = new java.util.LinkedHashSet<>();
        for (String candidate : candidates) {
            String mapped = meshMapper.mapToMeshTerm(candidate);
            if (mapped != null && !mapped.isBlank()) {
                terms.add(mapped);
            } else {
                terms.add(candidate);
            }
            if (terms.size() >= 8) break;
        }
        if (terms.isEmpty()) {
            terms.add(claim.trim());
        }
        return new ArrayList<>(terms);
    }

    private String buildEvidenceSearchQuery(String claim, List<String> terms) {
        if (terms != null && !terms.isEmpty()) {
            List<String> prioritized = new ArrayList<>();
            for (String term : terms) {
                if (term == null || term.isBlank()) {
                    continue;
                }
                if (isPreferredMedicalTerm(term) && !prioritized.contains(term)) {
                    prioritized.add(term);
                }
            }
            for (String term : terms) {
                if (term == null || term.isBlank() || prioritized.contains(term)) {
                    continue;
                }
                prioritized.add(term);
            }

            return prioritized.stream()
                .filter(term -> term != null && !term.isBlank())
                .limit(5)
                .collect(Collectors.joining(" "));
        }
        return claim != null ? claim.trim() : "";
    }

    private boolean isPreferredMedicalTerm(String term) {
        if (term == null || term.isBlank()) {
            return false;
        }
        return !term.equals(term.toLowerCase(Locale.ROOT))
            || term.contains(",")
            || term.contains(" ")
            || term.matches(".*\\d.*");
    }

    private SimilarityCalculator.StanceDetection detectEvidenceStance(
        String claim,
        List<String> terms,
        String evidenceText
    ) {
        SimilarityCalculator.StanceDetection claimDetection = similarityCalculator.detectStance(claim, evidenceText);
        String normalizedTerms = buildEvidenceSearchQuery(claim, terms);
        SimilarityCalculator.StanceDetection termDetection = normalizedTerms.isBlank()
            ? claimDetection
            : similarityCalculator.detectStance(normalizedTerms, evidenceText);

        SimilarityCalculator.StanceDetection best = termDetection.score > claimDetection.score
            ? termDetection
            : claimDetection;

        if (best.stance != SimilarityCalculator.Stance.NEUTRAL) {
            return best;
        }

        double overlap = similarityCalculator.combinedSimilarity(normalizedTerms, evidenceText, 0.65);
        int keywordHits = countKeywordHits(normalizedTerms, evidenceText);
        if (keywordHits >= 2 && overlap >= 0.12) {
            return new SimilarityCalculator.StanceDetection(SimilarityCalculator.Stance.SUPPORT, Math.max(overlap, 0.24));
        }
        if (overlap >= 0.22) {
            return new SimilarityCalculator.StanceDetection(SimilarityCalculator.Stance.SUPPORT, overlap);
        }

        return best;
    }

    private int countKeywordHits(String normalizedTerms, String evidenceText) {
        if (normalizedTerms == null || normalizedTerms.isBlank() || evidenceText == null || evidenceText.isBlank()) {
            return 0;
        }

        String normalizedEvidence = evidenceText.toLowerCase(Locale.ROOT);
        Set<String> ignored = Set.of(
            "type", "adult", "adults", "study", "effect", "effects", "control",
            "mellitus", "patients", "patient", "therapy", "treatment"
        );

        LinkedHashSet<String> tokens = new LinkedHashSet<>();
        for (String token : normalizedTerms.toLowerCase(Locale.ROOT).split("[^a-z0-9]+")) {
            if (token.length() < 4 || ignored.contains(token)) {
                continue;
            }
            tokens.add(token);
        }

        int hits = 0;
        for (String token : tokens) {
            if (normalizedEvidence.contains(token)) {
                hits += 1;
            }
        }
        return hits;
    }

    private List<String> buildOperators(int termCount) {
        if (termCount <= 1) return List.of();
        List<String> ops = new ArrayList<>();
        for (int i = 1; i < termCount; i++) {
            ops.add("AND");
        }
        return ops;
    }

    private String extractSnippet(String abstractText, String fallbackTitle) {
        if (abstractText != null && !abstractText.isBlank()) {
            String text = abstractText.trim();
            return text.length() > 220 ? text.substring(0, 220) + "..." : text;
        }
        return fallbackTitle != null ? fallbackTitle : "";
    }

    private Verdict resolveVerdict(double totalEvidence, double supportRatio, int evidenceCount) {
        if (totalEvidence == 0 || evidenceCount < 3) {
            return Verdict.INSUFFICIENT_EVIDENCE;
        }
        if (supportRatio >= 0.6 && totalEvidence >= 0.6) {
            return Verdict.SUPPORTED;
        }
        if (supportRatio <= 0.4 && totalEvidence >= 0.6) {
            return Verdict.REFUTED;
        }
        return Verdict.CONFLICTING;
    }

    private String mapVerdictToStatus(Verdict verdict) {
        if (verdict == null) return "pending";
        return switch (verdict) {
            case SUPPORTED -> "verified";
            case REFUTED -> "misinformation";
            case CONFLICTING, INSUFFICIENT_EVIDENCE -> "conflicting";
        };
    }

    private AIVerdictBundle buildVerdictWithAI(
        String claim,
        List<VerificationResponseDTO.EvidenceDTO> supporting,
        List<VerificationResponseDTO.EvidenceDTO> contradicting,
        Verdict heuristicVerdict,
        double heuristicScore,
        double heuristicConfidence
    ) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Devuelve UNICAMENTE un JSON valido con las claves exactas ");
        prompt.append("verdict (SUPPORTED|REFUTED|CONFLICTING|INSUFFICIENT_EVIDENCE), ");
        prompt.append("score (numero 0-100), confidence (numero 0-1), ");
        prompt.append("explanation (string) y recommendations (array de strings). ");
        prompt.append("No uses markdown ni texto fuera del JSON.\\n");
        prompt.append("Actua como un verificador medico. Basate estrictamente en la evidencia adjunta ");
        prompt.append("y no inventes datos externos.\\n");
        prompt.append("Contexto (evidencia recuperada de PubMed y stance calculado):\\n");
        prompt.append("Claim del usuario: ").append(claim).append("\\n");
        prompt.append("Veredicto heuristico previo: ")
            .append(heuristicVerdict != null ? heuristicVerdict.name() : "UNKNOWN")
            .append("\\n");
        prompt.append("Score heuristico previo (0-100): ").append(heuristicScore).append("\\n");
        prompt.append("Confianza heuristica previa (0-1): ").append(heuristicConfidence).append("\\n");
        prompt.append("Evidencia que soporta el claim:\\n");
        for (VerificationResponseDTO.EvidenceDTO e : supporting.stream().limit(4).toList()) {
            prompt.append("- ").append(e.getTitle()).append(": ").append(e.getSnippet()).append("\\n");
        }
        prompt.append("Evidencia que contradice el claim:\\n");
        for (VerificationResponseDTO.EvidenceDTO e : contradicting.stream().limit(4).toList()) {
            prompt.append("- ").append(e.getTitle()).append(": ").append(e.getSnippet()).append("\\n");
        }

        String aiResponse = openAIService.generateText(prompt.toString(), true);
        if (aiResponse == null || aiResponse.isBlank()) {
            return new AIVerdictBundle(
                null,
                null,
                null,
                "An\u00e1lisis basado en evidencia recuperada de PubMed.",
                defaultRecommendations()
            );
        }
        try {
            String json = extractJson(aiResponse);
            if (json == null) {
                return new AIVerdictBundle(
                    null,
                    null,
                    null,
                    aiResponse.trim(),
                    defaultRecommendations()
                );
            }
            var node = objectMapper.readTree(json);
            Verdict aiVerdict = parseVerdict(node.path("verdict").asText(null));
            Double aiScore = parseOptionalDouble(node.get("score"));
            Double aiConfidence = parseOptionalDouble(node.get("confidence"));
            String explanation = node.path("explanation").asText(null);
            List<String> recs = new ArrayList<>();
            if (node.has("recommendations") && node.get("recommendations").isArray()) {
                for (var item : node.get("recommendations")) {
                    if (item != null && !item.asText().isBlank()) {
                        recs.add(item.asText());
                    }
                }
            }
            if (explanation != null && !explanation.isBlank()) {
                return new AIVerdictBundle(
                    aiVerdict,
                    aiScore,
                    aiConfidence,
                    explanation.trim(),
                    recs.isEmpty() ? defaultRecommendations() : recs
                );
            }
            if (aiVerdict != null || aiScore != null || aiConfidence != null) {
                return new AIVerdictBundle(
                    aiVerdict,
                    aiScore,
                    aiConfidence,
                    "Analisis completado con evidencia recuperada.",
                    recs.isEmpty() ? defaultRecommendations() : recs
                );
            }
        } catch (Exception e) {
            log.warn("Error parsing AI explanation", e);
        }
        return new AIVerdictBundle(
            null,
            null,
            null,
            aiResponse.trim(),
            defaultRecommendations()
        );
    }

    private List<String> defaultRecommendations() {
        return List.of(
            "Consultar revisiones sistem\u00e1ticas recientes",
            "Contrastar con gu\u00edas cl\u00ednicas actualizadas",
            "Ampliar la b\u00fasqueda con t\u00e9rminos relacionados"
        );
    }

    private String extractJson(String text) {
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return text.substring(start, end + 1);
        }
        return null;
    }

    private Verdict parseVerdict(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        return switch (normalized) {
            case "SUPPORTED", "SUPPORT", "VERIFIED", "TRUE" -> Verdict.SUPPORTED;
            case "REFUTED", "MISINFORMATION", "FALSE" -> Verdict.REFUTED;
            case "CONFLICTING", "MIXED" -> Verdict.CONFLICTING;
            case "INSUFFICIENT_EVIDENCE", "INCONCLUSIVE", "UNKNOWN", "PENDING" -> Verdict.INSUFFICIENT_EVIDENCE;
            default -> {
                try {
                    yield Verdict.valueOf(normalized);
                } catch (IllegalArgumentException ex) {
                    yield null;
                }
            }
        };
    }

    private double clampScore(Double score) {
        if (score == null) {
            return 0.0;
        }
        return Math.max(0.0, Math.min(100.0, score));
    }

    private double clampConfidence(Double confidence) {
        if (confidence == null) {
            return 0.0;
        }
        double normalized = confidence > 1.0 ? confidence / 100.0 : confidence;
        return Math.max(0.0, Math.min(1.0, normalized));
    }

    private Double parseOptionalDouble(com.fasterxml.jackson.databind.JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (node.isNumber()) {
            return node.asDouble();
        }
        if (node.isTextual()) {
            try {
                return Double.parseDouble(node.asText().trim());
            } catch (NumberFormatException ex) {
                return null;
            }
        }
        return null;
    }

    private String buildEvidencePrompt(String query, String context, List<RelevantArticle> selectedArticles) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Responde en espanol clinico claro. ");
        prompt.append("Genera un texto basado solo en evidencia y cita PMIDs como [PMID:123456]. ");
        prompt.append("No inventes fuentes ni datos.\n");
        prompt.append("Consulta principal: ").append(query).append("\n");
        if (context != null && !context.isBlank()) {
            prompt.append("Contexto adicional: ").append(context).append("\n");
        }
        prompt.append("Evidencia disponible:\n");
        int index = 1;
        for (RelevantArticle article : selectedArticles) {
            prompt.append(index++)
                .append(". PMID: ").append(safeText(article.pmid))
                .append(" | Nivel: ").append(article.evidenceLevel)
                .append(" | Titulo: ").append(safeText(article.title))
                .append(" | Resumen: ").append(safeText(article.snippet))
                .append("\n");
        }
        prompt.append("Entrega 2-4 parrafos y evita afirmaciones absolutas.");
        return prompt.toString();
    }

    private String buildFallbackGeneratedText(String query, List<RelevantArticle> selectedArticles) {
        if (selectedArticles == null || selectedArticles.isEmpty()) {
            return "No se recupero evidencia suficiente para responder sobre: " + query + ".";
        }
        StringBuilder text = new StringBuilder();
        text.append("Sintesis de evidencia para: ").append(query).append(". ");
        text.append("Se priorizaron articulos con mejor nivel metodologico y mayor relevancia semantica. ");
        text.append("Los hallazgos apuntan a una tendencia general que debe interpretarse junto al contexto clinico local.");

        String citations = selectedArticles.stream()
            .map(article -> safeText(article.pmid))
            .filter(pmid -> !pmid.isBlank())
            .limit(4)
            .map(pmid -> "[PMID:" + pmid + "]")
            .collect(Collectors.joining(" "));
        if (!citations.isBlank()) {
            text.append("\n\nFuentes: ").append(citations);
        }
        return text.toString();
    }

    private String buildSummary(String text) {
        if (text == null || text.isBlank()) {
            return "No summary available.";
        }
        String normalized = text.replaceAll("\\s+", " ").trim();
        if (normalized.length() <= 220) {
            return normalized;
        }
        return normalized.substring(0, 220) + "...";
    }

    private List<GenTextResult.EvidenceArticle> toEvidenceArticles(List<RelevantArticle> articles) {
        if (articles == null || articles.isEmpty()) {
            return List.of();
        }
        List<GenTextResult.EvidenceArticle> evidenceArticles = new ArrayList<>();
        for (RelevantArticle article : articles) {
            GenTextResult.EvidenceArticle evidence = GenTextResult.EvidenceArticle.builder()
                .pubmedId(safeText(article.pmid))
                .title(safeText(article.title))
                .authors(article.authors != null ? article.authors : "")
                .publicationYear(article.publicationYear != null ? article.publicationYear : 0)
                .journal(article.journal != null ? article.journal : "")
                .relevanceScore(article.relevanceScore != null ? article.relevanceScore : 0.0)
                .snippet(article.snippet != null ? article.snippet : "")
                .url(article.sourceUrl != null ? article.sourceUrl : "")
                .build();
            evidenceArticles.add(evidence);
        }
        return evidenceArticles;
    }

    private Map<String, Object> buildGenTextMetadata(
        boolean usedAi,
        String query,
        String context,
        int usedArticles,
        int requestedArticles
    ) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("pipeline", "rag");
        metadata.put("usedAi", usedAi);
        metadata.put("query", query);
        metadata.put("context", context);
        metadata.put("usedArticles", usedArticles);
        metadata.put("requestedArticles", requestedArticles);
        return metadata;
    }

    private double rerankScore(RelevantArticle article) {
        if (article == null) {
            return 0.0;
        }
        double relevance = article.relevanceScore != null ? article.relevanceScore : 0.0;
        double evidenceFactor = article.evidenceLevel != null
            ? evidenceWeight(article.evidenceLevel)
            : evidenceWeight(6);
        return (relevance * 0.7) + (evidenceFactor * 0.3);
    }

    private String joinAuthors(List<String> authors) {
        if (authors == null || authors.isEmpty()) {
            return "";
        }
        return authors.stream()
            .filter(author -> author != null && !author.isBlank())
            .limit(4)
            .collect(Collectors.joining(", "));
    }

    private String buildSourceUrl(String pmid, String doi) {
        if (pmid != null && !pmid.isBlank()) {
            return "https://pubmed.ncbi.nlm.nih.gov/" + pmid + "/";
        }
        if (doi != null && !doi.isBlank()) {
            return "https://doi.org/" + doi;
        }
        return "";
    }

    private String safeText(String value) {
        return value == null ? "" : value.replaceAll("\\s+", " ").trim();
    }

    private double evidenceWeight(int level) {
        return switch (level) {
            case 1 -> 1.0;
            case 2 -> 0.9;
            case 3 -> 0.8;
            case 4 -> 0.65;
            case 5 -> 0.5;
            default -> 0.35;
        };
    }

    private double recencyWeight(Integer year) {
        if (year == null) {
            return 0.85;
        }
        int currentYear = LocalDateTime.now().getYear();
        int age = Math.max(0, currentYear - year);
        if (age <= 2) return 1.0;
        if (age <= 5) return 0.9;
        if (age <= 10) return 0.8;
        if (age <= 20) return 0.65;
        return 0.5;
    }

    private Integer extractYear(String publicationDate) {
        if (publicationDate == null || publicationDate.isBlank()) {
            return null;
        }
        Matcher matcher = YEAR_PATTERN.matcher(publicationDate);
        if (matcher.find()) {
            try {
                return Integer.parseInt(matcher.group());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private record AIVerdictBundle(
        Verdict verdict,
        Double score,
        Double confidence,
        String explanation,
        List<String> recommendations
    ) {}
}
