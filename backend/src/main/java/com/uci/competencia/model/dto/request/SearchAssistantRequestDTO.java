package com.uci.competencia.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SearchAssistantRequestDTO {

    @NotBlank(message = "Assistant message cannot be empty")
    private String message;

    private List<String> selectedTerms;
    private List<String> operators;
    private List<String> recentTerms;
    private SearchRequestDTO.SearchFiltersDTO filters;
    private String projectContext;
    private List<ConversationMessageDTO> conversationHistory;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ConversationMessageDTO {
        private String role;
        private String content;
    }
}
