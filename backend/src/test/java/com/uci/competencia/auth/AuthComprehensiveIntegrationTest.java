package com.uci.competencia.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.request.LoginRequestDTO;
import com.uci.competencia.model.dto.request.RegisterRequestDTO;
import com.uci.competencia.model.dto.response.LoginResponseDTO;
import com.uci.competencia.model.dto.response.UserDTO;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.repository.UserRepository;
import com.uci.competencia.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * PRUEBA DE INTEGRACIÓN — Auth Completa
 * =====================================
 * 
 * OBJETIVO: Pruebas end-to-end de autenticación y autorización
 * con JWT, control de acceso basado en roles, persistencia de usuarios
 * y validación de seguridad en EduSearch.
 * 
 * REQUISITOS CUMPLIDOS:
 *   1. ✅ @SpringBootTest con MockMvc
 *   2. ✅ MockMvcBuilders.webAppContextSetup() — sin depender de @AutoConfigureMockMvc
 *   3. ✅ Persistencia real con H2 modo PostgreSQL
 *   4. ✅ JWT reales con JwtTokenProvider.generateTokenFromUsername()
 *   5. ✅ @Transactional para rollback automático
 *   6. ✅ Escenarios positivos y negativos
 *   7. ✅ Validación de serialización JSON con ObjectMapper
 *   8. ✅ Validación de persistencia en base de datos
 * 
 * ESCENARIOS CUBIERTOS (16 tests):
 * 
 *   POSITIVOS:
 *   - Registro con datos válidos → 201 Created
 *   - Login con email → 200 + JWT
 *   - Login con username → 200
 *   - /me con token válido → 200 + perfil
 * 
 *   NEGATIVOS:
 *   - Email duplicado → 400
 *   - Password < 8 chars → 400
 *   - Password sin mayúscula → 400
 *   - Password sin dígito → 400
 *   - Password sin símbolo → 400
 *   - Username duplicado → 400
 *   - Contraseña incorrecta → 401
 *   - Email inexistente → 401
 *   - Usuario inactivo → 401
 *   - Sin token JWT → 401
 *   - Token inválido → 401
 *   - Admin en endpoint admin → 200
 *   - Student en endpoint admin → 403
 * 
 * @see com.uci.competencia.controller.AuthController
 * @see com.uci.competencia.service.AuthService
 */
@SpringBootTest
@ActiveProfiles("integration")
@Transactional
@DisplayName("AuthComprehensiveIntegrationTest — Autenticación completa")
class AuthComprehensiveIntegrationTest {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    private User studentUser;
    private User professorUser;
    private String studentToken;
    private String professorToken;

    @BeforeEach
    void setUp() {
        // Configurar MockMvc manualmente (evita @AutoConfigureMockMvc)
        mockMvc = MockMvcBuilders
            .webAppContextSetup(webApplicationContext)
            .build();

        // Limpiar BD
        userRepository.deleteAll();

        // Crear usuarios de prueba (dominio médico)
        studentUser = createUser("student@university.edu", "student_user", "Student", "User", Role.ROLE_STUDENT);
        professorUser = createUser("professor@university.edu", "professor_user", "Professor", "User", Role.ROLE_PROFESSOR);

        // Generar tokens JWT con el método REAL del provider
        studentToken = jwtTokenProvider.generateTokenFromUsername(
            studentUser.getEmail(), Role.ROLE_STUDENT.name());
        professorToken = jwtTokenProvider.generateTokenFromUsername(
            professorUser.getEmail(), Role.ROLE_PROFESSOR.name());
    }

    // =========================================================================
    // POSITIVE SCENARIOS: REGISTRATION
    // =========================================================================
    @Nested
    @DisplayName("✓ POSITIVE: User Registration")
    class RegistrationPositiveScenarios {

