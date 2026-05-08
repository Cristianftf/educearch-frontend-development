package com.uci.competencia.controller.api;

import com.uci.competencia.model.dto.request.VerificationRequestDTO;
import com.uci.competencia.model.dto.response.VerificationResponseDTO;
import com.uci.competencia.security.UserIdentityResolver;
import com.uci.competencia.service.VerificationService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/verify")
@Slf4j
public class VerificationController {

    @Autowired
    private VerificationService verificationService;

    @Autowired
    private UserIdentityResolver userIdentityResolver;

    @PostMapping("/claim")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<VerificationResponseDTO> verifyClaim(@Valid @RequestBody VerificationRequestDTO request) {
        String claim = request.getClaimText();
        String sourceUrl = request.getSourceUrl();
        if ((claim == null || claim.isBlank()) && (sourceUrl == null || sourceUrl.isBlank())) {
            throw new IllegalArgumentException("Debes enviar un claim o una URL valida para verificar.");
        }
        log.info("Verifying claim: {}", claim != null ? claim : sourceUrl);
        VerificationResponseDTO response = verificationService.verifyClaim(request);
        return ResponseEntity.accepted().body(response);
    }

    @GetMapping("/result/{verificationId}")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<VerificationResponseDTO> getVerificationResult(@PathVariable String verificationId) {
        log.info("Getting verification result: {}", verificationId);
        VerificationResponseDTO response = verificationService.getVerificationResult(verificationId);
        return ResponseEntity.ok(response);
    }

    /**
     * Obtener ID del usuario autenticado
     */
    private String getCurrentUserId() {
        return userIdentityResolver.getCurrentPrincipalIdentifier()
            .map(userIdentityResolver::resolveCanonicalUserId)
            .orElse(null);
    }

    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<Map<String, Object>> getVerificationHistory(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit) {
        String userId = getCurrentUserId();
        log.info("Getting verification history for user: {}, page: {}, limit: {}", userId, page, limit);

        List<VerificationResponseDTO> verifications = verificationService.getVerificationHistory(userId, page, limit);

        Map<String, Object> response = new HashMap<>();
        response.put("verifications", verifications);
        response.put("total", verifications.size()); // Paginación: page y limit implementados en VerificationService

        return ResponseEntity.ok(response);
    }
}
