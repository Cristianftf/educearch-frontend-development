package com.uci.competencia.service;

import com.uci.competencia.model.dto.response.SystemHealthDTO;

public interface SystemHealthService {
    SystemHealthDTO checkSystemHealth();
    String getPrometheusMetrics();
}
