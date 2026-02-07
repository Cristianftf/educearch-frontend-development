package com.uci.competencia.service.impl;

import com.uci.competencia.model.dto.response.ActivityDTO;
import com.uci.competencia.model.dto.response.StudentProgressDTO;
import com.uci.competencia.model.entity.CompetencyProgress;
import com.uci.competencia.model.entity.SearchSession;
import com.uci.competencia.model.entity.VerificationResult;
import com.uci.competencia.repository.CompetencyProgressRepository;
import com.uci.competencia.repository.BibliographyRepository;
import com.uci.competencia.repository.CaseSubmissionRepository;
import com.uci.competencia.repository.SearchSessionRepository;
import com.uci.competencia.repository.VerificationResultRepository;
import com.uci.competencia.service.ProgressService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

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

    private static final int RECENT_ACTIVITY_LIMIT = 10;

    @Override
    public StudentProgressDTO getStudentProgress(String studentId) {
        log.debug("Fetching progress for student: {}", studentId);

        // Obtener datos de competencia del estudiante
        CompetencyProgress competencyProgress = competencyProgressRepository
            .findByStudentId(studentId)
            .orElse(createDefaultProgress(studentId));

        // Crear el DTO de respuesta
        StudentProgressDTO dto = new StudentProgressDTO();
        dto.setStudentId(studentId);
        dto.setUserId(studentId);

        // Construir mapa de competencias con valores Double
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

        // Calcular progreso general
        Double overallProgress = competencies.values().stream()
            .map(StudentProgressDTO.CompetencyProgressDTO::getScore)
            .filter(Objects::nonNull)
            .mapToDouble(Double::doubleValue)
            .average()
            .orElse(0.0);
        dto.setOverallProgress(overallProgress);

        // Totales de actividades
        Map<String, Integer> activityStats = new HashMap<>();
        int totalSearches = competencyProgress.getTotalSearches() != null ? competencyProgress.getTotalSearches() : 0;
        int totalVerifications = competencyProgress.getTotalVerifications() != null ? competencyProgress.getTotalVerifications() : 0;
        int totalBibliographies = competencyProgress.getBibliographiesGenerated() != null ? competencyProgress.getBibliographiesGenerated() : 0;

        activityStats.put("searches", totalSearches);
        activityStats.put("verifications", totalVerifications);
        activityStats.put("bibliographies", totalBibliographies);
        dto.setActivityStats(activityStats);
        dto.setTotalSearches(totalSearches);
        dto.setTotalVerifications(totalVerifications);
        dto.setTotalBibliographies(totalBibliographies);
        dto.setRecentActivities(buildRecentActivities(studentId));

        // Casos completados (por defecto 0 hasta que se implemente)
        dto.setCasesCompleted(0);
        dto.setTotalCases(0);
        
        // Promedio de calificaciones y horas
        dto.setAverageGrade(0.0);
        dto.setHoursSpent(0.0);

        // Recomendaciones (por ahora vacía, puede expandirse)
        dto.setRecommendations(new ArrayList<>());

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


    /**
     * Crea un progreso por defecto para estudiantes sin datos
     */
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
                    "Bibliograf\u00eda generada: " + safeText(bib.getName(), "Sin t\u00edtulo"),
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
        String query = safeText(session.getOriginalQuery(), "b\u00fasqueda");
        return "B\u00fasqueda ejecutada: " + truncate(query, 60);
    }

    private String buildVerificationDescription(VerificationResult result) {
        String claim = safeText(result.getClaimText(), "verificaci\u00f3n");
        return "Verificaci\u00f3n realizada: " + truncate(claim, 60);
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
