package com.uci.competencia.model.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SearchHedgeTestResultDTO {
    
    private String query;
    
    private Integer resultCount;
    
    private Double estimatedPrecision;
    
    private Double estimatedRecall;
    
    private String status;
    
    private String message;
}
