package com.uci.competencia.model.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO para respuesta de logs de auditoría
 * Utilizado en AdminController.getAuditLogs()
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLogDTO {
    
    private String id;
    private LocalDateTime timestamp;
    private String level; // INFO, WARN, ERROR
    private String userId;
    private String userIdentifier;
    private String userDisplayName;
    private String userEmail;
    private String userRole;
    private String ipAddress;
    private String userAgent;
    private String action;
    private String endpoint;
    private Long responseTime;
    private Integer responseStatus;
    private String errorMessage;
}
