package com.uci.competencia.service;

import com.uci.competencia.model.dto.request.SearchRequestDTO;
import com.uci.competencia.model.dto.response.SearchResponseDTO;

public interface SearchService {
    SearchResponseDTO executeSearch(SearchRequestDTO request);
}
