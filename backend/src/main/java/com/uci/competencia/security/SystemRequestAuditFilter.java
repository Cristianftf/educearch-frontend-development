package com.uci.competencia.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.entity.SystemLog;
import com.uci.competencia.model.enums.ActionType;
import com.uci.competencia.model.enums.LogLevel;
import com.uci.competencia.repository.SystemLogRepository;
import com.uci.competencia.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
@Slf4j
public class SystemRequestAuditFilter extends OncePerRequestFilter {

    private static final Pattern UUID_PATTERN = Pattern.compile(
        "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
    );

    private final SystemLogRepository systemLogRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Value("${app.monitoring.audit.enabled:true}")
    private boolean auditEnabled;

    @Value("${app.monitoring.audit.include-success:true}")
    private boolean includeSuccessLogs;

    @Value("${app.monitoring.audit.max-details-length:4000}")
    private int maxDetailsLength;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (path == null || path.isBlank()) return true;
        if (!path.startsWith("/api/")) return true;
        return path.startsWith("/api/admin/audit/logs");
    }

    @Override
    protected boolean shouldNotFilterErrorDispatch() {
        return true;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {
        long startedAt = System.currentTimeMillis();
        String correlationId = resolveCorrelationId(request);
        response.setHeader("X-Correlation-Id", correlationId);

        Exception capturedException = null;
        try {
            filterChain.doFilter(request, response);
        } catch (Exception ex) {
            capturedException = ex;
            throw ex;
        } finally {
            if (!auditEnabled) {
                return;
            }
            persistAuditLog(request, response, correlationId, startedAt, capturedException);
        }
    }

    private void persistAuditLog(
        HttpServletRequest request,
        HttpServletResponse response,
        String correlationId,
        long startedAt,
        Exception capturedException
    ) {
        int status = response.getStatus();
        if (!includeSuccessLogs && status < 400) {
            return;
        }

        long durationMs = Math.max(1L, System.currentTimeMillis() - startedAt);
        String path = request.getRequestURI();

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = resolveUserId(auth);
        String userRole = resolveUserRole(auth);

        SystemLog entry = new SystemLog();
        entry.setTimestamp(LocalDateTime.now());
        entry.setLevel(resolveLogLevel(status, capturedException));
        entry.setUserId(userId);
        entry.setUserRole(userRole);
        entry.setIpAddress(resolveIpAddress(request));
        entry.setUserAgent(trimToLength(request.getHeader("User-Agent"), 512));
        entry.setAction(resolveActionType(request.getMethod(), path));
        entry.setEndpoint(trimToLength(path, 255));
        entry.setRequestDetails(buildRequestDetails(request));
        entry.setResponseDetails(buildResponseDetails(response, durationMs));
        entry.setResponseTime(durationMs);
        entry.setResponseStatus(status);
        entry.setErrorMessage(resolveErrorMessage(request, capturedException, status));
        entry.setStackTrace(resolveStackTrace(capturedException));
        entry.setSessionId(resolveSessionId(request));
        entry.setCorrelationId(correlationId);

        try {
            systemLogRepository.save(entry);
        } catch (Exception ex) {
            log.warn("Could not persist audit log for endpoint {}: {}", path, ex.getMessage());
        }
    }

    private String resolveCorrelationId(HttpServletRequest request) {
        String header = request.getHeader("X-Correlation-Id");
        if (header != null && !header.trim().isEmpty()) {
            return trimToLength(header.trim(), 120);
        }
        return UUID.randomUUID().toString();
    }

    private String resolveSessionId(HttpServletRequest request) {
        try {
            return request.getSession(false) != null ? request.getSession(false).getId() : null;
        } catch (Exception ex) {
            return null;
        }
    }

    private String resolveIpAddress(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return trimToLength(forwarded.split(",")[0].trim(), 120);
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return trimToLength(realIp.trim(), 120);
        }
        return trimToLength(request.getRemoteAddr(), 120);
    }

    private String resolveUserId(Authentication auth) {
        if (!isResolvableAuthentication(auth)) {
            return "ANONYMOUS";
        }
        String name = auth.getName();
        if (!isResolvableUserIdentifier(name)) {
            return "ANONYMOUS";
        }
        String normalized = name.trim();
        Optional<String> resolvedById = isUuid(normalized)
            ? userRepository.findById(normalized).map(user -> trimToLength(user.getId(), 120))
            : Optional.empty();
        return resolvedById
            .or(() -> userRepository.findByEmail(normalized).map(user -> trimToLength(user.getId(), 120)))
            .or(() -> userRepository.findByUsername(normalized).map(user -> trimToLength(user.getId(), 120)))
            .orElseGet(() -> trimToLength(normalized, 120));
    }

    private String resolveUserRole(Authentication auth) {
        if (!isResolvableAuthentication(auth) || auth.getAuthorities() == null || auth.getAuthorities().isEmpty()) {
            return "ANONYMOUS";
        }
        Optional<? extends GrantedAuthority> authority = auth.getAuthorities().stream().findFirst();
        return authority.map(GrantedAuthority::getAuthority).map(value -> trimToLength(value, 80)).orElse("ANONYMOUS");
    }

    private boolean isResolvableAuthentication(Authentication auth) {
        return auth != null
            && auth.isAuthenticated()
            && !(auth instanceof AnonymousAuthenticationToken)
            && isResolvableUserIdentifier(auth.getName());
    }

    private boolean isResolvableUserIdentifier(String identifier) {
        if (identifier == null) {
            return false;
        }
        String normalized = identifier.trim();
        return !normalized.isBlank() && !"anonymousUser".equalsIgnoreCase(normalized);
    }

    private boolean isUuid(String value) {
        return value != null && UUID_PATTERN.matcher(value).matches();
    }

    private LogLevel resolveLogLevel(int status, Exception ex) {
        if (ex != null || status >= 500) return LogLevel.ERROR;
        if (status >= 400) return LogLevel.WARN;
        return LogLevel.INFO;
    }

    private ActionType resolveActionType(String method, String path) {
        String endpoint = path == null ? "" : path.toLowerCase();
        String httpMethod = method == null ? "" : method.toUpperCase();

        if (endpoint.contains("/auth/login")) return ActionType.LOGIN;
        if (endpoint.contains("/auth/logout")) return ActionType.LOGOUT;
        if (endpoint.contains("/search")) return ActionType.SEARCH;
        if (endpoint.contains("/verify")) return ActionType.VERIFY;
        if (endpoint.contains("/export")) return ActionType.EXPORT;
        if (endpoint.contains("/case") && "POST".equals(httpMethod)) return ActionType.CREATE_CASE;
        if (endpoint.contains("/submit")) return ActionType.SUBMIT_CASE;
        if (endpoint.contains("/grade") || endpoint.contains("/evaluation")) return ActionType.GRADE_CASE;
        if (endpoint.contains("/admin/users")) {
            if ("POST".equals(httpMethod)) return ActionType.CREATE_USER;
            if ("PUT".equals(httpMethod) || "PATCH".equals(httpMethod)) return ActionType.UPDATE_USER;
            if ("DELETE".equals(httpMethod)) return ActionType.DELETE_USER;
        }
        if (endpoint.contains("/admin/settings")) return ActionType.CHANGE_SETTINGS;
        if (endpoint.contains("/admin/audit/export")) return ActionType.GENERATE_REPORT;
        if (endpoint.contains("/backup")) return ActionType.BACKUP;
        if (endpoint.contains("/restore")) return ActionType.RESTORE;
        return ActionType.VIEW_ANALYTICS;
    }

    private String buildRequestDetails(HttpServletRequest request) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("method", request.getMethod());
        details.put("path", request.getRequestURI());
        details.put("query", request.getQueryString());
        details.put("contentType", request.getContentType());
        details.put("remoteAddr", resolveIpAddress(request));
        details.put("userAgent", trimToLength(request.getHeader("User-Agent"), 220));
        details.put("timestamp", LocalDateTime.now().toString());
        return toJson(details);
    }

    private String buildResponseDetails(HttpServletResponse response, long durationMs) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("status", response.getStatus());
        details.put("durationMs", durationMs);
        details.put("timestamp", LocalDateTime.now().toString());
        return toJson(details);
    }

    private String resolveErrorMessage(HttpServletRequest request, Exception ex, int status) {
        if (ex != null) {
            String message = ex.getClass().getSimpleName() + ": " + ex.getMessage();
            return trimToLength(message, 2000);
        }
        Object requestError = request.getAttribute("system.error.message");
        if (requestError != null) {
            return trimToLength(String.valueOf(requestError), 2000);
        }
        if (status >= 500) {
            return "HTTP " + status + " - Internal server error";
        }
        if (status >= 400) {
            return "HTTP " + status;
        }
        return null;
    }

    private String resolveStackTrace(Exception ex) {
        if (ex == null) return null;
        StringBuilder builder = new StringBuilder();
        builder.append(ex.getClass().getName()).append(": ").append(ex.getMessage()).append('\n');
        StackTraceElement[] stack = ex.getStackTrace();
        int maxFrames = Math.min(stack.length, 20);
        for (int i = 0; i < maxFrames; i++) {
            builder.append("at ").append(stack[i]).append('\n');
        }
        return trimToLength(builder.toString(), 8000);
    }

    private String toJson(Map<String, Object> value) {
        try {
            return trimToLength(objectMapper.writeValueAsString(value), maxDetailsLength);
        } catch (Exception ex) {
            return trimToLength(value.toString(), maxDetailsLength);
        }
    }

    private String trimToLength(String value, int maxLength) {
        if (value == null) return null;
        String normalized = value.trim();
        if (normalized.length() <= maxLength) return normalized;
        return normalized.substring(0, maxLength);
    }
}
