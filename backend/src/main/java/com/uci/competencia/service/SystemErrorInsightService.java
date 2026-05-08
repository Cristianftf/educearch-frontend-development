package com.uci.competencia.service;

import java.util.Map;

public interface SystemErrorInsightService {

    Map<String, Object> analyzeRecentErrors(int windowMinutes, int limit);

    Map<String, Object> getMonitoringOverview(int windowMinutes, int limit);
}
