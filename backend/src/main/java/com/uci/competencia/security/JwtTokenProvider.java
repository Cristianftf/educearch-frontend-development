package com.uci.competencia.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import jakarta.annotation.PostConstruct;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.stream.Collectors;

@Component
@Slf4j
public class JwtTokenProvider {

    @Value("${app.jwt.secret:your-secret-key-change-in-production}")
    private String jwtSecret;

    @Value("${app.jwt.expiration:3600000}")
    private long jwtExpirationInMs;

    @Value("${app.jwt.refresh-expiration:604800000}")
    private long refreshTokenExpirationInMs;

    @PostConstruct
    private void validateSecret() {
        if (jwtSecret == null || jwtSecret.length() < 32) {
            throw new IllegalStateException("JWT secret must be at least 32 characters long");
        }
    }

    public String generateToken(org.springframework.security.core.Authentication authentication) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
        String authorities = authentication.getAuthorities().stream()
            .map(org.springframework.security.core.GrantedAuthority::getAuthority)
            .collect(Collectors.joining(","));

        return Jwts.builder()
            .subject(authentication.getName())
            .claim("authorities", authorities)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + jwtExpirationInMs))
            .signWith(key)
            .compact();
    }

    public String generateTokenFromUsername(String username, String roles) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
        return Jwts.builder()
            .subject(username)
            .claim("authorities", roles)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + jwtExpirationInMs))
            .signWith(key)
            .compact();
    }

    public String generateRefreshTokenFromUsername(String username, String roles) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
        return Jwts.builder()
            .subject(username)
            .claim("authorities", roles)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + refreshTokenExpirationInMs))
            .signWith(key)
            .compact();
    }

    public String generatePasswordResetToken(String username, long expirationInMs) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
        return Jwts.builder()
            .subject(username)
            .claim("purpose", "password_reset")
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expirationInMs))
            .signWith(key)
            .compact();
    }

    public String getUsernameFromToken(String token) {
        try {
            SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
            Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
            return claims.getSubject();
        } catch (Exception e) {
            log.error("Error extracting username from token: {}", e.getMessage());
            return null;
        }
    }

    public boolean validateToken(String token) {
        try {
            SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
            Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token);
            return true;
        } catch (Exception e) {
            log.error("Token validation failed: {}", e.getMessage());
            return false;
        }
    }

    public String getAuthoritiesFromToken(String token) {
        try {
            SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
            Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
            return (String) claims.get("authorities");
        } catch (Exception e) {
            log.error("Error extracting authorities from token: {}", e.getMessage());
            return null;
        }
    }

    public String getPurposeFromToken(String token) {
        try {
            SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
            Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
            Object purpose = claims.get("purpose");
            return purpose instanceof String ? (String) purpose : null;
        } catch (Exception e) {
            log.error("Error extracting token purpose: {}", e.getMessage());
            return null;
        }
    }

    public List<String> getNormalizedAuthoritiesFromToken(String token) {
        String rawAuthorities = getAuthoritiesFromToken(token);
        if (rawAuthorities == null || rawAuthorities.isBlank()) {
            return Collections.emptyList();
        }

        return java.util.Arrays.stream(rawAuthorities.split(","))
            .map(String::trim)
            .filter(value -> !value.isBlank())
            .map(this::normalizeAuthority)
            .filter(Objects::nonNull)
            .distinct()
            .collect(Collectors.toList());
    }

    private String normalizeAuthority(String authority) {
        if (authority == null || authority.isBlank()) {
            return null;
        }

        String normalized = authority.trim().toUpperCase(Locale.ROOT);
        if (normalized.startsWith("ROLE_")) {
            return normalized;
        }

        return switch (normalized) {
            case "ADMIN", "PROFESSOR", "STUDENT" -> "ROLE_" + normalized;
            default -> normalized;
        };
    }
}
