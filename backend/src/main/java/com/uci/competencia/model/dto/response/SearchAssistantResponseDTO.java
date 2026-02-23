package com.uci.competencia.model.dto.response;

import com.uci.competencia.model.dto.request.SearchRequestDTO;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SearchAssistantResponseDTO {
    private String reply;
    private List<SuggestedTermDTO> suggestedTerms;
    private List<String> suggestedOperators;
    private SearchRequestDTO.SearchFiltersDTO suggestedFilters;
    private AutoPlanDTO autoPlan;
    private boolean canAutoApply;
    private List<String> tips;
    private boolean usedAi;
    private boolean fallbackUsed;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SuggestedTermDTO {
        private String id;
        private String term;
        private String description;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AutoPlanDTO {
        private List<String> terms;
        private List<String> operators;
        private SearchRequestDTO.SearchFiltersDTO filters;
        private String rationale;
    }
}
