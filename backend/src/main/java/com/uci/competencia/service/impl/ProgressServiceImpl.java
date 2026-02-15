package com.uci.competencia.service.impl;

import com.uci.competencia.model.dto.response.ActivityDTO;
import com.uci.competencia.model.dto.response.StudentProgressDTO;
import com.uci.competencia.model.entity.CaseSubmission;
import com.uci.competencia.model.entity.CompetencyProgress;
import com.uci.competencia.model.entity.Evaluation;
import com.uci.competencia.model.entity.SearchSession;
import com.uci.competencia.model.entity.VerificationResult;
import com.uci.competencia.model.enums.SubmissionStatus;
import com.uci.competencia.repository.BibliographyRepository;
import com.uci.competencia.repository.CaseStudyRepository;
import com.uci.competencia.repository.CaseSubmissionRepository;
import com.uci.competencia.repository.CompetencyProgressRepository;
import com.uci.competencia.repository.EvaluationRepository;
import com.uci.competencia.repository.SearchSessionRepository;
import com.uci.competencia.repository.VerificationResultRepository;
import com.uci.competencia.service.ProgressService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Slf4j
public class ProgressServiceImpl implements ProgressService {

    @Autowired
    private CompetencyProgressRepository competencyProgressRepository;

    @Autowired
    private SearchSessionRepository searchSessionRepository;

    @Autowired
    private VerificationResultRepository verificationResultRepository;

    @Autowired
    private BibliographyRepository bibliographyRepository;

    @Autowired
    private CaseSubmissionRepository caseSubmissionRepository;

    @Autowired
    private CaseStudyRepository caseStudyRepository;

    @Autowired
    private EvaluationRepository evaluationRepository;

    private static final int RECENT_ACTIVITY_LIMIT = 10;

    @Override
    public StudentProgressDTO getStudentProgress(String studentId) {
        log.debug("Fetching progress for student: {}", studentId);

        CompetencyProgress competencyProgress = competencyProgressRepository
            .findByStudentId(studentId)
            .orElse(createDefaultProgress(studentId));

        StudentProgressDTO dto = new StudentProgressDTO();
        dto.setStudentId(studentId);
        dto.setUserId(studentId);

        Map<String, StudentProgressDTO.CompetencyProgressDTO> competencies = new HashMap<>();
        competencies.put(
            "access",
            toCompetencyProgress("access", competencyProgress.getAccessScore(), competencyProgress.getLastUpdated())
        );
        competencies.put(
            "process",
            toCompetencyProgress("process", competencyProgress.getProcessingScore(), competencyProgress.getLastUpdated())
        );
        competencies.put(
            "communicate",
            toCompetencyProgress("communicate", competencyProgress.getCommunicationScore(), competencyProgress.getLastUpdated())
        );

        dto.setCompetencies(competencies);

        Double overallProgress = competencies.values().stream()
            .map(StudentProgressDTO.CompetencyProgressDTO::getScore)
            .filter(Objects::nonNull)
            .mapToDouble(Double::doubleValue)
            .average()
            .orElse(0.0);
        dto.setOverallProgress(overallProgress);

        int totalSearches = Math.toIntExact(searchSessionRepository.countByUser_Id(studentId));
        int totalVerifications = Math.toIntExact(verificationResultRepository.countByUser_Id(studentId));
        int totalBibliographies = Math.toIntExact(bibliographyRepository.countByUserId(studentId));

        if (totalSearches == 0 && competencyProgress.getTotalSearches() != null) {
            totalSearches = competencyProgress.getTotalSearches();
        }
        if (totalVerifications == 0 && competencyProgress.getTotalVerifications() != null) {
            totalVerifications = competencyProgress.getTotalVerifications();
        }
        if (totalBibliographies == 0 && competencyProgress.getBibliographiesGenerated() != null) {
            totalBibliographies = competencyProgress.getBibliographiesGenerated();
        }

        List<CaseSubmission> submissions = caseSubmissionRepository.findByStudentId(studentId);
        int totalCases = caseStudyRepository.findByAssignedStudent(studentId).size();
        int casesCompleted = (int) submissions.stream()
            .filter(submission -> submission.getStatus() == SubmissionStatus.REVIEWED
                || submission.getStatus() == SubmissionStatus.EVALUATED)
            .map(CaseSubmission::getCaseId)
            .filter(Objects::nonNull)
            .distinct()
            .count();

        Map<String, Integer> activityStats = new HashMap<>();
        activityStats.put("searches", totalSearches);
        activityStats.put("verifications", totalVerifications);
        activityStats.put("bibliographies", totalBibliographies);
        activityStats.put("casesCompleted", casesCompleted);
        activityStats.put("casesAssigned", totalCases);

        dto.setActivityStats(activityStats);
        dto.setTotalSearches(totalSearches);
        dto.setTotalVerifications(totalVerifications);
        dto.setTotalBibliographies(totalBibliographies);
        dto.setRecentActivities(buildRecentActivities(studentId));

        dto.setCasesCompleted(casesCompleted);
        dto.setTotalCases(totalCases);
        dto.setAverageGrade(calculateAverageGrade(submissions));
        dto.setHoursSpent(calculateHoursSpent(studentId));
        dto.setRecommendations(buildRecommendations(competencies, totalCases, casesCompleted, totalSearches));

        log.debug("Student progress retrieved successfully for: {}", studentId);
        return dto;
    }

