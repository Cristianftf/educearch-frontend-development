package com.uci.competencia.service.impl;

import com.uci.competencia.model.dto.response.EvaluationDTO;
import com.uci.competencia.model.entity.CaseSubmission;
import com.uci.competencia.model.entity.Evaluation;
import com.uci.competencia.model.enums.SubmissionStatus;
import com.uci.competencia.repository.CaseSubmissionRepository;
import com.uci.competencia.repository.EvaluationRepository;
import com.uci.competencia.service.EvaluationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class EvaluationServiceImpl implements EvaluationService {

    private final EvaluationRepository evaluationRepository;
    private final CaseSubmissionRepository caseSubmissionRepository;
    private final ObjectMapper objectMapper;

    @Override
    public List<Map<String, Object>> getPendingEvaluations(String professorId) {
        log.info("Getting pending evaluations for professor: {}", professorId);

        try {
            // Obtener todas las submissions pendientes
            List<CaseSubmission> pendingSubmissions = caseSubmissionRepository
                    .findByStatus(SubmissionStatus.PENDING);

            // Filtrar para no incluir evaluaciones ya realizadas
            List<Map<String, Object>> pendingEvaluations = pendingSubmissions.stream()
                    .filter(submission -> {
                        // Verificar si esta submission ya tiene evaluación
                        Optional<Evaluation> existing = evaluationRepository
                                .findBySubmissionId(submission.getId());
                        return existing.isEmpty();
                    })
                    .map(this::convertSubmissionToEvaluationMap)
                    .collect(Collectors.toList());

            log.info("Found {} pending evaluations for professor {}", pendingEvaluations.size(), professorId);
            return pendingEvaluations;

        } catch (Exception e) {
            log.error("Error getting pending evaluations for professor {}: {}", professorId, e.getMessage());
            throw new RuntimeException("Error getting pending evaluations: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public Evaluation createEvaluation(String submissionId, String professorId, Map<String, Object> evaluationData) {
        log.info("Creating evaluation for submission: {}, professor: {}", submissionId, professorId);

        try {
            // Verificar que la submission existe
            CaseSubmission submission = caseSubmissionRepository.findById(submissionId)
                    .orElseThrow(() -> new RuntimeException("Submission not found: " + submissionId));

            // Verificar que no existe evaluación previa
            Optional<Evaluation> existing = evaluationRepository.findBySubmissionId(submissionId);
            if (existing.isPresent()) {
                log.warn("Evaluation already exists for submission: {}", submissionId);
                throw new RuntimeException("Evaluation already exists for this submission");
            }

            // Crear nueva evaluación
            Evaluation evaluation = new Evaluation();
            evaluation.setSubmissionId(submissionId);
            evaluation.setProfessorId(professorId);

            // Extraer scores y comments del mapa
            if (evaluationData.containsKey("scores")) {
                String scoresJson = objectMapper.writeValueAsString(evaluationData.get("scores"));
                evaluation.setScores(scoresJson);
            }

            if (evaluationData.containsKey("comments")) {
                String commentsJson = objectMapper.writeValueAsString(evaluationData.get("comments"));
                evaluation.setComments(commentsJson);
            }

            // Obtener score general
            Object overallScoreObj = evaluationData.get("overallScore");
            if (overallScoreObj != null) {
                evaluation.setOverallScore(((Number) overallScoreObj).intValue());
            } else {
                evaluation.setOverallScore(0);
            }

            // Feedback
            if (evaluationData.containsKey("feedback")) {
                evaluation.setFeedback((String) evaluationData.get("feedback"));
            }

            evaluation.setEvaluatedAt(LocalDateTime.now());
            evaluation.setUpdatedAt(LocalDateTime.now());

            Evaluation saved = evaluationRepository.save(evaluation);

            // Actualizar estado de la submission a EVALUATED
            submission.setStatus(SubmissionStatus.EVALUATED);
            submission.setUpdatedAt(LocalDateTime.now());
            caseSubmissionRepository.save(submission);

            log.info("Evaluation created successfully: {}", saved.getId());
            return saved;

        } catch (Exception e) {
            log.error("Error creating evaluation: {}", e.getMessage());
            throw new RuntimeException("Error creating evaluation: " + e.getMessage());
        }
    }

    @Override
    public EvaluationDTO getEvaluationBySubmission(String submissionId) {
        log.info("Getting evaluation for submission: {}", submissionId);

        try {
            Evaluation evaluation = evaluationRepository.findBySubmissionId(submissionId)
                    .orElseThrow(() -> new RuntimeException("Evaluation not found for submission: " + submissionId));

            return convertToDTO(evaluation);

        } catch (Exception e) {
            log.error("Error getting evaluation for submission {}: {}", submissionId, e.getMessage());
            throw new RuntimeException("Error getting evaluation: " + e.getMessage());
        }
    }

    @Override
    public Map<String, Object> getSubmissionById(String submissionId) {
        log.info("Getting submission: {}", submissionId);

        try {
            CaseSubmission submission = caseSubmissionRepository.findById(submissionId)
                    .orElseThrow(() -> new RuntimeException("Submission not found: " + submissionId));

            return convertSubmissionToMap(submission);

        } catch (Exception e) {
            log.error("Error getting submission {}: {}", submissionId, e.getMessage());
            throw new RuntimeException("Error getting submission: " + e.getMessage());
        }
    }

    @Override
    public List<EvaluationDTO> getProfessorEvaluations(String professorId) {
        log.info("Getting all evaluations for professor: {}", professorId);

        try {
            List<Evaluation> evaluations = evaluationRepository.findByProfessorId(professorId);
            return evaluations.stream()
                    .map(this::convertToDTO)
                    .collect(Collectors.toList());

        } catch (Exception e) {
            log.error("Error getting professor evaluations: {}", e.getMessage());
            throw new RuntimeException("Error getting evaluations: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public Evaluation updateEvaluation(String evaluationId, Map<String, Object> evaluationData) {
        log.info("Updating evaluation: {}", evaluationId);

        try {
            Evaluation evaluation = evaluationRepository.findById(evaluationId)
                    .orElseThrow(() -> new RuntimeException("Evaluation not found: " + evaluationId));

            // Actualizar scores
            if (evaluationData.containsKey("scores")) {
                String scoresJson = objectMapper.writeValueAsString(evaluationData.get("scores"));
                evaluation.setScores(scoresJson);
            }

            // Actualizar comments
            if (evaluationData.containsKey("comments")) {
                String commentsJson = objectMapper.writeValueAsString(evaluationData.get("comments"));
                evaluation.setComments(commentsJson);
            }

            // Actualizar score general
            if (evaluationData.containsKey("overallScore")) {
                evaluation.setOverallScore(((Number) evaluationData.get("overallScore")).intValue());
            }

            // Actualizar feedback
            if (evaluationData.containsKey("feedback")) {
                evaluation.setFeedback((String) evaluationData.get("feedback"));
            }

            evaluation.setUpdatedAt(LocalDateTime.now());

            Evaluation updated = evaluationRepository.save(evaluation);
            log.info("Evaluation updated successfully: {}", evaluationId);
            return updated;

        } catch (Exception e) {
            log.error("Error updating evaluation: {}", e.getMessage());
            throw new RuntimeException("Error updating evaluation: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public void deleteEvaluation(String evaluationId) {
        log.info("Deleting evaluation: {}", evaluationId);

        try {
            Evaluation evaluation = evaluationRepository.findById(evaluationId)
                    .orElseThrow(() -> new RuntimeException("Evaluation not found: " + evaluationId));

            // Revertir status de submission a PENDING
            Optional<CaseSubmission> submission = caseSubmissionRepository.findById(evaluation.getSubmissionId());
            if (submission.isPresent()) {
                submission.get().setStatus(SubmissionStatus.PENDING);
                submission.get().setUpdatedAt(LocalDateTime.now());
                caseSubmissionRepository.save(submission.get());
            }

            evaluationRepository.deleteById(evaluationId);
            log.info("Evaluation deleted successfully: {}", evaluationId);

        } catch (Exception e) {
            log.error("Error deleting evaluation: {}", e.getMessage());
            throw new RuntimeException("Error deleting evaluation: " + e.getMessage());
        }
    }

    /**
     * Convierte una submission a un mapa de evaluación pendiente
     */
    private Map<String, Object> convertSubmissionToEvaluationMap(CaseSubmission submission) {
        Map<String, Object> map = new HashMap<>();
        map.put("submissionId", submission.getId());
        map.put("studentId", submission.getStudentId());
        map.put("caseId", submission.getCaseId());
        map.put("submittedAt", submission.getSubmittedAt());
        map.put("status", submission.getStatus());
        map.put("content", submission.getContent());
        map.put("selectedArticles", submission.getSelectedArticles());
        map.put("bibliography", submission.getBibliography());
        return map;
    }

    /**
     * Convierte una submission a un mapa
     */
    private Map<String, Object> convertSubmissionToMap(CaseSubmission submission) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", submission.getId());
        map.put("submissionId", submission.getId());
        map.put("studentId", submission.getStudentId());
        map.put("caseId", submission.getCaseId());
        map.put("submittedAt", submission.getSubmittedAt());
        map.put("status", submission.getStatus());
        map.put("content", submission.getContent());
        map.put("selectedArticles", submission.getSelectedArticles());
        map.put("bibliography", submission.getBibliography());
        map.put("updatedAt", submission.getUpdatedAt());
        return map;
    }

    /**
     * Convierte una Evaluation a EvaluationDTO
     */
    private EvaluationDTO convertToDTO(Evaluation evaluation) {
        try {
            EvaluationDTO dto = new EvaluationDTO();
            dto.setId(evaluation.getId());
            dto.setSubmissionId(evaluation.getSubmissionId());
            dto.setProfessorId(evaluation.getProfessorId());

            // Parsear scores JSON a mapa
            if (evaluation.getScores() != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> scores = objectMapper.readValue(evaluation.getScores(), Map.class);
                dto.setScores(scores);
            }

            // Parsear comments JSON a mapa
            if (evaluation.getComments() != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> comments = objectMapper.readValue(evaluation.getComments(), Map.class);
                dto.setComments(comments);
            }

            dto.setOverallScore(evaluation.getOverallScore());
            dto.setFeedback(evaluation.getFeedback());
            dto.setEvaluatedAt(evaluation.getEvaluatedAt());
            dto.setUpdatedAt(evaluation.getUpdatedAt());

            return dto;
        } catch (Exception e) {
            log.error("Error converting evaluation to DTO: {}", e.getMessage());
            throw new RuntimeException("Error converting evaluation: " + e.getMessage());
        }
    }
}
