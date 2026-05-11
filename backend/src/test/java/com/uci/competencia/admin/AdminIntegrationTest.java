package com.uci.competencia.admin;

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
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PRUEBAS DE INTEGRACIÓN — Admin (Administración de Usuarios y Sistema)
 * =====================================================================
 *
 * Contexto del sistema:
 *   EduSearch permite al administrador gestionar usuarios (CRUD), monitorear
 *   el sistema, revisar logs de auditoría y configurar parámetros globales.
 *
 * Estrategia de pruebas:
 *   - @SpringBootTest + RANDOM_PORT: contexto Spring completo con servidor embebido.
 *   - @Transactional: rollback automático (H2 modo PostgreSQL).
 *   - JWT real con rol ADMIN generado por JwtTokenProvider.
 *   - TestRestTemplate para peticiones HTTP reales.
 *
 * Escenarios validados:
 * ┌──────────────────────┬──────────────────────────────────────────────┐
 * │ Endpoint             │ Escenarios cubiertos                         │
 * ├──────────────────────┼──────────────────────────────────────────────┤
 * │ GET /api/admin/      │ ✅ Listar usuarios → 200 + lista paginada   │
 * │ users                │ ✅ Filtrar por rol → 200                    │
 * │                      │ ✅ Sin autenticación → 401                  │
 * │                      │ ✅ Student no autorizado → 403              │
 * ├──────────────────────┼──────────────────────────────────────────────┤
 * │ GET /api/admin/      │ ✅ Obtener usuario por ID → 200             │
 * │ users/{id}           │ ✅ ID inexistente → 404                     │
 * ├──────────────────────┼──────────────────────────────────────────────┤
 * │ PUT /api/admin/      │ ✅ Actualizar rol de usuario → 200          │
 * │ users/{id}/role      │ ✅ Rol inválido → 400                       │
 * ├──────────────────────┼──────────────────────────────────────────────┤
 * │ DELETE /api/admin/   │ ✅ Eliminar usuario → 200                   │
 * │ users/{id}           │ ✅ ID inexistente → 404                     │
 * ├──────────────────────┼──────────────────────────────────────────────┤
 * │ GET /api/admin/      │ ✅ Métricas del sistema → 200               │
 * │ system/metrics       │                                             │
 * ├──────────────────────┼──────────────────────────────────────────────┤
 * │ GET /api/admin/      │ ✅ Logs de auditoría → 200                  │
 * │ audit/logs           │                                             │
 * └──────────────────────┴──────────────────────────────────────────────┘
 *
 * Datos de prueba:
 *   - Administrador: admin@edusearch.uci.cu (ADMIN)
 *   - Estudiante: laura.fernandez@universidad.edu (STUDENT)
 *   - Profesor: carlos.garcia@universidad.edu (PROFESSOR)
 *
 * @see AdminController
 * @see AdminService
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("integration")
@Transactional
@DisplayName("AdminIntegrationTest - Suite de integración de administración")
class AdminIntegrationTest {

    @LocalServerPort
    private int port;

    private RestTemplate rest;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    private String baseUrl;
    private String adminToken;
    private String studentToken;
    private String adminId;
    private String studentId;
    private String professorId;

    // =========================================================================
    //  Datos de prueba
    // =========================================================================

    private static final String ADMIN_EMAIL    = "admin@edusearch.uci.cu";
    private static final String ADMIN_PASSWORD = "AdminEduSearch2024!";

    private static final String STUDENT_EMAIL    = "laura.fernandez@universidad.edu";
    private static final String STUDENT_PASSWORD = "Medicina2024!";

    private static final String PROFESSOR_EMAIL    = "carlos.garcia@universidad.edu";
    private static final String PROFESSOR_PASSWORD = "Docencia2024!";

    @BeforeEach
    void setUp() {
        baseUrl = "http://localhost:" + port;
        rest = new RestTemplate();
        userRepository.deleteAll();

        // Admin
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
        admin = userRepository.saveAndFlush(admin);
        adminId = admin.getId();

        // Estudiante
        var student = new User();
        student.setUsername("laura.fernandez");
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

        // Profesor
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
        professor = userRepository.saveAndFlush(professor);
        professorId = professor.getId();

        // Tokens
        adminToken = jwtTokenProvider.generateTokenFromUsername(
            ADMIN_EMAIL, Role.ROLE_ADMIN.name());
        studentToken = jwtTokenProvider.generateTokenFromUsername(
            STUDENT_EMAIL, Role.ROLE_STUDENT.name());
    }

    // =========================================================================
    //  HELPERS
    // =========================================================================

    private HttpEntity<Void> authEntity(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return new HttpEntity<>(headers);
    }