    @Override
    public String calculateLevel(Double score) {
        if (score == null) {
            return "novice";
        }
        if (score >= 75) {
            return "advanced";
        } else if (score >= 50) {
            return "intermediate";
        } else {
            return "novice";
        }
    }

    private CompetencyProgress createDefaultProgress(String studentId) {
        CompetencyProgress progress = new CompetencyProgress();
        progress.setAccessScore(0.0);
        progress.setProcessingScore(0.0);
        progress.setCommunicationScore(0.0);
        progress.setTotalSearches(0);
        progress.setTotalVerifications(0);
        progress.setBibliographiesGenerated(0);
        progress.setLastUpdated(LocalDateTime.now());
        return progress;
    }

    private StudentProgressDTO.CompetencyProgressDTO toCompetencyProgress(
        String type,
        Double score,
        LocalDateTime lastUpdated
    ) {
        double normalizedScore = score != null ? score : 0.0;
        return new StudentProgressDTO.CompetencyProgressDTO(
            type,
            normalizedScore,
            calculateLevel(normalizedScore),
            lastUpdated != null ? lastUpdated.toString() : null
        );
    }

    private double calculateAverageGrade(List<CaseSubmission> submissions) {
        if (submissions == null || submissions.isEmpty()) {
            return 0.0;
        }

        List<String> submissionIds = submissions.stream()
            .map(CaseSubmission::getId)
            .filter(Objects::nonNull)
            .toList();

        if (submissionIds.isEmpty()) {
            return 0.0;
        }

        List<Evaluation> evaluations = evaluationRepository.findBySubmissionIdIn(submissionIds);
        if (evaluations.isEmpty()) {
            return 0.0;
        }

        return evaluations.stream()
            .map(Evaluation::getOverallScore)
            .filter(Objects::nonNull)
            .mapToInt(Integer::intValue)
            .average()
            .orElse(0.0);
    }

    private double calculateHoursSpent(String studentId) {
        PageRequest page = PageRequest.of(0, 200, Sort.by(Sort.Direction.DESC, "startedAt"));
        List<SearchSession> sessions = searchSessionRepository.findByUser_Id(studentId, page).getContent();
        if (sessions.isEmpty()) {
            return 0.0;
        }

        double minutes = 0.0;
        for (SearchSession session : sessions) {
            LocalDateTime start = session.getStartedAt();
            LocalDateTime end = session.getCompletedAt();
            if (start == null || end == null || end.isBefore(start)) {
                continue;
            }
            long sessionMinutes = Duration.between(start, end).toMinutes();
            if (sessionMinutes < 0) {
                continue;
            }
            // Avoid unrealistic outliers
            minutes += Math.min(sessionMinutes, 240);
        }
        return Math.round((minutes / 60.0) * 100.0) / 100.0;
    }

    private List<String> buildRecommendations(
        Map<String, StudentProgressDTO.CompetencyProgressDTO> competencies,
        int totalCases,
        int casesCompleted,
        int totalSearches
    ) {
        List<String> recommendations = new ArrayList<>();
        if (competencies.get("access") != null && competencies.get("access").getScore() < 60) {
            recommendations.add("Reforzar formulacion de estrategias de busqueda y uso de terminos MeSH.");
        }
        if (competencies.get("process") != null && competencies.get("process").getScore() < 60) {
            recommendations.add("Practicar evaluacion critica de evidencia y deteccion de sesgos.");
        }
        if (competencies.get("communicate") != null && competencies.get("communicate").getScore() < 60) {
            recommendations.add("Mejorar estructura del reporte y formato de citacion bibliografica.");
        }
        if (totalCases > 0 && casesCompleted == 0) {
            recommendations.add("Priorizar la entrega del primer caso asignado para activar seguimiento docente.");
        }
        if (totalSearches == 0) {
            recommendations.add("Realizar busquedas guiadas para iniciar historial de aprendizaje.");
        }
        return recommendations;
    }

