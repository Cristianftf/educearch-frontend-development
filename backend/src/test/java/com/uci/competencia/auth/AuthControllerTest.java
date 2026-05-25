package com.uci.competencia.auth;

import com.uci.competencia.model.dto.request.LoginRequestDTO;
import com.uci.competencia.model.dto.request.RegisterRequestDTO;
import com.uci.competencia.model.dto.response.LoginResponseDTO;
import com.uci.competencia.model.dto.response.UserDTO;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.repository.UserRepository;
import com.uci.competencia.security.UserIdentityResolver;
import com.uci.competencia.service.AuthService;
import com.uci.competencia.service.external.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Pruebas unitarias para {@link AuthController}.
 *
 * <p>Valida todos los endpoints REST de autenticación: login, registro,
 * refresh token, logout, y obtención de usuario autenticado (/me).
 * Cubre escenarios positivos, negativos, y de borde con datos de dominio
 * médico-científico.</p>
 *
 * @see AuthController
 * @see AuthService
 * @see UserRepository
 * @see PasswordEncoder
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AuthController - Pruebas del controlador de autenticación")
class AuthControllerTest {

    @Mock
    private AuthService authService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private UserIdentityResolver userIdentityResolver;

    @Mock
    private EmailService emailService;

    @InjectMocks
    private AuthController authController;

    // --- Datos de prueba ---
    private static final String USER_ID = "u1a2b3c4-d5e6-7890-abcd-ef1234567890";
    private static final String EMAIL = "laura.fernandez@universidad.edu";
    private static final String USERNAME = "laura.fernandez";
    private static final String PASSWORD = "Medicina2024!";
    private static final String PASSWORD_HASH = "$2a$10$hashedPasswordValue";
    private static final String JWT_TOKEN = "eyJhbGciOiJIUzI1NiJ9.valid-jwt-token";
    private static final String REFRESH_TOKEN = "eyJhbGciOiJIUzI1NiJ9.valid-refresh-token";

    private User defaultUser;
    private LoginRequestDTO defaultLoginRequest;
    private LoginResponseDTO defaultLoginResponse;
    private RegisterRequestDTO defaultRegisterRequest;

    @BeforeEach
    void setUp() {
        defaultUser = new User();
        defaultUser.setId(USER_ID);
        defaultUser.setEmail(EMAIL);
        defaultUser.setUsername(USERNAME);
        defaultUser.setPasswordHash(PASSWORD_HASH);
        defaultUser.setFirstName("Laura");
        defaultUser.setLastName("Fernández Ruiz");
        defaultUser.setRole(Role.ROLE_STUDENT);
        defaultUser.setActive(true);
        defaultUser.setFaculty("Medicina");
        defaultUser.setDepartment("Ciencias Clínicas");
        defaultUser.setCreatedAt(LocalDateTime.now().minusDays(60));
        defaultUser.setUpdatedAt(LocalDateTime.now());

        defaultLoginRequest = new LoginRequestDTO();
        defaultLoginRequest.setEmail(EMAIL);
        defaultLoginRequest.setPassword(PASSWORD);

        defaultLoginResponse = new LoginResponseDTO();
        defaultLoginResponse.setToken(JWT_TOKEN);
        defaultLoginResponse.setRefreshToken(REFRESH_TOKEN);
        defaultLoginResponse.setUserId(USER_ID);
        defaultLoginResponse.setUsername(USERNAME);
        defaultLoginResponse.setEmail(EMAIL);
        defaultLoginResponse.setFirstName("Laura");
        defaultLoginResponse.setLastName("Fernández Ruiz");
        defaultLoginResponse.setRole("STUDENT");

        defaultRegisterRequest = new RegisterRequestDTO();
        defaultRegisterRequest.setName("Laura Fernández Ruiz");
        defaultRegisterRequest.setEmail(EMAIL);
        defaultRegisterRequest.setPassword(PASSWORD);
        defaultRegisterRequest.setRole("student");
        defaultRegisterRequest.setUsername(USERNAME);
        defaultRegisterRequest.setFaculty("Medicina");
        defaultRegisterRequest.setDepartment("Ciencias Clínicas");
    }

    // =========================================================================
    //  1. POST /api/auth/login
    // =========================================================================

