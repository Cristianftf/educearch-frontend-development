package com.uci.competencia.config;

import com.uci.competencia.security.JwtAuthenticationFilter;
import com.uci.competencia.security.JwtAuthenticationEntryPoint;
import com.uci.competencia.security.JwtAccessDeniedHandler;
import com.uci.competencia.security.JwtTokenProvider;
import com.uci.competencia.security.SystemRequestAuditFilter;
import com.uci.competencia.security.SecurityHeadersFilter;
import com.uci.competencia.security.IpWhitelistFilter;
import com.uci.competencia.security.RateLimitingFilter;
import com.uci.competencia.security.RequestSizeLimitFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.http.HttpMethod;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    @Autowired
    private JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;

    @Autowired
    private JwtAccessDeniedHandler jwtAccessDeniedHandler;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private SystemRequestAuditFilter systemRequestAuditFilter;

    @Autowired
    private SecurityHeadersFilter securityHeadersFilter;

    @Autowired
    private IpWhitelistFilter ipWhitelistFilter;

    @Autowired
    private RequestSizeLimitFilter requestSizeLimitFilter;

    @Autowired
    private CorsSecurityConfig corsSecurityConfig;

    @Value("${app.cors.allowed-origin-patterns:http://localhost:3000}")
    private List<String> allowedOriginPatterns;

    @Bean
    public RateLimitingFilter rateLimitingFilter() {
        return new RateLimitingFilter();
    }

    @Bean
    public FilterRegistrationBean<RateLimitingFilter> rateLimitingFilterRegistration(
        RateLimitingFilter rateLimitingFilter
    ) {
        FilterRegistrationBean<RateLimitingFilter> registration = new FilterRegistrationBean<>(rateLimitingFilter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, RateLimitingFilter rateLimitingFilter) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .exceptionHandling(eh -> eh
                .authenticationEntryPoint(jwtAuthenticationEntryPoint)
                .accessDeniedHandler(jwtAccessDeniedHandler))
            .sessionManagement(sm -> sm
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/ws-native", "/ws-native/**", "/ws/**").permitAll()
                .requestMatchers("/error").permitAll()
                // Endpoints sensibles - requieren autenticación
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").hasRole("ADMIN")
                .requestMatchers("/api/system/**", "/api/health", "/api/metrics/**").hasRole("ADMIN")
                // Endpoints normales
                .requestMatchers("/api/search/**").hasAnyRole("STUDENT", "PROFESSOR")
                .requestMatchers("/api/verify/**").hasAnyRole("STUDENT", "PROFESSOR")
                .requestMatchers("/api/chat/**").hasAnyRole("STUDENT", "PROFESSOR", "ADMIN")
                .requestMatchers("/api/bibliography/**", "/api/export/bibliography", "/api/formats/**")
                    .hasAnyRole("STUDENT", "PROFESSOR")
                .requestMatchers("/api/export/report/**", "/api/professor/**", "/api/evaluations/**", "/api/hedges/**")
                    .hasRole("PROFESSOR")
                .requestMatchers("/api/submissions/**")
                    .hasAnyRole("STUDENT", "PROFESSOR")
                .requestMatchers(HttpMethod.GET, "/api/cases/*")
                    .hasAnyRole("STUDENT", "PROFESSOR")
                .requestMatchers(HttpMethod.GET, "/api/cases/assigned", "/api/cases/*/submission")
                    .hasRole("STUDENT")
                .requestMatchers(HttpMethod.POST, "/api/cases/*/submit")
                    .hasRole("STUDENT")
                .requestMatchers("/api/cases/**")
                    .hasRole("PROFESSOR")
                .requestMatchers(HttpMethod.GET, "/api/progress/me")
                    .hasRole("STUDENT")
                .requestMatchers("/api/progress/**")
                    .hasAnyRole("PROFESSOR", "ADMIN")
                .requestMatchers("/api/student/**").hasRole("STUDENT")
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())
            // Orden de filtros (importante):
            // 1. RequestSizeLimitFilter - primero para limitar tamaño
            // 2. RateLimitingFilter - límite de peticiones
            // 3. IpWhitelistFilter - whitelist de IPs
            // 4. SecurityHeadersFilter - headers de seguridad
            // 5. JwtAuthenticationFilter - autenticación JWT
            // 6. SystemRequestAuditFilter - auditoría
            .addFilterBefore(requestSizeLimitFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(rateLimitingFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(ipWhitelistFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(securityHeadersFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(new JwtAuthenticationFilter(jwtTokenProvider), UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(systemRequestAuditFilter, JwtAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public FilterRegistrationBean<SystemRequestAuditFilter> systemRequestAuditFilterRegistration(
        SystemRequestAuditFilter filter
    ) {
        FilterRegistrationBean<SystemRequestAuditFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        
        // Usar configuración restrictiva de CORS con patrones y orígenes exactos
        List<String> allowedOrigins = corsSecurityConfig.getAllowedOrigins();
        if (!allowedOrigins.isEmpty()) {
            configuration.setAllowedOriginPatterns(allowedOrigins);
        } else {
            configuration.setAllowedOriginPatterns(allowedOriginPatterns);
        }
        
        configuration.setAllowedMethods(corsSecurityConfig.getAllowedMethods());
        configuration.setAllowedHeaders(corsSecurityConfig.getAllowedHeaders());
        configuration.setAllowCredentials(corsSecurityConfig.isAllowCredentials());
        configuration.setMaxAge(corsSecurityConfig.getMaxAge());
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
