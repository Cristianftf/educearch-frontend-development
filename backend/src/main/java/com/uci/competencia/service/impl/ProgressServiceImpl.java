package com.uci.competencia.service.impl;

import com.uci.competencia.model.dto.response.StudentProgressDTO;
import com.uci.competencia.model.entity.CompetencyProgress;
import com.uci.competencia.repository.CompetencyProgressRepository;
import com.uci.competencia.service.ProgressService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
@Slf4j
public class ProgressServiceImpl implements ProgressService {

    @Autowired
    private CompetencyProgressRepository competencyProgressRepository;

    @Override
    public StudentProgressDTO getStudentProgress(String studentId) {
        log.debug("Fetching progress for student: {}", studentId);

        // Obtener datos de competencia del estudiante
        CompetencyProgress competencyProgress = competencyProgressRepository
            .findByStudentId(studentId)
            .orElse(createDefaultProgress(studentId));

        // Crear el DTO de respuesta
        StudentProgressDTO dto = new StudentProgressDTO();
        dto.setStudentId(Long.valueOf(studentId));

        // Construir mapa de competencias con valores Double
        Map<String, Double> competencies = new HashMap<>();
        competencies.put("access", competencyProgress.getAccessScore() != null ? competencyProgress.getAccessScore() : 0.0);
        competencies.put("process", competencyProgress.getProcessingScore() != null ? competencyProgress.getProcessingScore() : 0.0);
        competencies.put("communicate", competencyProgress.getCommunicationScore() != null ? competencyProgress.getCommunicationScore() : 0.0);
        
        dto.setCompetencies(competencies);

        // Calcular progreso general
        Double overallProgress = competencies.values().stream()
            .mapToDouble(Double::doubleValue)
            .average()
            .orElse(0.0);
        dto.setOverallProgress(overallProgress);

        // Totales de actividades
        Map<String, Integer> activityStats = new HashMap<>();
        activityStats.put("searches", competencyProgress.getTotalSearches() != null ? competencyProgress.getTotalSearches() : 0);
        activityStats.put("verifications", competencyProgress.getTotalVerifications() != null ? competencyProgress.getTotalVerifications() : 0);
        activityStats.put("bibliographies", competencyProgress.getBibliographiesGenerated() != null ? competencyProgress.getBibliographiesGenerated() : 0);
        dto.setActivityStats(activityStats);

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
}
