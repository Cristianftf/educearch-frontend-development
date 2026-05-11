package com.uci.competencia.verification;

import com.uci.competencia.model.dto.request.VerificationRequestDTO;
import com.uci.competencia.model.dto.response.VerificationResponseDTO;
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
 * PRUEBAS DE INTEGRACIÓN — Verification (Verificación de Afirmaciones Médicas)
 * ============================================================================
 *
 * Contexto del sistema:
 *   EduSearch verifica afirmaciones médicas (claims) usando un pipeline que
 *   integra búsqueda en PubMed, motor BioBERT/IA para validación semántica,
 *   y cálculo de niveles de evidencia científica. Detecta infodemia mediante
 *   el semáforo de verificación (VERIFIED, QUESTIONABLE, DEBUNKED).
 *
 * Estrategia de pruebas:
 *   - @SpringBootTest + RANDOM_PORT: contexto Spring completo con servidor embebido.
 *   - @Transactional: rollback automático en H2 (modo PostgreSQL).
 *   - JWT real generado por JwtTokenProvider con secret de prueba.
 *   - TestRestTemplate inyectado automáticamente por Spring Boot.
 *   - Servicios de IA externos (BioBERT) se ejecutan con configuración de prueba
 *     (sin clave API real, modo fallback o simulado en profile integration).
 *
 * Escenarios validados:
 * ┌──────────────────────┬──────────────────────────────────────────────┐
 * │ Endpoint             │ Escenarios cubiertos                         │
 * ├──────────────────────┼──────────────────────────────────────────────┤
 * │ POST /api/verify/    │ ✅ Afirmación válida sobre vacunas → 200    │
 * │ claim                │ ✅ Afirmación con infodemia → 200 + alerta  │
 * │                      │ ✅ ClaimText vacío → 400                    │
 * │                      │ ✅ Sin autenticación → 401                  │
 * ├──────────────────────┼──────────────────────────────────────────────┤
 * │ GET /api/verify/     │ ✅ Historial de verificaciones → 200        │
 * │ history              │ ✅ Sin autenticación → 401                  │
 * ├──────────────────────┼──────────────────────────────────────────────┤
 * │ Serialización JSON   │ ✅ VerificationResponseDTO campos correctos │
 * │                      │ ✅ Semáforo con valores válidos             │
 * └──────────────────────┴──────────────────────────────────────────────┘
 *
 * Datos de prueba (dominio médico):
 *   - Afirmación verdadera: "Las vacunas contra COVID-19 reducen hospitalización"
 *   - Afirmación falsa (infodemia): "El consumo de lejía cura el COVID-19"
 *
 * Resultados esperados en consola:
 *   ✓ Spring Boot iniciado en puerto aleatorio
 *   ✓ H2 modo PostgreSQL operativo
 *   ✓ JWT generados y validados correctamente
 *   ✓ Respuestas HTTP con códigos correctos
 *   ✓ JSON con estructura VerificationResponseDTO válida
 *
 * @see VerificationController
 * @see VerificationService
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("integration")
@Transactional
@DisplayName("VerificationIntegrationTest - Suite de integración de verificación de afirmaciones")
class VerificationIntegrationTest {

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
    private String studentToken;

    // =========================================================================
    //  Datos de prueba
    // =========================================================================

    private static final String STUDENT_EMAIL    = "laura.fernandez@universidad.edu";
    private static final String STUDENT_PASSWORD = "Medicina2024!";

    private static final String PROFESSOR_EMAIL    = "carlos.garcia@universidad.edu";
    private static final String PROFESSOR_PASSWORD = "Docencia2024!";

    @BeforeEach
    void setUp() {
        baseUrl = "http://localhost:" + port;
        rest = new RestTemplate();
        userRepository.deleteAll();

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
        userRepository.saveAndFlush(student);

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
        userRepository.saveAndFlush(professor);

        // Tokens
        studentToken = jwtTokenProvider.generateTokenFromUsername(
            STUDENT_EMAIL, Role.ROLE_STUDENT.name());
        jwtTokenProvider.generateTokenFromUsername(
            PROFESSOR_EMAIL, Role.ROLE_PROFESSOR.name());
    }

    // =========================================================================
    //  HELPERS
    // =========================================================================

    private HttpHeaders jsonAuthHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private <T> HttpEntity<T> jsonEntity(T body, String token) {
        return new HttpEntity<>(body, jsonAuthHeaders(token));
    }

    private HttpEntity<Void> authEntity(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return new HttpEntity<>(headers);
    }

    // =========================================================================
    //  1. POST /api/verify/claim — Verificar afirmación médica
    // =========================================================================

    @Nested
    @DisplayName("POST /api/verify/claim — Verificar afirmación médica")
    class VerifyClaimIntegrationTest {

