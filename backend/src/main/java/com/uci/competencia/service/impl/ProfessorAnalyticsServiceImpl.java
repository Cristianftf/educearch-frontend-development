package com.uci.competencia.service.impl;

import com.uci.competencia.exception.ResourceNotFoundException;
import com.uci.competencia.model.dto.response.CaseStudyDTO;
import com.uci.competencia.model.dto.response.ProfessorAnalyticsDTO;
import com.uci.competencia.model.dto.response.StudentProgressDTO;
import com.uci.competencia.model.entity.CaseStudy;
import com.uci.competencia.model.entity.SearchSession;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.CaseDifficulty;
import com.uci.competencia.model.enums.CaseStatus;
import com.uci.competencia.repository.CaseStudyRepository;
import com.uci.competencia.repository.SearchSessionRepository;
import com.uci.competencia.security.UserIdentityResolver;
import com.uci.competencia.service.ProgressService;
import com.uci.competencia.service.ProfessorAnalyticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class ProfessorAnalyticsServiceImpl implements ProfessorAnalyticsService {

    private static final double LOW_PROGRESS_THRESHOLD = 60.0;
    private static final double PROBLEMATIC_ERROR_RATE_THRESHOLD = 0.25;
    private static final int MIN_OCCURRENCES_FOR_PROBLEMATIC = 2;
    private static final Pattern TERM_PATTERN = Pattern.compile("[\\p{L}\\p{N}]{3,}");
    private static final Set<String> STOP_WORDS = Set.of(
        "and", "or", "not", "the", "for", "with", "from", "that",
        "los", "las", "del", "con", "para", "por", "una", "uno", "unos", "unas",
        "de", "la", "el", "en", "y", "o", "no"
    );
    private static final Map<String, Double> EMPTY_COMPETENCY_MAP = Map.of(
        "access", 0.0,
        "process", 0.0,
        "communicate", 0.0
    );

    private final CaseStudyRepository caseStudyRepository;
    private final UserIdentityResolver userIdentityResolver;
    private final SearchSessionRepository searchSessionRepository;
    private final ProgressService progressService;

    @Override
    public ProfessorAnalyticsDTO getAnalyticsOverview(String professorId) {
        log.info("Generating analytics overview for professor: {}", professorId);

        ProfessorAnalyticsDTO dto = new ProfessorAnalyticsDTO();
        List<CaseStudy> professorCases = getProfessorCasesForIdentifier(professorId);
        Set<String> studentIds = collectAssignedStudentIds(professorCases);

        dto.setStudentCount(studentIds.size());
        dto.setAverageProgress(calculateAverageProgress(studentIds));
        dto.setLowProgressStudents(getLowProgressStudents(studentIds, LOW_PROGRESS_THRESHOLD));
        dto.setCommonSearchTerms(getCommonSearchTerms(studentIds));
        dto.setProblematicTerms(getProblematicTerms(studentIds));
        dto.setStudentCompetencies(getStudentCompetencies(studentIds));

        log.info("Analytics overview generated for {} students", studentIds.size());
        return dto;
    }

    @Override
    public StudentProgressDTO getStudentAnalytics(String professorId, String studentId) {
        log.info("Getting analytics for student: {} and professor: {}", studentId, professorId);
        if (!isStudentAssignedToProfessor(professorId, studentId)) {
            throw new ResourceNotFoundException("Student not assigned to professor: " + studentId);
        }
        return progressService.getStudentProgress(studentId);
    }

    private Map<String, Double> calculateAverageProgress(Set<String> studentIds) {
        if (studentIds.isEmpty()) {
            return new HashMap<>(EMPTY_COMPETENCY_MAP);
        }

        double accessTotal = 0.0;
        double processTotal = 0.0;
        double communicateTotal = 0.0;
        int studentCount = 0;

        for (String studentId : studentIds) {
            try {
                StudentProgressDTO progress = progressService.getStudentProgress(studentId);
                Map<String, Double> scores = extractCompetencyScores(progress);
                accessTotal += scores.get("access");
                processTotal += scores.get("process");
                communicateTotal += scores.get("communicate");
                studentCount++;
            } catch (Exception e) {
                log.warn("Could not get progress for student {}", studentId, e);
            }
        }

        if (studentCount == 0) {
            return new HashMap<>(EMPTY_COMPETENCY_MAP);
        }

        Map<String, Double> averages = new HashMap<>();
        averages.put("access", accessTotal / studentCount);
        averages.put("process", processTotal / studentCount);
        averages.put("communicate", communicateTotal / studentCount);
        return averages;
    }

    private List<ProfessorAnalyticsDTO.StudentSummaryDTO> getLowProgressStudents(
        Set<String> studentIds,
        Double threshold
    ) {
        List<ProfessorAnalyticsDTO.StudentSummaryDTO> result = new ArrayList<>();
        for (String studentId : studentIds) {
            try {
                User user = userIdentityResolver.findUserByIdentifier(studentId).orElse(null);
                if (user == null) {
                    continue;
                }
                StudentProgressDTO progress = progressService.getStudentProgress(studentId);
                Map<String, Double> scores = extractCompetencyScores(progress);
                double averageScore = (scores.get("access") + scores.get("process") + scores.get("communicate")) / 3.0;

                if (averageScore < threshold) {
                    result.add(new ProfessorAnalyticsDTO.StudentSummaryDTO(
                        user.getId(),
                        user.getFirstName() + " " + user.getLastName(),
                        user.getEmail(),
                        user.getAvatar(),
                        averageScore
                    ));
                }
            } catch (Exception e) {
                log.warn("Error getting low-progress candidate {}", studentId, e);
            }
        }
        return result;
    }

    private List<ProfessorAnalyticsDTO.StudentCompetencyDetailsDTO> getStudentCompetencies(Set<String> studentIds) {
        List<ProfessorAnalyticsDTO.StudentCompetencyDetailsDTO> result = new ArrayList<>();
        for (String studentId : studentIds) {
            try {
                User user = userIdentityResolver.findUserByIdentifier(studentId).orElse(null);
                if (user == null) {
                    continue;
                }
                StudentProgressDTO progress = progressService.getStudentProgress(studentId);
                Map<String, Double> scores = extractCompetencyScores(progress);
                double averageScore = (scores.get("access") + scores.get("process") + scores.get("communicate")) / 3.0;

                result.add(new ProfessorAnalyticsDTO.StudentCompetencyDetailsDTO(
                    user.getId(),
                    user.getFirstName() + " " + user.getLastName(),
                    user.getEmail(),
                    user.getAvatar(),
                    scores,
                    averageScore
                ));
            } catch (Exception e) {
                log.warn("Error getting competency details for student {}", studentId, e);
            }
        }
        return result;
    }

    private List<ProfessorAnalyticsDTO.SearchTermFrequencyDTO> getCommonSearchTerms(Set<String> studentIds) {
        if (studentIds.isEmpty()) {
            return Collections.emptyList();
        }
        List<SearchSession> sessions;
        try {
            sessions = searchSessionRepository.findByUser_IdInOrderByStartedAtDesc(studentIds);
        } catch (Exception e) {
            log.warn("Could not fetch common terms for student IDs {}", studentIds, e);
            return Collections.emptyList();
        }
        if (sessions.isEmpty()) {
            return Collections.emptyList();
        }

        Map<String, Integer> counts = new HashMap<>();
        for (SearchSession session : sessions) {
            for (String term : extractQueryTerms(session.getOriginalQuery())) {
                counts.merge(term, 1, (old, v) -> old + v);
            }
        }

        return counts.entrySet().stream()
            .sorted(Map.Entry.<String, Integer>comparingByValue(Comparator.reverseOrder()))
            .limit(10)
            .map(entry -> new ProfessorAnalyticsDTO.SearchTermFrequencyDTO(entry.getKey(), entry.getValue()))
            .collect(Collectors.toList());
    }

    private List<ProfessorAnalyticsDTO.ProblematicTermDTO> getProblematicTerms(Set<String> studentIds) {
        if (studentIds.isEmpty()) {
            return Collections.emptyList();
        }
        List<SearchSession> sessions;
        try {
            sessions = searchSessionRepository.findByUser_IdInOrderByStartedAtDesc(studentIds);
        } catch (Exception e) {
            log.warn("Could not fetch problematic terms for student IDs {}", studentIds, e);
            return Collections.emptyList();
        }
        if (sessions.isEmpty()) {
            return Collections.emptyList();
        }

        Map<String, Integer> occurrences = new HashMap<>();
        Map<String, Integer> failures = new HashMap<>();

        for (SearchSession session : sessions) {
            Set<String> termsInSession = new HashSet<>(extractQueryTerms(session.getOriginalQuery()));
            boolean isFailure = session.getResultsCount() == null || session.getResultsCount() <= 0;
            for (String term : termsInSession) {
                occurrences.merge(term, 1, (old, v) -> old + v);
                if (isFailure) {
                    failures.merge(term, 1, (old, v) -> old + v);
                }
            }
        }

        List<ProfessorAnalyticsDTO.ProblematicTermDTO> result = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : occurrences.entrySet()) {
            String term = entry.getKey();
            int total = entry.getValue();
            int failed = failures.getOrDefault(term, 0);
            if (total < MIN_OCCURRENCES_FOR_PROBLEMATIC) {
                continue;
            }
            double errorRate = (double) failed / total;
            if (errorRate < PROBLEMATIC_ERROR_RATE_THRESHOLD) {
                continue;
            }
            result.add(new ProfessorAnalyticsDTO.ProblematicTermDTO(term, errorRate));
        }

        result.sort((a, b) -> Double.compare(
            b.getErrorRate() != null ? b.getErrorRate() : 0.0,
            a.getErrorRate() != null ? a.getErrorRate() : 0.0
        ));
        if (result.size() > 10) {
            return result.subList(0, 10);
        }
        return result;
    }

    private List<String> extractQueryTerms(String rawQuery) {
        if (rawQuery == null || rawQuery.isBlank()) {
            return Collections.emptyList();
        }
        List<String> terms = new ArrayList<>();
        Matcher matcher = TERM_PATTERN.matcher(rawQuery.toLowerCase(Locale.ROOT));
        while (matcher.find()) {
            String term = matcher.group();
            if (term == null || term.isBlank()) {
                continue;
            }
            if (STOP_WORDS.contains(term)) {
                continue;
            }
            terms.add(term);
        }
        return terms;
    }

    private Map<String, Double> extractCompetencyScores(StudentProgressDTO progress) {
        Map<String, Double> scores = new HashMap<>(EMPTY_COMPETENCY_MAP);
        if (progress == null || progress.getCompetencies() == null) {
            return scores;
        }

        scores.put("access", getScoreOrDefault(progress.getCompetencies().get("access"), 0.0));
        scores.put("process", getScoreOrDefault(progress.getCompetencies().get("process"), 0.0));
        scores.put("communicate", getScoreOrDefault(progress.getCompetencies().get("communicate"), 0.0));
        return scores;
    }

    @Override
    public List<StudentProgressDTO> getProfessorStudents(String professorId) {
        log.info("Getting students for professor: {}", professorId);

        List<CaseStudy> professorCases = getProfessorCasesForIdentifier(professorId);
        Set<String> studentIds = collectAssignedStudentIds(professorCases);

        List<StudentProgressDTO> result = new ArrayList<>();
        for (String studentId : studentIds) {
            try {
                StudentProgressDTO progress = progressService.getStudentProgress(studentId);
                if (progress != null) {
                    result.add(progress);
                }
            } catch (Exception e) {
                log.warn("Error getting progress for student {}", studentId, e);
            }
        }
        return result;
    }

    @Override
    public List<CaseStudyDTO> getProfessorCases(String professorId) {
        log.info("Getting cases for professor: {}", professorId);

        List<CaseStudy> cases = getProfessorCasesForIdentifier(professorId);
        return cases.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public CaseStudyDTO createCaseStudy(CaseStudyDTO caseData, String professorId) {
        log.info("Creating case study for professor: {}", professorId);

        User professor = findUserByIdentifier(professorId)
            .orElseThrow(() -> new ResourceNotFoundException("Professor not found: " + professorId));

        CaseStudy caseStudy = new CaseStudy();
        caseStudy.setTitle(caseData.getTitle());
        caseStudy.setScenario(caseData.getScenario());
        caseStudy.setCreatedBy(professor.getEmail() != null ? professor.getEmail() : professor.getId());
        caseStudy.setDifficulty(CaseDifficulty.NOVICE);
        caseStudy.setStatus(CaseStatus.DRAFT);
        caseStudy.setRequiredArticles(caseData.getRequiredArticles() != null ? caseData.getRequiredArticles() : List.of());
        caseStudy.setOptionalArticles(caseData.getOptionalArticles() != null ? caseData.getOptionalArticles() : List.of());
        caseStudy.setGuidingQuestions(caseData.getGuidingQuestions() != null ? caseData.getGuidingQuestions() : List.of());
        caseStudy.setAssignedStudents(caseData.getAssignedStudents() != null ? caseData.getAssignedStudents() : List.of());

        CaseStudy savedCase = caseStudyRepository.save(caseStudy);
        return convertToDTO(savedCase);
    }

    private CaseStudyDTO convertToDTO(CaseStudy caseStudy) {
        CaseStudyDTO dto = new CaseStudyDTO();
        dto.setId(caseStudy.getId());
        dto.setTitle(caseStudy.getTitle());
        dto.setScenario(caseStudy.getScenario());
        dto.setDifficulty(caseStudy.getDifficulty() != null ? caseStudy.getDifficulty().toString() : null);
        dto.setStatus(caseStudy.getStatus() != null ? caseStudy.getStatus().toString() : null);
        dto.setRequiredArticles(copyList(caseStudy.getRequiredArticles()));
        dto.setOptionalArticles(copyList(caseStudy.getOptionalArticles()));
        dto.setGuidingQuestions(copyList(caseStudy.getGuidingQuestions()));
        dto.setCreatedBy(caseStudy.getCreatedBy());
        dto.setCreatedAt(caseStudy.getCreatedAt());
        dto.setStartDate(caseStudy.getStartDate());
        dto.setDueDate(caseStudy.getDueDate());
        dto.setAssignedStudents(copyList(caseStudy.getAssignedStudents()));
        return dto;
    }

    @Override
    public Map<String, Object> getClassPerformanceMetrics(String professorId) {
        log.info("Calculating class performance metrics for professor: {}", professorId);

        Map<String, Object> performance = new HashMap<>();

        try {
            List<CaseStudy> professorCases = getProfessorCasesForIdentifier(professorId);
            Set<String> studentIds = collectAssignedStudentIds(professorCases);

            if (studentIds.isEmpty()) {
                performance.put("averageScore", 0.0);
                performance.put("completionRate", 0.0);
                performance.put("competencyDistribution", EMPTY_COMPETENCY_MAP);
                performance.put("topStudents", List.of());
                performance.put("studentCount", 0);
                return performance;
            }

            List<Map<String, Object>> studentMetrics = new ArrayList<>();
            double totalScore = 0;
            double accessTotal = 0;
            double processTotal = 0;
            double commTotal = 0;
            int completedCount = 0;

            for (String studentId : studentIds) {
                try {
                    StudentProgressDTO progress = progressService.getStudentProgress(studentId);
                    if (progress != null) {
                        User user = userIdentityResolver.findUserByIdentifier(studentId).orElse(null);
                        if (user != null) {
                            Map<String, Double> scores = extractCompetencyScores(progress);
                            double studentAvg = (scores.get("access") + scores.get("process") + scores.get("communicate")) / 3.0;
                            totalScore += studentAvg;
                            accessTotal += scores.get("access");
                            processTotal += scores.get("process");
                            commTotal += scores.get("communicate");
                            completedCount++;

                            studentMetrics.add(Map.of(
                                "id", studentId,
                                "name", user.getFirstName() + " " + user.getLastName(),
                                "score", studentAvg
                            ));
                        }
                    }
                } catch (Exception e) {
                    log.warn("Error getting metrics for student {}", studentId, e);
                }
            }

            double avgScore = completedCount > 0 ? totalScore / completedCount : 0.0;
            double completionRate = (completedCount * 100.0) / studentIds.size();
            Map<String, Double> competencyDist = completedCount > 0
                ? Map.of(
                    "access", accessTotal / completedCount,
                    "process", processTotal / completedCount,
                    "communicate", commTotal / completedCount
                )
                : EMPTY_COMPETENCY_MAP;

            List<Map<String, Object>> topStudents = studentMetrics.stream()
                .sorted((a, b) -> Double.compare((Double) b.get("score"), (Double) a.get("score")))
                .limit(5)
                .collect(Collectors.toList());

            performance.put("averageScore", Math.round(avgScore * 100.0) / 100.0);
            performance.put("completionRate", Math.round(completionRate * 100.0) / 100.0);
            performance.put("competencyDistribution", competencyDist);
            performance.put("topStudents", topStudents);
            performance.put("studentCount", studentIds.size());
            performance.put("completedCount", completedCount);
        } catch (Exception e) {
            log.error("Error calculating class performance metrics", e);
            performance.put("averageScore", 0.0);
            performance.put("completionRate", 0.0);
            performance.put("competencyDistribution", EMPTY_COMPETENCY_MAP);
            performance.put("topStudents", List.of());
        }

        return performance;
    }

    private Double getScore(Object competency) {
        if (competency == null) {
            return null;
        }
        if (competency instanceof StudentProgressDTO.CompetencyProgressDTO) {
            return ((StudentProgressDTO.CompetencyProgressDTO) competency).getScore();
        }
        if (competency instanceof Number) {
            return ((Number) competency).doubleValue();
        }
        if (competency instanceof Map) {
            Object score = ((Map<?, ?>) competency).get("score");
            if (score instanceof Number) {
                return ((Number) score).doubleValue();
            }
        }
        return null;
    }

    private double getScoreOrDefault(Object competency, double fallback) {
        Double score = getScore(competency);
        return score != null ? score : fallback;
    }

    private <T> List<T> copyList(List<T> source) {
        if (source == null || source.isEmpty()) {
            return List.of();
        }
        return new ArrayList<>(source);
    }

    private List<CaseStudy> getProfessorCasesForIdentifier(String professorId) {
        Set<String> professorIdentifiers = resolveProfessorIdentifiers(professorId);
        if (professorIdentifiers.isEmpty()) {
            return List.of();
        }

        Map<String, CaseStudy> merged = new HashMap<>();
        for (String identifier : professorIdentifiers) {
            try {
                List<CaseStudy> cases = caseStudyRepository.findByCreatedBy(identifier);
                for (CaseStudy caseStudy : cases) {
                    if (caseStudy == null || caseStudy.getId() == null) {
                        continue;
                    }
                    merged.put(caseStudy.getId(), caseStudy);
                }
            } catch (Exception e) {
                log.warn("Could not fetch cases for professor identifier {}", identifier, e);
            }
        }
        return new ArrayList<>(merged.values());
    }

    private Set<String> collectAssignedStudentIds(List<CaseStudy> cases) {
        Set<String> rawStudentRefs = cases.stream()
            .filter(Objects::nonNull)
            .flatMap(c -> c.getAssignedStudents() != null
                ? c.getAssignedStudents().stream()
                : java.util.stream.Stream.<String>empty())
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
        return resolveStudentIds(rawStudentRefs);
    }

    private boolean isStudentAssignedToProfessor(String professorId, String studentId) {
        if (professorId == null || professorId.isBlank() || studentId == null || studentId.isBlank()) {
            return false;
        }
        List<CaseStudy> professorCases = getProfessorCasesForIdentifier(professorId);
        Set<String> assignedStudentIds = collectAssignedStudentIds(professorCases);
        return assignedStudentIds.contains(studentId.trim());
    }

    private Set<String> resolveProfessorIdentifiers(String professorId) {
        if (professorId == null || professorId.isBlank()) {
            return Set.of();
        }

        Set<String> identifiers = new LinkedHashSet<>();
        identifiers.add(professorId.trim());

        findUserByIdentifier(professorId).ifPresent(user -> userIdentityResolver.addUserIdentifiers(identifiers, user));
        return identifiers;
    }

    private Optional<User> findUserByIdentifier(String identifier) {
        return userIdentityResolver.findUserByIdentifier(identifier);
    }

    private Set<String> resolveStudentIds(Set<String> rawStudentReferences) {
        if (rawStudentReferences == null || rawStudentReferences.isEmpty()) {
            return Set.of();
        }

        Set<String> resolved = new LinkedHashSet<>();
        for (String reference : rawStudentReferences) {
            resolveStudentId(reference).ifPresent(resolved::add);
        }
        return resolved;
    }

    private Optional<String> resolveStudentId(String reference) {
        if (reference == null || reference.isBlank()) {
            return Optional.empty();
        }
        String normalized = reference.trim();

        Optional<User> resolvedUser = userIdentityResolver.findUserByIdentifier(normalized);
        if (resolvedUser.isPresent()) {
            return Optional.of(resolvedUser.get().getId());
        }

        log.warn("Skipping unresolved student reference in professor analytics: {}", normalized);
        return Optional.empty();
    }
}
