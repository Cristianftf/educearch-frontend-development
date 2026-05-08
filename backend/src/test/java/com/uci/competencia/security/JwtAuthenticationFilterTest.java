package com.uci.competencia.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Pruebas unitarias para {@link JwtAuthenticationFilter}.
 *
 * <p>Valida el filtro de autenticación JWT: extracción de token del header,
 * autenticación con token válido, token inválido, ausencia de token,
 * token sin username, excepciones durante validación, y roles/autoridades.</p>
 *
 * @see JwtAuthenticationFilter
 * @see JwtTokenProvider
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("JwtAuthenticationFilter - Pruebas del filtro de autenticación JWT")
class JwtAuthenticationFilterTest {

    @Mock
    private JwtTokenProvider tokenProvider;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private FilterChain filterChain;

    private JwtAuthenticationFilter filter;

    private static final String VALID_TOKEN = "eyJhbGciOiJIUzI1NiJ9.valid-token-value";
    private static final String USERNAME = "maria.garcia@universidad.edu";

    @BeforeEach
    void setUp() {
        filter = new JwtAuthenticationFilter(tokenProvider);
        SecurityContextHolder.clearContext();
    }

    @Nested
    @DisplayName("doFilterInternal() - Procesamiento del filtro JWT")
    class DoFilterInternalTests {

        @Test
        @DisplayName("Given valid token with Bearer prefix, when doFilterInternal, then sets authentication in SecurityContext")
        void givenValidToken_whenDoFilterInternal_thenSetsAuthentication() throws Exception {
            // Arrange
            when(request.getHeader("Authorization")).thenReturn("Bearer " + VALID_TOKEN);
            when(tokenProvider.validateToken(VALID_TOKEN)).thenReturn(true);
            when(tokenProvider.getUsernameFromToken(VALID_TOKEN)).thenReturn(USERNAME);
            when(tokenProvider.getNormalizedAuthoritiesFromToken(VALID_TOKEN))
                .thenReturn(List.of("ROLE_STUDENT"));

            // Act
            filter.doFilterInternal(request, response, filterChain);

            // Assert
            var authentication = SecurityContextHolder.getContext().getAuthentication();
            assertNotNull(authentication, "Authentication must be set in SecurityContext");
            assertEquals(USERNAME, authentication.getPrincipal(),
                "Principal must match the username from token");
            assertEquals(1, authentication.getAuthorities().size(),
                "Must have 1 authority");
            assertEquals("ROLE_STUDENT",
                authentication.getAuthorities().iterator().next().getAuthority(),
                "Authority must be ROLE_STUDENT");
            verify(filterChain, times(1)).doFilter(request, response);
        }

        @Test
        @DisplayName("Given valid token with multiple roles, when doFilterInternal, then sets all authorities")
        void givenValidTokenWithMultipleRoles_whenDoFilterInternal_thenSetsAllAuthorities() throws Exception {
            // Arrange
            when(request.getHeader("Authorization")).thenReturn("Bearer " + VALID_TOKEN);
            when(tokenProvider.validateToken(VALID_TOKEN)).thenReturn(true);
            when(tokenProvider.getUsernameFromToken(VALID_TOKEN)).thenReturn(USERNAME);
            when(tokenProvider.getNormalizedAuthoritiesFromToken(VALID_TOKEN))
                .thenReturn(List.of("ROLE_ADMIN", "ROLE_PROFESSOR"));

            // Act
            filter.doFilterInternal(request, response, filterChain);

            // Assert
            var authentication = SecurityContextHolder.getContext().getAuthentication();
            assertNotNull(authentication);
            assertEquals(2, authentication.getAuthorities().size(),
                "Must have 2 authorities");
            verify(filterChain, times(1)).doFilter(request, response);
        }

        @Test
        @DisplayName("Given no Authorization header, when doFilterInternal, then continues filter chain without authentication")
        void givenNoAuthorizationHeader_whenDoFilterInternal_thenContinuesWithoutAuth() throws Exception {
            // Arrange
            when(request.getHeader("Authorization")).thenReturn(null);

            // Act
            filter.doFilterInternal(request, response, filterChain);

            // Assert
            var authentication = SecurityContextHolder.getContext().getAuthentication();
            assertNull(authentication, "SecurityContext must remain null when no token is present");
            verifyNoInteractions(tokenProvider);
            verify(filterChain, times(1)).doFilter(request, response);
        }

