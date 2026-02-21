package com.uci.competencia.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.response.EvaluationDTO;
import com.uci.competencia.model.entity.CaseStudy;
import com.uci.competencia.model.entity.CaseSubmission;
import com.uci.competencia.model.entity.Evaluation;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.SubmissionStatus;
import com.uci.competencia.repository.CaseStudyRepository;
import com.uci.competencia.repository.CaseSubmissionRepository;
import com.uci.competencia.repository.EvaluationRepository;
import com.uci.competencia.repository.UserRepository;
import com.uci.competencia.service.EvaluationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class EvaluationServiceImpl implements EvaluationService {

    private final EvaluationRepository evaluationRepository;
    private final CaseSubmissionRepository caseSubmissionRepository;
    private final CaseStudyRepository caseStudyRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Override
    public List<Map<String, Object>> getPendingEvaluations(String professorId) {
        log.info("Getting pending evaluations for professor: {}", professorId);

        try {
            Set<String> professorCaseIds = resolveProfessorCaseIds(professorId);
            if (professorCaseIds.isEmpty()) {
                return List.of();
            }

            List<CaseSubmission> pendingSubmissions = caseSubmissionRepository.findByStatus(SubmissionStatus.PENDING);

            List<Map<String, Object>> pendingEvaluations = pendingSubmissions.stream()
                .filter(Objects::nonNull)
                .filter(submission -> professorCaseIds.contains(submission.getCaseId()))
                .filter(submission -> findEvaluationsBySubmissionId(submission.getId()).isEmpty())
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
    public List<Map<String, Object>> getReviewedEvaluations(String professorId) {
        log.info("Getting reviewed evaluations for professor: {}", professorId);

        try {
            List<Evaluation> evaluations = resolveProfessorIdentifiers(professorId).stream()
                .flatMap(identifier -> evaluationRepository.findByProfessorId(identifier).stream())
                .filter(Objects::nonNull)
                .collect(Collectors.toMap(
                    Evaluation::getId,
                    evaluation -> evaluation,
                    (existing, replacement) -> existing
                ))
                .values()
                .stream()
                .toList();

            List<Map<String, Object>> reviewed = evaluations.stream()
                .map(evaluation -> caseSubmissionRepository.findById(evaluation.getSubmissionId())
                    .map(submission -> {
                        Map<String, Object> map = convertSubmissionToEvaluationMap(submission);
                        map.put("evaluationId", evaluation.getId());
                        map.put("status", SubmissionStatus.REVIEWED.name().toLowerCase());
                        return map;
                    })
                    .orElse(null))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

            log.info("Found {} reviewed evaluations for professor {}", reviewed.size(), professorId);
            return reviewed;
        } catch (Exception e) {
            log.error("Error getting reviewed evaluations for professor {}: {}", professorId, e.getMessage());
            throw new RuntimeException("Error getting reviewed evaluations: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public Evaluation createEvaluation(String submissionId, String professorId, Map<String, Object> evaluationData) {
        log.info("Creating evaluation for submission: {}, professor: {}", submissionId, professorId);

        Set<String> professorIdentifiers = resolveProfessorIdentifiers(professorId);
        CaseSubmission submission = caseSubmissionRepository.findById(submissionId)
            .orElseThrow(() -> new RuntimeException("Submission not found: " + submissionId));

        if (!isSubmissionOwnedByProfessor(submission, professorIdentifiers)) {
            throw new RuntimeException("Submission does not belong to professor");
        }

        List<Evaluation> existingEvaluations = findEvaluationsBySubmissionId(submissionId);
        Evaluation evaluation = existingEvaluations.isEmpty()
            ? new Evaluation()
            : existingEvaluations.get(0);

        evaluation.setSubmissionId(submissionId);
        evaluation.setProfessorId(resolveCanonicalUserId(professorId));
        applyEvaluationData(evaluation, evaluationData);
        evaluation.setEvaluatedAt(LocalDateTime.now());
        evaluation.setUpdatedAt(LocalDateTime.now());

        Evaluation saved = evaluationRepository.save(evaluation);

        submission.setStatus(SubmissionStatus.REVIEWED);
        submission.setUpdatedAt(LocalDateTime.now());
        caseSubmissionRepository.save(submission);

        if (existingEvaluations.size() > 1) {
            log.warn(
                "Submission {} has {} existing evaluations; updated latest record {}",
                submissionId,
                existingEvaluations.size(),
                saved.getId()
            );
        }

        log.info("Evaluation saved successfully: {}", saved.getId());
        return saved;
    }

    @Override
    public EvaluationDTO getEvaluationBySubmission(String submissionId) {
        log.info("Getting evaluation for submission: {}", submissionId);

        Evaluation evaluation = findEvaluationsBySubmissionId(submissionId).stream()
            .findFirst()
            .orElseThrow(() -> new RuntimeException("Evaluation not found for submission: " + submissionId));
        return convertToDTO(evaluation);
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
            List<Evaluation> evaluations = resolveProfessorIdentifiers(professorId).stream()
                .flatMap(identifier -> evaluationRepository.findByProfessorId(identifier).stream())
                .filter(Objects::nonNull)
                .collect(Collectors.toMap(
                    Evaluation::getId,
                    evaluation -> evaluation,
                    (existing, replacement) -> existing
                ))
                .values()
                .stream()
                .toList();

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

            if (evaluationData.containsKey("scores")) {
                String scoresJson = objectMapper.writeValueAsString(evaluationData.get("scores"));
                evaluation.setScores(scoresJson);
            }

            if (evaluationData.containsKey("comments")) {
                String commentsJson = objectMapper.writeValueAsString(evaluationData.get("comments"));
                evaluation.setComments(commentsJson);
            }

            if (evaluationData.containsKey("overallScore")) {
                int score = parseScore(evaluationData.get("overallScore"));
                evaluation.setOverallScore(Math.max(0, Math.min(score, 100)));
            }

            if (evaluationData.containsKey("feedback")) {
                Object feedbackValue = evaluationData.get("feedback");
                evaluation.setFeedback(feedbackValue != null ? feedbackValue.toString() : null);
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

    private Map<String, Object> convertSubmissionToEvaluationMap(CaseSubmission submission) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", submission.getId());
        map.put("submissionId", submission.getId());
        map.put("studentId", submission.getStudentId());
        map.put("caseId", submission.getCaseId());
        map.put("submittedAt", submission.getSubmittedAt());
        map.put("status", submission.getStatus() != null ? submission.getStatus().name().toLowerCase() : "pending");
        map.put("content", submission.getContent());
        map.put("selectedArticles", readSelectedArticles(submission));
        map.put("bibliography", submission.getBibliography());
        return map;
    }

    private Map<String, Object> convertSubmissionToMap(CaseSubmission submission) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", submission.getId());
        map.put("submissionId", submission.getId());
        map.put("studentId", submission.getStudentId());
        map.put("caseId", submission.getCaseId());
        map.put("submittedAt", submission.getSubmittedAt());
        map.put("status", submission.getStatus() != null ? submission.getStatus().name().toLowerCase() : "pending");
        map.put("content", submission.getContent());
        map.put("selectedArticles", readSelectedArticles(submission));
        map.put("bibliography", submission.getBibliography());
        map.put("updatedAt", submission.getUpdatedAt());
        return map;
    }

    private EvaluationDTO convertToDTO(Evaluation evaluation) {
        try {
            EvaluationDTO dto = new EvaluationDTO();
            dto.setId(evaluation.getId());
            dto.setSubmissionId(evaluation.getSubmissionId());
            dto.setProfessorId(evaluation.getProfessorId());

            if (evaluation.getScores() != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> scores = objectMapper.readValue(evaluation.getScores(), Map.class);
                dto.setScores(scores);
            }

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

    private Set<String> resolveProfessorCaseIds(String professorIdentifier) {
        Set<String> caseIds = new LinkedHashSet<>();
        for (String identifier : resolveProfessorIdentifiers(professorIdentifier)) {
            List<CaseStudy> cases = caseStudyRepository.findByCreatedBy(identifier);
            for (CaseStudy caseStudy : cases) {
                if (caseStudy == null || caseStudy.getId() == null || caseStudy.getId().isBlank()) {
                    continue;
                }
                caseIds.add(caseStudy.getId());
            }
        }
        return caseIds;
    }

    private Set<String> resolveProfessorIdentifiers(String professorIdentifier) {
        if (professorIdentifier == null || professorIdentifier.isBlank()) {
            return Set.of();
        }

        LinkedHashSet<String> identifiers = new LinkedHashSet<>();
        identifiers.add(professorIdentifier.trim());

        findUserByIdentifier(professorIdentifier).ifPresent(user -> {
            if (user.getId() != null && !user.getId().isBlank()) {
                identifiers.add(user.getId());
            }
            if (user.getEmail() != null && !user.getEmail().isBlank()) {
                identifiers.add(user.getEmail());
            }
            if (user.getUsername() != null && !user.getUsername().isBlank()) {
                identifiers.add(user.getUsername());
            }
        });

        return identifiers;
    }

    private String resolveCanonicalUserId(String identifier) {
        return findUserByIdentifier(identifier)
            .map(User::getId)
            .orElse(identifier);
    }

    private Optional<User> findUserByIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return Optional.empty();
        }

        String normalized = identifier.trim();
        try {
            Optional<User> byId = userRepository.findById(normalized);
            if (byId.isPresent()) {
                return byId;
            }
        } catch (Exception e) {
            log.debug("Identifier {} is not a direct user ID", normalized);
        }

        Optional<User> byEmail = userRepository.findByEmail(normalized);
        if (byEmail.isPresent()) {
            return byEmail;
        }

        return userRepository.findByUsername(normalized);
    }

    private boolean isSubmissionOwnedByProfessor(CaseSubmission submission, Set<String> professorIdentifiers) {
        if (submission == null || submission.getCaseId() == null || submission.getCaseId().isBlank()) {
            return false;
        }
        if (professorIdentifiers == null || professorIdentifiers.isEmpty()) {
            return false;
        }

        return caseStudyRepository.findById(submission.getCaseId())
            .map(CaseStudy::getCreatedBy)
            .filter(Objects::nonNull)
            .filter(createdBy -> !createdBy.isBlank())
            .map(professorIdentifiers::contains)
            .orElse(false);
    }

    private List<String> readSelectedArticles(CaseSubmission submission) {
        if (submission == null) {
            return List.of();
        }
        try {
            List<String> selectedArticles = submission.getSelectedArticles();
            if (selectedArticles == null || selectedArticles.isEmpty()) {
                return List.of();
            }
            return new ArrayList<>(selectedArticles);
        } catch (Exception e) {
            log.debug("Could not read selected articles for submission {}", submission.getId(), e);
            return List.of();
        }
    }

    private int parseScore(Object value) {
        if (value instanceof Number number) {
            return (int) Math.round(number.doubleValue());
        }
        if (value instanceof String stringValue) {
            try {
                return (int) Math.round(Double.parseDouble(stringValue.trim()));
            } catch (NumberFormatException e) {
                throw new RuntimeException("Invalid overallScore value");
            }
        }
        throw new RuntimeException("Invalid overallScore value");
    }

    private void applyEvaluationData(Evaluation evaluation, Map<String, Object> evaluationData) {
        if (evaluation == null || evaluationData == null) {
            return;
        }

        try {
            if (evaluationData.containsKey("scores")) {
                String scoresJson = objectMapper.writeValueAsString(evaluationData.get("scores"));
                evaluation.setScores(scoresJson);
            }

            if (evaluationData.containsKey("comments")) {
                String commentsJson = objectMapper.writeValueAsString(evaluationData.get("comments"));
                evaluation.setComments(commentsJson);
            }
        } catch (Exception e) {
            throw new RuntimeException("Invalid evaluation payload");
        }

        Object overallScoreObj = evaluationData.get("overallScore");
        int overallScore = overallScoreObj != null ? parseScore(overallScoreObj) : 0;
        evaluation.setOverallScore(Math.max(0, Math.min(overallScore, 100)));

        if (evaluationData.containsKey("feedback")) {
            Object feedbackValue = evaluationData.get("feedback");
            evaluation.setFeedback(feedbackValue != null ? feedbackValue.toString() : null);
        }
    }

    private List<Evaluation> findEvaluationsBySubmissionId(String submissionId) {
        if (submissionId == null || submissionId.isBlank()) {
            return List.of();
        }
        return evaluationRepository.findBySubmissionIdIn(List.of(submissionId)).stream()
            .filter(Objects::nonNull)
            .sorted(Comparator.comparing(
                Evaluation::getUpdatedAt,
                Comparator.nullsLast(Comparator.reverseOrder())
            ))
            .toList();
    }
}
