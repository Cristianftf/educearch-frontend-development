package com.uci.competencia.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.InetAddress;
import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Servicio de protección contra Server-Side Request Forgery (SSRF).
 * Valida URLs antes de realizar peticiones HTTP externas para prevenir
 * que un atacante fuerce al servidor a hacer peticiones a recursos internos.
 */
@Service
public class SsrfProtectionService {

    private static final Logger log = LoggerFactory.getLogger(SsrfProtectionService.class);

    private static final List<String> BLOCKED_SCHEMES = Arrays.asList("file", "ftp", "sftp", "ldap", "ldaps", "gopher", "dict");
    private static final List<String> LOCALHOST_NAMES = Arrays.asList("localhost", "127.0.0.1", "::1", "0.0.0.0");
    private static final List<Pattern> PRIVATE_IP_PATTERNS = Arrays.asList(
        Pattern.compile("^127\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$"),
        Pattern.compile("^10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$"),
        Pattern.compile("^172\\.(1[6-9]|2[0-9]|3[01])\\.\\d{1,3}\\.\\d{1,3}$"),
        Pattern.compile("^192\\.168\\.\\d{1,3}\\.\\d{1,3}$"),
        Pattern.compile("^169\\.254\\.\\d{1,3}\\.\\d{1,3}$"),
        Pattern.compile("^0\\.0\\.0\\.0$"),
        Pattern.compile("^::1$"),
        Pattern.compile("^fc00:"),
        Pattern.compile("^fe80:")
    );

    @Value("${app.ssrf.allowed-domains:}")
    private String allowedDomainsStr;

    @Value("${app.ssrf.enabled:true}")
    private boolean ssrfEnabled;

    @Value("${app.ssrf.resolve-dns:true}")
    private boolean resolveDns;

    /**
     * Valida una URL contra ataques SSRF.
     * @param url la URL a validar
     * @throws IllegalArgumentException si la URL es sospechosa de SSRF
     */
    public void validateUrl(String url) {
        if (!ssrfEnabled) {
            return;
        }

        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("URL cannot be empty");
        }

        try {
            URI uri = new URI(url);
            String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase() : "";
            String host = uri.getHost() != null ? uri.getHost().toLowerCase() : "";

            // 1. Validar esquema
            if (BLOCKED_SCHEMES.contains(scheme)) {
                log.warn("SSRF blocked: URL with blocked scheme '{}' : {}", scheme, url);
                throw new IllegalArgumentException("URL scheme not allowed: " + scheme);
            }

            if (!scheme.equals("http") && !scheme.equals("https")) {
                log.warn("SSRF blocked: URL with non-HTTP scheme '{}' : {}", scheme, url);
                throw new IllegalArgumentException("Only HTTP/HTTPS URLs are allowed");
            }

            // 2. Validar host
            if (host.isEmpty()) {
                log.warn("SSRF blocked: URL with no host: {}", url);
                throw new IllegalArgumentException("URL must have a host");
            }

            // 3. Validar contra localhost
            if (isLocalhost(host)) {
                log.warn("SSRF blocked: URL points to localhost: {}", url);
                throw new IllegalArgumentException("URL cannot point to localhost or internal resources");
            }

            // 4. Validar contra IPs privadas
            if (isPrivateIp(host)) {
                log.warn("SSRF blocked: URL points to private IP: {}", url);
                throw new IllegalArgumentException("URL cannot point to private IP addresses");
            }

            // 5. Validar contra dominios permitidos (si están configurados)
            if (!allowedDomainsStr.isBlank()) {
                List<String> allowedDomains = Arrays.asList(allowedDomainsStr.split(","));
                boolean isAllowed = allowedDomains.stream()
                    .anyMatch(d -> host.equals(d.trim().toLowerCase()) || host.endsWith("." + d.trim().toLowerCase()));

                if (!isAllowed) {
                    log.warn("SSRF blocked: URL domain '{}' not in allowed list", host);
                    throw new IllegalArgumentException("URL domain is not in the allowed list");
                }
            }

            // 6. Resolución DNS (opcional, verifica que no resuelva a IP interna)
            if (resolveDns && !isIpAddress(host)) {
                try {
                    InetAddress address = InetAddress.getByName(host);
                    String resolvedIp = address.getHostAddress();
                    if (isPrivateIp(resolvedIp) || isLocalhost(resolvedIp)) {
                        log.warn("SSRF blocked: Domain '{}' resolves to internal IP: {}", host, resolvedIp);
                        throw new IllegalArgumentException("Domain resolves to an internal IP address");
                    }
                } catch (Exception e) {
                    log.warn("SSRF check: DNS resolution failed for '{}': {}", host, e.getMessage());
                    // No bloquear por fallo de DNS, pero loguear
                }
            }

        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.warn("SSRF validation error for URL '{}': {}", url, e.getMessage());
            throw new IllegalArgumentException("Invalid URL: " + e.getMessage());
        }
    }

    private boolean isLocalhost(String host) {
        return LOCALHOST_NAMES.contains(host) || host.endsWith(".local") || host.endsWith(".internal");
    }

    private boolean isPrivateIp(String host) {
        return PRIVATE_IP_PATTERNS.stream().anyMatch(p -> p.matcher(host).matches());
    }

    private boolean isIpAddress(String host) {
        return host.matches("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$") || host.contains(":");
    }
}