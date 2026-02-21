package com.uci.competencia.model.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ExternalHealthSearchResponseDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private String provider;
    private List<ExternalHealthResultDTO> results;
    private Integer totalResults;
    private Boolean cached;
    private String generatedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ExternalHealthResultDTO implements Serializable {
        private static final long serialVersionUID = 1L;

        private String id;
        private String pmid;
        private String title;
        private String abstractText;
        private List<String> authors;
        private String journal;
        private Integer year;
        private String studyType;
        private Integer evidenceLevel;
        private Integer sampleSize;
        private Boolean hasConflictOfInterest;
        private String doi;
        private String source;
        private String sourceUrl;
    }
}