    @Nested
    @DisplayName("POST /api/auth/login - Inicio de sesión")
    class LoginEndpointTests {

        @Test
        @DisplayName("Given valid credentials, when login, then returns 200 with JWT token")
        void givenValidCredentials_whenLogin_thenReturns200WithToken() {
            when(authService.login(any(LoginRequestDTO.class))).thenReturn(defaultLoginResponse);

            ResponseEntity<LoginResponseDTO> response = authController.login(defaultLoginRequest);

            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
            assertNotNull(response.getBody());
            assertEquals(JWT_TOKEN, response.getBody().getToken());
            assertEquals(REFRESH_TOKEN, response.getBody().getRefreshToken());
            assertEquals(USER_ID, response.getBody().getUserId());
            assertEquals(EMAIL, response.getBody().getEmail());
            assertEquals("STUDENT", response.getBody().getRole());
            verify(authService, times(1)).login(defaultLoginRequest);
        }

        @Test
        @DisplayName("Given invalid credentials, when login, then propagates InvalidCredentialsException")
        void givenInvalidCredentials_whenLogin_thenPropagatesException() {
            when(authService.login(any(LoginRequestDTO.class)))
                .thenThrow(new com.uci.competencia.exception.InvalidCredentialsException("Invalid email or password"));

            assertThrows(com.uci.competencia.exception.InvalidCredentialsException.class,
                () -> authController.login(defaultLoginRequest));
        }
    }

    // =========================================================================
    //  2. POST /api/auth/register
    // =========================================================================

    @Nested
    @DisplayName("POST /api/auth/register - Registro de usuario")
    class RegisterEndpointTests {

        @Test
        @DisplayName("Given valid data, when register, then returns 201 Created")
        void givenValidData_whenRegister_thenReturns201() {
            when(userRepository.existsByEmail(EMAIL)).thenReturn(false);
            when(passwordEncoder.encode(PASSWORD)).thenReturn(PASSWORD_HASH);
            when(userRepository.existsByUsername(USERNAME)).thenReturn(false);
            when(userRepository.save(any(User.class))).thenReturn(defaultUser);

            ResponseEntity<UserDTO> response = authController.register(defaultRegisterRequest);

            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(201), response.getStatusCode());
            assertNotNull(response.getBody());
            assertEquals(EMAIL, response.getBody().getEmail());
            assertEquals("Laura", response.getBody().getFirstName());
            assertEquals("Fernández Ruiz", response.getBody().getLastName());
            assertEquals("student", response.getBody().getRole());
            assertTrue(response.getBody().isActive());
            assertEquals("Medicina", response.getBody().getFaculty());
            verify(userRepository, times(1)).existsByEmail(EMAIL);
            verify(userRepository, times(1)).existsByUsername(USERNAME);
            verify(passwordEncoder, times(1)).encode(PASSWORD);
            verify(userRepository, times(1)).save(any(User.class));
        }

