package com.uci.competencia.controller.api;

import com.uci.competencia.exception.ResourceNotFoundException;
import com.uci.competencia.service.EvaluationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/submissions")
@RequiredArgsConstructor
@Slf4j
public class SubmissionController {

    private final EvaluationService evaluationService;

    @GetMapping("/{submissionId}")
    @PreAuthorize("hasRole('PROFESSOR') or hasRole('STUDENT')")
    public ResponseEntity<Map<String, Object>> getSubmissionById(@PathVariable String submissionId) {
        log.info("Getting submission: {}", submissionId);
        Map<String, Object> submission = evaluationService.getSubmissionById(submissionId);
        if (submission == null || submission.isEmpty()) {
            throw new ResourceNotFoundException("Submission not found: " + submissionId);
        }
        return ResponseEntity.ok(Map.of(
            "submission", submission,
            "timestamp", System.currentTimeMillis()
        ));
    }
}
