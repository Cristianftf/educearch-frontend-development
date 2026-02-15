package com.uci.competencia.model.dto.response;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CaseStudyDTO {
    private String id;
    
    @NotBlank(message = "Title is required")
    @Size(min = 3, max = 255, message = "Title must be 3-255 characters")
    private String title;
    
    @NotBlank(message = "Scenario is required")
    @Size(min = 10, max = 5000, message = "Scenario must be 10-5000 characters")
    private String scenario;
    
    @NotBlank(message = "Difficulty is required")
    private String difficulty;

    @NotBlank(message = "Status is required")
    private String status;
    
    private List<String> requiredArticles;
    private List<String> optionalArticles;
    private List<String> guidingQuestions;
    private List<RubricItemDTO> rubric;
    private String createdBy;
    
    @JsonFormat(shape = JsonFormat.Shape.STRING, 
                pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'",
                timezone = "UTC")
    private LocalDateTime createdAt;
    
    @JsonFormat(shape = JsonFormat.Shape.STRING, 
                pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'",
                timezone = "UTC")
    private LocalDateTime startDate;

    @JsonFormat(shape = JsonFormat.Shape.STRING, 
                pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'",
                timezone = "UTC")
    private LocalDateTime dueDate;
    
    
    private List<String> assignedStudents;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RubricItemDTO {
        @NotBlank(message = "Competency is required")
        private String competency; // 'access' | 'process' | 'communicate'
        
        @NotBlank(message = "Criterion is required")
        @Size(min = 5, max = 500, message = "Criterion must be 5-500 characters")
        private String criterion;
        
        @NotNull(message = "Max score is required")
        private Integer maxScore;
        
        @Size(max = 1000, message = "Description must not exceed 1000 characters")
        private String description;
    }
}
