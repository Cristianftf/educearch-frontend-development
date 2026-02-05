package com.uci.competencia.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CaseStudyRequestDTO {
    @NotBlank(message = "Title cannot be blank")
    private String title;

    @NotBlank(message = "Scenario cannot be blank")
    private String scenario;

    private String difficulty;

    @NotEmpty(message = "Required articles cannot be empty")
    private List<String> requiredPmids;

    private List<String> optionalPmids;

    @NotEmpty(message = "Guiding questions cannot be empty")
    private List<String> guidingQuestions;

    private String rubric;

    private LocalDateTime dueDate;

    @NotEmpty(message = "Must assign to at least one student")
    private List<String> assignedStudents;
}
