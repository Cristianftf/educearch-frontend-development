package com.uci.competencia.model.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProfessorAnalyticsDTO {
    
    @NotNull(message = "Student count is required")
    @Min(value = 0, message = "Student count must be >= 0")
    private Integer studentCount;
    
    // Promedio de competencias: {access: 75.5, process: 82.3, communicate: 71.2}
    @NotNull(message = "Average progress is required")
    private Map<String, Double> averageProgress;
    
    // Estudiantes con progreso bajo
    private List<StudentSummaryDTO> lowProgressStudents;
    
    // Términos de búsqueda más comunes
    private List<SearchTermFrequencyDTO> commonSearchTerms;
    
    // Términos con problemas
    private List<ProblematicTermDTO> problematicTerms;
    
    // Competencias de todos los estudiantes
    @NotNull(message = "Student competencies are required")
    private List<StudentCompetencyDetailsDTO> studentCompetencies;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StudentSummaryDTO {
        @NotBlank(message = "Student ID is required")
        private String id;
        
        @NotBlank(message = "Student name is required")
        private String name;
        
        @NotBlank(message = "Student email is required")
        private String email;
        
        private String avatar;
        
        @NotNull(message = "Average score is required")
        @Min(value = 0, message = "Score must be >= 0")
        private Double averageScore;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SearchTermFrequencyDTO {
        @NotBlank(message = "Term is required")
        private String term;
        
        @NotNull(message = "Count is required")
        @Min(value = 0, message = "Count must be >= 0")
        private Integer count;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProblematicTermDTO {
        @NotBlank(message = "Term is required")
        private String term;
        
        @NotNull(message = "Error rate is required")
        @Min(value = 0, message = "Error rate must be >= 0")
        private Double errorRate;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StudentCompetencyDetailsDTO {
        @NotBlank(message = "Student ID is required")
        private String studentId;
        
        @NotBlank(message = "Student name is required")
        private String studentName;
        
        @NotBlank(message = "Student email is required")
        private String studentEmail;
        
        private String avatar;
        
        @NotNull(message = "Scores are required")
        private Map<String, Double> scores;  // {access: 85, process: 72, communicate: 78}

        @NotNull(message = "Average score is required")
        @Min(value = 0, message = "Score must be >= 0")
        private Double averageScore;
    }
}
