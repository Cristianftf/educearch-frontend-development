package com.uci.competencia.config;

import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        // Usar la serialización por defecto de Spring Data Redis 4.0+
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofHours(1))
            .disableCachingNullValues();

        Map<String, RedisCacheConfiguration> cacheConfigurations = new HashMap<>();
        
        cacheConfigurations.put("mesh-terms", defaultConfig.entryTtl(Duration.ofHours(24)));
        cacheConfigurations.put("search-results", defaultConfig.entryTtl(Duration.ofMinutes(30)));
        cacheConfigurations.put("pubmed-articles", defaultConfig.entryTtl(Duration.ofDays(7)));
        cacheConfigurations.put("common-verifications", defaultConfig.entryTtl(Duration.ofHours(1)));

        return Objects.requireNonNull(RedisCacheManager.builder(connectionFactory)
            .cacheDefaults(defaultConfig)
            .withInitialCacheConfigurations(cacheConfigurations)
            .build());
    }
}
