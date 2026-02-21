package com.uci.competencia.service.external;

import com.uci.competencia.model.dto.request.ExternalHealthSearchRequestDTO;
import com.uci.competencia.model.dto.response.ExternalHealthSearchResponseDTO;

public interface HealthSearchProxyService {
    ExternalHealthSearchResponseDTO search(String queryText, int maxResults, ExternalHealthSearchRequestDTO request);
}
