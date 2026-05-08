package com.uci.competencia.controller.api;

import com.uci.competencia.exception.ResourceNotFoundException;
import com.uci.competencia.model.dto.response.EvaluationDTO;
import com.uci.competencia.model.entity.Evaluation;
import com.uci.competencia.service.EvaluationService;
import com.uci.competencia.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/evaluations")
@RequiredArgsConstructor
@Slf4j
public class EvaluationController {

    private final EvaluationService evaluationService;

    @GetMapping("/pending")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<Map<String, Object>> getPendingEvaluations() {
        log.info("Getting pending evaluations for professor");
        String professorId = SecurityUtils.getCurrentUserId();
        List<Map<String, Object>> pending = evaluationService.getPendingEvaluations(professorId);
        return ResponseEntity.ok(Map.of(
            "evaluations", pending,
            "count", pending.size(),
            "timestamp", System.currentTimeMillis()
        ));
    }

    @GetMapping("/reviewed")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<Map<String, Object>> getReviewedEvaluations() {
        log.info("Getting reviewed evaluations for professor");
        String professorId = SecurityUtils.getCurrentUserId();
        List<Map<String, Object>> reviewed = evaluationService.getReviewedEvaluations(professorId);
        return ResponseEntity.ok(Map.of(
            "evaluations", reviewed,
            "count", reviewed.size(),
            "timestamp", System.currentTimeMillis()
        ));
    }

    @PostMapping("/{submissionId}")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<Map<String, Object>> createEvaluation(
        @PathVariable String submissionId,
        @RequestBody Map<String, Object> evaluationData
    ) {
        log.info("Creating evaluation for submission: {}", submissionId);
        String professorId = SecurityUtils.getCurrentUserId();
        Evaluation evaluation = evaluationService.createEvaluation(submissionId, professorId, evaluationData);
        return ResponseEntity.status(201).body(Map.of(
            "evaluation", convertToDTO(evaluation),
            "message", "Evaluacion creada exitosamente",
            "timestamp", System.currentTimeMillis()
        ));
    }

    @GetMapping("/submission/{submissionId}")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<Map<String, Object>> getEvaluationBySubmission(@PathVariable String submissionId) {
        log.info("Getting evaluation for submission: {}", submissionId);
        EvaluationDTO evaluation = evaluationService.getEvaluationBySubmission(submissionId);
        if (evaluation == null) {
            throw new ResourceNotFoundException("Evaluation not found for submission: " + submissionId);
        }
        return ResponseEntity.ok(Map.of(
            "evaluation", evaluation,
            "timestamp", System.currentTimeMillis()
        ));
    }

    @PutMapping("/{evaluationId}")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<Map<String, Object>> updateEvaluation(
        @PathVariable String evaluationId,
        @RequestBody Map<String, Object> evaluationData
    ) {
        log.info("Updating evaluation: {}", evaluationId);
        Evaluation evaluation = evaluationService.updateEvaluation(evaluationId, evaluationData);
        return ResponseEntity.ok(Map.of(
            "evaluation", convertToDTO(evaluation),
            "message", "Evaluacion actualizada exitosamente",
            "timestamp", System.currentTimeMillis()
        ));
    }

    @DeleteMapping("/{evaluationId}")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<Map<String, Object>> deleteEvaluation(@PathVariable String evaluationId) {
        log.info("Deleting evaluation: {}", evaluationId);
        evaluationService.deleteEvaluation(evaluationId);
        return ResponseEntity.ok(Map.of(
            "message", "Evaluacion eliminada exitosamente",
            "timestamp", System.currentTimeMillis()
        ));
    }

    @GetMapping
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<Map<String, Object>> getMyEvaluations() {
        log.info("Getting all evaluations for professor");
        String professorId = SecurityUtils.getCurrentUserId();
        List<EvaluationDTO> evaluations = evaluationService.getProfessorEvaluations(professorId);
        return ResponseEntity.ok(Map.of(
            "evaluations", evaluations,
            "count", evaluations.size(),
            "timestamp", System.currentTimeMillis()
        ));
    }

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
}
