package com.uci.competencia.service.impl;

import com.uci.competencia.exception.InvalidCredentialsException;
import com.uci.competencia.exception.ResourceNotFoundException;
import com.uci.competencia.model.dto.request.LoginRequestDTO;
import com.uci.competencia.model.dto.response.LoginResponseDTO;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.repository.UserRepository;
import com.uci.competencia.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Pruebas unitarias para {@link AuthServiceImpl}.
 *
 * <p>Valida la lógica de autenticación: login válido e inválido,
 * refresh de token, logout, manejo de credenciales incorrectas,
 * usuarios inactivos, usuarios inexistentes, roles y permisos.</p>
 *
 * @see AuthServiceImpl
 * @see JwtTokenProvider
 * @see UserRepository
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AuthServiceImpl - Pruebas del servicio de autenticación")
class AuthServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private JwtTokenProvider tokenProvider;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AuthServiceImpl authService;

    // --- Datos de prueba ---
    private static final String USER_ID = "u1a2b3c4-d5e6-7890-abcd-ef1234567890";
    private static final String EMAIL = "carlos.mendoza@universidad.edu";
    private static final String USERNAME = "carlos.mendoza";
    private static final String PASSWORD = "Str0ng!Pass2024";
    private static final String PASSWORD_HASH = "$2a$10$hashedPasswordValue";
    private static final String JWT_TOKEN = "eyJhbGciOiJIUzI1NiJ9.valid-token";
    private static final String REFRESH_TOKEN = "eyJhbGciOiJIUzI1NiJ9.valid-refresh-token";

    private User defaultUser;
    private LoginRequestDTO defaultLoginRequest;

    @BeforeEach
    void setUp() {
        defaultUser = new User();
        defaultUser.setId(USER_ID);
        defaultUser.setEmail(EMAIL);
        defaultUser.setUsername(USERNAME);
        defaultUser.setPasswordHash(PASSWORD_HASH);
        defaultUser.setFirstName("Carlos");
        defaultUser.setLastName("Mendoza García");
        defaultUser.setRole(Role.ROLE_STUDENT);
        defaultUser.setActive(true);
        defaultUser.setCreatedAt(LocalDateTime.now().minusDays(30));
        defaultUser.setUpdatedAt(LocalDateTime.now());

        defaultLoginRequest = new LoginRequestDTO();
        defaultLoginRequest.setEmail(EMAIL);
        defaultLoginRequest.setPassword(PASSWORD);
    }

    // =========================================================================
    //  1. login() — Login exitoso
    // =========================================================================

    @Nested
    @DisplayName("login() - Inicio de sesión")
    class LoginTests {

        @Test
        @DisplayName("Given valid credentials, when login, then returns LoginResponseDTO with JWT token")
        void givenValidCredentials_whenLogin_thenReturnsLoginResponseWithToken() {
            // Arrange
            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(defaultUser));
            when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(true);
            when(tokenProvider.generateTokenFromUsername(EMAIL, "ROLE_STUDENT"))
                .thenReturn(JWT_TOKEN);
            when(tokenProvider.generateRefreshTokenFromUsername(EMAIL, "ROLE_STUDENT"))
                .thenReturn(REFRESH_TOKEN);
            when(userRepository.save(any(User.class))).thenReturn(defaultUser);

            // Act
            LoginResponseDTO response = authService.login(defaultLoginRequest);

            // Assert
            assertNotNull(response, "Response must not be null");
            assertEquals(JWT_TOKEN, response.getToken(), "JWT token must match");
            assertEquals(REFRESH_TOKEN, response.getRefreshToken(), "Refresh token must match");
            assertEquals(USER_ID, response.getUserId(), "User ID must match");
            assertEquals(USERNAME, response.getUsername(), "Username must match");
            assertEquals(EMAIL, response.getEmail(), "Email must match");
            assertEquals("Carlos", response.getFirstName(), "First name must match");
            assertEquals("Mendoza García", response.getLastName(), "Last name must match");
            assertEquals("STUDENT", response.getRole(), "Role must be STUDENT");

            // Verificar que se actualizó lastLogin
            ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
            verify(userRepository, times(1)).save(userCaptor.capture());
            assertNotNull(userCaptor.getValue().getLastLogin(),
                "Last login timestamp must be updated");

            verify(tokenProvider, times(1)).generateTokenFromUsername(EMAIL, "ROLE_STUDENT");
            verify(tokenProvider, times(1)).generateRefreshTokenFromUsername(EMAIL, "ROLE_STUDENT");
        }

        @Test
        @DisplayName("Given login by username instead of email, when login, then resolves user and returns token")
        void givenLoginByUsername_whenLogin_thenResolvesAndReturnsToken() {
            // Arrange
            LoginRequestDTO request = new LoginRequestDTO();
            request.setEmail(USERNAME);
            request.setPassword(PASSWORD);

            when(userRepository.findByEmail(USERNAME)).thenReturn(Optional.empty());
            when(userRepository.findByUsername(USERNAME)).thenReturn(Optional.of(defaultUser));
            when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(true);
            when(tokenProvider.generateTokenFromUsername(EMAIL, "ROLE_STUDENT"))
                .thenReturn(JWT_TOKEN);
            when(tokenProvider.generateRefreshTokenFromUsername(EMAIL, "ROLE_STUDENT"))
                .thenReturn(REFRESH_TOKEN);
            when(userRepository.save(any(User.class))).thenReturn(defaultUser);

            // Act
            LoginResponseDTO response = authService.login(request);

            // Assert
            assertNotNull(response);
            assertEquals(JWT_TOKEN, response.getToken());
            assertEquals(EMAIL, response.getEmail(),
                "Response email should be the canonical user email");
            verify(userRepository, times(1)).findByEmail(USERNAME);
            verify(userRepository, times(1)).findByUsername(USERNAME);
        }

        @Test
        @DisplayName("Given professor user, when login, then returns with ROLE_PROFESSOR")
        void givenProfessorUser_whenLogin_thenReturnsWithProfessorRole() {
            // Arrange
            defaultUser.setRole(Role.ROLE_PROFESSOR);
            defaultUser.setEmail("profesor@universidad.edu");
            defaultLoginRequest.setEmail("profesor@universidad.edu");

            when(userRepository.findByEmail("profesor@universidad.edu"))
                .thenReturn(Optional.of(defaultUser));
            when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(true);
            when(tokenProvider.generateTokenFromUsername("profesor@universidad.edu", "ROLE_PROFESSOR"))
                .thenReturn(JWT_TOKEN);
            when(tokenProvider.generateRefreshTokenFromUsername("profesor@universidad.edu", "ROLE_PROFESSOR"))
                .thenReturn(REFRESH_TOKEN);
            when(userRepository.save(any(User.class))).thenReturn(defaultUser);

            // Act
            LoginResponseDTO response = authService.login(defaultLoginRequest);

            // Assert
            assertNotNull(response);
            assertEquals("PROFESSOR", response.getRole(), "Role must be PROFESSOR");
            verify(tokenProvider, times(1))
                .generateTokenFromUsername("profesor@universidad.edu", "ROLE_PROFESSOR");
        }
    }

    // =========================================================================
    //  2. login() — Escenarios negativos
    // =========================================================================

    @Nested
    @DisplayName("login() - Escenarios de error")
    class LoginErrorTests {

        @Test
        @DisplayName("Given non-existent email, when login, then throws InvalidCredentialsException")
        void givenNonExistentEmail_whenLogin_thenThrowsInvalidCredentials() {
            // Arrange
            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());
            when(userRepository.findByUsername(EMAIL)).thenReturn(Optional.empty());

            // Act & Assert
            InvalidCredentialsException exception = assertThrows(
                InvalidCredentialsException.class,
                () -> authService.login(defaultLoginRequest),
                "Should throw InvalidCredentialsException for non-existent user"
            );
            assertEquals("Invalid email or password", exception.getMessage(),
                "Exception message must not reveal user existence");
            verify(passwordEncoder, never()).matches(anyString(), anyString());
            verify(tokenProvider, never()).generateTokenFromUsername(anyString(), anyString());
        }

        @Test
        @DisplayName("Given inactive user, when login, then throws InvalidCredentialsException")
        void givenInactiveUser_whenLogin_thenThrowsInvalidCredentials() {
            // Arrange
            defaultUser.setActive(false);
            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(defaultUser));

            // Act & Assert
            InvalidCredentialsException exception = assertThrows(
                InvalidCredentialsException.class,
                () -> authService.login(defaultLoginRequest),
                "Should throw InvalidCredentialsException for inactive user"
            );
            assertEquals("Invalid email or password", exception.getMessage());
            verify(passwordEncoder, never()).matches(anyString(), anyString());
            verify(userRepository, never()).save(any());
            verify(tokenProvider, never()).generateTokenFromUsername(anyString(), anyString());
        }

        @Test
        @DisplayName("Given wrong password, when login, then throws InvalidCredentialsException")
        void givenWrongPassword_whenLogin_thenThrowsInvalidCredentials() {
            // Arrange
            String wrongPassword = "WrongPass123!";
            defaultLoginRequest.setPassword(wrongPassword);

            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(defaultUser));
            when(passwordEncoder.matches(wrongPassword, PASSWORD_HASH)).thenReturn(false);

            // Act & Assert
            InvalidCredentialsException exception = assertThrows(
                InvalidCredentialsException.class,
                () -> authService.login(defaultLoginRequest),
                "Should throw InvalidCredentialsException for wrong password"
            );
            assertEquals("Invalid email or password", exception.getMessage(),
                "Exception message must be generic for security");
            verify(userRepository, never()).save(any());
            verify(tokenProvider, never()).generateTokenFromUsername(anyString(), anyString());
        }

        @Test
        @DisplayName("Given null email identifier, when login, then throws InvalidCredentialsException")
        void givenNullEmail_whenLogin_thenThrowsInvalidCredentials() {
            // Arrange
            defaultLoginRequest.setEmail(null);

            // Act & Assert
            assertThrows(InvalidCredentialsException.class,
                () -> authService.login(defaultLoginRequest),
                "Should throw InvalidCredentialsException for null email");
            verifyNoInteractions(userRepository, tokenProvider, passwordEncoder);
        }

        @Test
        @DisplayName("Given blank email identifier, when login, then throws InvalidCredentialsException")
        void givenBlankEmail_whenLogin_thenThrowsInvalidCredentials() {
            // Arrange
            defaultLoginRequest.setEmail("   ");

            // Act & Assert
            assertThrows(InvalidCredentialsException.class,
                () -> authService.login(defaultLoginRequest),
                "Should throw InvalidCredentialsException for blank email");
            verifyNoInteractions(userRepository, tokenProvider, passwordEncoder);
        }
    }

    // =========================================================================
    //  3. refreshToken()
    // =========================================================================

    @Nested
    @DisplayName("refreshToken() - Renovación de token JWT")
    class RefreshTokenTests {

        @Test
        @DisplayName("Given valid refresh token, when refreshToken, then returns new tokens")
        void givenValidRefreshToken_whenRefreshToken_thenReturnsNewTokens() {
            // Arrange
            when(tokenProvider.validateToken(REFRESH_TOKEN)).thenReturn(true);
            when(tokenProvider.getUsernameFromToken(REFRESH_TOKEN)).thenReturn(EMAIL);
            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(defaultUser));
            when(tokenProvider.generateTokenFromUsername(EMAIL, "ROLE_STUDENT"))
                .thenReturn("new-jwt-token");
            when(tokenProvider.generateRefreshTokenFromUsername(EMAIL, "ROLE_STUDENT"))
                .thenReturn("new-refresh-token");

            // Act
            LoginResponseDTO response = authService.refreshToken(REFRESH_TOKEN);

            // Assert
            assertNotNull(response, "Response must not be null");
            assertEquals("new-jwt-token", response.getToken(), "New JWT must be returned");
            assertEquals("new-refresh-token", response.getRefreshToken(),
                "New refresh token must be returned");
            assertEquals(USER_ID, response.getUserId(), "User ID must match");
            assertEquals(USERNAME, response.getUsername(), "Username must match");
            assertEquals("STUDENT", response.getRole(), "Role must match");
            verify(tokenProvider, times(1)).validateToken(REFRESH_TOKEN);
            verify(tokenProvider, times(1)).getUsernameFromToken(REFRESH_TOKEN);
        }

        @Test
        @DisplayName("Given invalid refresh token, when refreshToken, then throws RuntimeException")
        void givenInvalidRefreshToken_whenRefreshToken_thenThrowsRuntimeException() {
            // Arrange
            String invalidToken = "invalid-token";
            when(tokenProvider.validateToken(invalidToken)).thenReturn(false);

            // Act & Assert
            assertThrows(RuntimeException.class,
                () -> authService.refreshToken(invalidToken),
                "Should throw RuntimeException for invalid refresh token");
            verify(tokenProvider, times(1)).validateToken(invalidToken);
            verifyNoMoreInteractions(userRepository);
        }

        @Test
        @DisplayName("Given valid token but user not found, when refreshToken, then throws ResourceNotFoundException")
        void givenValidTokenButUserNotFound_whenRefreshToken_thenThrowsResourceNotFound() {
            // Arrange
            when(tokenProvider.validateToken(REFRESH_TOKEN)).thenReturn(true);
            when(tokenProvider.getUsernameFromToken(REFRESH_TOKEN)).thenReturn(EMAIL);
            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

            // Act & Assert
            assertThrows(ResourceNotFoundException.class,
                () -> authService.refreshToken(REFRESH_TOKEN),
                "Should throw ResourceNotFoundException when user no longer exists");
        }

        @Test
        @DisplayName("Given valid refresh token for admin, when refreshToken, then returns with ROLE_ADMIN")
        void givenAdminUser_whenRefreshToken_thenReturnsAdminRole() {
            // Arrange
            defaultUser.setRole(Role.ROLE_ADMIN);
            defaultUser.setEmail("admin@universidad.edu");

            when(tokenProvider.validateToken(REFRESH_TOKEN)).thenReturn(true);
            when(tokenProvider.getUsernameFromToken(REFRESH_TOKEN)).thenReturn("admin@universidad.edu");
            when(userRepository.findByEmail("admin@universidad.edu"))
                .thenReturn(Optional.of(defaultUser));
            when(tokenProvider.generateTokenFromUsername("admin@universidad.edu", "ROLE_ADMIN"))
                .thenReturn("admin-jwt-token");
            when(tokenProvider.generateRefreshTokenFromUsername("admin@universidad.edu", "ROLE_ADMIN"))
                .thenReturn("admin-refresh-token");

            // Act
            LoginResponseDTO response = authService.refreshToken(REFRESH_TOKEN);

            // Assert
            assertNotNull(response);
            assertEquals("ADMIN", response.getRole(), "Role must be ADMIN");
        }
    }

    // =========================================================================
    //  4. logout()
    // =========================================================================

    @Nested
    @DisplayName("logout() - Cierre de sesión")
    class LogoutTests {

        @Test
        @DisplayName("Given any token, when logout, then completes without error")
        void givenAnyToken_whenLogout_thenCompletesSuccessfully() {
            // Act
            assertDoesNotThrow(() -> authService.logout(JWT_TOKEN),
                "Logout should not throw any exception");
        }

        @Test
        @DisplayName("Given null token, when logout, then completes without error")
        void givenNullToken_whenLogout_thenCompletesSuccessfully() {
            // Act
            assertDoesNotThrow(() -> authService.logout(null),
                "Logout with null should not throw");
        }
    }

    // =========================================================================
    //  5. password reset
    // =========================================================================

    @Nested
    @DisplayName("password reset - Recuperacion de contrasena")
    class PasswordResetTests {

        @Test
        @DisplayName("Given active user, when requestPasswordReset, then returns reset token")
        void givenActiveUser_whenRequestPasswordReset_thenReturnsResetToken() {
            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(defaultUser));
            when(tokenProvider.generatePasswordResetToken(eq(EMAIL), anyLong()))
                .thenReturn("reset-token");

            String token = authService.requestPasswordReset("  " + EMAIL.toUpperCase() + "  ");

            assertEquals("reset-token", token);
            verify(userRepository).findByEmail(EMAIL);
            verify(tokenProvider).generatePasswordResetToken(eq(EMAIL), anyLong());
        }

        @Test
        @DisplayName("Given inactive user, when requestPasswordReset, then returns null")
        void givenInactiveUser_whenRequestPasswordReset_thenReturnsNull() {
            defaultUser.setActive(false);
            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(defaultUser));

            assertNull(authService.requestPasswordReset(EMAIL));
            verify(tokenProvider, never()).generatePasswordResetToken(anyString(), anyLong());
        }

        @Test
        @DisplayName("Given valid reset token and strong password, when resetPassword, then updates hash")
        void givenValidResetTokenAndStrongPassword_whenResetPassword_thenUpdatesHash() {
            String resetToken = "reset-token";
            String newPassword = "NuevaClave2026!";
            when(tokenProvider.validateToken(resetToken)).thenReturn(true);
            when(tokenProvider.getPurposeFromToken(resetToken)).thenReturn("password_reset");
            when(tokenProvider.getUsernameFromToken(resetToken)).thenReturn(EMAIL);
            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(defaultUser));
            when(passwordEncoder.encode(newPassword)).thenReturn("new-hash");

            authService.resetPassword(resetToken, newPassword);

            assertEquals("new-hash", defaultUser.getPasswordHash());
            verify(userRepository).save(defaultUser);
        }

        @Test
        @DisplayName("Given token without reset purpose, when resetPassword, then rejects token")
        void givenTokenWithoutResetPurpose_whenResetPassword_thenRejectsToken() {
            String resetToken = "access-token";
            when(tokenProvider.validateToken(resetToken)).thenReturn(true);
            when(tokenProvider.getPurposeFromToken(resetToken)).thenReturn(null);

            assertThrows(InvalidCredentialsException.class,
                () -> authService.resetPassword(resetToken, "NuevaClave2026!"));
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("Given weak new password, when resetPassword, then rejects password")
        void givenWeakNewPassword_whenResetPassword_thenRejectsPassword() {
            String resetToken = "reset-token";
            when(tokenProvider.validateToken(resetToken)).thenReturn(true);
            when(tokenProvider.getPurposeFromToken(resetToken)).thenReturn("password_reset");

            assertThrows(IllegalArgumentException.class,
                () -> authService.resetPassword(resetToken, "weak"));
            verify(userRepository, never()).save(any());
        }
    }

    // =========================================================================
    //  6. buildAuthorityClaim() — roles y permisos (vía login indirectamente)
    // =========================================================================

    @Nested
    @DisplayName("buildAuthorityClaim() - Asignación de roles y permisos")
    class AuthorityClaimTests {

        @Test
        @DisplayName("Given user with ROLE_STUDENT, when login, then token generated with ROLE_STUDENT")
        void givenStudentUser_whenLogin_thenTokenHasStudentRole() {
            // Arrange
            defaultUser.setRole(Role.ROLE_STUDENT);
            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(defaultUser));
            when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(true);
            when(tokenProvider.generateTokenFromUsername(EMAIL, "ROLE_STUDENT"))
                .thenReturn(JWT_TOKEN);
            when(tokenProvider.generateRefreshTokenFromUsername(EMAIL, "ROLE_STUDENT"))
                .thenReturn(REFRESH_TOKEN);
            when(userRepository.save(any(User.class))).thenReturn(defaultUser);

            // Act
            LoginResponseDTO response = authService.login(defaultLoginRequest);

            // Assert
            assertNotNull(response);
            assertEquals("STUDENT", response.getRole());
            verify(tokenProvider).generateTokenFromUsername(EMAIL, "ROLE_STUDENT");
        }

        @Test
        @DisplayName("Given user with null role, when login, then NPE occurs after lastLogin update")
        void givenUserWithNullRole_whenLogin_thenThrowsNpeDueToRoleDisplayName() {
            // Arrange
            // Nota: El NPE ocurre en la línea 73 (user.getRole().getDisplayName())
            // DESPUÉS de que userRepository.save() ya se ejecutó en la línea 52.
            // Este es un bug real en AuthServiceImpl: si el usuario tiene role=null,
            // el login falla con NPE en lugar de usar fallback de buildAuthorityClaim().
            defaultUser.setRole(null);
            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(defaultUser));
            when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(true);

            // Act & Assert
            assertThrows(NullPointerException.class,
                () -> authService.login(defaultLoginRequest),
                "NPE because user.getRole() is null when calling getDisplayName()");
            // save() se ejecuta ANTES del NPE, no verificamos that
        }
    }
}
