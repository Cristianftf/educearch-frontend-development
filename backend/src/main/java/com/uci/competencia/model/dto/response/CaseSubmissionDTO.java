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
public class CaseSubmissionDTO {
    private String id;
    
    @NotBlank(message = "Case ID is required")
    private String caseId;
    
    @NotBlank(message = "Student ID is required")
    private String studentId;
    
    @JsonFormat(shape = JsonFormat.Shape.STRING, 
                pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'",
                timezone = "UTC")
    private LocalDateTime submittedAt;
    
    @NotBlank(message = "Content is required")
    @Size(min = 10, max = 10000, message = "Content must be 10-10000 characters")
    private String content;
    
    private List<String> selectedArticles;
    private String bibliography;
    
    @NotBlank(message = "Status is required")
    private String status;
    
    
    private EvaluationDTO evaluation;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EvaluationDTO {
        private String id;
        
        @NotBlank(message = "Submission ID is required")
        private String submissionId;
        
        @NotBlank(message = "Professor ID is required")
        private String professorId;
        
        @NotNull(message = "Scores are required")
        private CompetencyScoresDTO scores;
        
        @NotNull(message = "Comments are required")
        private CompetencyCommentsDTO comments;
        
        @NotNull(message = "Overall score is required")
        private Integer overallScore;
        
        @Size(max = 2000, message = "Feedback must not exceed 2000 characters")
        private String feedback;
        
        @JsonFormat(shape = JsonFormat.Shape.STRING, 
                    pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'",
                    timezone = "UTC")
        private LocalDateTime evaluatedAt;

        @Data
        @NoArgsConstructor
        @AllArgsConstructor
        public static class CompetencyScoresDTO {
            @NotNull(message = "Access score is required")
            private Integer access;
            
            @NotNull(message = "Process score is required")
            private Integer process;
            
            @NotNull(message = "Communicate score is required")
            private Integer communicate;
        }

        @Data
        @NoArgsConstructor
        @AllArgsConstructor
        public static class CompetencyCommentsDTO {
            @Size(max = 500, message = "Access comment must not exceed 500 characters")
            private String access;
            
            @Size(max = 500, message = "Process comment must not exceed 500 characters")
            private String process;
            
            @Size(max = 500, message = "Communicate comment must not exceed 500 characters")
            private String communicate;
        }
    }
}