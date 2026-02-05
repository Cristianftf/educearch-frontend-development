package com.uci.competencia.controller.api;

import com.uci.competencia.service.EvaluationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Controlador REST para gestión de submissions
 */
@RestController
@RequestMapping("/api/submissions")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001", "https://frontend.uci.cu"})
@RequiredArgsConstructor
@Slf4j
public class SubmissionController {

    private final EvaluationService evaluationService;

    /**
     * GET /api/submissions/{submissionId}
     * Obtener una submission por ID
     */
    @GetMapping("/{submissionId}")
    @PreAuthorize("hasRole('PROFESSOR') or hasRole('STUDENT')")
    public ResponseEntity<?> getSubmissionById(@PathVariable String submissionId) {
        log.info("Getting submission: {}", submissionId);

        try {
            Map<String, Object> submission = evaluationService.getSubmissionById(submissionId);

            Map<String, Object> response = new HashMap<>();
            response.put("submission", submission);
            response.put("timestamp", System.currentTimeMillis());

            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            log.warn("Submission not found: {}", submissionId);
            return buildErrorResponse("Submission not found", e.getMessage(), HttpStatus.NOT_FOUND);
        } catch (Exception e) {
            log.error("Error getting submission: {}", e.getMessage());
            return buildErrorResponse("Error getting submission", e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Helper para construir respuestas de error
     */
    private ResponseEntity<Map<String, Object>> buildErrorResponse(String error, String message, HttpStatus status) {
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", error);
        errorResponse.put("message", message);
        errorResponse.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.status(status).body(errorResponse);
    }
}
