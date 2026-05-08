package com.uci.competencia.model.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "system_error_insights", indexes = {
    @Index(name = "idx_error_insights_last_seen", columnList = "last_seen"),
    @Index(name = "idx_error_insights_severity", columnList = "severity"),
    @Index(name = "idx_error_insights_fingerprint", columnList = "fingerprint", unique = true)
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SystemErrorInsight {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false, length = 190, unique = true)
    private String fingerprint;

    @Column(length = 255)
    private String endpoint;

    private Integer httpStatus;

    @Column(length = 20)
    private String severity;

    @Column(length = 120)
    private String errorType;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @Column(columnDefinition = "TEXT")
    private String sampleStackTrace;

    @Column(columnDefinition = "TEXT")
    private String aiDiagnosis;

    @Column(columnDefinition = "TEXT")
    private String aiRecommendations;

    private Double aiConfidence;

    @Column(nullable = false)
    private Long occurrences;

    @Column(nullable = false)
    private LocalDateTime firstSeen;

    @Column(nullable = false)
    private LocalDateTime lastSeen;

    private LocalDateTime lastAnalyzedAt;

    @Column(length = 120)
    private String lastLogId;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (occurrences == null || occurrences < 1) {
            occurrences = 1L;
        }
        if (firstSeen == null) {
            firstSeen = now;
        }
        if (lastSeen == null) {
            lastSeen = now;
        }
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
