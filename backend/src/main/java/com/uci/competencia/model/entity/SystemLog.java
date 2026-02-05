package com.uci.competencia.model.entity;

import com.uci.competencia.model.enums.ActionType;
import com.uci.competencia.model.enums.LogLevel;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "system_logs", indexes = {
    @Index(name = "idx_timestamp", columnList = "timestamp"),
    @Index(name = "idx_user_id", columnList = "user_id"),
    @Index(name = "idx_action", columnList = "action")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SystemLog {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    
    private LocalDateTime timestamp;
    
    @Enumerated(EnumType.STRING)
    private LogLevel level;
    
    private String userId;
    private String userRole;
    private String ipAddress;
    private String userAgent;
    
    @Enumerated(EnumType.STRING)
    private ActionType action;
    
    private String endpoint;
    
    @Lob
    private String requestDetails;
    
    @Lob
    private String responseDetails;
    
    private Long responseTime;
    private Integer responseStatus;
    
    private String errorMessage;
    private String stackTrace;
    
    private String sessionId;
    private String correlationId;
    
    @PrePersist
    protected void onCreate() {
        timestamp = LocalDateTime.now();
    }
}
