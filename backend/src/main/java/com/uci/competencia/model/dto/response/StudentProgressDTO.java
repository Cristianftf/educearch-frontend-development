package com.uci.competencia.model.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StudentProgressDTO {
    private Long studentId;
    private Double overallProgress;
    private Map<String, Double> competencies;
    private Integer casesCompleted;
    private Integer totalCases;
    private Double averageGrade;
    private Double hoursSpent;
    private Map<String, Integer> activityStats;
    private List<String> recommendations;
}
