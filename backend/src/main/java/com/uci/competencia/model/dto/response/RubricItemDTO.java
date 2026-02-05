package com.uci.competencia.model.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RubricItemDTO {
    private String competency;  // 'access' | 'process' | 'communicate'
    private String criterion;
    private Integer maxScore;
    private String description;
}