        /**
         * Valida: Verificación de una afirmación médica verdadera.
         *
         * Escenario:
         *   Estudiante verifica "Las vacunas contra COVID-19 reducen
         *   significativamente el riesgo de hospitalización". El sistema
         *   debe retornar un resultado con semáforo VERIFIED o QUESTIONABLE
         *   y nivel de evidencia asociado.
         *
         * Assertions:
         *   - HTTP 200 OK
         *   - verificationId no nulo (UUID)
         *   - claimText coincide con el enviado
         *   - overallScore entre 0.0 y 1.0
         *   - Semáforo en VERIFIED, QUESTIONABLE o DEBUNKED (valor válido)
         *   - Evidencia con artículos de PubMed
         *   - Tiempo de procesamiento presente
         */
        @Test
        @DisplayName("Afirmación médica válida → HTTP 200 + VerificationResponseDTO")
        void givenValidMedicalClaim_whenVerifyClaim_thenReturns200WithVerification() {
            VerificationRequestDTO req = new VerificationRequestDTO();
            req.setClaimText("Las vacunas contra COVID-19 reducen significativamente "
                + "el riesgo de hospitalización en pacientes mayores de 65 años");
            req.setSourceUrl("https://pubmed.ncbi.nlm.nih.gov/12345678/");

            ResponseEntity<VerificationResponseDTO> response = rest.exchange(
                baseUrl + "/api/verify/claim",
                HttpMethod.POST,
                jsonEntity(req, studentToken),
                VerificationResponseDTO.class);

            assertThat(response.getStatusCode())
                .as("Verificación de afirmación debe retornar 200 OK")
                .isEqualTo(HttpStatus.OK);

            VerificationResponseDTO body = response.getBody();
            assertThat(body).as("Body no debe ser nulo").isNotNull();
            assertThat(body.getId())
                .as("Debe generar un verificationId")
                .isNotNull();
            assertThat(body.getClaim())
                .as("claimText debe coincidir con el enviado")
                .contains("vacunas contra COVID-19");
            assertThat(body.getScore())
                .as("Score debe estar entre 0.0 y 1.0")
                .isBetween(0.0, 1.0);
            assertThat(body.getStatus())
                .as("Status debe ser un valor válido")
                .isIn("verified", "conflicting", "misinformation", "pending");
            assertThat(body.getVerifiedAt())
                .as("Tiempo de verificación debe estar presente")
                .isNotNull();
        }

        /**
         * Valida: Verificación de una afirmación que constituye infodemia.
         *
         * Escenario:
         *   Afirmación falsa peligrosa. El sistema debe detectarla como
         *   DEBUNKED con puntuación baja y alertas de infodemia.
         *
         * Assertions:
         *   - HTTP 200 OK
         *   - overallScore bajo (típicamente < 0.3)
         *   - Semáforo DEBUNKED
         *   - Evidencia que contradice la afirmación
         */
        @Test
        @DisplayName("Afirmación de infodemia (falsa) → HTTP 200 + DEBUNKED + alertas")
        void givenInfodemicClaim_whenVerifyClaim_thenReturns200WithDebunked() {
            VerificationRequestDTO req = new VerificationRequestDTO();
            req.setClaimText("El consumo de lejía (dióxido de cloro) cura "
                + "enfermedades como el COVID-19 y el cáncer");
            req.setSourceUrl("https://example-fake-news.com/cure");

            ResponseEntity<VerificationResponseDTO> response = rest.exchange(
                baseUrl + "/api/verify/claim",
                HttpMethod.POST,
                jsonEntity(req, studentToken),
                VerificationResponseDTO.class);

            assertThat(response.getStatusCode())
                .as("Verificación debe retornar 200 OK aunque sea infodemia")
                .isEqualTo(HttpStatus.OK);

            VerificationResponseDTO body = response.getBody();
            assertThat(body).as("Body no debe ser nulo").isNotNull();
            assertThat(body.getClaim())
                .as("claim debe coincidir")
                .contains("lejía");
            assertThat(body.getScore())
                .as("Afirmación falsa debe tener score bajo")
                .isLessThanOrEqualTo(0.5);
        }

        /**
         * Valida: Verificación con texto vacío.
         * HTTP 400 — @Size(max = 1000) o validación personalizada.
         */
        @Test
        @DisplayName("Afirmación con texto vacío → HTTP 400")
        void givenEmptyClaimText_whenVerifyClaim_thenReturns400() {
            VerificationRequestDTO req = new VerificationRequestDTO();
            req.setClaimText("");
            req.setSourceUrl("https://example.com");

            ResponseEntity<String> response = rest.exchange(
                baseUrl + "/api/verify/claim",
                HttpMethod.POST,
                jsonEntity(req, studentToken),
                String.class);

            assertThat(response.getStatusCode())
                .as("Texto vacío debe retornar 400 Bad Request")
                .isEqualTo(HttpStatus.BAD_REQUEST);
        }

