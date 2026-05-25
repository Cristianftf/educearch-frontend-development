package com.uci.competencia.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pruebas unitarias para {@link JwtTokenProvider}.
 *
 * <p>Valida la generación, validación y extracción de datos de tokens JWT.
 * Cubre: generación de token desde Authentication, desde username+roles,
 * refresh token, validación de token válido, token expirado, token inválido,
 * token malformado, extracción de username y authorities, normalización de roles.</p>
 *
 * @see JwtTokenProvider
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("JwtTokenProvider - Pruebas del manejador de tokens JWT")
class JwtTokenProviderTest {

    private JwtTokenProvider tokenProvider;

    private static final String JWT_SECRET = "miClaveSecretaSuperSegura2024QueCumple32Caracteres!"; // 49 chars
    private static final long JWT_EXPIRATION = 3600000; // 1 hora
    private static final long REFRESH_EXPIRATION = 604800000; // 7 días

    private static final String USERNAME = "maria.garcia@universidad.edu";
    private static final String ROLES = "ROLE_STUDENT";

    @BeforeEach
    void setUp() {
        tokenProvider = new JwtTokenProvider();
        ReflectionTestUtils.setField(tokenProvider, "jwtSecret", JWT_SECRET);
        ReflectionTestUtils.setField(tokenProvider, "jwtExpirationInMs", JWT_EXPIRATION);
        ReflectionTestUtils.setField(tokenProvider, "refreshTokenExpirationInMs", REFRESH_EXPIRATION);
    }

    // =========================================================================
    //  1. generateToken(Authentication)
    // =========================================================================

    @Nested
    @DisplayName("generateToken(Authentication) - Generación desde Authentication")
    class GenerateTokenFromAuthenticationTests {

        @Test
        @DisplayName("Given valid Authentication, when generateToken, then returns valid JWT string")
        void givenValidAuthentication_whenGenerateToken_thenReturnsValidJwt() {
            Authentication authentication = new UsernamePasswordAuthenticationToken(
                USERNAME, null,
                List.of(new SimpleGrantedAuthority("ROLE_STUDENT"))
            );

            String token = tokenProvider.generateToken(authentication);

            assertNotNull(token, "Token must not be null");
            assertTrue(token.split("\\.").length == 3, "JWT must have 3 parts (header.payload.signature)");
            assertTrue(tokenProvider.validateToken(token), "Generated token must be valid");
            assertEquals(USERNAME, tokenProvider.getUsernameFromToken(token), "Username must match");
            String authorities = tokenProvider.getAuthoritiesFromToken(token);
            assertTrue(authorities.contains("ROLE_STUDENT"), "Token must contain ROLE_STUDENT");
        }

        @Test
        @DisplayName("Given Authentication with multiple authorities, when generateToken, then token contains all roles")
        void givenAuthenticationWithMultipleAuthorities_whenGenerateToken_thenTokenContainsAllRoles() {
            Authentication authentication = new UsernamePasswordAuthenticationToken(
                "admin@universidad.edu", null,
                List.of(
                    new SimpleGrantedAuthority("ROLE_ADMIN"),
                    new SimpleGrantedAuthority("ROLE_PROFESSOR")
                )
            );

            String token = tokenProvider.generateToken(authentication);

            assertNotNull(token);
            String authorities = tokenProvider.getAuthoritiesFromToken(token);
            assertTrue(authorities.contains("ROLE_ADMIN"), "Must contain ROLE_ADMIN");
            assertTrue(authorities.contains("ROLE_PROFESSOR"), "Must contain ROLE_PROFESSOR");
        }
    }

    // =========================================================================
    //  2. generateTokenFromUsername()
    // =========================================================================

    @Nested
    @DisplayName("generateTokenFromUsername() - Generación desde username + roles")
    class GenerateTokenFromUsernameTests {

        @Test
        @DisplayName("Given username and roles, when generateTokenFromUsername, then returns valid JWT")
        void givenUsernameAndRoles_whenGenerateTokenFromUsername_thenReturnsValidJwt() {
            String token = tokenProvider.generateTokenFromUsername(USERNAME, ROLES);

            assertNotNull(token);
            assertTrue(tokenProvider.validateToken(token));
            assertEquals(USERNAME, tokenProvider.getUsernameFromToken(token));
            assertEquals(ROLES, tokenProvider.getAuthoritiesFromToken(token));
        }

        @Test
        @DisplayName("Given empty roles string, when generateTokenFromUsername, then generates token with empty authorities")
        void givenEmptyRoles_whenGenerateTokenFromUsername_thenGeneratesTokenWithEmptyAuthorities() {
            String token = tokenProvider.generateTokenFromUsername(USERNAME, "");

            assertNotNull(token);
            assertTrue(tokenProvider.validateToken(token));
            assertEquals("", tokenProvider.getAuthoritiesFromToken(token));
        }
    }

