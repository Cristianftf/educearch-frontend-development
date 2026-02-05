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
    private String studentId;
    private String userId;
    private Double overallProgress;
    private Map<String, CompetencyProgressDTO> competencies;
    private Integer casesCompleted;
    private Integer totalCases;
    private Double averageGrade;
    private Double hoursSpent;
    private Map<String, Integer> activityStats;
    private List<String> recommendations;
    private Integer totalSearches;
    private Integer totalVerifications;
    private Integer totalBibliographies;
    private List<ActivityDTO> recentActivities;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CompetencyProgressDTO {
        private String type;
        private Double score;
        private String level;
        private String lastUpdated;
    }
}