    private List<ActivityDTO> buildRecentActivities(String studentId) {
        List<ActivityEntry> entries = new ArrayList<>();

        PageRequest page = PageRequest.of(0, RECENT_ACTIVITY_LIMIT, Sort.by(Sort.Direction.DESC, "startedAt"));
        searchSessionRepository.findByUser_Id(studentId, page).forEach(session -> {
            LocalDateTime timestamp = session.getCompletedAt() != null ? session.getCompletedAt() : session.getStartedAt();
            entries.add(new ActivityEntry(
                new ActivityDTO(
                    session.getId(),
                    "search",
                    buildSearchDescription(session),
                    toTimestamp(timestamp),
                    Map.of(
                        "resultsCount", session.getResultsCount() != null ? session.getResultsCount() : 0,
                        "query", safeText(session.getOriginalQuery(), "")
                    )
                ),
                timestamp
            ));
        });

        PageRequest verificationPage = PageRequest.of(0, RECENT_ACTIVITY_LIMIT, Sort.by(Sort.Direction.DESC, "submittedAt"));
        verificationResultRepository.findByUser_Id(studentId, verificationPage).forEach(result -> {
            LocalDateTime timestamp = result.getCompletedAt() != null ? result.getCompletedAt() : result.getSubmittedAt();
            entries.add(new ActivityEntry(
                new ActivityDTO(
                    result.getId(),
                    "verification",
                    buildVerificationDescription(result),
                    toTimestamp(timestamp),
                    Map.of(
                        "status", result.getStatus() != null ? result.getStatus().name().toLowerCase() : "pending",
                        "score", result.getOverallScore() != null ? result.getOverallScore() : 0.0
                    )
                ),
                timestamp
            ));
        });

        var bibliographyPage = PageRequest.of(0, RECENT_ACTIVITY_LIMIT, Sort.by(Sort.Direction.DESC, "createdAt"));
        bibliographyRepository.findByUserIdOrderByCreatedAtDesc(studentId, bibliographyPage).forEach(bib -> {
            LocalDateTime timestamp = bib.getCreatedAt();
            entries.add(new ActivityEntry(
                new ActivityDTO(
                    bib.getId(),
                    "export",
                    "Bibliografia generada: " + safeText(bib.getName(), "Sin titulo"),
                    toTimestamp(timestamp),
                    Map.of(
                        "format", safeText(bib.getFormat(), "apa"),
                        "articleCount", bib.getArticleCount() != null ? bib.getArticleCount() : 0
                    )
                ),
                timestamp
            ));
        });

        PageRequest submissionPage = PageRequest.of(0, RECENT_ACTIVITY_LIMIT, Sort.by(Sort.Direction.DESC, "submittedAt"));
        caseSubmissionRepository.findByStudentId(studentId, submissionPage).forEach(submission -> {
            LocalDateTime timestamp = submission.getSubmittedAt();
            entries.add(new ActivityEntry(
                new ActivityDTO(
                    submission.getId(),
                    "case_submission",
                    "Entrega de caso: " + safeText(submission.getCaseId(), "sin identificar"),
                    toTimestamp(timestamp),
                    Map.of(
                        "caseId", submission.getCaseId(),
                        "status", submission.getStatus() != null ? submission.getStatus().name().toLowerCase() : "pending"
                    )
                ),
                timestamp
            ));
        });

        entries.sort((a, b) -> b.timestamp.compareTo(a.timestamp));
        List<ActivityDTO> activities = new ArrayList<>();
        for (ActivityEntry entry : entries) {
            if (activities.size() >= RECENT_ACTIVITY_LIMIT) {
                break;
            }
            activities.add(entry.dto);
        }
        return activities;
    }

    private String buildSearchDescription(SearchSession session) {
        String query = safeText(session.getOriginalQuery(), "busqueda");
        return "Busqueda ejecutada: " + truncate(query, 60);
    }

    private String buildVerificationDescription(VerificationResult result) {
        String claim = safeText(result.getClaimText(), "verificacion");
        return "Verificacion realizada: " + truncate(claim, 60);
    }

    private String toTimestamp(LocalDateTime timestamp) {
        return (timestamp != null ? timestamp : LocalDateTime.now()).toString();
    }

    private String truncate(String value, int max) {
        if (value == null) {
            return "";
        }
        if (value.length() <= max) {
            return value;
        }
        return value.substring(0, Math.max(0, max - 3)) + "...";
    }

    private String safeText(String value, String fallback) {
        return value != null && !value.isBlank() ? value : fallback;
    }

    private static class ActivityEntry {
        private final ActivityDTO dto;
        private final LocalDateTime timestamp;

        private ActivityEntry(ActivityDTO dto, LocalDateTime timestamp) {
            this.dto = dto;
            this.timestamp = timestamp != null ? timestamp : LocalDateTime.now();
        }
    }
}

