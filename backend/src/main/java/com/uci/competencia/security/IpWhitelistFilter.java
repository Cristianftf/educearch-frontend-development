package com.uci.competencia.security;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.HashSet;
import java.util.Set;

/**
 * Filtro que valida las IPs permitidas para acceder a endpoints sensibles
 */
@Slf4j
@Component
public class IpWhitelistFilter implements Filter {

    @Value("${security.ip.whitelist:127.0.0.1,::1}")
    private String whitelistedIps;

    @Value("${app.security.trust-proxy-headers:false}")
    private boolean trustProxyHeaders;

    private Set<String> ipWhitelist;

    @Override
    public void init(FilterConfig config) throws ServletException {
        ipWhitelist = new HashSet<>();
        if (whitelistedIps != null && !whitelistedIps.isEmpty()) {
            for (String ip : whitelistedIps.split(",")) {
                String normalizedIp = normalizeIp(ip.trim());
                if (normalizedIp != null) {
                    ipWhitelist.add(normalizedIp);
                }
            }
        }
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String clientIp = getClientIp(httpRequest);
        String requestPath = httpRequest.getRequestURI();

        // Endpoints sensibles que requieren validación de IP
        if (isSensitiveEndpoint(requestPath)) {
            if (!isIpAllowed(clientIp)) {
                log.warn("Blocked sensitive endpoint {} from IP {}. Allowed: {}", requestPath, clientIp, ipWhitelist);
                HttpServletResponse httpResponse = (HttpServletResponse) response;
                httpResponse.setStatus(HttpServletResponse.SC_FORBIDDEN);
                httpResponse.getWriter().write("{\"error\": \"Access denied from IP: " + clientIp + "\"}");
                return;
            }
        }

        chain.doFilter(request, response);
    }

    /**
     * Obtiene la IP real del cliente considerando proxies.
     * Si la petición viene de un proxy local, no se usa X-Forwarded-For para mantener
     * la validación sobre la IP del proxy local y evitar falsos negativos en dev.
     */
    private String getClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        String xRealIp = request.getHeader("X-Real-IP");

        if (!trustProxyHeaders) {
            return remoteAddr;
        }

        if (StringUtils.hasText(xForwardedFor)) {
            return xForwardedFor.split(",")[0].trim();
        }
        if (StringUtils.hasText(xRealIp)) {
            return xRealIp.trim();
        }
        return remoteAddr;
    }

    private boolean isLocalhostAddress(String ip) {
        if (ip == null || ip.isBlank()) {
            return false;
        }

        String normalized = ip.trim();
        if (normalized.equals("127.0.0.1") || normalized.equalsIgnoreCase("localhost") ||
            normalized.equals("::1") || normalized.equals("0:0:0:0:0:0:0:1") ||
            normalized.startsWith("::ffff:")) {
            return true;
        }

        try {
            InetAddress address = InetAddress.getByName(normalized);
            return address.isLoopbackAddress();
        } catch (UnknownHostException e) {
            return false;
        }
    }

    /**
     * Verifica si la IP está en la lista blanca
     */
    private boolean isIpAllowed(String clientIp) {
        String normalizedClientIp = normalizeIp(clientIp);
        if (normalizedClientIp == null) {
            return false;
        }

        if (isLocalhostAddress(normalizedClientIp)) {
            return ipWhitelist.stream().anyMatch(this::isLocalhostAddress);
        }

        return ipWhitelist.contains(normalizedClientIp);
    }

    private String normalizeIp(String ip) {
        if (ip == null || ip.isBlank()) {
            return null;
        }

        String trimmed = ip.trim();
        try {
            InetAddress address = InetAddress.getByName(trimmed);
            return address.getHostAddress();
        } catch (UnknownHostException e) {
            return trimmed;
        }
    }

    /**
     * Determina si el endpoint es sensible y requiere validación de IP.
     *
     * Nota: las APIs de administración deben protegerse con roles y JWT,
     * no con una lista blanca de IP de cliente, para permitir acceso remoto seguro.
     */
    private boolean isSensitiveEndpoint(String path) {
        return path.contains("/api/metrics/") ||
               path.contains("/api/system/metrics/") ||
               path.contains("/actuator") ||
               path.contains("/swagger-ui") ||
               path.contains("/v3/api-docs");
    }
}
