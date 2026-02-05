package com.uci.competencia.service.impl;

import com.uci.competencia.model.dto.response.ProfessorAnalyticsDTO;
import com.uci.competencia.model.dto.response.StudentProgressDTO;
import com.uci.competencia.model.dto.response.CaseStudyDTO;
import com.uci.competencia.model.entity.CaseStudy;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.repository.CaseStudyRepository;
import com.uci.competencia.repository.UserRepository;
import com.uci.competencia.service.ProgressService;
import com.uci.competencia.service.ProfessorAnalyticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProfessorAnalyticsServiceImpl implements ProfessorAnalyticsService {
    
    private final CaseStudyRepository caseStudyRepository;
    private final UserRepository userRepository;
    private final ProgressService progressService;
    
    @Override
    public ProfessorAnalyticsDTO getAnalyticsOverview(String professorId) {
        log.info("Generating analytics overview for professor: {}", professorId);
        
        ProfessorAnalyticsDTO dto = new ProfessorAnalyticsDTO();
        
        // 1. Obtener todos los casos del profesor
        List<CaseStudy> professorCases = caseStudyRepository.findByCreatedBy(professorId);
        
        // 2. Obtener IDs únicos de estudiantes asignados
        Set<String> studentIds = professorCases.stream()
            .flatMap(c -> c.getAssignedStudents().stream())
            .collect(Collectors.toSet());
        
        dto.setStudentCount(studentIds.size());
        
        // 3. Calcular progreso promedio
        Map<String, Double> avgProgress = calculateAverageProgress(studentIds);
        dto.setAverageProgress(avgProgress);
        
        // 4. Obtener estudiantes con bajo rendimiento
        List<ProfessorAnalyticsDTO.StudentSummaryDTO> lowProgress = 
            getLowProgressStudents(studentIds, 60.0);
        dto.setLowProgressStudents(lowProgress);
        
        // 5. Términos de búsqueda comunes (placeholder)
        dto.setCommonSearchTerms(new ArrayList<>());
        
        // 6. Términos problemáticos (placeholder)
        dto.setProblematicTerms(new ArrayList<>());
        
        // 7. Competencias de estudiantes
        List<ProfessorAnalyticsDTO.StudentCompetencyDetailsDTO> competencies = 
            getStudentCompetencies(studentIds);
        dto.setStudentCompetencies(competencies);
        
        log.info("Analytics overview generated for {} students", studentIds.size());
        
        return dto;
    }
    
    @Override
    public StudentProgressDTO getStudentAnalytics(String studentId) {
        log.info("Getting analytics for student: {}", studentId);
        return progressService.getStudentProgress(studentId);
    }
    
    private Map<String, Double> calculateAverageProgress(Set<String> studentIds) {
        Map<String, Double> result = new HashMap<>();
        result.put("access", 0.0);
        result.put("process", 0.0);
        result.put("communicate", 0.0);
        
        if (studentIds.isEmpty()) return result;
        
        try {
            // Para cada estudiante, obtener su progreso real
            Map<String, Double> accessScores = new HashMap<>();
            Map<String, Double> processScores = new HashMap<>();
            Map<String, Double> communicateScores = new HashMap<>();
            
            for (String studentId : studentIds) {
                try {
                    StudentProgressDTO progress = progressService.getStudentProgress(studentId);
                    if (progress != null && progress.getCompetencies() != null) {
                        // Obtener scores reales de competencias
                        @SuppressWarnings("unchecked")
                        Map<String, Object> competencies = (Map<String, Object>) (Map<?, ?>) progress.getCompetencies();
                        
                        if (competencies.containsKey("access")) {
                            Object accessObj = competencies.get("access");
                            if (accessObj instanceof Map) {
                                Object score = ((Map<?, ?>) accessObj).get("score");
                                if (score instanceof Number) {
                                    accessScores.put(studentId, ((Number) score).doubleValue());
                                }
                            }
                        }
                        
                        if (competencies.containsKey("process")) {
                            Object processObj = competencies.get("process");
                            if (processObj instanceof Map) {
                                Object score = ((Map<?, ?>) processObj).get("score");
                                if (score instanceof Number) {
                                    processScores.put(studentId, ((Number) score).doubleValue());
                                }
                            }
                        }
                        
                        if (competencies.containsKey("communicate")) {
                            Object commObj = competencies.get("communicate");
                            if (commObj instanceof Map) {
                                Object score = ((Map<?, ?>) commObj).get("score");
                                if (score instanceof Number) {
                                    communicateScores.put(studentId, ((Number) score).doubleValue());
                                }
                            }
                        }
                    }
                } catch (Exception e) {
                    log.warn("Could not get progress for student: {}", studentId, e);
                }
            }
            
            // Calcular promedios con valores reales
            if (!accessScores.isEmpty()) {
                double avg = accessScores.values().stream()
                    .mapToDouble(Double::doubleValue)
                    .average()
                    .orElse(0.0);
                result.put("access", avg);
            }

            if (!processScores.isEmpty()) {
                double avg = processScores.values().stream()
                    .mapToDouble(Double::doubleValue)
                    .average()
                    .orElse(0.0);
                result.put("process", avg);
            }

            if (!communicateScores.isEmpty()) {
                double avg = communicateScores.values().stream()
                    .mapToDouble(Double::doubleValue)
                    .average()
                    .orElse(0.0);
                result.put("communicate", avg);
            }
            
            log.info("Average progress calculated: access={}, process={}, communicate={}", 
                     result.get("access"), result.get("process"), result.get("communicate"));
            
        } catch (Exception e) {
            log.error("Error calculating average progress", e);
        }
        
        return result;
    }
    
    private List<ProfessorAnalyticsDTO.StudentSummaryDTO> getLowProgressStudents(
            Set<String> studentIds, Double threshold) {
        
        return studentIds.stream()
            .map(studentId -> {
                try {
                    User user = userRepository.findById(studentId).orElse(null);
                    if (user == null) return null;

                    StudentProgressDTO progress = progressService.getStudentProgress(studentId);
                    Double avgScore = 0.0;
                    
                    // Calcular promedio real de competencias
                    if (progress != null && progress.getCompetencies() != null) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> competencies = (Map<String, Object>) (Map<?, ?>) progress.getCompetencies();
                        double total = 0;
                        int count = 0;
                        
                        for (var entry : competencies.entrySet()) {
                            Object competencyObj = entry.getValue();
                            if (competencyObj instanceof Map) {
                                Object score = ((Map<?, ?>) competencyObj).get("score");
                                if (score instanceof Number) {
                                    total += ((Number) score).doubleValue();
                                    count++;
                                }
                            }
                        }
                        
                        if (count > 0) {
                            avgScore = total / count;
                        }
                    }

                    if (avgScore < threshold) {
                        return new ProfessorAnalyticsDTO.StudentSummaryDTO(
                            user.getId(),
                            user.getFirstName() + " " + user.getLastName(),
                            user.getEmail(),
                            user.getAvatar(),
                            avgScore
                        );
                    }
                    return null;
                } catch (Exception e) {
                    log.warn("Error getting progress for student: {}", studentId, e);
                    return null;
                }
            })
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
    }
    
    private List<ProfessorAnalyticsDTO.StudentCompetencyDetailsDTO> getStudentCompetencies(
            Set<String> studentIds) {
        
        return studentIds.stream()
            .map(studentId -> {
                try {
                    User user = userRepository.findById(studentId).orElse(null);
                    if (user == null) return null;
                    
                    StudentProgressDTO progress = progressService.getStudentProgress(studentId);
                    
                    Map<String, Double> scores = new HashMap<>();
                    double total = 0;
                    int count = 0;
                    
                    if (progress != null && progress.getCompetencies() != null) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> competencies = (Map<String, Object>) (Map<?, ?>) progress.getCompetencies();
                        
                        for (var entry : competencies.entrySet()) {
                            String key = entry.getKey();
                            Object competencyObj = entry.getValue();
                            
                            double score = 0.0;
                            if (competencyObj instanceof Map) {
                                Object scoreObj = ((Map<?, ?>) competencyObj).get("score");
                                if (scoreObj instanceof Number) {
                                    score = ((Number) scoreObj).doubleValue();
                                }
                            } else if (competencyObj instanceof Number) {
                                score = ((Number) competencyObj).doubleValue();
                            }
                            
                            scores.put(key, score);
                            total += score;
                            count++;
                        }
                    }
                    
                    return new ProfessorAnalyticsDTO.StudentCompetencyDetailsDTO(
                        user.getId(),
                        user.getFirstName() + " " + user.getLastName(),
                        user.getEmail(),
                        user.getAvatar(),
                        scores,
                        count > 0 ? total / count : 0.0
                    );
                } catch (Exception e) {
                    log.warn("Error getting competencies for student: {}", studentId, e);
                    return null;
                }
            })
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
    }

    @Override
    public List<StudentProgressDTO> getProfessorStudents(String professorId) {
        log.info("Getting students for professor: {}", professorId);
        
        List<CaseStudy> professorCases = caseStudyRepository.findByCreatedBy(professorId);
        
        Set<String> studentIds = professorCases.stream()
            .flatMap(c -> c.getAssignedStudents().stream())
            .collect(Collectors.toSet());
        
        return studentIds.stream()
            .map(progressService::getStudentProgress)
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
    }

    @Override
    public List<CaseStudyDTO> getProfessorCases(String professorId) {
        log.info("Getting cases for professor: {}", professorId);
        
        List<CaseStudy> cases = caseStudyRepository.findByCreatedBy(professorId);
        
        return cases.stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
    }

    @Override
    public CaseStudyDTO createCaseStudy(CaseStudyDTO caseData, String professorId) {
        log.info("Creating case study for professor: {}", professorId);
        
        Optional<User> professor = userRepository.findById(professorId);
        if (professor.isEmpty()) {
            log.error("Professor not found: {}", professorId);
            return null;
        }
        
        CaseStudy caseStudy = new CaseStudy();
        caseStudy.setTitle(caseData.getTitle());
        caseStudy.setScenario(caseData.getScenario());
        caseStudy.setCreatedBy(professorId);
        // createdAt is set automatically by @CreationTimestamp
        
        CaseStudy savedCase = caseStudyRepository.save(caseStudy);
        return convertToDTO(savedCase);
    }

    private CaseStudyDTO convertToDTO(CaseStudy caseStudy) {
        CaseStudyDTO dto = new CaseStudyDTO();
        dto.setId(caseStudy.getId());
        dto.setTitle(caseStudy.getTitle());
        dto.setScenario(caseStudy.getScenario());
        dto.setDifficulty(caseStudy.getDifficulty().toString());
        dto.setStatus(caseStudy.getStatus().toString());
        dto.setRequiredArticles(caseStudy.getRequiredArticles());
        dto.setOptionalArticles(caseStudy.getOptionalArticles());
        dto.setGuidingQuestions(caseStudy.getGuidingQuestions());
        dto.setCreatedBy(caseStudy.getCreatedBy());
        dto.setCreatedAt(caseStudy.getCreatedAt());
        dto.setDueDate(caseStudy.getDueDate());
        // Note: rubric conversion would need additional logic for RubricItemDTO
        return dto;
    }

    @Override
    public Map<String, Object> getClassPerformanceMetrics(String professorId) {
        log.info("Calculating class performance metrics for professor: {}", professorId);
        
        Map<String, Object> performance = new HashMap<>();
        
        try {
            // Obtener casos del profesor
            List<CaseStudy> professorCases = caseStudyRepository.findByCreatedBy(professorId);
            
            // Obtener estudiantes asignados
            Set<String> studentIds = professorCases.stream()
                .flatMap(c -> c.getAssignedStudents().stream())
                .collect(Collectors.toSet());
            
            if (studentIds.isEmpty()) {
                performance.put("averageScore", 0.0);
                performance.put("completionRate", 0.0);
                performance.put("competencyDistribution", Map.of(
                    "access", 0.0,
                    "process", 0.0,
                    "communicate", 0.0
                ));
                performance.put("topStudents", List.of());
                performance.put("studentCount", 0);
                return performance;
            }
            
            // Calcular métricas
            List<Map<String, Object>> studentMetrics = new ArrayList<>();
            double totalScore = 0;
            double accessTotal = 0, processTotal = 0, commTotal = 0;
            int completedCount = 0;
            
            for (String studentId : studentIds) {
                try {
                    StudentProgressDTO progress = progressService.getStudentProgress(studentId);
                    if (progress != null) {
                        User user = userRepository.findById(studentId).orElse(null);
                        if (user != null) {
                            double studentAvg = 0;
                            Map<String, Double> competencies = progress.getCompetencies();
                            
                            if (competencies != null) {
                                double compTotal = 0;
                                int compCount = 0;
                                
                                // Extraer scores de cada competencia
                                if (competencies.containsKey("access")) {
                                    double score = competencies.getOrDefault("access", 0.0);
                                    accessTotal += score;
                                    compTotal += score;
                                    compCount++;
                                }
                                
                                if (competencies.containsKey("process")) {
                                    double score = competencies.getOrDefault("process", 0.0);
                                    processTotal += score;
                                    compTotal += score;
                                    compCount++;
                                }
                                
                                if (competencies.containsKey("communicate")) {
                                    double score = competencies.getOrDefault("communicate", 0.0);
                                    commTotal += score;
                                    compTotal += score;
                                    compCount++;
                                }
                                
                                if (compCount > 0) {
                                    studentAvg = compTotal / compCount;
                                    completedCount++;
                                }
                            }
                            
                            totalScore += studentAvg;
                            
                            studentMetrics.add(Map.of(
                                "id", studentId,
                                "name", user.getFirstName() + " " + user.getLastName(),
                                "score", studentAvg
                            ));
                        }
                    }
                } catch (Exception e) {
                    log.warn("Error getting metrics for student: {}", studentId, e);
                }
            }
            
            // Calcular promedios
            double avgScore = completedCount > 0 ? totalScore / completedCount : 0.0;
            double completionRate = (completedCount * 100.0) / studentIds.size();
            
            // Distribución de competencias
            Map<String, Double> competencyDist = Map.of(
                "access", completedCount > 0 ? accessTotal / completedCount : 0.0,
                "process", completedCount > 0 ? processTotal / completedCount : 0.0,
                "communicate", completedCount > 0 ? commTotal / completedCount : 0.0
            );
            
            // Top estudiantes (ordenar por score descendente y tomar los 5 mejores)
            List<Map<String, Object>> topStudents = studentMetrics.stream()
                .sorted((a, b) -> Double.compare((Double) b.get("score"), (Double) a.get("score")))
                .limit(5)
                .collect(Collectors.toList());
            
            // Construir respuesta
            performance.put("averageScore", Math.round(avgScore * 100.0) / 100.0);
            performance.put("completionRate", Math.round(completionRate * 100.0) / 100.0);
            performance.put("competencyDistribution", competencyDist);
            performance.put("topStudents", topStudents);
            performance.put("studentCount", studentIds.size());
            performance.put("completedCount", completedCount);
            
            log.info("Class performance metrics calculated: avgScore={}, completionRate={}", 
                     avgScore, completionRate);
            
        } catch (Exception e) {
            log.error("Error calculating class performance metrics", e);
            performance.put("averageScore", 0.0);
            performance.put("completionRate", 0.0);
            performance.put("competencyDistribution", Map.of(
                "access", 0.0,
                "process", 0.0,
                "communicate", 0.0
            ));
            performance.put("topStudents", List.of());
        }
        
        return performance;
    }
}