        @Test
        @DisplayName("Given invalid token, when doFilterInternal, then continues without auth and does NOT set authentication")
        void givenInvalidToken_whenDoFilterInternal_thenContinuesWithoutAuth() throws Exception {
            // Arrange
            when(request.getHeader("Authorization")).thenReturn("Bearer invalid-token");
            when(tokenProvider.validateToken("invalid-token")).thenReturn(false);

            // Act
            filter.doFilterInternal(request, response, filterChain);

            // Assert
            var authentication = SecurityContextHolder.getContext().getAuthentication();
            assertNull(authentication, "SecurityContext must not be set for invalid token");
            verify(tokenProvider, times(1)).validateToken("invalid-token");
            verify(tokenProvider, never()).getUsernameFromToken(anyString());
            verify(filterChain, times(1)).doFilter(request, response);
        }

        @Test
        @DisplayName("Given Authorization header without Bearer prefix, when doFilterInternal, then ignores and continues")
        void givenNonBearerAuthorizationHeader_whenDoFilterInternal_thenIgnores() throws Exception {
            // Arrange
            when(request.getHeader("Authorization")).thenReturn("Basic base64credentials");

            // Act
            filter.doFilterInternal(request, response, filterChain);

            // Assert
            var authentication = SecurityContextHolder.getContext().getAuthentication();
            assertNull(authentication, "Non-Bearer authorization must be ignored");
            verifyNoInteractions(tokenProvider);
            verify(filterChain, times(1)).doFilter(request, response);
        }

        @Test
        @DisplayName("Given valid token but null username extracted, when doFilterInternal, then clears context and continues")
        void givenValidTokenWithNullUsername_whenDoFilterInternal_thenClearsContext() throws Exception {
            when(request.getHeader("Authorization")).thenReturn("Bearer " + VALID_TOKEN);
            when(tokenProvider.validateToken(VALID_TOKEN)).thenReturn(true);
            when(tokenProvider.getUsernameFromToken(VALID_TOKEN)).thenReturn(null);
            when(tokenProvider.getNormalizedAuthoritiesFromToken(VALID_TOKEN)).thenReturn(List.of("ROLE_STUDENT"));

            filter.doFilterInternal(request, response, filterChain);

            var authentication = SecurityContextHolder.getContext().getAuthentication();
            assertNull(authentication);
            verify(tokenProvider, times(1)).getNormalizedAuthoritiesFromToken(VALID_TOKEN);
            verify(filterChain, times(1)).doFilter(request, response);
        }

        @Test
        @DisplayName("Given valid token but empty username extracted, when doFilterInternal, then clears context and continues")
        void givenValidTokenWithEmptyUsername_whenDoFilterInternal_thenClearsContext() throws Exception {
            when(request.getHeader("Authorization")).thenReturn("Bearer " + VALID_TOKEN);
            when(tokenProvider.validateToken(VALID_TOKEN)).thenReturn(true);
            when(tokenProvider.getUsernameFromToken(VALID_TOKEN)).thenReturn("");
            when(tokenProvider.getNormalizedAuthoritiesFromToken(VALID_TOKEN)).thenReturn(List.of("ROLE_STUDENT"));

            filter.doFilterInternal(request, response, filterChain);

            var authentication = SecurityContextHolder.getContext().getAuthentication();
            assertNull(authentication);
            verify(filterChain, times(1)).doFilter(request, response);
        }

        @Test
        @DisplayName("Given token provider throws exception during validation, when doFilterInternal, then clears context and continues")
        void givenTokenProviderException_whenDoFilterInternal_thenClearsContext() throws Exception {
            // Arrange
            when(request.getHeader("Authorization")).thenReturn("Bearer " + VALID_TOKEN);
            when(tokenProvider.validateToken(VALID_TOKEN)).thenThrow(new RuntimeException("Unexpected error"));

            // Act
            filter.doFilterInternal(request, response, filterChain);

            // Assert
            var authentication = SecurityContextHolder.getContext().getAuthentication();
            assertNull(authentication, "SecurityContext must be cleared when provider throws");
            verify(filterChain, times(1)).doFilter(request, response);
        }

        @Test
        @DisplayName("Given Authorization header with empty token, when doFilterInternal, then continues without authentication")
        void givenEmptyBearerToken_whenDoFilterInternal_thenContinuesWithoutAuth() throws Exception {
            // Arrange
            when(request.getHeader("Authorization")).thenReturn("Bearer ");

            // Act
            filter.doFilterInternal(request, response, filterChain);

            // Assert
            var authentication = SecurityContextHolder.getContext().getAuthentication();
            assertNull(authentication, "Empty Bearer token must be ignored");
            verifyNoInteractions(tokenProvider);
            verify(filterChain, times(1)).doFilter(request, response);
        }
    }
}