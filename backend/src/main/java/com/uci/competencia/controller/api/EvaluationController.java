package com.uci.competencia.controller.api;

import com.uci.competencia.model.dto.response.EvaluationDTO;
import com.uci.competencia.model.entity.Evaluation;
import com.uci.competencia.service.EvaluationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Controlador REST para gestión de evaluaciones
 */
@RestController
@RequestMapping("/api/evaluations")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001", "https://frontend.uci.cu"})
@RequiredArgsConstructor
@Slf4j
public class EvaluationController {

    private final EvaluationService evaluationService;

    /**
     * GET /api/evaluations/pending
     * Obtener evaluaciones pendientes para un profesor
     */
    @GetMapping("/pending")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<Map<String, Object>> getPendingEvaluations() {
        log.info("Getting pending evaluations for professor");
        
        try {
            String professorId = getProfessorIdFromContext();
            List<Map<String, Object>> pending = evaluationService.getPendingEvaluations(professorId);

            Map<String, Object> response = new HashMap<>();
            response.put("evaluations", pending);
            response.put("count", pending.size());
            response.put("timestamp", System.currentTimeMillis());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error getting pending evaluations: {}", e.getMessage());
            return buildErrorResponse("Error getting pending evaluations", e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * POST /api/evaluations/{submissionId}
     * Crear una nueva evaluación
     */
    @PostMapping("/{submissionId}")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<?> createEvaluation(
            @PathVariable String submissionId,
            @RequestBody Map<String, Object> evaluationData) {
        log.info("Creating evaluation for submission: {}", submissionId);

        try {
            String professorId = getProfessorIdFromContext();
            Evaluation evaluation = evaluationService.createEvaluation(submissionId, professorId, evaluationData);

            EvaluationDTO dto = convertToDTO(evaluation);
            Map<String, Object> response = new HashMap<>();
            response.put("evaluation", dto);
            response.put("message", "Evaluación creada exitosamente");
            response.put("timestamp", System.currentTimeMillis());

            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (RuntimeException e) {
            log.warn("Validation error creating evaluation: {}", e.getMessage());
            return buildErrorResponse("Error creating evaluation", e.getMessage(), HttpStatus.BAD_REQUEST);
        } catch (Exception e) {
            log.error("Error creating evaluation: {}", e.getMessage());
            return buildErrorResponse("Error creating evaluation", e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * GET /api/evaluations/submission/{submissionId}
     * Obtener evaluación de una submission
     */
    @GetMapping("/submission/{submissionId}")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<?> getEvaluationBySubmission(@PathVariable String submissionId) {
        log.info("Getting evaluation for submission: {}", submissionId);

        try {
            EvaluationDTO evaluation = evaluationService.getEvaluationBySubmission(submissionId);

            Map<String, Object> response = new HashMap<>();
            response.put("evaluation", evaluation);
            response.put("timestamp", System.currentTimeMillis());

            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            log.warn("Evaluation not found for submission: {}", submissionId);
            return buildErrorResponse("Evaluation not found", e.getMessage(), HttpStatus.NOT_FOUND);
        } catch (Exception e) {
            log.error("Error getting evaluation: {}", e.getMessage());
            return buildErrorResponse("Error getting evaluation", e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * PUT /api/evaluations/{evaluationId}
     * Actualizar una evaluación
     */
    @PutMapping("/{evaluationId}")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<?> updateEvaluation(
            @PathVariable String evaluationId,
            @RequestBody Map<String, Object> evaluationData) {
        log.info("Updating evaluation: {}", evaluationId);

        try {
            Evaluation evaluation = evaluationService.updateEvaluation(evaluationId, evaluationData);

            EvaluationDTO dto = convertToDTO(evaluation);
            Map<String, Object> response = new HashMap<>();
            response.put("evaluation", dto);
            response.put("message", "Evaluación actualizada exitosamente");
            response.put("timestamp", System.currentTimeMillis());

            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            log.warn("Evaluation not found: {}", evaluationId);
            return buildErrorResponse("Evaluation not found", e.getMessage(), HttpStatus.NOT_FOUND);
        } catch (Exception e) {
            log.error("Error updating evaluation: {}", e.getMessage());
            return buildErrorResponse("Error updating evaluation", e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * DELETE /api/evaluations/{evaluationId}
     * Eliminar una evaluación
     */
    @DeleteMapping("/{evaluationId}")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<?> deleteEvaluation(@PathVariable String evaluationId) {
        log.info("Deleting evaluation: {}", evaluationId);

        try {
            evaluationService.deleteEvaluation(evaluationId);

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Evaluación eliminada exitosamente");
            response.put("timestamp", System.currentTimeMillis());

            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            log.warn("Evaluation not found: {}", evaluationId);
            return buildErrorResponse("Evaluation not found", e.getMessage(), HttpStatus.NOT_FOUND);
        } catch (Exception e) {
            log.error("Error deleting evaluation: {}", e.getMessage());
            return buildErrorResponse("Error deleting evaluation", e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * GET /api/evaluations
     * Obtener todas las evaluaciones del profesor
     */
    @GetMapping
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<?> getMyEvaluations() {
        log.info("Getting all evaluations for professor");

        try {
            String professorId = getProfessorIdFromContext();
            List<EvaluationDTO> evaluations = evaluationService.getProfessorEvaluations(professorId);

            Map<String, Object> response = new HashMap<>();
            response.put("evaluations", evaluations);
            response.put("count", evaluations.size());
            response.put("timestamp", System.currentTimeMillis());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error getting evaluations: {}", e.getMessage());
            return buildErrorResponse("Error getting evaluations", e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Helper para obtener profesor ID del contexto
     */
    private String getProfessorIdFromContext() {
        // En producción, obtener del contexto de seguridad
        // Por ahora retornar un ID de ejemplo
        return "professor_context_id";
    }

    /**
     * Helper para convertir Evaluation a DTO
     */
    private EvaluationDTO convertToDTO(Evaluation evaluation) {
        return EvaluationDTO.builder()
                .id(evaluation.getId())
                .submissionId(evaluation.getSubmissionId())
                .professorId(evaluation.getProfessorId())
                .overallScore(evaluation.getOverallScore())
                .feedback(evaluation.getFeedback())
                .evaluatedAt(evaluation.getEvaluatedAt())
                .updatedAt(evaluation.getUpdatedAt())
                .build();
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
