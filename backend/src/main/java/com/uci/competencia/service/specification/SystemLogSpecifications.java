package com.uci.competencia.service.specification;

import com.uci.competencia.model.entity.SystemLog;
import com.uci.competencia.model.enums.ActionType;
import com.uci.competencia.model.enums.LogLevel;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;

/**
 * Especificaciones para búsquedas dinámicas de SystemLog
 * 
 * Utiliza JPA Criteria API para construir queries sin concatenación de strings
 * Facilita filtrado por múltiples campos
 */
public class SystemLogSpecifications {
    
    /**
     * Especificación para filtrar por nivel
     */
    public static Specification<SystemLog> hasLevel(LogLevel level) {
        return (root, query, cb) -> {
            if (level == null) return cb.conjunction();
            return cb.equal(root.get("level"), level);
        };
    }
    
    /**
     * Especificación para filtrar por usuario
     */
    public static Specification<SystemLog> hasUserId(String userId) {
        return (root, query, cb) -> {
            if (userId == null || userId.isEmpty()) return cb.conjunction();
            return cb.equal(root.get("userId"), userId);
        };
    }

    public static Specification<SystemLog> matchesUserIdentifier(String userIdentifier) {
        return (root, query, cb) -> {
            if (userIdentifier == null || userIdentifier.isBlank()) return cb.conjunction();
            String normalized = userIdentifier.trim().toLowerCase();
            String like = "%" + normalized + "%";
            return cb.like(cb.lower(root.get("userId")), like);
        };
    }
    
    /**
     * Especificación para filtrar por acción
     */
    public static Specification<SystemLog> hasAction(ActionType action) {
        return (root, query, cb) -> {
            if (action == null) return cb.conjunction();
            return cb.equal(root.get("action"), action);
        };
    }
    
    /**
     * Especificación para filtrar por endpoint
     */
    public static Specification<SystemLog> hasEndpoint(String endpoint) {
        return (root, query, cb) -> {
            if (endpoint == null || endpoint.isEmpty()) return cb.conjunction();
            return cb.like(root.get("endpoint"), "%" + endpoint + "%");
        };
    }
    
    /**
     * Especificación para filtrar por rango de tiempo (desde)
     */
    public static Specification<SystemLog> fromTimestamp(LocalDateTime startDate) {
        return (root, query, cb) -> {
            if (startDate == null) return cb.conjunction();
            return cb.greaterThanOrEqualTo(root.get("timestamp"), startDate);
        };
    }
    
    /**
     * Especificación para filtrar por rango de tiempo (hasta)
     */
    public static Specification<SystemLog> toTimestamp(LocalDateTime endDate) {
        return (root, query, cb) -> {
            if (endDate == null) return cb.conjunction();
            return cb.lessThanOrEqualTo(root.get("timestamp"), endDate);
        };
    }
    
    /**
     * Especificación para filtrar por rol del usuario
     */
    public static Specification<SystemLog> hasUserRole(String userRole) {
        return (root, query, cb) -> {
            if (userRole == null || userRole.isEmpty()) return cb.conjunction();
            return cb.equal(root.get("userRole"), userRole);
        };
    }
    
    /**
     * Especificación para filtrar por código de respuesta HTTP
     */
    public static Specification<SystemLog> hasResponseStatus(Integer status) {
        return (root, query, cb) -> {
            if (status == null) return cb.conjunction();
            return cb.equal(root.get("responseStatus"), status);
        };
    }
    
    /**
     * Especificación para filtrar solo logs con error
     */
    public static Specification<SystemLog> hasError() {
        return (root, query, cb) -> cb.isNotNull(root.get("errorMessage"));
    }
    
    /**
     * Especificación para buscar logs por dirección IP
     */
    public static Specification<SystemLog> hasIpAddress(String ipAddress) {
        return (root, query, cb) -> {
            if (ipAddress == null || ipAddress.isEmpty()) return cb.conjunction();
            return cb.equal(root.get("ipAddress"), ipAddress);
        };
    }

    /**
     * EspecificaciÃ³n para busqueda libre en campos comunes
     */
    public static Specification<SystemLog> containsSearch(String search) {
        return (root, query, cb) -> {
            if (search == null || search.isEmpty()) return cb.conjunction();
            String like = "%" + search.toLowerCase() + "%";
            return cb.or(
                cb.like(cb.lower(root.get("userId")), like),
                cb.like(cb.lower(root.get("userRole")), like),
                cb.like(cb.lower(root.get("endpoint")), like),
                cb.like(cb.lower(root.get("errorMessage")), like),
                cb.like(cb.lower(root.get("requestDetails")), like),
                cb.like(cb.lower(root.get("responseDetails")), like),
                cb.like(cb.lower(root.get("userAgent")), like),
                cb.like(cb.lower(root.get("ipAddress")), like)
            );
        };
    }
}
