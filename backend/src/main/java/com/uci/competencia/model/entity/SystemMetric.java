package com.uci.competencia.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

/**
 * Entidad SystemMetric - Métricas de sistema para monitoreo y observabilidad
 */
@Entity
@Table(name = "system_metrics", indexes = {
    @Index(name = "idx_metric_timestamp", columnList = "timestamp"),
    @Index(name = "idx_metric_name", columnList = "metric_name"),
    @Index(name = "idx_metric_type", columnList = "type")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SystemMetric {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private LocalDateTime timestamp;
    
    @Column(nullable = false, length = 100)
    private String metricName; // "active_users", "api_latency_p95", "cache_hit_rate"
    
    @Column(nullable = false)
    private Double metricValue;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MetricType type; // GAUGE, COUNTER, HISTOGRAM
    
    @Column(length = 50)
    private String unit; // "ms", "%", "count"
    
    @Lob
    private String labels; // JSON: {"endpoint": "/api/search", "role": "student"}
    
    @Column(length = 255)
    private String description;
    
    @Column(length = 50)
    private String service; // "api", "database", "cache", "pubmed"
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        if (timestamp == null) {
            timestamp = LocalDateTime.now();
        }
        createdAt = LocalDateTime.now();
    }
    
    public enum MetricType {
        GAUGE("Gauge - Valor instantáneo"),
        COUNTER("Counter - Valor acumulado"),
        HISTOGRAM("Histogram - Distribución de valores");
        
        private final String description;
        
        MetricType(String description) {
            this.description = description;
        }
        
        public String getDescription() {
            return description;
        }
    }
}
