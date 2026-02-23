package com.uci.competencia.service;

import com.uci.competencia.model.dto.request.SearchAssistantRequestDTO;
import com.uci.competencia.model.dto.response.SearchAssistantResponseDTO;

public interface SearchAssistantService {
    SearchAssistantResponseDTO generateResponse(SearchAssistantRequestDTO request);
}
