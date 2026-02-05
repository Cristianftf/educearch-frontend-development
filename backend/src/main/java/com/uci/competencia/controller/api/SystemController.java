package com.uci.competencia.controller.api;

import com.uci.competencia.model.dto.response.SystemHealthDTO;
import com.uci.competencia.service.SystemHealthService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/system")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001", "https://frontend.uci.cu"})
@Slf4j
public class SystemController {

    @Autowired
    private SystemHealthService systemHealthService;

    @GetMapping("/health")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SystemHealthDTO> getSystemHealth() {
        log.info("Getting system health status");
        SystemHealthDTO health = systemHealthService.checkSystemHealth();
        return ResponseEntity.ok(health);
    }

    @GetMapping("/metrics/prometheus")
    public ResponseEntity<String> getPrometheusMetrics() {
        log.info("Getting Prometheus metrics");
        String metrics = systemHealthService.getPrometheusMetrics();
        return ResponseEntity.ok()
            .header("Content-Type", "text/plain; charset=UTF-8")
            .body(metrics);
    }
}
