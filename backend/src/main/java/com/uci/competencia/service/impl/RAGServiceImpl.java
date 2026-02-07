package com.uci.competencia.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.request.GenTextRequest;
import com.uci.competencia.model.dto.request.SearchRequestDTO;
import com.uci.competencia.model.dto.request.VerificationRequest;
import com.uci.competencia.model.dto.response.GenTextResult;
import com.uci.competencia.model.dto.response.VerificationResponseDTO;
import com.uci.competencia.model.enums.StudyType;
import com.uci.competencia.model.enums.Verdict;
import com.uci.competencia.service.RAGService;
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
import java.util.List;
import java.util.stream.Collectors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
@RequiredArgsConstructor
public class RAGServiceImpl implements RAGService {

    private static final Pattern YEAR_PATTERN = Pattern.compile("(19|20)\\d{2}");

    private final PubMedApiService pubMedApiService;
    private final PubMedQueryBuilder pubMedQueryBuilder;
    private final SimilarityCalculator similarityCalculator;
    private final OpenAIService openAIService;
    private final ObjectMapper objectMapper;
    private final MeshMapper meshMapper;

    @Override
    public GenTextResult generateEvidenceBasedText(GenTextRequest request) {
        GenTextResult result = new GenTextResult();
        result.setGeneratedText("Funcionalidad no implementada en esta versi\u00f3n.");
        result.setGeneratedAt(LocalDateTime.now());
        result.setEvidence(List.of());
        result.setConfidenceScore(0.0);
        result.setSourceCount(0);
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
            SimilarityCalculator.StanceDetection detection = similarityCalculator.detectStance(claim, evidenceText);

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

        double total = supportScore + contradictScore;
        double supportRatio = total > 0 ? supportScore / total : 0.5;
        double score = Math.round(supportRatio * 1000.0) / 10.0;

        Verdict verdict = resolveVerdict(total, supportRatio, supporting.size() + contradicting.size());
        String status = mapVerdictToStatus(verdict);

        ExplanationBundle bundle = buildExplanationWithAI(claim, supporting, contradicting, verdict);
        String explanation = bundle.explanation;
        List<String> recommendations = bundle.recommendations;

        VerificationResponseDTO response = new VerificationResponseDTO();
        response.setClaim(claim);
        response.setStatus(status);
        response.setScore(score);
        response.setSupportingEvidence(supporting);
        response.setContradictingEvidence(contradicting);
        response.setConflictingEvidence(contradicting);
        response.setExplanation(explanation);
        response.setRecommendations(recommendations);
        response.setVerdict(verdict != null ? verdict.name() : null);
        response.setConfidence(Math.abs(supportRatio - 0.5) * 2);
        response.setEvidenceCount(evidence.size());
        response.setVerifiedAt(LocalDateTime.now().toString());
        return response;
    }

    @Override
    public List<RelevantArticle> semanticSearch(String query, int maxResults) {
        return List.of();
    }

    @Override
    public List<RelevantArticle> rerankByEvidenceLevel(List<RelevantArticle> articles) {
        return articles == null ? List.of() : articles;
    }

    @Override
    public String validateAndAttributeCitations(String text, List<RelevantArticle> sourceArticles) {
        return text;
    }

    @Override
    public Double calculateQualityScore(String genText) {
        return 0.0;
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

    private ExplanationBundle buildExplanationWithAI(
        String claim,
        List<VerificationResponseDTO.EvidenceDTO> supporting,
        List<VerificationResponseDTO.EvidenceDTO> contradicting,
        Verdict verdict
    ) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Devuelve SOLO un JSON con las claves: explanation (string), recommendations (array). ");
        prompt.append("Responde en espanol y se clinicamente preciso.\\n");
        prompt.append("Claim: ").append(claim).append("\\n");
        prompt.append("Verdict: ").append(verdict != null ? verdict.name() : "UNKNOWN").append("\\n");
        prompt.append("Evidence supporting:\\n");
        for (VerificationResponseDTO.EvidenceDTO e : supporting.stream().limit(4).toList()) {
            prompt.append("- ").append(e.getTitle()).append(": ").append(e.getSnippet()).append("\\n");
        }
        prompt.append("Evidence contradicting:\\n");
        for (VerificationResponseDTO.EvidenceDTO e : contradicting.stream().limit(4).toList()) {
            prompt.append("- ").append(e.getTitle()).append(": ").append(e.getSnippet()).append("\\n");
        }

        String aiResponse = openAIService.generateText(prompt.toString());
        if (aiResponse == null || aiResponse.isBlank()) {
            return new ExplanationBundle(
                "An\u00e1lisis basado en evidencia recuperada de PubMed.",
                defaultRecommendations()
            );
        }
        try {
            String json = extractJson(aiResponse);
            if (json == null) {
                return new ExplanationBundle(aiResponse.trim(), defaultRecommendations());
            }
            var node = objectMapper.readTree(json);
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
                return new ExplanationBundle(
                    explanation.trim(),
                    recs.isEmpty() ? defaultRecommendations() : recs
                );
            }
        } catch (Exception e) {
            log.warn("Error parsing AI explanation", e);
        }
        return new ExplanationBundle(aiResponse.trim(), defaultRecommendations());
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

    private record ExplanationBundle(String explanation, List<String> recommendations) {}
}
