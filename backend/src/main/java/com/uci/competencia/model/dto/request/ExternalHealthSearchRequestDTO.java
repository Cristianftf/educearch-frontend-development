package com.uci.competencia.model.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ExternalHealthSearchRequestDTO {
    private String queryText;
    private List<String> terms;
    private Integer yearFrom;
    private Integer yearTo;
    private List<String> studyTypes;
    private String language;
    private Boolean hasFullText;
    private Integer minSampleSize;
    private Integer maxResults;
}