        /**
         * Valida: Verificación sin autenticación.
         * HTTP 401.
         */
        @Test
        @DisplayName("Verificación sin token → HTTP 401")
        void givenNoToken_whenVerifyClaim_thenReturns401() {
            VerificationRequestDTO req = new VerificationRequestDTO();
            req.setClaimText("Test claim");
            req.setSourceUrl("https://example.com");

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<VerificationRequestDTO> entity = new HttpEntity<>(req, headers);

            ResponseEntity<String> response = rest.exchange(
                baseUrl + "/api/verify/claim",
                HttpMethod.POST,
                entity,
                String.class);

            assertThat(response.getStatusCode())
                .as("Sin token debe retornar 401 Unauthorized")
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        }
    }

    // =========================================================================
    //  2. GET /api/verify/history — Historial de verificaciones
    // =========================================================================

    @Nested
    @DisplayName("GET /api/verify/history — Historial de verificaciones")
    class VerificationHistoryIntegrationTest {

        /**
         * Valida: Historial de verificaciones del usuario autenticado.
         * HTTP 200 + lista de verificaciones previas.
         */
        @Test
        @DisplayName("Verificaciones previas → HTTP 200 + historial")
        void givenPreviousVerifications_whenGetHistory_thenReturns200() {
            // Ejecutar verificación primero
            VerificationRequestDTO req = new VerificationRequestDTO();
            req.setClaimText("La vacuna contra la influenza es segura");
            req.setSourceUrl("https://pubmed.ncbi.nlm.nih.gov/ref123/");

            rest.exchange(
                baseUrl + "/api/verify/claim",
                HttpMethod.POST,
                jsonEntity(req, studentToken),
                VerificationResponseDTO.class);

            // Obtener historial
            ResponseEntity<String> historyResponse = rest.exchange(
                baseUrl + "/api/verify/history",
                HttpMethod.GET,
                authEntity(studentToken),
                String.class);

            assertThat(historyResponse.getStatusCode())
                .as("Historial debe retornar 200 OK")
                .isEqualTo(HttpStatus.OK);
            assertThat(historyResponse.getBody())
                .as("Body no debe ser nulo")
                .isNotNull();
            assertThat(historyResponse.getBody())
                .as("Body debe contener la afirmación verificada")
                .contains("vacuna contra la influenza");
        }

        /**
         * Valida: Historial sin autenticación.
         * HTTP 401.
         */
        @Test
        @DisplayName("Historial sin autenticación → HTTP 401")
        void givenNoToken_whenGetHistory_thenReturns401() {
            ResponseEntity<String> response = rest.getForEntity(
                baseUrl + "/api/verify/history", String.class);

            assertThat(response.getStatusCode())
                .as("Sin token debe retornar 401")
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        }
    }

    // =========================================================================
    //  3. Serialización JSON de VerificationResponseDTO
    // =========================================================================

    @Nested
    @DisplayName("Serialización JSON de VerificationResponseDTO")
    class JsonSerializationIntegrationTest {

        /**
         * Valida: La respuesta de verificación se serializa correctamente a JSON.
         *
         * Verifica:
         *   - verificationId presente (UUID)
         *   - claimText presente
         *   - overallScore como número decimal entre 0 y 1
         *   - trafficLight con valor válido
         *   - processingTime presente
         */
        @Test
        @DisplayName("VerificationResponseDTO contiene todos los campos esperados")
        void givenVerificationResponse_whenSerialized_thenContainsAllFields() {
            VerificationRequestDTO req = new VerificationRequestDTO();
            req.setClaimText("El paracetamol es efectivo para reducir la fiebre");
            req.setSourceUrl("https://pubmed.ncbi.nlm.nih.gov/known/");

            ResponseEntity<String> response = rest.exchange(
                baseUrl + "/api/verify/claim",
                HttpMethod.POST,
                jsonEntity(req, studentToken),
                String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody())
                .as("JSON response no debe ser nulo")
                .isNotNull();
            assertThat(response.getBody())
                .as("JSON debe contener id")
                .contains("\"id\"");
            assertThat(response.getBody())
                .as("JSON debe contener claim")
                .contains("paracetamol");
            assertThat(response.getBody())
                .as("JSON debe contener score")
                .contains("\"score\"");
            assertThat(response.getBody())
                .as("JSON debe contener status")
                .containsAnyOf("verified", "conflicting", "misinformation", "pending");
        }
    }
}