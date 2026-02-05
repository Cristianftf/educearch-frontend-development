package com.uci.competencia.service.impl;

import com.uci.competencia.model.dto.request.VerificationRequestDTO;
import com.uci.competencia.model.dto.response.VerificationResponseDTO;
import com.uci.competencia.model.entity.VerificationResult;
import com.uci.competencia.model.enums.VerificationStatus;
import com.uci.competencia.repository.VerificationResultRepository;
import com.uci.competencia.service.VerificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class VerificationServiceImpl implements VerificationService {

    private final VerificationResultRepository verificationResultRepository;

    @Override
    public VerificationResponseDTO verifyClaim(VerificationRequestDTO request) {
        log.info("Processing verification for claim: {}", request.getClaimText());

        VerificationResponseDTO response = new VerificationResponseDTO();
        response.setId("verify-" + System.currentTimeMillis());
        response.setStatus(VerificationStatus.PROCESSING.getValue());

        return response;
    }

    @Override
    public VerificationResponseDTO getVerificationResult(String verificationId) {
        log.info("Retrieving verification result: {}", verificationId);

        VerificationResponseDTO response = new VerificationResponseDTO();
        response.setId(verificationId);
        response.setStatus(VerificationStatus.COMPLETED.getValue());

        return response;
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
            Page<VerificationResult> resultPage = verificationResultRepository.findByUserId(userId, pageable);

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
        dto.setStatus(result.getStatus() != null ? result.getStatus().getValue() : "unknown");
        dto.setScore(result.getOverallScore() != null ? result.getOverallScore() : 0.0);
        dto.setVerifiedAt(result.getCompletedAt() != null ? result.getCompletedAt().toString() : 
                         result.getSubmittedAt() != null ? result.getSubmittedAt().toString() : null);
        dto.setVerdict(result.getVerdict() != null ? result.getVerdict().name() : null);
        dto.setConfidence(result.getConfidence());
        dto.setEvidenceCount(result.getEvidenceCount() != null ? result.getEvidenceCount() : 0);
        return dto;
    }
}
