package com.uci.competencia.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class RateLimitingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitingFilter.class);

    private final Map<String, Bucket> localBuckets = new ConcurrentHashMap<>();

    @Value("${app.rate-limit.default-capacity:100}")
    private int defaultCapacity;

    @Value("${app.rate-limit.default-refill:50}")
    private int defaultRefill;

    @Value("${app.rate-limit.default-refill-minutes:1}")
    private int defaultRefillMinutes;

    @Value("${app.rate-limit.auth-capacity:20}")
    private int authCapacity;

    @Value("${app.rate-limit.auth-refill:10}")
    private int authRefill;

    @Value("${app.rate-limit.auth-refill-minutes:1}")
    private int authRefillMinutes;

    @Value("${app.rate-limit.api-capacity:200}")
    private int apiCapacity;

    @Value("${app.rate-limit.api-refill:100}")
    private int apiRefill;

    @Value("${app.rate-limit.api-refill-minutes:1}")
    private int apiRefillMinutes;

    @Value("${app.security.trust-proxy-headers:false}")
    private boolean trustProxyHeaders;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String clientIp = resolveClientIp(request);
        String path = request.getRequestURI();

        String bucketKey = resolveBucketKey(clientIp, path);

        Bucket bucket = resolveBucket(bucketKey, path);

        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            log.warn("Rate limit exceeded for IP: {} on path: {}", clientIp, path);
            response.setStatus(429);
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write(
                "{\"code\":\"RATE_LIMIT_EXCEEDED\",\"message\":\"Too many requests. Please try again later.\",\"status\":429}"
            );
        }
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (trustProxyHeaders) {
            String xForwardedFor = request.getHeader("X-Forwarded-For");
            if (xForwardedFor != null && !xForwardedFor.isBlank()) {
                return xForwardedFor.split(",")[0].trim();
            }
            String xRealIp = request.getHeader("X-Real-IP");
            if (xRealIp != null && !xRealIp.isBlank()) {
                return xRealIp.trim();
            }
        }
        return request.getRemoteAddr();
    }

    private String resolveBucketKey(String clientIp, String path) {
        if (path.contains("/auth/") || path.contains("/login") || path.contains("/register")) {
            return "rate_limit:auth:" + clientIp;
        }
        if (path.startsWith("/api/")) {
            return "rate_limit:api:" + clientIp;
        }
        return "rate_limit:default:" + clientIp;
    }

    private Bucket resolveBucket(String bucketKey, String path) {
        Bucket bucket = localBuckets.get(bucketKey);
        if (bucket == null) {
            bucket = createBucket(bucketKey, path);
            localBuckets.put(bucketKey, bucket);
        }
        return bucket;
    }

    private Bucket createBucket(String bucketKey, String path) {
        Bandwidth limit;
        if (bucketKey.contains(":auth:")) {
            limit = Bandwidth.classic(
                authCapacity,
                Refill.greedy(authRefill, Duration.ofMinutes(authRefillMinutes))
            );
        } else if (bucketKey.contains(":api:")) {
            limit = Bandwidth.classic(
                apiCapacity,
                Refill.greedy(apiRefill, Duration.ofMinutes(apiRefillMinutes))
            );
        } else {
            limit = Bandwidth.classic(
                defaultCapacity,
                Refill.greedy(defaultRefill, Duration.ofMinutes(defaultRefillMinutes))
            );
        }

        return Bucket.builder()
            .addLimit(limit)
            .build();
    }
}
