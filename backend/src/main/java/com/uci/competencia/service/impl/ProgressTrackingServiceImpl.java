package com.uci.competencia.service.impl;

import com.uci.competencia.model.entity.CompetencyProgress;
import com.uci.competencia.model.entity.Student;
import com.uci.competencia.model.entity.Badge;
import com.uci.competencia.model.entity.SearchSession;
import com.uci.competencia.model.dto.response.StudentProgressReport;
import com.uci.competencia.repository.CompetencyProgressRepository;
import com.uci.competencia.repository.StudentRepository;
import com.uci.competencia.repository.SearchSessionRepository;
import com.uci.competencia.service.ProgressTrackingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProgressTrackingServiceImpl implements ProgressTrackingService {

    private final CompetencyProgressRepository competencyProgressRepository;
    private final StudentRepository studentRepository;
    private final SearchSessionRepository searchSessionRepository;

    @Override
    @Transactional
    public void updateStudentCompetencies(String studentId, StudentAction action, ActionMetadata metadata) {
        log.info("Updating competencies for student: {}, action: {}", studentId, action);

        try {
            // Obtener el estudiante
            Optional<Student> optionalStudent = studentRepository.findByStudentId(studentId);
            if (optionalStudent.isEmpty()) {
                log.warn("Student not found: {}", studentId);
                return;
            }

            Student student = optionalStudent.get();

            // Obtener o crear progreso de competencia
            CompetencyProgress progress = competencyProgressRepository.findByStudentId(studentId)
                .orElse(new CompetencyProgress());

            if (progress.getStudent() == null) {
                progress.setStudent(student);
            }

            // Actualizar basado en tipo de acción
            switch (action) {
                case SEARCH_PERFORMED:
                    progress.setTotalSearches((progress.getTotalSearches() != null ? progress.getTotalSearches() : 0) + 1);
                    break;

                case SEARCH_SUCCESS:
                    progress.setTotalSearches((progress.getTotalSearches() != null ? progress.getTotalSearches() : 0) + 1);
                    progress.setSuccessfulSearches((progress.getSuccessfulSearches() != null ? progress.getSuccessfulSearches() : 0) + 1);
                    if (metadata.score != null) {
                        // Actualizar score de acceso (media móvil)
                        double currentAccess = progress.getAccessScore() != null ? progress.getAccessScore() : 0;
                        int total = progress.getSuccessfulSearches();
                        progress.setAccessScore((currentAccess * (total - 1) + metadata.score) / total);
                    }
                    break;

                case VERIFICATION_PERFORMED:
                    progress.setTotalVerifications((progress.getTotalVerifications() != null ? progress.getTotalVerifications() : 0) + 1);
                    break;

                case VERIFICATION_CORRECT:
                    progress.setTotalVerifications((progress.getTotalVerifications() != null ? progress.getTotalVerifications() : 0) + 1);
                    progress.setCorrectVerifications((progress.getCorrectVerifications() != null ? progress.getCorrectVerifications() : 0) + 1);
                    if (metadata.score != null) {
                        // Actualizar score de procesamiento
                        double currentProcessing = progress.getProcessingScore() != null ? progress.getProcessingScore() : 0;
                        int total = progress.getCorrectVerifications();
                        progress.setProcessingScore((currentProcessing * (total - 1) + metadata.score) / total);
                    }
                    break;

                case BIBLIOGRAPHY_GENERATED:
                    progress.setBibliographiesGenerated((progress.getBibliographiesGenerated() != null ? progress.getBibliographiesGenerated() : 0) + 1);
                    if (metadata.score != null) {
                        // Actualizar score de comunicación
                        double currentComm = progress.getCommunicationScore() != null ? progress.getCommunicationScore() : 0;
                        int total = progress.getBibliographiesGenerated();
                        progress.setCommunicationScore((currentComm * (total - 1) + metadata.score) / total);
                    }
                    break;

                default:
                    log.debug("Action {} not mapped to competency update", action);
            }

            // Guardar progreso
            competencyProgressRepository.save(progress);
            log.info("Competencies updated for student: {}", studentId);

        } catch (Exception e) {
            log.error("Error updating competencies for student: {}", studentId, e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> checkAndAwardBadges(String studentId) {
        log.info("Checking badges for student: {}", studentId);

        List<String> newBadges = new ArrayList<>();

        try {
            Optional<CompetencyProgress> progress = competencyProgressRepository.findByStudentId(studentId);
            if (progress.isEmpty()) {
                return newBadges;
            }

            CompetencyProgress p = progress.get();

            // Verificar badges basados en criterios
            if (p.getSuccessfulSearches() != null && p.getSuccessfulSearches() >= 10) {
                newBadges.add("Search Master");
            }

            if (p.getCorrectVerifications() != null && p.getCorrectVerifications() >= 15) {
                newBadges.add("Verification Expert");
            }

            if (p.getBibliographiesGenerated() != null && p.getBibliographiesGenerated() >= 5) {
                newBadges.add("Citation Master");
            }

            if (p.getAccessScore() != null && p.getAccessScore() >= 90) {
                newBadges.add("Access Champion");
            }

            if (p.getProcessingScore() != null && p.getProcessingScore() >= 85 && 
                p.getCommunicationScore() != null && p.getCommunicationScore() >= 85) {
                newBadges.add("Infodemic Fighter");
            }

            log.info("Found {} potential badges for student: {}", newBadges.size(), studentId);
            return newBadges;

        } catch (Exception e) {
            log.error("Error checking badges for student: {}", studentId, e);
            return newBadges;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public AlertNotification checkForAlerts(String studentId) {
        log.info("Checking alerts for student: {}", studentId);

        AlertNotification notification = new AlertNotification();
        notification.studentId = studentId;
        notification.timestamp = LocalDateTime.now();

        try {
            Optional<CompetencyProgress> progress = competencyProgressRepository.findByStudentId(studentId);

            if (progress.isEmpty()) {
                notification.type = AlertType.HELP_REQUIRED;
                notification.message = "No progress data found";
                notification.severity = AlertSeverity.WARNING;
                return notification;
            }

            CompetencyProgress p = progress.get();

            // Verificar baja precisión
            if (p.getSuccessfulSearches() != null && p.getTotalSearches() != null && p.getTotalSearches() > 0) {
                double accuracy = (double) p.getSuccessfulSearches() / p.getTotalSearches();
                if (accuracy < 0.5) {
                    notification.type = AlertType.LOW_ACCURACY;
                    notification.message = "Low search accuracy: " + String.format("%.1f%%", accuracy * 100);
                    notification.severity = AlertSeverity.WARNING;
                    return notification;
                }
            }

            // Verificar bajo rendimiento general
            double avgScore = 0;
            int count = 0;
            if (p.getAccessScore() != null) { avgScore += p.getAccessScore(); count++; }
            if (p.getProcessingScore() != null) { avgScore += p.getProcessingScore(); count++; }
            if (p.getCommunicationScore() != null) { avgScore += p.getCommunicationScore(); count++; }

            if (count > 0) {
                avgScore /= count;
                if (avgScore < 60) {
                    notification.type = AlertType.LOW_PERFORMANCE;
                    notification.message = "Overall performance below 60: " + String.format("%.1f%%", avgScore);
                    notification.severity = AlertSeverity.CRITICAL;
                    return notification;
                }
            }

            // Sin alertas
            notification.type = AlertType.HELP_REQUIRED; // Usando como "no alerts"
            notification.message = "No issues detected";
            notification.severity = AlertSeverity.INFO;

        } catch (Exception e) {
            log.error("Error checking alerts for student: {}", studentId, e);
            notification.type = AlertType.HELP_REQUIRED;
            notification.message = "Error checking alerts: " + e.getMessage();
            notification.severity = AlertSeverity.WARNING;
        }

        return notification;
    }

    @Override
    @Transactional
    public void saveCompetencySnapshot(String studentId, CompetencyProgress progress) {
        log.info("Saving competency snapshot for student: {}", studentId);

        try {
            if (progress == null) {
                log.warn("Cannot save null progress");
                return;
            }

            // El snapshot se guarda automáticamente cada vez que se actualiza
            // Aquí simplemente aseguramos que se persista
            progress.setLastUpdated(LocalDateTime.now());
            competencyProgressRepository.save(progress);

            log.info("Competency snapshot saved for student: {}", studentId);

        } catch (Exception e) {
            log.error("Error saving competency snapshot for student: {}", studentId, e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public StudentProgressReport generateProgressReport(String studentId, DateRange dateRange, ReportDetailLevel detailLevel) {
        log.info("Generating progress report for student: {}, detailLevel: {}", studentId, detailLevel);

        StudentProgressReport report = new StudentProgressReport();
        report.setGeneratedAt(LocalDateTime.now());

        try {
            // Obtener progreso
            Optional<CompetencyProgress> progress = competencyProgressRepository.findByStudentId(studentId);
            if (progress.isEmpty()) {
                return report;
            }

            CompetencyProgress p = progress.get();
            report.setStudentId(Long.parseLong(studentId.hashCode() + ""));

            // Calcular progreso general
            double avgScore = calculateAverageScore(p);
            report.setOverallProgress(avgScore);

            // Competencias individuales
            Map<String, Double> competencies = new HashMap<>();
            if (p.getAccessScore() != null) competencies.put("access", p.getAccessScore());
            if (p.getProcessingScore() != null) competencies.put("processing", p.getProcessingScore());
            if (p.getCommunicationScore() != null) competencies.put("communication", p.getCommunicationScore());
            report.setCompetencyProgress(competencies);

            // Casos completados (placeholder - requeriría CaseSubmissionRepository)
            report.setCasesCompleted(0);
            report.setTotalCases(0);
            report.setAverageGrade(avgScore);

            // Horas invertidas (placeholder)
            report.setHoursSpent(0.0);

            // Estadísticas de actividad
            Map<String, StudentProgressReport.ActivityStats> activityStats = new HashMap<>();
            activityStats.put("totalSearches", new StudentProgressReport.ActivityStats(
                p.getTotalSearches() != null ? p.getTotalSearches() : 0, 0, 0.0));
            activityStats.put("successfulSearches", new StudentProgressReport.ActivityStats(
                p.getSuccessfulSearches() != null ? p.getSuccessfulSearches() : 0, 0, 0.0));
            activityStats.put("totalVerifications", new StudentProgressReport.ActivityStats(
                p.getTotalVerifications() != null ? p.getTotalVerifications() : 0, 0, 0.0));
            activityStats.put("correctVerifications", new StudentProgressReport.ActivityStats(
                p.getCorrectVerifications() != null ? p.getCorrectVerifications() : 0, 0, 0.0));
            activityStats.put("bibliographiesGenerated", new StudentProgressReport.ActivityStats(
                p.getBibliographiesGenerated() != null ? p.getBibliographiesGenerated() : 0, 0, 0.0));
            report.setActivityStats(activityStats);

            // Recomendaciones
            List<String> recommendations = generateRecommendations(p);
            report.setRecommendations(recommendations);

            log.info("Progress report generated for student: {}", studentId);

        } catch (Exception e) {
            log.error("Error generating progress report for student: {}", studentId, e);
        }

        return report;
    }

    @Override
    @Transactional(readOnly = true)
    public Integer calculatePercentile(String studentId, CompetencyType competencyType) {
        log.info("Calculating percentile for student: {}, competency: {}", studentId, competencyType);

        try {
            Optional<CompetencyProgress> progress = competencyProgressRepository.findByStudentId(studentId);
            if (progress.isEmpty()) {
                return 50; // Default median
            }

            CompetencyProgress p = progress.get();
            Double score = null;

            switch (competencyType) {
                case ACCESS:
                    score = p.getAccessScore();
                    break;
                case PROCESSING:
                    score = p.getProcessingScore();
                    break;
                case COMMUNICATION:
                    score = p.getCommunicationScore();
                    break;
            }

            if (score == null) {
                return 50; // Default median
            }

            // Aproximar percentil basado en score (escala 0-100)
            // En una implementación real, comparar con todos los estudiantes
            return Math.min(100, Math.max(0, (int) (score * 1.0)));

        } catch (Exception e) {
            log.error("Error calculating percentile for student: {}", studentId, e);
            return 50;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public ActivityHeatmap getActivityHeatmap(String studentId, int days) {
        log.info("Getting activity heatmap for student: {}, days: {}", studentId, days);

        ActivityHeatmap heatmap = new ActivityHeatmap();
        heatmap.data = new int[days][24];
        heatmap.maxValue = 0;
        heatmap.startDate = LocalDate.now().minusDays(days);
        heatmap.endDate = LocalDate.now();

        try {
            // Obtener sesiones de búsqueda del período
            LocalDateTime startDateTime = LocalDate.now().minusDays(days).atStartOfDay();
            LocalDateTime endDateTime = LocalDateTime.now();

            Pageable pageable = PageRequest.of(0, 1000);
            Page<SearchSession> sessions = searchSessionRepository.findByUserId(studentId, pageable);

            // Llenar heatmap
            for (SearchSession session : sessions.getContent()) {
                if (session.getStartedAt() != null) {
                    LocalDateTime sessionTime = session.getStartedAt();

                    // Calcular día relativo al rango
                    long dayDiff = ChronoUnit.DAYS.between(heatmap.startDate, sessionTime.toLocalDate());
                    int hour = sessionTime.getHour();

                    if (dayDiff >= 0 && dayDiff < days && hour >= 0 && hour < 24) {
                        heatmap.data[(int) dayDiff][hour]++;
                        heatmap.maxValue = Math.max(heatmap.maxValue, heatmap.data[(int) dayDiff][hour]);
                    }
                }
            }

            log.info("Activity heatmap generated for student: {} with maxValue: {}", studentId, heatmap.maxValue);

        } catch (Exception e) {
            log.error("Error getting activity heatmap for student: {}", studentId, e);
        }

        return heatmap;
    }

    @Override
    public Map<String, Object> getDetailedProgress(String studentId) {
        // Implementación temporal - devolver datos de ejemplo
        Map<String, Object> detailedProgress = new HashMap<>();
        detailedProgress.put("studentId", studentId);
        detailedProgress.put("competencies", Map.of(
            "access", Map.of("score", 80.0, "level", "Intermediate"),
            "process", Map.of("score", 70.0, "level", "Basic"),
            "communicate", Map.of("score", 65.0, "level", "Basic")
        ));
        detailedProgress.put("recentActivity", List.of(
            Map.of("type", "search", "timestamp", "2023-01-15T10:30:00", "score", 85.0),
            Map.of("type", "verification", "timestamp", "2023-01-14T14:15:00", "score", 75.0)
        ));
        detailedProgress.put("badges", List.of(
            "Search Master",
            "Verification Expert"
        ));
        detailedProgress.put("alerts", List.of(
            Map.of("type", "LOW_ACCURACY", "message", "Low accuracy in recent searches", "severity", "WARNING")
        ));
        return detailedProgress;
    }

    /**
     * Calcula el promedio de scores
     */
    private double calculateAverageScore(CompetencyProgress progress) {
        double total = 0;
        int count = 0;

        if (progress.getAccessScore() != null) {
            total += progress.getAccessScore();
            count++;
        }
        if (progress.getProcessingScore() != null) {
            total += progress.getProcessingScore();
            count++;
        }
        if (progress.getCommunicationScore() != null) {
            total += progress.getCommunicationScore();
            count++;
        }

        return count > 0 ? total / count : 0.0;
    }

    /**
     * Genera recomendaciones basadas en progreso
     */
    private List<String> generateRecommendations(CompetencyProgress progress) {
        List<String> recommendations = new ArrayList<>();

        if (progress.getAccessScore() != null && progress.getAccessScore() < 70) {
            recommendations.add("Mejora tus habilidades de búsqueda: practica con MeSH terms y operadores booleanos");
        }

        if (progress.getProcessingScore() != null && progress.getProcessingScore() < 70) {
            recommendations.add("Refuerza tu capacidad de análisis crítico: realiza más verificaciones de afirmaciones");
        }

        if (progress.getCommunicationScore() != null && progress.getCommunicationScore() < 70) {
            recommendations.add("Mejora tu comunicación académica: genera más bibliografías y revisa tu formato APA");
        }

        if (progress.getTotalSearches() != null && progress.getTotalSearches() < 5) {
            recommendations.add("Incrementa tu práctica: realiza más búsquedas académicas");
        }

        if (recommendations.isEmpty()) {
            recommendations.add("¡Vas bien! Continúa practicando para mejorar aún más");
        }

        return recommendations;
    }
}