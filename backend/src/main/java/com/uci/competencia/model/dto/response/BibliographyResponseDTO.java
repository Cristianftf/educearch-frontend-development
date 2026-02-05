package com.uci.competencia.model.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BibliographyResponseDTO {
    private String id;
    private String name;
    private String format;
    private String content;
    private String createdAt;
    private Integer articleCount;
    private List<ArticleDTO> articles;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ArticleDTO {
        private String id;
        private String pmid;
        private String title;
        private List<String> authors;
        private String journal;
        private Integer year;
        private String abstractText;
        private String studyType;
        private Integer evidenceLevel;
        private Integer sampleSize;
        private Boolean hasConflictOfInterest;
        private String doi;
    }
}