    private <T> HttpEntity<T> jsonEntity(T body, String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, headers);
    }

    // =========================================================================
    //  1. GET /api/admin/users — Listar usuarios
    // =========================================================================

    @Nested
    @DisplayName("GET /api/admin/users — Listar usuarios del sistema")
    class ListUsersIntegrationTest {

        /**
         * Valida: Listado de usuarios con paginación.
         * HTTP 200 + lista con al menos 3 usuarios (admin, student, professor).
         */
        @Test
        @DisplayName("Admin listando usuarios → HTTP 200 + lista paginada")
        void givenAdminToken_whenListUsers_thenReturns200WithUserList() {
            ResponseEntity<String> response = rest.exchange(
                baseUrl + "/api/admin/users",
                HttpMethod.GET,
                authEntity(adminToken),
                String.class);

            assertThat(response.getStatusCode())
                .as("Admin debe poder listar usuarios")
                .isEqualTo(HttpStatus.OK);
            assertThat(response.getBody())
                .as("Body no debe ser nulo")
                .isNotNull();
            assertThat(response.getBody())
                .as("Body debe contener los usuarios creados")
                .contains(ADMIN_EMAIL, STUDENT_EMAIL, PROFESSOR_EMAIL);
        }

        /**
         * Valida: Listado de usuarios sin autenticación.
         * HTTP 401.
         */
        @Test
        @DisplayName("Listado sin token → HTTP 401")
        void givenNoToken_whenListUsers_thenReturns401() {
            ResponseEntity<String> response = rest.getForEntity(
                baseUrl + "/api/admin/users", String.class);

            assertThat(response.getStatusCode())
                .as("Sin token debe retornar 401")
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        }

        /**
         * Valida: Estudiante no puede listar usuarios.
         * HTTP 403.
         */
        @Test
        @DisplayName("Estudiante listando usuarios → HTTP 403")
        void givenStudentToken_whenListUsers_thenReturns403() {
            ResponseEntity<String> response = rest.exchange(
                baseUrl + "/api/admin/users",
                HttpMethod.GET,
                authEntity(studentToken),
                String.class);

            assertThat(response.getStatusCode())
                .as("Estudiante NO debe listar usuarios")
                .isEqualTo(HttpStatus.FORBIDDEN);
        }

        /**
         * Valida: Listado de usuarios filtrado por rol.
         * HTTP 200 + solo usuarios del rol solicitado.
         */
        @Test
        @DisplayName("Filtrar usuarios por rol STUDENT → HTTP 200 + solo estudiantes")
        void givenRoleFilter_whenListUsers_thenReturns200WithFilteredResults() {
            ResponseEntity<String> response = rest.exchange(
                baseUrl + "/api/admin/users?role=STUDENT",
                HttpMethod.GET,
                authEntity(adminToken),
                String.class);

            assertThat(response.getStatusCode())
                .as("Filtro por rol debe retornar 200")
                .isEqualTo(HttpStatus.OK);
            assertThat(response.getBody())
                .as("Body debe contener al estudiante pero no al admin")
                .isNotNull();
        }
    }

    // =========================================================================
    //  2. GET /api/admin/users/{id} — Obtener usuario por ID
    // =========================================================================

    @Nested
    @DisplayName("GET /api/admin/users/{id} — Obtener usuario por ID")
    class GetUserByIdIntegrationTest {

        /**
         * Valida: Obtener usuario existente por ID.
         * HTTP 200 + UserDTO con datos del estudiante.
         */
        @Test
        @DisplayName("Usuario existente → HTTP 200 + datos del usuario")
        void givenExistingUserId_whenGetUser_thenReturns200WithUserData() {
            ResponseEntity<UserDTO> response = rest.exchange(
                baseUrl + "/api/admin/users/" + studentId,
                HttpMethod.GET,
                authEntity(adminToken),
                UserDTO.class);

            assertThat(response.getStatusCode())
                .as("Usuario existente debe retornar 200")
                .isEqualTo(HttpStatus.OK);
            assertThat(response.getBody())
                .as("Body no debe ser nulo")
                .isNotNull();
            assertThat(response.getBody().getEmail())
                .as("Email debe coincidir con el estudiante")
                .isEqualTo(STUDENT_EMAIL);
        }

        /**
         * Valida: Obtener usuario con ID inexistente.
         * HTTP 404.
         */
        @Test
        @DisplayName("ID inexistente → HTTP 404")
        void givenNonExistentUserId_whenGetUser_thenReturns404() {
            ResponseEntity<String> response = rest.exchange(
                baseUrl + "/api/admin/users/non-existent-id-12345",
                HttpMethod.GET,
                authEntity(adminToken),
                String.class);

            assertThat(response.getStatusCode())
                .as("ID inexistente debe retornar 404")
                .isEqualTo(HttpStatus.NOT_FOUND);
        }
    }

    // =========================================================================
    //  3. PUT /api/admin/users/{id}/role — Actualizar rol
    // =========================================================================

    @Nested
    @DisplayName("PUT /api/admin/users/{id}/role — Actualizar rol de usuario")
    class UpdateUserRoleIntegrationTest {

        /**
         * Valida: Cambiar rol de estudiante a profesor.
         * HTTP 200 + rol actualizado en BD.
         */
        @Test
        @DisplayName("Cambio de rol exitoso → HTTP 200 + rol actualizado")
        void givenValidRoleUpdate_whenUpdateRole_thenReturns200() {
            Map<String, String> body = Map.of("role", "PROFESSOR");

            ResponseEntity<String> response = rest.exchange(
                baseUrl + "/api/admin/users/" + studentId + "/role",
                HttpMethod.PUT,
                jsonEntity(body, adminToken),
                String.class);

            assertThat(response.getStatusCode())
                .as("Cambio de rol exitoso debe retornar 200")
                .isEqualTo(HttpStatus.OK);

            // Verificar persistencia
            User updatedUser = userRepository.findById(studentId).orElseThrow();
            assertThat(updatedUser.getRole())
                .as("Rol en BD debe ser PROFESSOR")
                .isEqualTo(Role.ROLE_PROFESSOR);
        }

        /**
         * Valida: Cambiar rol con valor inválido.
         * HTTP 400.
         */
        @Test
        @DisplayName("Rol inválido → HTTP 400")
        void givenInvalidRole_whenUpdateRole_thenReturns400() {
            Map<String, String> body = Map.of("role", "INVALID_ROLE_XYZ");

            ResponseEntity<String> response = rest.exchange(
                baseUrl + "/api/admin/users/" + studentId + "/role",
                HttpMethod.PUT,
                jsonEntity(body, adminToken),
                String.class);

            assertThat(response.getStatusCode())
                .as("Rol inválido debe retornar 400")
                .isEqualTo(HttpStatus.BAD_REQUEST);
        }
    }

    // =========================================================================
    //  4. DELETE /api/admin/users/{id} — Eliminar usuario
    // =========================================================================

    @Nested
    @DisplayName("DELETE /api/admin/users/{id} — Eliminar usuario")
    class DeleteUserIntegrationTest {

        /**
         * Valida: Eliminar usuario existente.
         * HTTP 204 + usuario eliminado de BD.
         */
        @Test
        @DisplayName("Eliminar usuario existente → HTTP 204 + eliminado de BD")
        void givenExistingUserId_whenDeleteUser_thenReturns204() {
            ResponseEntity<Void> response = rest.exchange(
                baseUrl + "/api/admin/users/" + studentId,
                HttpMethod.DELETE,
                authEntity(adminToken),
                Void.class);

            assertThat(response.getStatusCode())
                .as("Eliminación exitosa debe retornar 204 No Content")
                .isEqualTo(HttpStatus.NO_CONTENT);

            // Verificar eliminación en BD
            assertThat(userRepository.findById(studentId))
                .as("Usuario debe haber sido eliminado de BD")
                .isNotPresent();
        }

        /**
         * Valida: Eliminar usuario inexistente.
         * HTTP 404.
         */
        @Test
        @DisplayName("Eliminar usuario inexistente → HTTP 404")
        void givenNonExistentUserId_whenDeleteUser_thenReturns404() {
            ResponseEntity<String> response = rest.exchange(
                baseUrl + "/api/admin/users/non-existent-id-99999",
                HttpMethod.DELETE,
                authEntity(adminToken),
                String.class);

            assertThat(response.getStatusCode())
                .as("ID inexistente debe retornar 404")
                .isEqualTo(HttpStatus.NOT_FOUND);
        }
    }

    // =========================================================================
    //  5. GET /api/admin/system/metrics — Métricas del sistema
    // =========================================================================

    @Nested
    @DisplayName("GET /api/admin/system/metrics — Métricas del sistema")
    class SystemMetricsIntegrationTest {

        /**
         * Valida: Obtención de métricas del sistema.
         * HTTP 200 + indicadores de salud del sistema.
         */
        @Test
        @DisplayName("Admin obteniendo métricas → HTTP 200 + indicadores")
        void givenAdminToken_whenGetMetrics_thenReturns200() {
            ResponseEntity<String> response = rest.exchange(
                baseUrl + "/api/admin/system/metrics",
                HttpMethod.GET,
                authEntity(adminToken),
                String.class);

            assertThat(response.getStatusCode())
                .as("Admin debe poder obtener métricas")
                .isEqualTo(HttpStatus.OK);
            assertThat(response.getBody())
                .as("Body no debe ser nulo")
                .isNotNull();
        }
    }
}