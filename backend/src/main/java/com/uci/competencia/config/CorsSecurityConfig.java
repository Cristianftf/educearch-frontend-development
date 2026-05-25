package com.uci.competencia.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;

/**
 * Configuración de CORS restrictiva por entorno
 */
@Configuration
@ConfigurationProperties(prefix = "security.cors")
public class CorsSecurityConfig {

    private List<String> allowedOrigins = new ArrayList<>();
    private List<String> allowedMethods = new ArrayList<>();
    private List<String> allowedHeaders = new ArrayList<>();
    private long maxAge = 3600;
    private boolean allowCredentials = true;

    public CorsSecurityConfig() {
        // Valores por defecto (restrictivos)
        this.allowedOrigins.add("http://localhost:3000");
        this.allowedMethods.add("GET");
        this.allowedMethods.add("POST");
        this.allowedMethods.add("PUT");
        this.allowedMethods.add("DELETE");
        this.allowedMethods.add("PATCH");
        this.allowedMethods.add("OPTIONS");
        this.allowedHeaders.add("Authorization");
        this.allowedHeaders.add("Content-Type");
        this.allowedHeaders.add("Accept");
        this.allowedHeaders.add("Origin");
        this.allowedHeaders.add("X-Requested-With");
        this.allowedHeaders.add("X-UCI-Platform");
        this.allowedHeaders.add("X-User-Role");
    }

    public List<String> getAllowedOrigins() {
        return allowedOrigins;
    }

    public void setAllowedOrigins(List<String> allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    public List<String> getAllowedMethods() {
        return allowedMethods;
    }

    public void setAllowedMethods(List<String> allowedMethods) {
        this.allowedMethods = allowedMethods;
    }

    public List<String> getAllowedHeaders() {
        return allowedHeaders;
    }

    public void setAllowedHeaders(List<String> allowedHeaders) {
        this.allowedHeaders = allowedHeaders;
    }

    public long getMaxAge() {
        return maxAge;
    }

    public void setMaxAge(long maxAge) {
        this.maxAge = maxAge;
    }

    public boolean isAllowCredentials() {
        return allowCredentials;
    }

    public void setAllowCredentials(boolean allowCredentials) {
        this.allowCredentials = allowCredentials;
    }
}