        @Test
        @DisplayName("Given existing email, when register, then returns 400")
        void givenExistingEmail_whenRegister_thenReturns400() {
            when(userRepository.existsByEmail(EMAIL)).thenReturn(true);

            ResponseEntity<UserDTO> response = authController.register(defaultRegisterRequest);

            assertEquals(HttpStatusCode.valueOf(400), response.getStatusCode());
            assertNull(response.getBody());
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("Given weak password (short), when register, then returns 400")
        void givenShortPassword_whenRegister_thenReturns400() {
            RegisterRequestDTO weak = new RegisterRequestDTO();
            weak.setName("Laura");
            weak.setEmail(EMAIL);
            weak.setPassword("short");
            weak.setRole("student");

            ResponseEntity<UserDTO> response = authController.register(weak);

            assertEquals(HttpStatusCode.valueOf(400), response.getStatusCode());
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("Given weak password without uppercase, when register, then returns 400")
        void givenPasswordWithoutUppercase_whenRegister_thenReturns400() {
            defaultRegisterRequest.setPassword("solo-minusculas-2024!");

            ResponseEntity<UserDTO> response = authController.register(defaultRegisterRequest);

            assertEquals(HttpStatusCode.valueOf(400), response.getStatusCode());
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("Given weak password without number, when register, then returns 400")
        void givenPasswordWithoutNumber_whenRegister_thenReturns400() {
            defaultRegisterRequest.setPassword("SoloLetrasSinNumero!");

            ResponseEntity<UserDTO> response = authController.register(defaultRegisterRequest);

            assertEquals(HttpStatusCode.valueOf(400), response.getStatusCode());
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("Given weak password without symbol, when register, then returns 400")
        void givenPasswordWithoutSymbol_whenRegister_thenReturns400() {
            defaultRegisterRequest.setPassword("SoloLetrasYNumeros2024");

            ResponseEntity<UserDTO> response = authController.register(defaultRegisterRequest);

            assertEquals(HttpStatusCode.valueOf(400), response.getStatusCode());
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("Given existing username, when register, then returns 400")
        void givenExistingUsername_whenRegister_thenReturns400() {
            when(userRepository.existsByEmail(EMAIL)).thenReturn(false);
            // NOTA: passwordEncoder.encode() no se stubbea porque existsByUsername falla antes
            when(userRepository.existsByUsername(USERNAME)).thenReturn(true);

            ResponseEntity<UserDTO> response = authController.register(defaultRegisterRequest);

            assertEquals(HttpStatusCode.valueOf(400), response.getStatusCode());
            verify(userRepository, times(1)).existsByUsername(USERNAME);
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("Given professor role, when register, then creates as student")
        void givenProfessorRole_whenRegister_thenCreatesAsStudent() {
            defaultRegisterRequest.setRole("professor");
            when(userRepository.existsByEmail(EMAIL)).thenReturn(false);
            when(passwordEncoder.encode(PASSWORD)).thenReturn(PASSWORD_HASH);
            when(userRepository.existsByUsername(USERNAME)).thenReturn(false);
            when(userRepository.save(any(User.class))).thenReturn(defaultUser);

            ResponseEntity<UserDTO> response = authController.register(defaultRegisterRequest);

            assertEquals(HttpStatusCode.valueOf(201), response.getStatusCode());
            assertEquals("student", response.getBody().getRole());
        }

        @Test
        @DisplayName("Given null username, when register, then generates from email")
        void givenNullUsername_whenRegister_thenGeneratesFromEmail() {
            defaultRegisterRequest.setUsername(null);
            String expectedUser = "laura.fernandez";
            when(userRepository.existsByEmail(EMAIL)).thenReturn(false);
            when(passwordEncoder.encode(PASSWORD)).thenReturn(PASSWORD_HASH);
            when(userRepository.existsByUsername(expectedUser)).thenReturn(false);
            when(userRepository.save(any(User.class))).thenReturn(defaultUser);

            ResponseEntity<UserDTO> response = authController.register(defaultRegisterRequest);

            assertEquals(HttpStatusCode.valueOf(201), response.getStatusCode());
            verify(userRepository).existsByUsername(expectedUser);
        }

        @Test
        @DisplayName("Given null password, when register, then returns 400")
        void givenNullPassword_whenRegister_thenReturns400() {
            defaultRegisterRequest.setPassword(null);

            ResponseEntity<UserDTO> response = authController.register(defaultRegisterRequest);

            assertEquals(HttpStatusCode.valueOf(400), response.getStatusCode());
            verify(userRepository, never()).save(any());
        }
    }

    // =========================================================================
    //  3. POST /api/auth/refresh
    // =========================================================================

    @Nested
    @DisplayName("POST /api/auth/refresh - Renovar token JWT")
    class RefreshTokenEndpointTests {

        @Test
        @DisplayName("Given valid refresh token, when refresh, then returns 200 with new tokens")
        void givenValidRefreshToken_whenRefresh_thenReturns200() {
            when(authService.refreshToken(REFRESH_TOKEN)).thenReturn(defaultLoginResponse);

            ResponseEntity<LoginResponseDTO> response =
                authController.refreshToken("Bearer " + REFRESH_TOKEN);

            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
            assertEquals(JWT_TOKEN, response.getBody().getToken());
            verify(authService, times(1)).refreshToken(REFRESH_TOKEN);
        }

        @Test
        @DisplayName("Given invalid refresh token, when refresh, then propagates exception")
        void givenInvalidRefreshToken_whenRefresh_thenPropagatesException() {
            String invalid = "invalid-token";
            when(authService.refreshToken(invalid))
                .thenThrow(new RuntimeException("Invalid refresh token"));

            assertThrows(RuntimeException.class,
                () -> authController.refreshToken("Bearer " + invalid));
        }
    }

    // =========================================================================
    //  4. POST /api/auth/logout
    // =========================================================================

    @Nested
    @DisplayName("POST /api/auth/logout - Cerrar sesión")
    class LogoutEndpointTests {

        @Test
        @DisplayName("Given valid token, when logout, then returns 200")
        void givenValidToken_whenLogout_thenReturns200() {
            doNothing().when(authService).logout(JWT_TOKEN);

            ResponseEntity<Void> response = authController.logout("Bearer " + JWT_TOKEN);

            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
            verify(authService, times(1)).logout(JWT_TOKEN);
        }
    }

    // =========================================================================
    //  5. GET /api/auth/me
    // =========================================================================

    @Nested
    @DisplayName("GET /api/auth/me - Obtener usuario autenticado")
    class GetCurrentUserTests {

        @Test
        @DisplayName("Given authenticated user, when getCurrentUser, then returns 200 with user data")
        void givenAuthenticatedUser_whenGetCurrentUser_thenReturns200() {
            when(userIdentityResolver.resolveCurrentUser()).thenReturn(Optional.of(defaultUser));

            ResponseEntity<UserDTO> response = authController.getCurrentUser();

            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
            assertNotNull(response.getBody());
            assertEquals(USER_ID, response.getBody().getId());
            assertEquals(EMAIL, response.getBody().getEmail());
            assertEquals("Laura Fernández Ruiz", response.getBody().getName());
            assertEquals("student", response.getBody().getRole());
            assertTrue(response.getBody().isActive());
            assertEquals("Medicina", response.getBody().getFaculty());
        }

        @Test
        @DisplayName("Given unauthenticated user, when getCurrentUser, then returns 401")
        void givenUnauthenticatedUser_whenGetCurrentUser_thenReturns401() {
            when(userIdentityResolver.resolveCurrentUser()).thenReturn(Optional.empty());

            ResponseEntity<UserDTO> response = authController.getCurrentUser();

            assertEquals(HttpStatusCode.valueOf(401), response.getStatusCode());
            assertNull(response.getBody());
        }
    }

    @Nested
    @DisplayName("POST /api/auth/forgot-password - Solicitud de recuperacion")
    class ForgotPasswordEndpointTests {

        @Test
        @DisplayName("Given existing user, when forgotPassword, then sends generic response and email")
        void givenExistingUser_whenForgotPassword_thenSendsGenericResponseAndEmail() {
            when(authService.requestPasswordReset(EMAIL)).thenReturn("reset-token");

            ResponseEntity<Map<String, String>> response =
                authController.forgotPassword(Map.of("email", EMAIL));

            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
            assertNotNull(response.getBody());
            assertTrue(response.getBody().containsKey("message"));
            verify(emailService).sendPasswordResetEmail(eq(EMAIL), contains("/reset-password/reset-token"));
        }

        @Test
        @DisplayName("Given unknown user, when forgotPassword, then returns same generic response")
        void givenUnknownUser_whenForgotPassword_thenReturnsGenericResponse() {
            when(authService.requestPasswordReset(EMAIL)).thenReturn(null);

            ResponseEntity<Map<String, String>> response =
                authController.forgotPassword(Map.of("email", EMAIL));

            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
            assertNotNull(response.getBody());
            assertTrue(response.getBody().containsKey("message"));
            verify(emailService, never()).sendPasswordResetEmail(anyString(), anyString());
        }
    }

    @Nested
    @DisplayName("POST /api/auth/reset-password - Cambio de contrasena")
    class ResetPasswordEndpointTests {

        @Test
        @DisplayName("Given valid token and password, when resetPassword, then delegates to service")
        void givenValidTokenAndPassword_whenResetPassword_thenDelegatesToService() {
            ResponseEntity<Map<String, String>> response =
                authController.resetPassword(Map.of("token", "reset-token", "password", PASSWORD));

            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
            assertNotNull(response.getBody());
            assertEquals("Password updated successfully.", response.getBody().get("message"));
            verify(authService).resetPassword("reset-token", PASSWORD);
        }
    }
}
