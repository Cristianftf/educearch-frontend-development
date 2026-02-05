package com.uci.competencia.model.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CompetencyProgressDTO {
    private String type;  // 'access' | 'process' | 'communicate'
    private Double score;
    private String level;  // 'novice' | 'intermediate' | 'advanced'
    private String lastUpdated;
}
