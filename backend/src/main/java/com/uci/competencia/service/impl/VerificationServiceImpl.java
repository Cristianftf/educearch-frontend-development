package com.uci.competencia.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.request.VerificationRequestDTO;
import com.uci.competencia.model.dto.response.VerificationResponseDTO;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.entity.VerificationResult;
import com.uci.competencia.model.enums.Verdict;
import com.uci.competencia.model.enums.VerificationStatus;
import com.uci.competencia.repository.UserRepository;
import com.uci.competencia.repository.VerificationResultRepository;
import com.uci.competencia.service.VerificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;

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
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Override
    public VerificationResponseDTO verifyClaim(VerificationRequestDTO request) {
        log.info("Processing verification for claim: {}", request.getClaimText());

        VerificationResult result = new VerificationResult();
        String claim = (request.getClaimText() != null && !request.getClaimText().isBlank())
            ? request.getClaimText()
            : request.getSourceUrl();
        result.setClaimText(claim);
        result.setSourceUrl(request.getSourceUrl());
        result.setStatus(VerificationStatus.PENDING);

        String userId = getCurrentUserId();
        if (userId != null) {
            Optional<User> user = userRepository.findById(userId);
            user.ifPresent(result::setUser);
        }

        VerificationResult saved = verificationResultRepository.save(result);

        VerificationResponseDTO response = new VerificationResponseDTO();
        response.setId(saved.getId());
        response.setClaim(saved.getClaimText());
        response.setStatus("pending");
        response.setScore(0.0);
        response.setSupportingEvidence(new ArrayList<>());
        response.setContradictingEvidence(new ArrayList<>());
        response.setConflictingEvidence(new ArrayList<>());
        response.setExplanation("El claim está en proceso de verificación.");
        response.setRecommendations(new ArrayList<>());
        response.setVerifiedAt(saved.getSubmittedAt() != null ? saved.getSubmittedAt().toString() : null);
        return response;
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

    private String getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetails) {
            return ((UserDetails) principal).getUsername();
        }
        return principal != null ? principal.toString() : null;
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
