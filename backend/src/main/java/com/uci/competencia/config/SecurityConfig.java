package com.uci.competencia.config;

import com.uci.competencia.security.JwtAuthenticationFilter;
import com.uci.competencia.security.JwtAuthenticationEntryPoint;
import com.uci.competencia.security.JwtAccessDeniedHandler;
import com.uci.competencia.security.JwtTokenProvider;
import com.uci.competencia.security.SystemRequestAuditFilter;
import com.uci.competencia.security.SecurityHeadersFilter;
import com.uci.competencia.security.IpWhitelistFilter;
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

import java.util.Arrays;
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
    private CorsSecurityConfig corsSecurityConfig;

    @Value("${app.cors.allowed-origin-patterns:http://localhost:3000}")
    private List<String> allowedOriginPatterns;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
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
                .requestMatchers("/api/health", "/api/metrics/**").hasRole("ADMIN")
                // Endpoints normales
                .requestMatchers("/api/search/**").hasAnyRole("STUDENT", "PROFESSOR")
                .requestMatchers("/api/verify/**").hasAnyRole("STUDENT", "PROFESSOR")
                .requestMatchers("/api/chat/**").hasAnyRole("STUDENT", "PROFESSOR", "ADMIN")
                .requestMatchers("/api/student/**").hasRole("STUDENT")
                .requestMatchers("/api/professor/**").hasRole("PROFESSOR")
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())
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