    // =========================================================================
    //  3. generateRefreshTokenFromUsername()
    // =========================================================================

    @Nested
    @DisplayName("generateRefreshTokenFromUsername() - Generación de refresh token")
    class GenerateRefreshTokenTests {

        @Test
        @DisplayName("Given username and roles, when generateRefreshTokenFromUsername, then returns valid longer-lived token")
        void givenUsernameAndRoles_whenGenerateRefreshTokenFromUsername_thenReturnsValidRefreshToken() {
            String refreshToken = tokenProvider.generateRefreshTokenFromUsername(USERNAME, ROLES);

            assertNotNull(refreshToken, "Refresh token must not be null");
            assertTrue(tokenProvider.validateToken(refreshToken));
            assertEquals(USERNAME, tokenProvider.getUsernameFromToken(refreshToken));
        }
    }

    @Nested
    @DisplayName("generatePasswordResetToken() - Generacion de token de recuperacion")
    class GeneratePasswordResetTokenTests {

        @Test
        @DisplayName("Given username, when generatePasswordResetToken, then token has reset purpose")
        void givenUsername_whenGeneratePasswordResetToken_thenTokenHasResetPurpose() {
            String resetToken = tokenProvider.generatePasswordResetToken(USERNAME, 900000);

            assertNotNull(resetToken);
            assertTrue(tokenProvider.validateToken(resetToken));
            assertEquals(USERNAME, tokenProvider.getUsernameFromToken(resetToken));
            assertEquals("password_reset", tokenProvider.getPurposeFromToken(resetToken));
            assertNull(tokenProvider.getAuthoritiesFromToken(resetToken));
        }
    }

    // =========================================================================
    //  4. validateToken()
    // =========================================================================

    @Nested
    @DisplayName("validateToken() - Validación de tokens")
    class ValidateTokenTests {

        @Test
        @DisplayName("Given valid token, when validateToken, then returns true")
        void givenValidToken_whenValidateToken_thenReturnsTrue() {
            String token = tokenProvider.generateTokenFromUsername(USERNAME, ROLES);

            boolean isValid = tokenProvider.validateToken(token);

            assertTrue(isValid);
        }

        @Test
        @DisplayName("Given expired token, when validateToken, then returns false")
        void givenExpiredToken_whenValidateToken_thenReturnsFalse() {
            SecretKey key = Keys.hmacShaKeyFor(JWT_SECRET.getBytes());
            String expiredToken = Jwts.builder()
                .subject(USERNAME)
                .claim("authorities", ROLES)
                .issuedAt(new Date(System.currentTimeMillis() - 7200000))
                .expiration(new Date(System.currentTimeMillis() - 3600000))
                .signWith(key)
                .compact();

            boolean isValid = tokenProvider.validateToken(expiredToken);

            assertFalse(isValid);
        }

        @Test
        @DisplayName("Given malformed token, when validateToken, then returns false")
        void givenMalformedToken_whenValidateToken_thenReturnsFalse() {
            assertFalse(tokenProvider.validateToken("not.a.jwt"));
        }

        @Test
        @DisplayName("Given null token, when validateToken, then returns false")
        void givenNullToken_whenValidateToken_thenReturnsFalse() {
            assertFalse(tokenProvider.validateToken(null));
        }

        @Test
        @DisplayName("Given empty token, when validateToken, then returns false")
        void givenEmptyToken_whenValidateToken_thenReturnsFalse() {
            assertFalse(tokenProvider.validateToken(""));
        }

        @Test
        @DisplayName("Given token signed with different secret, when validateToken, then returns false")
        void givenTokenWithDifferentSecret_whenValidateToken_thenReturnsFalse() {
            SecretKey differentKey = Keys.hmacShaKeyFor("otraClaveSecretaDiferente32CaracteresMinimo!".getBytes());
            String foreignToken = Jwts.builder()
                .subject(USERNAME)
                .claim("authorities", ROLES)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 3600000))
                .signWith(differentKey)
                .compact();

