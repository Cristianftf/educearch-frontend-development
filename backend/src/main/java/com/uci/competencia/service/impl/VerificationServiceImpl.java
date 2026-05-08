package com.uci.competencia.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.request.VerificationRequestDTO;
import com.uci.competencia.model.dto.request.VerificationRequest;
import com.uci.competencia.model.dto.response.VerificationResponseDTO;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.entity.VerificationResult;
import com.uci.competencia.model.enums.Verdict;
import com.uci.competencia.model.enums.VerificationStatus;
import com.uci.competencia.security.UserIdentityResolver;
import com.uci.competencia.repository.VerificationResultRepository;
import com.uci.competencia.service.RAGService;
import com.uci.competencia.service.VerificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class VerificationServiceImpl implements VerificationService {

    private final VerificationResultRepository verificationResultRepository;
    private final UserIdentityResolver userIdentityResolver;
    private final ObjectMapper objectMapper;
    private final RAGService ragService;

    @Override
    public VerificationResponseDTO verifyClaim(VerificationRequestDTO request) {
        String claim = (request.getClaimText() != null && !request.getClaimText().isBlank())
            ? request.getClaimText()
            : request.getSourceUrl();
        String claimForAnalysis = claim;
        if (request.getSourceUrl() != null && (request.getClaimText() == null || request.getClaimText().isBlank())) {
            claimForAnalysis = fetchClaimFromUrl(request.getSourceUrl());
        }

        log.info("Processing verification for claim: {}", claim);

        VerificationResult result = new VerificationResult();
        result.setClaimText(claim);
        result.setSourceUrl(request.getSourceUrl());
        result.setStatus(VerificationStatus.PROCESSING);

        resolveCurrentUser().ifPresent(result::setUser);

        VerificationResult saved = verificationResultRepository.save(result);

        VerificationResponseDTO response;
        try {
            VerificationRequest ragRequest = VerificationRequest.builder()
                .claim(claimForAnalysis)
                .context(request.getSourceUrl())
                .maxArticles(15)
                .confidenceThreshold(0.5)
                .sessionId(request.getContext() != null ? request.getContext().getSessionId() : null)
                .build();

            response = ragService.verifyClaimAgainstEvidence(ragRequest);
            response.setId(saved.getId());
            response.setClaim(claim);

            saved.setStatus(VerificationStatus.COMPLETED);
            saved.setVerdict(mapVerdict(response.getVerdict()));
            saved.setOverallScore(response.getScore());
            saved.setConfidence(response.getConfidence());
            saved.setEvidenceCount(response.getEvidenceCount());
            saved.setSupportingEvidence(objectMapper.writeValueAsString(response.getSupportingEvidence()));
            saved.setConflictingEvidence(objectMapper.writeValueAsString(response.getContradictingEvidence()));
            saved.setExplanations(response.getExplanation());
            saved.setRecommendations(objectMapper.writeValueAsString(response.getRecommendations()));
            saved.setCompletedAt(java.time.LocalDateTime.now());

            verificationResultRepository.save(saved);
            return response;
        } catch (Exception e) {
            log.error("Error verifying claim", e);
            saved.setStatus(VerificationStatus.FAILED);
            saved.setExplanations("No se pudo completar la verificación. Intenta de nuevo.");
            verificationResultRepository.save(saved);
            response = convertToDTO(saved);
            response.setId(saved.getId());
            response.setClaim(claim);
            return response;
        }
    }

    @Override
    public VerificationResponseDTO getVerificationResult(String verificationId) {
        log.info("Retrieving verification result: {}", verificationId);

        Optional<VerificationResult> result = verificationResultRepository.findById(verificationId);
        if (result.isEmpty()) {
            VerificationResponseDTO response = new VerificationResponseDTO();
            response.setId(verificationId);
            response.setStatus("pending");
            response.setScore(0.0);
            response.setSupportingEvidence(new ArrayList<>());
            response.setContradictingEvidence(new ArrayList<>());
            response.setConflictingEvidence(new ArrayList<>());
            response.setExplanation("No se encontró el resultado aún.");
            response.setRecommendations(new ArrayList<>());
            return response;
        }

        return convertToDTO(result.get());
    }

    @Override
    public List<VerificationResponseDTO> getVerificationHistory(String userId, int page, int limit) {
        log.info("Retrieving verification history for user: {}, page: {}, limit: {}", userId, page, limit);

        try {
            // Validar parámetros
            if (page < 1) page = 1;
            if (limit < 1 || limit > 100) limit = 20; // Límite máximo de 100

            // Crear paginación
            Pageable pageable = PageRequest.of(page - 1, limit);

            // Obtener datos de la base de datos
            Page<VerificationResult> resultPage = verificationResultRepository.findByUser_Id(userId, pageable);

            // Convertir a DTOs y retornar
            List<VerificationResponseDTO> history = resultPage.getContent().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());

            log.info("Retrieved {} verification records for user: {}", history.size(), userId);
            return history;

        } catch (Exception e) {
            log.error("Error retrieving verification history for user: {}", userId, e);
            return new ArrayList<>();
        }
    }

    /**
     * Convierte una entidad VerificationResult a DTO
     */
    private VerificationResponseDTO convertToDTO(VerificationResult result) {
        VerificationResponseDTO dto = new VerificationResponseDTO();
        dto.setId(result.getId());
        dto.setClaim(result.getClaimText());
        dto.setStatus(mapStatus(result));
        dto.setScore(result.getOverallScore() != null ? result.getOverallScore() : 0.0);
        dto.setVerifiedAt(result.getCompletedAt() != null ? result.getCompletedAt().toString() : 
                         result.getSubmittedAt() != null ? result.getSubmittedAt().toString() : null);
        dto.setVerdict(result.getVerdict() != null ? result.getVerdict().name() : null);
        dto.setConfidence(result.getConfidence());
        dto.setEvidenceCount(result.getEvidenceCount() != null ? result.getEvidenceCount() : 0);
        dto.setSupportingEvidence(parseEvidenceList(result.getSupportingEvidence(), true));
        List<VerificationResponseDTO.EvidenceDTO> contradicting = parseEvidenceList(result.getConflictingEvidence(), false);
        dto.setContradictingEvidence(contradicting);
        dto.setConflictingEvidence(contradicting);
        dto.setExplanation(resolveExplanation(result));
        dto.setRecommendations(parseRecommendations(result.getRecommendations()));
        return dto;
    }

    private Verdict mapVerdict(String verdict) {
        if (verdict == null) return null;
        try {
            return Verdict.valueOf(verdict);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private String fetchClaimFromUrl(String url) {
        try {
            String text = Jsoup.connect(url)
                .userAgent("UCI-Competencia/1.0")
                .timeout(10000)
                .get()
                .text();
            if (text == null || text.isBlank()) {
                return url;
            }
            return text.length() > 1200 ? text.substring(0, 1200) : text;
        } catch (Exception e) {
            log.warn("Unable to fetch content from URL, using URL as claim", e);
            return url;
        }
    }

    private String mapStatus(VerificationResult result) {
        if (result.getStatus() == null || result.getStatus() != VerificationStatus.COMPLETED) {
            return "pending";
        }

        Verdict verdict = result.getVerdict();
        if (verdict == null) {
            return "pending";
        }

        switch (verdict) {
            case SUPPORTED:
                return "verified";
            case CONFLICTING:
                return "conflicting";
            case REFUTED:
                return "misinformation";
            case INSUFFICIENT_EVIDENCE:
            default:
                return "conflicting";
        }
    }

    private List<VerificationResponseDTO.EvidenceDTO> parseEvidenceList(String raw, boolean defaultSupports) {
        if (raw == null || raw.isBlank()) {
            return new ArrayList<>();
        }

        try {
            List<Map<String, Object>> items = objectMapper.readValue(raw, new TypeReference<List<Map<String, Object>>>() {});
            return items.stream()
                .map(item -> toEvidenceDTO(item, defaultSupports))
                .collect(Collectors.toList());
        } catch (Exception e) {
            VerificationResponseDTO.EvidenceDTO fallback = new VerificationResponseDTO.EvidenceDTO();
            fallback.setSnippet(raw);
            fallback.setSupports(defaultSupports);
            fallback.setRelevanceScore(0.0);
            return new ArrayList<>(Collections.singletonList(fallback));
        }
    }

    private VerificationResponseDTO.EvidenceDTO toEvidenceDTO(Map<String, Object> item, boolean defaultSupports) {
        VerificationResponseDTO.EvidenceDTO dto = new VerificationResponseDTO.EvidenceDTO();
        dto.setArticleId(asString(item.get("articleId"), asString(item.get("pmid"), null)));
        dto.setPmid(asString(item.get("pmid"), null));
        dto.setTitle(asString(item.get("title"), null));
        dto.setSnippet(asString(item.get("snippet"), asString(item.get("text"), null)));
        dto.setSource(asString(item.get("source"), null));
        dto.setSourceUrl(asString(item.get("sourceUrl"), null));
        dto.setSupports(asBoolean(item.get("supports"), defaultSupports));
        dto.setStance(asString(item.get("stance"), dto.getSupports() != null && dto.getSupports() ? "support" : "contradict"));
        dto.setRelevanceScore(asDouble(item.get("relevanceScore"), asDouble(item.get("similarity"), 0.0)));
        dto.setSimilarity(asDouble(item.get("similarity"), dto.getRelevanceScore()));
        dto.setEvidenceLevel(asInteger(item.get("evidenceLevel"), null));
        return dto;
    }

    private List<String> parseRecommendations(String raw) {
        if (raw == null || raw.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(raw, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            String[] parts = raw.split("\\r?\\n|;");
            List<String> list = new ArrayList<>();
            for (String part : parts) {
                String value = part.trim();
                if (!value.isBlank()) {
                    list.add(value);
                }
            }
            return list;
        }
    }

    private String resolveExplanation(VerificationResult result) {
        if (result.getExplanations() != null && !result.getExplanations().isBlank()) {
            return result.getExplanations();
        }
        if (result.getGenText() != null && !result.getGenText().isBlank()) {
            return result.getGenText();
        }
        return "No hay explicación disponible.";
    }

    private Optional<User> resolveCurrentUser() {
        return userIdentityResolver.resolveCurrentUser();
    }

    private String asString(Object value, String fallback) {
        return value != null ? value.toString() : fallback;
    }

    private Boolean asBoolean(Object value, Boolean fallback) {
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        if (value instanceof String) {
            return Boolean.parseBoolean((String) value);
        }
        return fallback;
    }

    private Double asDouble(Object value, Double fallback) {
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        if (value instanceof String) {
            try {
                return Double.parseDouble((String) value);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private Integer asInteger(Object value, Integer fallback) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String) {
            try {
                return Integer.parseInt((String) value);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }
}