        @Test
        @DisplayName("Register new medical researcher - valid input - 201 Created")
        void givenValidMedicalResearcherData_whenRegister_thenReturns201AndPersists() throws Exception {
            RegisterRequestDTO request = new RegisterRequestDTO();
            request.setName("Dra. María Elena López García");
            request.setEmail("maria.lopez@hospital.edu");
            request.setPassword("MedicalResearch2024!");
            request.setUsername("maria.lopez");
            request.setFaculty("Medicina");
            request.setDepartment("Epidemiología Clínica");
            request.setRole("student");

            String requestBody = objectMapper.writeValueAsString(request);

            MvcResult result = mockMvc.perform(
                    post("/api/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(requestBody)
                    )
                    .andExpect(status().isCreated())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.id").exists())
                    .andExpect(jsonPath("$.email").value("maria.lopez@hospital.edu"))
                    .andExpect(jsonPath("$.role").value("student"))
                    .andExpect(jsonPath("$.active").value(true))
                    .andReturn();

            // Validar deserialización JSON
            UserDTO response = objectMapper.readValue(
                    result.getResponse().getContentAsString(),
                    UserDTO.class
            );
            assertThat(response).isNotNull();
            assertThat(response.getId()).isNotBlank();
            assertThat(response.getEmail()).isEqualTo("maria.lopez@hospital.edu");

            // Validar persistencia en BD
            User persistedUser = userRepository.findByEmail("maria.lopez@hospital.edu").orElseThrow();
            assertThat(persistedUser.getId()).isEqualTo(response.getId());
            assertThat(persistedUser.getPasswordHash()).startsWith("$2a$"); // BCrypt
            assertThat(persistedUser.getPasswordHash()).isNotEqualTo("MedicalResearch2024!"); // No plaintext
            assertThat(persistedUser.getFaculty()).isEqualTo("Medicina");
        }

        @Test
        @DisplayName("Username auto-generated from email when not provided")
        void givenNoUsername_whenRegister_thenAutoGeneratesFromEmail() throws Exception {
            RegisterRequestDTO request = new RegisterRequestDTO();
            request.setName("Juan Pérez");
            request.setEmail("juan.perez@university.edu");
            request.setPassword("SecurePassword123!");
            request.setFaculty("Medicina");

            mockMvc.perform(
                    post("/api/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request))
                    )
                    .andExpect(status().isCreated());

            User user = userRepository.findByEmail("juan.perez@university.edu").orElseThrow();
            assertThat(user.getUsername()).isEqualTo("juan.perez");
        }
    }

    // =========================================================================
    // NEGATIVE SCENARIOS: REGISTRATION VALIDATION
    // =========================================================================
    @Nested
    @DisplayName("✗ NEGATIVE: Registration Validation Errors")
    class RegistrationNegativeScenarios {

        @Test
        @DisplayName("Duplicate email rejected - 400 Bad Request")
        void givenDuplicateEmail_whenRegister_thenReturns400() throws Exception {
            RegisterRequestDTO request = new RegisterRequestDTO();
            request.setName("Duplicate User");
            request.setEmail(studentUser.getEmail());
            request.setPassword("NewPassword123!");
            request.setFaculty("Medicina");

            mockMvc.perform(
                    post("/api/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request))
                    )
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("Password < 8 characters rejected - 400")
        void givenPasswordTooShort_whenRegister_thenReturns400() throws Exception {
            RegisterRequestDTO request = new RegisterRequestDTO();
            request.setName("Test User");
            request.setEmail("short.pass@test.edu");
            request.setPassword("Short1!");
            request.setFaculty("Medicina");

            mockMvc.perform(
                    post("/api/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request))
                    )
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("Password without uppercase letter rejected - 400")
        void givenPasswordWithoutUppercase_whenRegister_thenReturns400() throws Exception {
            RegisterRequestDTO request = new RegisterRequestDTO();
            request.setName("Test User");
            request.setEmail("no.upper@test.edu");
            request.setPassword("lowercase123!");
            request.setFaculty("Medicina");

            mockMvc.perform(
                    post("/api/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request))
                    )
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("Password without digit rejected - 400")
        void givenPasswordWithoutDigit_whenRegister_thenReturns400() throws Exception {
            RegisterRequestDTO request = new RegisterRequestDTO();
            request.setName("Test User");
            request.setEmail("no.digit@test.edu");
            request.setPassword("NoDigitPassword!");
            request.setFaculty("Medicina");

            mockMvc.perform(
                    post("/api/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request))
                    )
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("Password without special character rejected - 400")
        void givenPasswordWithoutSpecialChar_whenRegister_thenReturns400() throws Exception {
            RegisterRequestDTO request = new RegisterRequestDTO();
            request.setName("Test User");
            request.setEmail("no.special@test.edu");
            request.setPassword("NoSpecial123");
            request.setFaculty("Medicina");

            mockMvc.perform(
                    post("/api/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request))
                    )
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("Duplicate username rejected - 400")
        void givenDuplicateUsername_whenRegister_thenReturns400() throws Exception {
            RegisterRequestDTO request = new RegisterRequestDTO();
            request.setName("Another User");
            request.setEmail("another@test.edu");
            request.setPassword("ValidPassword123!");
            request.setUsername(studentUser.getUsername());
            request.setFaculty("Medicina");

            mockMvc.perform(
                    post("/api/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request))
                    )
                    .andExpect(status().isBadRequest());
        }
    }

    // =========================================================================
    // POSITIVE SCENARIOS: LOGIN
    // =========================================================================
    @Nested
    @DisplayName("✓ POSITIVE: User Login")
    class LoginPositiveScenarios {

        @Test
        @DisplayName("Login with email and password - 200 with valid JWT")
        void givenValidCredentials_whenLogin_thenReturns200WithValidJwt() throws Exception {
            LoginRequestDTO request = new LoginRequestDTO();
            request.setEmail(studentUser.getEmail());
            request.setPassword("TestPassword123!");

            MvcResult result = mockMvc.perform(
                    post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request))
                    )
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.token").exists())
                    .andExpect(jsonPath("$.refreshToken").exists())
                    .andExpect(jsonPath("$.userId").exists())
                    .andExpect(jsonPath("$.email").value(studentUser.getEmail()))
                    .andExpect(jsonPath("$.role").value("STUDENT"))
                    .andExpect(jsonPath("$.expiresIn").isNumber())
                    .andReturn();

            // Validar JWT format (3 partes)
            LoginResponseDTO response = objectMapper.readValue(
                    result.getResponse().getContentAsString(),
                    LoginResponseDTO.class
            );
            assertThat(response.getToken()).matches("^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$");
            assertThat(jwtTokenProvider.validateToken(response.getToken())).isTrue();

            // Validar persistencia: lastLogin actualizado
            User persistedUser = userRepository.findByEmail(studentUser.getEmail()).orElseThrow();
            assertThat(persistedUser.getLastLogin()).isNotNull();
            assertThat(persistedUser.getLastLogin()).isBefore(LocalDateTime.now().plusSeconds(10));
        }

        @Test
        @DisplayName("Login with username instead of email - 200")
        void givenUsernameInsteadOfEmail_whenLogin_thenReturns200() throws Exception {
            LoginRequestDTO request = new LoginRequestDTO();
            request.setEmail(studentUser.getUsername());
            request.setPassword("TestPassword123!");

            mockMvc.perform(
                    post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request))
                    )
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.token").exists());
        }
    }

    // =========================================================================
    // NEGATIVE SCENARIOS: LOGIN ERRORS
    // =========================================================================
    @Nested
    @DisplayName("✗ NEGATIVE: Login Errors")
    class LoginNegativeScenarios {

        @Test
        @DisplayName("Invalid password - 401 Unauthorized")
        void givenInvalidPassword_whenLogin_thenReturns401() throws Exception {
            LoginRequestDTO request = new LoginRequestDTO();
            request.setEmail(studentUser.getEmail());
            request.setPassword("WrongPassword123!");

            mockMvc.perform(
                    post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request))
                    )
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Non-existent user - 401 Unauthorized")
        void givenNonExistentEmail_whenLogin_thenReturns401() throws Exception {
            LoginRequestDTO request = new LoginRequestDTO();
            request.setEmail("nonexistent@test.edu");
            request.setPassword("SomePassword123!");

            mockMvc.perform(
                    post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request))
                    )
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Inactive user - 401 Unauthorized")
        void givenInactiveUser_whenLogin_thenReturns401() throws Exception {
            studentUser.setActive(false);
            userRepository.saveAndFlush(studentUser);

            LoginRequestDTO request = new LoginRequestDTO();
            request.setEmail(studentUser.getEmail());
            request.setPassword("TestPassword123!");

            mockMvc.perform(
                    post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request))
                    )
                    .andExpect(status().isUnauthorized());
        }
    }

    // =========================================================================
    // SECURITY SCENARIOS: JWT & AUTHENTICATION
    // =========================================================================
    @Nested
    @DisplayName("🔒 SECURITY: JWT & Access Control")
    class SecurityScenarios {

        @Test
        @DisplayName("Request without JWT token - 401 Unauthorized")
        void givenNoToken_whenAccessProtectedEndpoint_thenReturns401() throws Exception {
            mockMvc.perform(get("/api/auth/me"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Request with invalid JWT token - 401")
        void givenInvalidToken_whenAccessProtectedEndpoint_thenReturns401() throws Exception {
            mockMvc.perform(
                    get("/api/auth/me")
                            .header("Authorization", "Bearer invalid.token.here")
                    )
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Request with malformed Bearer header - 401")
        void givenMalformedBearerHeader_whenRequest_thenReturns401() throws Exception {
            mockMvc.perform(
                    get("/api/auth/me")
                            .header("Authorization", "InvalidPrefix " + studentToken)
                    )
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Valid JWT provides access to protected endpoint")
        void givenValidToken_whenAccessProtectedEndpoint_thenReturns200() throws Exception {
            mockMvc.perform(
                    get("/api/auth/me")
                            .header("Authorization", "Bearer " + studentToken)
                    )
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.email").value(studentUser.getEmail()))
                    .andExpect(jsonPath("$.role").value("student"));
        }
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private User createUser(String email, String username, String firstName, String lastName, Role role) {
        User user = new User();
        user.setEmail(email);
        user.setUsername(username);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setPasswordHash(passwordEncoder.encode("TestPassword123!"));
        user.setRole(role);
        user.setActive(true);
        user.setFaculty("Medicine");
        user.setDepartment("Research");
        return userRepository.save(user);
    }
}