            assertFalse(tokenProvider.validateToken(foreignToken));
        }
    }

    // =========================================================================
    //  5. getUsernameFromToken()
    // =========================================================================

    @Nested
    @DisplayName("getUsernameFromToken() - Extracción de username del token")
    class GetUsernameFromTokenTests {

        @Test
        @DisplayName("Given valid token, when getUsernameFromToken, then returns username")
        void givenValidToken_whenGetUsernameFromToken_thenReturnsUsername() {
            String token = tokenProvider.generateTokenFromUsername(USERNAME, ROLES);

            assertEquals(USERNAME, tokenProvider.getUsernameFromToken(token));
        }

        @Test
        @DisplayName("Given invalid token, when getUsernameFromToken, then returns null")
        void givenInvalidToken_whenGetUsernameFromToken_thenReturnsNull() {
            assertNull(tokenProvider.getUsernameFromToken("invalid-token"));
        }

        @Test
        @DisplayName("Given null token, when getUsernameFromToken, then returns null")
        void givenNullToken_whenGetUsernameFromToken_thenReturnsNull() {
            assertNull(tokenProvider.getUsernameFromToken(null));
        }
    }

    // =========================================================================
    //  6. getAuthoritiesFromToken()
    // =========================================================================

    @Nested
    @DisplayName("getAuthoritiesFromToken() - Extracción de authorities")
    class GetAuthoritiesFromTokenTests {

        @Test
        @DisplayName("Given valid token with roles, when getAuthoritiesFromToken, then returns roles string")
        void givenValidToken_whenGetAuthoritiesFromToken_thenReturnsRoles() {
            String token = tokenProvider.generateTokenFromUsername(USERNAME, "ROLE_STUDENT,ROLE_PROFESSOR");

            String authorities = tokenProvider.getAuthoritiesFromToken(token);

            assertNotNull(authorities);
            assertTrue(authorities.contains("ROLE_STUDENT"));
            assertTrue(authorities.contains("ROLE_PROFESSOR"));
        }
    }

    // =========================================================================
    //  7. getNormalizedAuthoritiesFromToken()
    // =========================================================================

    @Nested
    @DisplayName("getNormalizedAuthoritiesFromToken() - Normalización de roles")
    class GetNormalizedAuthoritiesTests {

        @Test
        @DisplayName("Given token with ROLE_STUDENT, when getNormalizedAuthoritiesFromToken, then returns normalized list")
        void givenTokenWithRoleStudent_whenGetNormalizedAuthorities_thenReturnsNormalizedList() {
            String token = tokenProvider.generateTokenFromUsername(USERNAME, "ROLE_STUDENT");

            List<String> authorities = tokenProvider.getNormalizedAuthoritiesFromToken(token);

            assertFalse(authorities.isEmpty());
            assertEquals(1, authorities.size());
            assertEquals("ROLE_STUDENT", authorities.getFirst());
        }

        @Test
        @DisplayName("Given token with non-prefixed role 'STUDENT', when getNormalizedAuthoritiesFromToken, then normalizes to ROLE_STUDENT")
        void givenTokenWithNonPrefixedRole_whenGetNormalizedAuthorities_thenNormalizesRole() {
            String token = tokenProvider.generateTokenFromUsername(USERNAME, "STUDENT");

            List<String> authorities = tokenProvider.getNormalizedAuthoritiesFromToken(token);

            assertEquals(1, authorities.size());
            assertEquals("ROLE_STUDENT", authorities.getFirst());
        }

        @Test
        @DisplayName("Given token with ADMIN, PROFESSOR roles, when getNormalizedAuthoritiesFromToken, then normalizes all")
        void givenTokenWithMultipleRoles_whenGetNormalizedAuthorities_thenNormalizesAll() {
            String token = tokenProvider.generateTokenFromUsername(USERNAME, "ADMIN,PROFESSOR");

            List<String> authorities = tokenProvider.getNormalizedAuthoritiesFromToken(token);

            assertEquals(2, authorities.size());
            assertTrue(authorities.contains("ROLE_ADMIN"));
            assertTrue(authorities.contains("ROLE_PROFESSOR"));
        }

        @Test
        @DisplayName("Given token with empty authorities, when getNormalizedAuthoritiesFromToken, then returns empty list")
        void givenTokenWithEmptyAuthorities_whenGetNormalizedAuthorities_thenReturnsEmptyList() {
            String token = tokenProvider.generateTokenFromUsername(USERNAME, "");

            List<String> authorities = tokenProvider.getNormalizedAuthoritiesFromToken(token);

            assertTrue(authorities.isEmpty());
        }

        @Test
        @DisplayName("Given token with mixed authorities, when getNormalizedAuthoritiesFromToken, then keeps all ROLE_ prefixed")
        void givenTokenWithMixedAuthorities_whenGetNormalizedAuthorities_thenKeepsAll() {
            String token = tokenProvider.generateTokenFromUsername(USERNAME, "ROLE_STUDENT,ROLE_CUSTOM,ROLE_PROFESSOR");

            List<String> authorities = tokenProvider.getNormalizedAuthoritiesFromToken(token);

            assertEquals(3, authorities.size(),
                "normalizeAuthority keeps all ROLE_ prefixed authorities and non-standard roles");
            assertTrue(authorities.contains("ROLE_STUDENT"));
            assertTrue(authorities.contains("ROLE_PROFESSOR"));
            assertTrue(authorities.contains("ROLE_CUSTOM"));
        }
    }
}
