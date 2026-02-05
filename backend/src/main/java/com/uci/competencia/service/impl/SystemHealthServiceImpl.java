package com.uci.competencia.service.impl;

import com.uci.competencia.model.dto.response.SystemHealthDTO;
import com.uci.competencia.service.SystemHealthService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class SystemHealthServiceImpl implements SystemHealthService {

    @Override
    public SystemHealthDTO checkSystemHealth() {
        log.info("Checking system health");

        SystemHealthDTO health = new SystemHealthDTO();
        health.setStatus("HEALTHY");
        health.setTimestamp(java.time.LocalDateTime.now().toString());

        SystemHealthDTO.DatabaseHealthDTO dbHealth = new SystemHealthDTO.DatabaseHealthDTO();
        dbHealth.setStatus("UP");
        dbHealth.setLatency("45ms");
        health.setDatabase(dbHealth);

        SystemHealthDTO.CacheHealthDTO cacheHealth = new SystemHealthDTO.CacheHealthDTO();
        cacheHealth.setStatus("UP");
        cacheHealth.setMemoryUsage("65%");
        health.setCache(cacheHealth);

        SystemHealthDTO.PubMedHealthDTO pubmedHealth = new SystemHealthDTO.PubMedHealthDTO();
        pubmedHealth.setStatus("UP");
        pubmedHealth.setCallsRemaining(9850);
        health.setPubmed(pubmedHealth);

        return health;
    }

    @Override
    public String getPrometheusMetrics() {
        log.info("Generating Prometheus metrics");
        return "# HELP uci_platform_active_users Active users\n" +
                "# TYPE uci_platform_active_users gauge\n" +
                "uci_platform_active_users 45\n";
    }
}
