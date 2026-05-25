package com.uci.competencia.security;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Filtro para limitar el tamaño máximo de las solicitudes entrantes.
 * Mitiga ataques de denegación de servicio por payloads demasiado grandes.
 */
@Component
@Order(0)
public class RequestSizeLimitFilter implements Filter {

    private static final Logger log = LoggerFactory.getLogger(RequestSizeLimitFilter.class);

    @Value("${app.security.max-content-length:5242880}")
    private long maxContentLength; // 5MB default

    @Value("${app.security.max-content-length-auth:10240}")
    private long maxContentLengthAuth; // 10KB for auth endpoints

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        String path = httpRequest.getRequestURI();
        String contentLengthHeader = httpRequest.getHeader("Content-Length");

        long contentLength = -1;
        if (contentLengthHeader != null && !contentLengthHeader.isBlank()) {
            try {
                contentLength = Long.parseLong(contentLengthHeader);
            } catch (NumberFormatException e) {
                log.warn("Invalid Content-Length header: {} from IP: {}", contentLengthHeader, httpRequest.getRemoteAddr());
                httpResponse.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                httpResponse.setContentType("application/json");
                httpResponse.getWriter().write(
                    "{\"code\":\"INVALID_CONTENT_LENGTH\",\"message\":\"Invalid Content-Length header.\",\"status\":400}"
                );
                return;
            }
        }

        // Determinar límite según el endpoint
        long limit = maxContentLength;
        if (path.contains("/auth/") || path.contains("/login") || path.contains("/register")) {
            limit = maxContentLengthAuth;
        }

        if (contentLength > limit) {
            log.warn("Request too large: {} bytes from {} on path: {} (limit: {})",
                contentLength, httpRequest.getRemoteAddr(), path, limit);
            httpResponse.setStatus(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
            httpResponse.setContentType("application/json");
            httpResponse.getWriter().write(
                "{\"code\":\"PAYLOAD_TOO_LARGE\",\"message\":\"Request payload exceeds maximum allowed size.\",\"status\":413}"
            );
            return;
        }

        // Wrap request para limitar lectura también
        RequestSizeLimitRequestWrapper wrappedRequest = new RequestSizeLimitRequestWrapper(httpRequest, limit);
        chain.doFilter(wrappedRequest, response);
    }
}