package com.uci.competencia.scheduler;

import com.uci.competencia.service.SystemErrorInsightService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class SystemErrorMonitoringScheduler {

    private final SystemErrorInsightService systemErrorInsightService;

    @Value("${app.monitoring.error-analysis.enabled:true}")
    private boolean analysisEnabled;

    @Value("${app.monitoring.error-analysis-window-minutes:60}")
    private int analysisWindowMinutes;

    @Value("${app.monitoring.error-analysis-batch-size:40}")
    private int analysisBatchSize;

    @Scheduled(fixedDelayString = "${app.monitoring.error-analysis-interval-ms:60000}")
    public void analyzeBackendErrors() {
        if (!analysisEnabled) {
            return;
        }
        try {
            systemErrorInsightService.analyzeRecentErrors(analysisWindowMinutes, analysisBatchSize);
        } catch (Exception ex) {
            log.warn("Scheduled backend error analysis failed: {}", ex.getMessage());
        }
    }
}
