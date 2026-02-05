package com.uci.competencia.scheduler;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class CacheCleanupScheduler {

    @Scheduled(cron = "0 0 2 * * ?") // 2 AM daily
    public void cleanupExpiredCache() {
        log.info("Running cache cleanup scheduler");
        // Implementation for cache cleanup
    }
}
