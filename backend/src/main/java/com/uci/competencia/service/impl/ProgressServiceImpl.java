package com.uci.competencia.service.impl;

import com.uci.competencia.model.dto.response.ActivityDTO;
import com.uci.competencia.model.dto.response.StudentProgressDTO;
import com.uci.competencia.model.entity.CaseStudy;
import com.uci.competencia.model.entity.CaseSubmission;
import com.uci.competencia.model.entity.CompetencyProgress;
import com.uci.competencia.model.entity.Evaluation;
import com.uci.competencia.model.entity.SearchSession;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.entity.VerificationResult;
import com.uci.competencia.model.enums.SubmissionStatus;
import com.uci.competencia.repository.BibliographyRepository;
import com.uci.competencia.repository.CaseStudyRepository;
import com.uci.competencia.repository.CaseSubmissionRepository;
import com.uci.competencia.repository.CompetencyProgressRepository;
import com.uci.competencia.repository.EvaluationRepository;
import com.uci.competencia.repository.SearchSessionRepository;
import com.uci.competencia.repository.UserRepository;
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
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
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

    @Autowired
    private UserRepository userRepository;

    private static final int RECENT_ACTIVITY_LIMIT = 10;

    @Override
    public StudentProgressDTO getStudentProgress(String studentId) {
        log.debug("Fetching progress for student: {}", studentId);

        Set<String> studentIdentifiers = resolveUserIdentifiers(studentId);
        String canonicalStudentId = resolveCanonicalUserId(studentId);
        Set<String> sessionUserIds = resolveEntityUserIds(studentIdentifiers);

        if (studentIdentifiers.isEmpty() && canonicalStudentId != null && !canonicalStudentId.isBlank()) {
            studentIdentifiers = new LinkedHashSet<>();
            studentIdentifiers.add(canonicalStudentId);
        }
        if (sessionUserIds.isEmpty() && canonicalStudentId != null && !canonicalStudentId.isBlank()) {
            sessionUserIds = new LinkedHashSet<>();
            sessionUserIds.add(canonicalStudentId);
        }

        CompetencyProgress competencyProgress = loadCompetencyProgress(canonicalStudentId, studentIdentifiers)
            .orElse(createDefaultProgress(canonicalStudentId));

        StudentProgressDTO dto = new StudentProgressDTO();
        dto.setStudentId(canonicalStudentId);
        dto.setUserId(canonicalStudentId);

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

        int totalSearches = countSearches(sessionUserIds);
        int totalVerifications = countVerifications(sessionUserIds);
        int totalBibliographies = countBibliographies(studentIdentifiers);

        if (totalSearches == 0 && competencyProgress.getTotalSearches() != null) {
            totalSearches = competencyProgress.getTotalSearches();
        }
        if (totalVerifications == 0 && competencyProgress.getTotalVerifications() != null) {
            totalVerifications = competencyProgress.getTotalVerifications();
        }
        if (totalBibliographies == 0 && competencyProgress.getBibliographiesGenerated() != null) {
            totalBibliographies = competencyProgress.getBibliographiesGenerated();
        }

        List<CaseSubmission> submissions = loadSubmissions(studentIdentifiers);
        int totalCases = countAssignedCases(studentIdentifiers);
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
        dto.setRecentActivities(buildRecentActivities(studentIdentifiers, sessionUserIds, submissions));

        dto.setCasesCompleted(casesCompleted);
        dto.setTotalCases(totalCases);
        dto.setAverageGrade(calculateAverageGrade(submissions));
        dto.setHoursSpent(calculateHoursSpent(sessionUserIds));
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

    private Optional<CompetencyProgress> loadCompetencyProgress(String canonicalStudentId, Set<String> studentIdentifiers) {
        LinkedHashSet<String> candidateIds = new LinkedHashSet<>();
        if (canonicalStudentId != null && !canonicalStudentId.isBlank()) {
            candidateIds.add(canonicalStudentId);
        }
        candidateIds.addAll(resolveEntityUserIds(studentIdentifiers));

        for (String candidateId : candidateIds) {
            Optional<CompetencyProgress> progress = competencyProgressRepository.findByStudentId(candidateId);
            if (progress.isPresent()) {
                return progress;
            }
        }
        return Optional.empty();
    }

    private int countSearches(Set<String> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return 0;
        }
        long total = 0L;
        for (String userId : userIds) {
            total += searchSessionRepository.countByUser_Id(userId);
        }
        return (int) Math.min(Integer.MAX_VALUE, total);
    }

    private int countVerifications(Set<String> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return 0;
        }
        long total = 0L;
        for (String userId : userIds) {
            total += verificationResultRepository.countByUser_Id(userId);
        }
        return (int) Math.min(Integer.MAX_VALUE, total);
    }

    private int countBibliographies(Set<String> userIdentifiers) {
        if (userIdentifiers == null || userIdentifiers.isEmpty()) {
            return 0;
        }
        long total = 0L;
        for (String identifier : userIdentifiers) {
            total += bibliographyRepository.countByUserId(identifier);
        }
        return (int) Math.min(Integer.MAX_VALUE, total);
    }

    private List<CaseSubmission> loadSubmissions(Set<String> userIdentifiers) {
        if (userIdentifiers == null || userIdentifiers.isEmpty()) {
            return List.of();
        }

        Map<String, CaseSubmission> submissionsById = new LinkedHashMap<>();
        for (String identifier : userIdentifiers) {
            List<CaseSubmission> submissions = caseSubmissionRepository.findByStudentId(identifier);
            for (CaseSubmission submission : submissions) {
                if (submission == null || submission.getId() == null) {
                    continue;
                }
                submissionsById.putIfAbsent(submission.getId(), submission);
            }
        }

        return submissionsById.values().stream()
            .sorted(Comparator.comparing(
                CaseSubmission::getSubmittedAt,
                Comparator.nullsLast(Comparator.reverseOrder())
            ))
            .collect(Collectors.toList());
    }

    private int countAssignedCases(Set<String> userIdentifiers) {
        if (userIdentifiers == null || userIdentifiers.isEmpty()) {
            return 0;
        }

        Set<String> caseIds = new LinkedHashSet<>();
        for (String identifier : userIdentifiers) {
            List<CaseStudy> cases = caseStudyRepository.findByAssignedStudent(identifier);
            for (CaseStudy caseStudy : cases) {
                if (caseStudy == null || caseStudy.getId() == null || caseStudy.getId().isBlank()) {
                    continue;
                }
                caseIds.add(caseStudy.getId());
            }
        }
        return caseIds.size();
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

    private double calculateHoursSpent(Set<String> searchUserIds) {
        List<SearchSession> sessions = loadSearchSessions(searchUserIds);
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

    private List<ActivityDTO> buildRecentActivities(
        Set<String> studentIdentifiers,
        Set<String> searchUserIds,
        List<CaseSubmission> submissions
    ) {
        List<ActivityEntry> entries = new ArrayList<>();

        loadSearchSessions(searchUserIds).stream()
            .limit(RECENT_ACTIVITY_LIMIT * 2L)
            .forEach(session -> {
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
        for (String userId : safeCollection(searchUserIds)) {
            verificationResultRepository.findByUser_Id(userId, verificationPage).forEach(result -> {
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
        }

        var bibliographyPage = PageRequest.of(0, RECENT_ACTIVITY_LIMIT, Sort.by(Sort.Direction.DESC, "createdAt"));
        for (String identifier : safeCollection(studentIdentifiers)) {
            bibliographyRepository.findByUserIdOrderByCreatedAtDesc(identifier, bibliographyPage).forEach(bib -> {
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
        }

        submissions.stream()
            .limit(RECENT_ACTIVITY_LIMIT * 2L)
            .forEach(submission -> {
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

    private List<SearchSession> loadSearchSessions(Set<String> searchUserIds) {
        if (searchUserIds == null || searchUserIds.isEmpty()) {
            return List.of();
        }
        return searchSessionRepository.findByUser_IdInOrderByStartedAtDesc(searchUserIds);
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

    private Set<String> resolveUserIdentifiers(String userIdentifier) {
        LinkedHashSet<String> identifiers = new LinkedHashSet<>();
        if (userIdentifier == null || userIdentifier.isBlank()) {
            return identifiers;
        }

        identifiers.add(userIdentifier.trim());
        findUserByIdentifier(userIdentifier).ifPresent(user -> addUserIdentifiers(identifiers, user));
        return identifiers;
    }

    private Set<String> resolveEntityUserIds(Set<String> identifiers) {
        LinkedHashSet<String> userIds = new LinkedHashSet<>();
        if (identifiers == null || identifiers.isEmpty()) {
            return userIds;
        }
        for (String identifier : identifiers) {
            findUserByIdentifier(identifier)
                .map(User::getId)
                .ifPresentOrElse(userIds::add, () -> userIds.add(identifier));
        }
        return userIds;
    }

    private String resolveCanonicalUserId(String userIdentifier) {
        if (userIdentifier == null || userIdentifier.isBlank()) {
            return userIdentifier;
        }
        return findUserByIdentifier(userIdentifier)
            .map(User::getId)
            .orElse(userIdentifier.trim());
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

    private void addUserIdentifiers(Set<String> target, User user) {
        if (target == null || user == null) {
            return;
        }
        if (user.getId() != null && !user.getId().isBlank()) {
            target.add(user.getId());
        }
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            target.add(user.getEmail());
        }
        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            target.add(user.getUsername());
        }
    }

    private Collection<String> safeCollection(Set<String> values) {
        return values != null ? values : Set.of();
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
