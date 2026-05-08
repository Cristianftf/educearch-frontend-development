package com.uci.competencia.model.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SearchResponseDTO {
    private String searchId;
    private List<SearchResultDTO> results;
    private SearchMetadataDTO metadata;
    private List<String> suggestions;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SearchResultDTO {
        private String id;  // ID único del resultado
        private String pmid;  // PubMed ID
        private String title;
        private String abstractText;  // Abstract content
        private List<String> authors;
        private String journal;
        private Integer year;  // Año de publicación (número)
        private String studyType;
        private Integer evidenceLevel;
        private Integer sampleSize;  // Nuevo campo
        private Boolean hasConflictOfInterest;  // Nuevo campo
        private String doi;  // Nuevo campo
        
        // Campos opcionales que podemos mantener si existen en base de datos
        private Double relevanceScore;
        private String fullTextUrl;
        private List<String> meshTerms;

        
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SearchMetadataDTO {
        private Integer totalResults;
        private String searchTime;
        private String queryTransformed;
        private List<String> suggestedImprovements;
        private Boolean fallbackUsed;
        private List<String> warnings;
    }
}
