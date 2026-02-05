package com.uci.competencia.model.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * DTO para respuestas de evaluaciones
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EvaluationDTO {
    private String id;
    private String submissionId;
    private String professorId;

    @JsonProperty("scores")
    private Map<String, Object> scores;

    @JsonProperty("comments")
    private Map<String, Object> comments;

    @JsonProperty("overallScore")
    private Integer overallScore;

    private String feedback;
    private LocalDateTime evaluatedAt;
    private LocalDateTime updatedAt;
}
