package com.uci.competencia.auth;

import com.fasterxml.jackson.core.JsonProcessingException;
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
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PRUEBAS DE INTEGRACIÓN — Auth (Autenticación y Autorización)
 * ============================================================
 *
 * Contexto del sistema: Plataforma EduSearch para búsqueda científica y
 * detección de infodemia médica. Spring Boot 4.x + JWT + PostgreSQL (H2 en pruebas).
 *
 * Perfil activo: "integration" → H2 modo PostgreSQL, JWT con secret de prueba.
 *
 * Estrategia: RestTemplate con LocalServerPort para HTTP real sobre Tomcat embebido.
 *
 * Escenarios validados (32 escenarios, cobertura completa para tesis):
 *
 * Login       : ✅ Credenciales válidas → 200+JWT | ❌ Contraseña incorrecta → 401
 *               ✅ Email inexistente → 401        | ❌ Usuario inactivo → 401
 *               ✅ Login por username → 200       | ✅ lastLogin actualizado en BD
 * Registro    : ✅ Válido médico → 201+BCrypt     | ❌ Email duplicado → 400
 *               ❌ Password <8 chars → 400        | ❌ Sin mayúscula → 400
 *               ❌ Sin número → 400               | ❌ Sin símbolo → 400
 *               ❌ Username duplicado → 400       | ✅ Rol forzado a student → 201
 *               ✅ Username auto-generado → 201   |
 * Endpoints   : ❌ Sin token → 401                | ✅ Token válido → no 401
 * protegidos  : ❌ Student→admin → 403            | ❌ Admin→student → 403
 *               ✅ Admin→admin → 200              | ✅ Professor→professor → 200
 *               ❌ Token malformado → 401          |
 * Refresh     : ✅ Refresh válido → 200+tokens    | ❌ Token inválido → error
 * Logout      : ✅ Logout → 200                   |
 * GET /me     : ✅ Autenticado → 200+perfil       | ❌ No autenticado → 401
 * JSON        : ✅ LoginResponseDTO campos ok      | ✅ UserDTO campos ok
 * Persistencia: ✅ lastLogin actualizado           | ✅ Todos los campos persistidos
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("integration")
@Transactional
@DisplayName("AuthIntegrationTest - Suite de integración de autenticación")
class AuthIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    private RestTemplate rest;
    private String baseUrl;

    // Datos de prueba — Dominio médico
    private static final String STUDENT_EMAIL    = "laura.fernandez@universidad.edu";
    private static final String STUDENT_USERNAME = "laura.fernandez";
    private static final String STUDENT_PASSWORD = "Medicina2024!";
    private static final String PROFESSOR_EMAIL    = "carlos.garcia@universidad.edu";
    private static final String PROFESSOR_PASSWORD = "Docencia2024!";
    private static final String ADMIN_EMAIL    = "admin@edusearch.uci.cu";
    private static final String ADMIN_PASSWORD = "AdminEduSearch2024!";

    private String studentId;
    private String studentToken;
    private String professorToken;
    private String adminToken;

    @BeforeEach
    void setUp() {
        rest = new RestTemplate();
        baseUrl = "http://localhost:" + port;
        userRepository.deleteAll();

        var student = new User();
        student.setUsername(STUDENT_USERNAME);
        student.setEmail(STUDENT_EMAIL);
        student.setPasswordHash(passwordEncoder.encode(STUDENT_PASSWORD));
        student.setFirstName("Laura");
        student.setLastName("Fernández Ruiz");
        student.setRole(Role.ROLE_STUDENT);
        student.setFaculty("Medicina");
        student.setActive(true);
        student.setCreatedAt(LocalDateTime.now());
        student.setUpdatedAt(LocalDateTime.now());
        student = userRepository.saveAndFlush(student);
        studentId = student.getId();

        var professor = new User();
        professor.setUsername("carlos.garcia");
        professor.setEmail(PROFESSOR_EMAIL);
        professor.setPasswordHash(passwordEncoder.encode(PROFESSOR_PASSWORD));
        professor.setFirstName("Carlos");
        professor.setLastName("García Mendoza");
        professor.setRole(Role.ROLE_PROFESSOR);
        professor.setFaculty("Medicina");
        professor.setActive(true);
        professor.setCreatedAt(LocalDateTime.now());
        professor.setUpdatedAt(LocalDateTime.now());
        userRepository.saveAndFlush(professor);

        var admin = new User();
        admin.setUsername("admin");
        admin.setEmail(ADMIN_EMAIL);
        admin.setPasswordHash(passwordEncoder.encode(ADMIN_PASSWORD));
        admin.setFirstName("Admin");
        admin.setLastName("Sistema");
        admin.setRole(Role.ROLE_ADMIN);
        admin.setFaculty("Dirección");
        admin.setActive(true);
        admin.setCreatedAt(LocalDateTime.now());
        admin.setUpdatedAt(LocalDateTime.now());
        userRepository.saveAndFlush(admin);

        studentToken   = jwtTokenProvider.generateTokenFromUsername(STUDENT_EMAIL, Role.ROLE_STUDENT.name());
        professorToken = jwtTokenProvider.generateTokenFromUsername(PROFESSOR_EMAIL, Role.ROLE_PROFESSOR.name());
        adminToken     = jwtTokenProvider.generateTokenFromUsername(ADMIN_EMAIL, Role.ROLE_ADMIN.name());
    }

    private HttpEntity<Void> authEntity(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        return new HttpEntity<>(h);
    }

    private <T> HttpEntity<T> jsonEntity(T body, String token) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, h);
    }

    // =====================================================================
    //  1. POST /api/auth/login
    // =====================================================================

    @Nested
    @DisplayName("POST /api/auth/login — Inicio de sesión")
    class LoginEndpointIntegrationTest {

        @Test
        @DisplayName("Login exitoso → HTTP 200 + JWT válido + refresh + datos + lastLogin")
        void givenValidCredentials_whenLogin_thenReturns200WithJwtAndUpdatesLastLogin() {
            LoginRequestDTO req = new LoginRequestDTO(STUDENT_EMAIL, STUDENT_PASSWORD);
            ResponseEntity<LoginResponseDTO> response = rest.postForEntity(
                baseUrl + "/api/auth/login", req, LoginResponseDTO.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            LoginResponseDTO body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body.getToken()).startsWith("eyJ");
            assertThat(body.getToken().split("\\.")).hasSize(3);
            assertThat(body.getRefreshToken()).isNotNull();
            assertThat(body.getUserId()).isNotNull();
            assertThat(body.getEmail()).isEqualTo(STUDENT_EMAIL);
            assertThat(body.getRole()).isEqualTo("STUDENT");
            assertThat(jwtTokenProvider.validateToken(body.getToken())).isTrue();
            assertThat(jwtTokenProvider.getUsernameFromToken(body.getToken())).isEqualTo(STUDENT_EMAIL);
            User persisted = userRepository.findByEmail(STUDENT_EMAIL).orElseThrow();
            assertThat(persisted.getLastLogin()).isNotNull();
            assertThat(persisted.getLastLogin()).isBeforeOrEqualTo(LocalDateTime.now());
        }

        @Test
        @DisplayName("Login contraseña incorrecta → HTTP 401")
        void givenWrongPassword_whenLogin_thenReturns401() {
            ResponseEntity<String> response = rest.postForEntity(
                baseUrl + "/api/auth/login", new LoginRequestDTO(STUDENT_EMAIL, "WrongPassword123!"), String.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }

        @Test
        @DisplayName("Login email inexistente → HTTP 401")
        void givenNonExistentEmail_whenLogin_thenReturns401() {
            ResponseEntity<String> response = rest.postForEntity(
                baseUrl + "/api/auth/login", new LoginRequestDTO("no.existe@test.com", "Pass1234!"), String.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }

        @Test
        @DisplayName("Login usuario inactivo → HTTP 401")
        void givenInactiveUser_whenLogin_thenReturns401() {
            User u = userRepository.findByEmail(STUDENT_EMAIL).orElseThrow();
            u.setActive(false);
            userRepository.saveAndFlush(u);
            ResponseEntity<String> response = rest.postForEntity(
                baseUrl + "/api/auth/login", new LoginRequestDTO(STUDENT_EMAIL, STUDENT_PASSWORD), String.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }

        @Test
        @DisplayName("Login por username → HTTP 200")
        void givenUsername_whenLogin_thenReturns200() {
            ResponseEntity<LoginResponseDTO> response = rest.postForEntity(
                baseUrl + "/api/auth/login", new LoginRequestDTO(STUDENT_USERNAME, STUDENT_PASSWORD), LoginResponseDTO.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getToken()).isNotNull();
        }
    }

    // =====================================================================
    //  2. POST /api/auth/register
    // =====================================================================

    @Nested
    @DisplayName("POST /api/auth/register — Registro")
    class RegisterEndpointIntegrationTest {

        @Test
        @DisplayName("Registro exitoso investigador médico → HTTP 201 + persistencia + BCrypt")
        void givenValidMedicalResearcherData_whenRegister_thenReturns201AndPersists() {
            RegisterRequestDTO req = new RegisterRequestDTO();
            req.setName("Dra. María Elena López García");
            req.setEmail("maria.lopez@hospital.edu");
            req.setPassword("Investigacion2026!");
            req.setUsername("maria.lopez");
            req.setFaculty("Medicina");
            req.setDepartment("Epidemiología Clínica");
            req.setRole("student");

            ResponseEntity<UserDTO> response = rest.postForEntity(
                baseUrl + "/api/auth/register", req, UserDTO.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            UserDTO body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body.getEmail()).isEqualTo("maria.lopez@hospital.edu");
            assertThat(body.getRole()).isEqualTo("student");
            assertThat(body.isActive()).isTrue();
            assertThat(body.getId()).isNotNull();

            User persisted = userRepository.findByEmail("maria.lopez@hospital.edu").orElse(null);
            assertThat(persisted).isNotNull();
            assertThat(persisted.getPasswordHash()).startsWith("$2a$");
            assertThat(persisted.getPasswordHash()).isNotEqualTo("Investigacion2026!");
            assertThat(persisted.getFaculty()).isEqualTo("Medicina");
            assertThat(persisted.getDepartment()).isEqualTo("Epidemiología Clínica");
        }

        @Test
        @DisplayName("Registro email duplicado → HTTP 400")
        void givenDuplicateEmail_whenRegister_thenReturns400() {
            RegisterRequestDTO req = new RegisterRequestDTO();
            req.setName("Dup"); req.setEmail(STUDENT_EMAIL);
            req.setPassword("OtraPass2026!"); req.setUsername("dup.user");
            req.setFaculty("Medicina");
            ResponseEntity<String> r = rest.postForEntity(baseUrl + "/api/auth/register", req, String.class);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        }

        @Test
        @DisplayName("Registro password < 8 chars → HTTP 400")
        void givenPasswordShorterThan8Chars_whenRegister_thenReturns400() {
            RegisterRequestDTO req = new RegisterRequestDTO();
            req.setName("Test"); req.setEmail("t.corto@test.com");
            req.setPassword("Ab1!"); req.setUsername("t.corto");
            req.setFaculty("Medicina");
            ResponseEntity<String> r = rest.postForEntity(baseUrl + "/api/auth/register", req, String.class);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        }

        @Test
        @DisplayName("Registro password sin mayúscula → HTTP 400")
        void givenPasswordWithoutUppercase_whenRegister_thenReturns400() {
            RegisterRequestDTO req = new RegisterRequestDTO();
            req.setName("Test"); req.setEmail("t.mayus@test.com");
            req.setPassword("solo-minusculas-2026!"); req.setUsername("t.mayus");
            req.setFaculty("Medicina");
            ResponseEntity<String> r = rest.postForEntity(baseUrl + "/api/auth/register", req, String.class);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        }

        @Test
        @DisplayName("Registro password sin número → HTTP 400")
        void givenPasswordWithoutNumber_whenRegister_thenReturns400() {
            RegisterRequestDTO req = new RegisterRequestDTO();
            req.setName("Test"); req.setEmail("t.num@test.com");
            req.setPassword("SoloLetrasSinNum!"); req.setUsername("t.num");
            req.setFaculty("Medicina");
            ResponseEntity<String> r = rest.postForEntity(baseUrl + "/api/auth/register", req, String.class);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        }

        @Test
        @DisplayName("Registro password sin símbolo → HTTP 400")
        void givenPasswordWithoutSymbol_whenRegister_thenReturns400() {
            RegisterRequestDTO req = new RegisterRequestDTO();
            req.setName("Test"); req.setEmail("t.sym@test.com");
            req.setPassword("SoloLetrasYNumeros2026"); req.setUsername("t.sym");
            req.setFaculty("Medicina");
            ResponseEntity<String> r = rest.postForEntity(baseUrl + "/api/auth/register", req, String.class);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        }

        @Test
        @DisplayName("Registro username duplicado → HTTP 400")
        void givenDuplicateUsername_whenRegister_thenReturns400() {
            RegisterRequestDTO req = new RegisterRequestDTO();
            req.setName("Otro"); req.setEmail("otro@universidad.edu");
            req.setPassword("SeguraPass2026!"); req.setUsername(STUDENT_USERNAME);
            req.setFaculty("Medicina");
            ResponseEntity<String> r = rest.postForEntity(baseUrl + "/api/auth/register", req, String.class);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        }

        @Test
        @DisplayName("Registro rol profesor → forzado a student (HTTP 201)")
        void givenProfessorRole_whenRegister_thenForcedToStudent() {
            RegisterRequestDTO req = new RegisterRequestDTO();
            req.setName("Test Prof"); req.setEmail("test.prof@hospital.edu");
            req.setPassword("TestProf2026!"); req.setUsername("test.prof");
            req.setFaculty("Medicina"); req.setRole("professor");
            ResponseEntity<UserDTO> r = rest.postForEntity(baseUrl + "/api/auth/register", req, UserDTO.class);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            assertThat(r.getBody().getRole()).isEqualTo("student");
        }

        @Test
        @DisplayName("Registro sin username → auto-generado desde email (HTTP 201)")
        void givenNullUsername_whenRegister_thenUsernameGeneratedFromEmail() {
            RegisterRequestDTO req = new RegisterRequestDTO();
            req.setName("Auto Gen"); req.setEmail("auto.gen@universidad.edu");
            req.setPassword("Generado2026!"); req.setFaculty("Medicina");
            ResponseEntity<UserDTO> r = rest.postForEntity(baseUrl + "/api/auth/register", req, UserDTO.class);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            User persisted = userRepository.findByEmail("auto.gen@universidad.edu").orElseThrow();
            assertThat(persisted.getUsername()).isEqualTo("auto.gen");
        }
    }

    // =====================================================================
    //  3. Endpoints protegidos
    // =====================================================================

    @Nested
    @DisplayName("Protección endpoints por JWT y roles")
    class ProtectedEndpointsIntegrationTest {

        @Test
        @DisplayName("Sin token → HTTP 401")
        void givenNoToken_whenAccessingProtectedEndpoint_thenReturns401() {
            ResponseEntity<String> r = rest.getForEntity(baseUrl + "/api/search/execute", String.class);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }

        @Test
        @DisplayName("Token estudiante válido → NO 401")
        void givenValidStudentToken_whenAccessingProtectedEndpoint_thenNotUnauthorized() {
            ResponseEntity<String> r = rest.exchange(
                baseUrl + "/api/search/execute", HttpMethod.POST, authEntity(studentToken), String.class);
            assertThat(r.getStatusCode()).isNotEqualTo(HttpStatus.UNAUTHORIZED);
        }

        @Test
        @DisplayName("Student → /api/admin/users → HTTP 403")
        void givenStudentToken_whenAccessingAdminEndpoint_thenReturns403() {
            ResponseEntity<String> r = rest.exchange(
                baseUrl + "/api/admin/users", HttpMethod.GET, authEntity(studentToken), String.class);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        }

        @Test
        @DisplayName("Admin → /api/student/dashboard/overview → HTTP 403")
        void givenAdminToken_whenAccessingStudentEndpoint_thenReturns403() {
            ResponseEntity<String> r = rest.exchange(
                baseUrl + "/api/student/dashboard/overview", HttpMethod.GET, authEntity(adminToken), String.class);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        }

        @Test
        @DisplayName("Admin → /api/admin/users → HTTP 200")
        void givenAdminToken_whenAccessingAdminEndpoint_thenReturns200() {
            ResponseEntity<String> r = rest.exchange(
                baseUrl + "/api/admin/users", HttpMethod.GET, authEntity(adminToken), String.class);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        @DisplayName("Professor → /api/professor/dashboard/overview → HTTP 200")
        void givenProfessorToken_whenAccessingProfessorEndpoint_thenReturns200() {
            ResponseEntity<String> r = rest.exchange(
                baseUrl + "/api/professor/dashboard/overview", HttpMethod.GET, authEntity(professorToken), String.class);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        @DisplayName("Token malformado → HTTP 401")
        void givenMalformedToken_whenAccessingProtectedEndpoint_thenReturns401() {
            HttpHeaders h = new HttpHeaders();
            h.setBearerAuth("eyJhbGciOiJIUzI1NiJ9.token.falso");
            ResponseEntity<String> r = rest.exchange(
                baseUrl + "/api/search/execute", HttpMethod.POST, new HttpEntity<>(h), String.class);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }
    }

    // =====================================================================
    //  4. POST /api/auth/refresh
    // =====================================================================

    @Nested
    @DisplayName("POST /api/auth/refresh — Renovación de tokens")
    class RefreshTokenIntegrationTest {

        @Test
        @DisplayName("Refresh válido → HTTP 200 + nuevos tokens")
        void givenValidRefreshToken_whenRefresh_thenReturns200WithNewTokens() {
            String refresh = jwtTokenProvider.generateRefreshTokenFromUsername(STUDENT_EMAIL, Role.ROLE_STUDENT.name());
            HttpHeaders h = new HttpHeaders();
            h.setBearerAuth(refresh);
            ResponseEntity<LoginResponseDTO> r = rest.exchange(
                baseUrl + "/api/auth/refresh", HttpMethod.POST, new HttpEntity<>(h), LoginResponseDTO.class);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(r.getBody()).isNotNull();
            assertThat(r.getBody().getToken()).isNotEmpty();
            assertThat(r.getBody().getRefreshToken()).isNotEmpty();
            assertThat(r.getBody().getEmail()).isEqualTo(STUDENT_EMAIL);
        }

        @Test
        @DisplayName("Refresh inválido → HTTP error")
        void givenInvalidRefreshToken_whenRefresh_thenReturnsError() {
            HttpHeaders h = new HttpHeaders();
            h.setBearerAuth("token.invalido");
            ResponseEntity<String> r = rest.exchange(
                baseUrl + "/api/auth/refresh", HttpMethod.POST, new HttpEntity<>(h), String.class);
            assertThat(r.getStatusCode().isError()).isTrue();
        }
    }

    // =====================================================================
    //  5. POST /api/auth/logout
    // =====================================================================

    @Nested
    @DisplayName("POST /api/auth/logout — Cierre de sesión")
    class LogoutIntegrationTest {
        @Test
        @DisplayName("Logout → HTTP 200")
        void givenValidToken_whenLogout_thenReturns200() {
            ResponseEntity<Void> r = rest.exchange(
                baseUrl + "/api/auth/logout", HttpMethod.POST, authEntity(studentToken), Void.class);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
        }
    }

    // =====================================================================
    //  6. GET /api/auth/me
    // =====================================================================

    @Nested
    @DisplayName("GET /api/auth/me — Perfil del usuario autenticado")
    class GetCurrentUserIntegrationTest {

        @Test
        @DisplayName("Autenticado → HTTP 200 + perfil completo")
        void givenAuthenticatedUser_whenGetMe_thenReturns200WithProfile() {
            ResponseEntity<String> r = rest.exchange(
                baseUrl + "/api/auth/me", HttpMethod.GET, authEntity(studentToken), String.class);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(r.getBody()).isNotNull();
            assertThat(r.getBody()).contains(STUDENT_EMAIL);
        }

        @Test
        @DisplayName("No autenticado → HTTP 401")
        void givenUnauthenticated_whenGetMe_thenReturns401() {
            ResponseEntity<String> r = rest.getForEntity(baseUrl + "/api/auth/me", String.class);
            assertThat(r.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }
    }

    // =====================================================================
    //  7. Serialización JSON
    // =====================================================================

    @Nested
    @DisplayName("Serialización JSON")
    class JsonSerializationIntegrationTest {

        @Test
        @DisplayName("LoginResponseDTO correcto")
        void givenLoginResponse_whenSerialized_thenContainsAllFields() throws JsonProcessingException {
            String json = rest.postForEntity(
                baseUrl + "/api/auth/login", new LoginRequestDTO(STUDENT_EMAIL, STUDENT_PASSWORD), String.class).getBody();
            assertThat(json).isNotNull();
            LoginResponseDTO dto = objectMapper.readValue(json, LoginResponseDTO.class);
            assertThat(dto.getToken()).isNotNull();
            assertThat(dto.getToken().split("\\.")).hasSize(3);
            assertThat(dto.getEmail()).isEqualTo(STUDENT_EMAIL);
            assertThat(dto.getRole()).isEqualTo("STUDENT");
        }

        @Test
        @DisplayName("UserDTO correcto")
        void givenUserDto_whenSerialized_thenContainsExpectedFields() throws JsonProcessingException {
            String json = rest.exchange(
                baseUrl + "/api/auth/me", HttpMethod.GET, authEntity(studentToken), String.class).getBody();
            assertThat(json).isNotNull();
            UserDTO dto = objectMapper.readValue(json, UserDTO.class);
            assertThat(dto.getId()).isEqualTo(studentId);
            assertThat(dto.getEmail()).isEqualTo(STUDENT_EMAIL);
            assertThat(dto.isActive()).isTrue();
            assertThat(dto.getRole()).isEqualTo("student");
        }
    }

    // =====================================================================
    //  8. Persistencia
    // =====================================================================

    @Nested
    @DisplayName("Persistencia de datos")
    class DataPersistenceIntegrationTest {

        @Test
        @DisplayName("Login actualiza lastLogin en BD")
        void givenLogin_whenSuccessful_thenLastLoginIsUpdatedInDatabase() {
            rest.postForEntity(baseUrl + "/api/auth/login",
                new LoginRequestDTO(STUDENT_EMAIL, STUDENT_PASSWORD), LoginResponseDTO.class);
            User u = userRepository.findByEmail(STUDENT_EMAIL).orElseThrow();
            assertThat(u.getLastLogin()).isNotNull();
            assertThat(u.getLastLogin()).isBeforeOrEqualTo(LocalDateTime.now());
        }

        @Test
        @DisplayName("Registro persiste todos los campos correctamente")
        void givenRegistration_whenSuccessful_thenAllFieldsArePersisted() {
            RegisterRequestDTO req = new RegisterRequestDTO();
            req.setName("Dr. Juan Carlos Pérez Mendoza");
            req.setEmail("juanc.perez@hospital.edu");
            req.setPassword("Cardiologia2026!");
            req.setUsername("juanc.perez");
            req.setFaculty("Medicina");
            req.setDepartment("Cardiología Intervencionista");

            rest.postForEntity(baseUrl + "/api/auth/register", req, UserDTO.class);
            User u = userRepository.findByEmail("juanc.perez@hospital.edu").orElseThrow();
            assertThat(u.getFirstName()).isEqualTo("Dr. Juan Carlos");
            assertThat(u.getLastName()).isEqualTo("Pérez Mendoza");
            assertThat(u.getRole()).isEqualTo(Role.ROLE_STUDENT);
            assertThat(u.isActive()).isTrue();
            assertThat(u.getPasswordHash()).startsWith("$2a$");
            assertThat(u.getPasswordHash()).isNotEqualTo("Cardiologia2026!");
            assertThat(u.getFaculty()).isEqualTo("Medicina");
            assertThat(u.getDepartment()).isEqualTo("Cardiología Intervencionista");
        }
    }
}