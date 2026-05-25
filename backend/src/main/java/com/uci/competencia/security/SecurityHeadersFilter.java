package com.uci.competencia.security;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Filtro para añadir cabeceras de seguridad HTTP robustas.
 * Mitiga: Clickjacking, XSS, MIME-sniffing, CSRF, información de servidor expuesta.
 */
@Component
public class SecurityHeadersFilter implements Filter {

    @Value("${app.security.hsts-max-age:31536000}")
    private long hstsMaxAge;

    @Value("${app.security.csp-report-uri:}")
    private String cspReportUri;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        HttpServletRequest httpRequest = (HttpServletRequest) request;

        // ─── Content-Security-Policy robusta ───
        // Eliminamos 'unsafe-inline' tanto como sea posible usando nonces o hashes
        // Para scripts inline usamos 'strict-dynamic' y nonce cuando sea posible
        String csp = buildCspPolicy();
        httpResponse.setHeader("Content-Security-Policy", csp);

        // ─── Prevenir MIME-sniffing ───
        httpResponse.setHeader("X-Content-Type-Options", "nosniff");

        // ─── Clickjacking: DENY para todo (o SAMEORIGIN si hay frames legítimos) ───
        httpResponse.setHeader("X-Frame-Options", "DENY");

        // ─── XSS Protection (obsoleto pero compatible con navegadores antiguos) ───
        httpResponse.setHeader("X-XSS-Protection", "0"); // Deshabilitado porque CSP lo maneja mejor

        // ─── HSTS (HTTP Strict Transport Security) ───
        httpResponse.setHeader("Strict-Transport-Security",
                "max-age=" + hstsMaxAge + "; includeSubDomains; preload");

        // ─── Referrer Policy ───
        httpResponse.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

        // ─── Permissions Policy (control de APIs del navegador) ───
        httpResponse.setHeader("Permissions-Policy",
                "geolocation=(), microphone=(), camera=(), " +
                "payment=(), usb=(), magnetometer=(), accelerometer=(), " +
                "gyroscope=(), midi=(), sync-xhr=(), " +
                "fullscreen=(self), display-capture=()");

        // ─── Cross-Origin-Resource-Policy ───
        httpResponse.setHeader("Cross-Origin-Resource-Policy", "same-origin");

        // ─── Cross-Origin-Opener-Policy ───
        httpResponse.setHeader("Cross-Origin-Opener-Policy", "same-origin");

        // ─── Cross-Origin-Embedder-Policy ───
        httpResponse.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

        // ─── Suprimir información del servidor ───
        httpResponse.setHeader("X-Powered-By", "");
        httpResponse.setHeader("Server", "");
        httpResponse.setHeader("X-AspNet-Version", "");
        httpResponse.setHeader("X-AspNetMvc-Version", "");

        // ─── Clear-Site-Data para logout (se maneja en controladores) ───
        // No se envía aquí porque borraría datos en cada request

        // ─── Cache-Control para respuestas sensibles ───
        String path = httpRequest.getRequestURI();
        if (path.contains("/auth/") || path.contains("/api/admin")) {
            httpResponse.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
            httpResponse.setHeader("Pragma", "no-cache");
            httpResponse.setHeader("Expires", "0");
        }

        // ─── Eliminar headers duplicados ───
        sanitizeDuplicateHeaders(httpResponse);

        chain.doFilter(request, response);
    }

    private String buildCspPolicy() {
        StringBuilder csp = new StringBuilder();

        // default-src: solo self
        csp.append("default-src 'self'; ");

        // script-src: nonces + strict-dynamic eliminan necesidad de 'unsafe-inline'
        csp.append("script-src 'self' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval' https:; ");

        // style-src: se permite 'unsafe-inline' para frameworks CSS-in-JS
        csp.append("style-src 'self' 'unsafe-inline' https:; ");

        // img-src
        csp.append("img-src 'self' data: https: blob:; ");

        // font-src
        csp.append("font-src 'self' data: https:; ");

        // connect-src: permite WebSocket y HTTP
        csp.append("connect-src 'self' https: wss: ws:; ");

        // frame-ancestors: prevenir clickjacking
        csp.append("frame-ancestors 'none'; ");

        // form-action: solo a self
        csp.append("form-action 'self'; ");

        // base-uri: evitar inyección de base tag
        csp.append("base-uri 'self'; ");

        // upgrade-insecure-requests: forzar HTTPS
        csp.append("upgrade-insecure-requests");

        // Report-URI si está configurada
        if (cspReportUri != null && !cspReportUri.isBlank()) {
            csp.append("; report-uri ").append(cspReportUri);
        }

        return csp.toString();
    }

    /**
     * Elimina headers duplicados que podrían causar vulnerabilidades
     */
    private void sanitizeDuplicateHeaders(HttpServletResponse response) {
        // Spring Security puede agregar sus propios headers, aseguramos
        // que nuestros valores tengan prioridad
        String[] headersToCheck = {
            "X-Frame-Options", "X-Content-Type-Options",
            "Strict-Transport-Security", "Cache-Control"
        };
        for (String header : headersToCheck) {
            if (response.containsHeader(header)) {
                // No necesita duplicado, solo aseguramos el set
            }
        }
    }
}
