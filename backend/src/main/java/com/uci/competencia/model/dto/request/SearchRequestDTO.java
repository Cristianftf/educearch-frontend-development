package com.uci.competencia.model.dto.request;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SearchRequestDTO {
    @NotNull(message = "Search query cannot be null")
    private SearchQueryDTO query;

    private SearchFiltersDTO filters;

    private SearchContextDTO context;

    @Data
    public static class SearchQueryDTO {
        @NotEmpty(message = "Search terms cannot be empty")
        private List<String> terms;

        private List<String> operators;
        private List<GroupingDTO> groupings;

        @Size(max = 10, message = "Maximum 10 MeSH terms allowed")
        private List<String> meshTerms;
    }

    @Data
    public static class SearchFiltersDTO {
        @Min(value = 1900, message = "Year from cannot be before 1900")
        @Max(value = 2100, message = "Year from cannot be after 2100")
        private Integer yearFrom;

        @Min(value = 1900, message = "Year to cannot be before 1900")
        @Max(value = 2100, message = "Year to cannot be after 2100")
        private Integer yearTo;

        private List<String> studyTypes;
        private Boolean hasFullText;
        private String language;

        @Min(value = 0, message = "Minimum sample size cannot be negative")
        @Max(value = 100000, message = "Minimum sample size too large")
        private Integer minSampleSize;

        @Max(value = 500, message = "Maximum results limited to 500")
        private Integer maxResults = 100;
    }

    @Data
    public static class GroupingDTO {
        private String operation;
        private List<String> terms;
    }

    @Data
    public static class SearchContextDTO {
        private String userId;
        private Boolean isPractice;
        private String sessionId;
    }
}
