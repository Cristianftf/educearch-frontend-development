package com.uci.competencia.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.stream.Collectors;

@Component
@Slf4j
public class JwtTokenProvider {

    @Value("${jwt.secret:mySecretKeyThatIsAtLeast32CharactersLong}")
    private String jwtSecret;

    @Value("${jwt.expiration:86400000}")
    private long jwtExpirationInMs;

    @Value("${jwt.refresh-expiration:604800000}")
    private long refreshTokenExpirationInMs;

    public String generateToken(Authentication authentication) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
        String authorities = authentication.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority)
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
}
