package com.uci.competencia.service;

import com.uci.competencia.model.dto.request.VerificationRequestDTO;
import com.uci.competencia.model.dto.response.VerificationResponseDTO;

import java.util.List;

public interface VerificationService {
    VerificationResponseDTO verifyClaim(VerificationRequestDTO request);
    VerificationResponseDTO getVerificationResult(String verificationId);
    List<VerificationResponseDTO> getVerificationHistory(String userId, int page, int limit);
}
