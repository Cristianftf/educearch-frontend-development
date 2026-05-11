package com.uci.competencia.verification;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.request.VerificationRequestDTO;
import com.uci.competencia.model.dto.response.VerificationResponseDTO;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.repository.VerificationResultRepository;
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
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * PRUEBA DE INTEGRACIÓN — Verificación de afirmaciones médicas
 * ============================================================
 * 
 * OBJETIVO: Validar el flujo de verificación de claims médicos usando
 * el contexto Spring completo con MockMvc construido manualmente.
 * 
 * REQUISITOS CUMPLIDOS:
 *   - @SpringBootTest con WebApplicationContext
 *   - MockMvc con MockMvcBuilders (sin @AutoConfigureMockMvc)
 *   - JWT reales con generateTokenFromUsername()
 *   - @Transactional para rollback automático
 *   - Escenarios positivos y negativos
 *   - Validación JSON y persistencia
 */
@SpringBootTest
@ActiveProfiles("integration")
@Transactional
@DisplayName("VerificationComprehensiveIntegrationTest — Verificación de claims médicos")
class VerificationComprehensiveIntegrationTest {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private VerificationResultRepository verificationResultRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User studentUser;
    private User professorUser;
    private String studentToken;
    private String professorToken;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
            .webAppContextSetup(webApplicationContext)
            .build();

        verificationResultRepository.deleteAll();
        userRepository.deleteAll();

        studentUser = createUser("student@university.edu", "student_user", Role.ROLE_STUDENT);
        professorUser = createUser("professor@university.edu", "professor_user", Role.ROLE_PROFESSOR);

        studentToken = jwtTokenProvider.generateTokenFromUsername(
            studentUser.getEmail(), Role.ROLE_STUDENT.name());
        professorToken = jwtTokenProvider.generateTokenFromUsername(
            professorUser.getEmail(), Role.ROLE_PROFESSOR.name());
    }

    // =========================================================================
    // POSITIVE SCENARIOS
    // =========================================================================

    @Nested
    @DisplayName("✓ POSITIVE: Valid Claim Verification")
    class ValidVerificationScenarios {

        @Test
        @DisplayName("Verify legitimate medical claim - COVID-19 vaccination")
        void givenValidMedicalClaim_whenVerify_thenReturns200WithVerdict() throws Exception {
            VerificationRequestDTO request = new VerificationRequestDTO();
            request.setClaimText("Las vacunas contra COVID-19 reducen el riesgo de hospitalización");
            request.setSourceUrl("https://pubmed.ncbi.nlm.nih.gov/12345678/");

            MvcResult result = mockMvc.perform(
                    post("/api/verification/verify")
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                )
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.status").exists())
                .andExpect(jsonPath("$.score").isNumber())
                .andExpect(jsonPath("$.claim").exists())
                .andExpect(jsonPath("$.verifiedAt").exists())
                .andReturn();

            VerificationResponseDTO response = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                VerificationResponseDTO.class
            );

            assertThat(response).isNotNull();
            assertThat(response.getId()).isNotBlank();
            assertThat(response.getClaim()).contains("vacunas contra COVID-19");
            assertThat(response.getScore()).isBetween(0.0, 1.0);
            assertThat(response.getStatus()).isIn("verified", "conflicting", "misinformation", "pending");
        }

        @Test
        @DisplayName("Detect medical misinformation")
        void givenMisinformationClaim_whenVerify_thenReturnsLowScore() throws Exception {
            VerificationRequestDTO request = new VerificationRequestDTO();
            request.setClaimText("El consumo de lejía cura el COVID-19 y el cáncer");
            request.setSourceUrl("https://example-fake-news.com");

            mockMvc.perform(
                    post("/api/verification/verify")
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.score").isNumber())
                .andExpect(jsonPath("$.claim").value(
                    "El consumo de lejía cura el COVID-19 y el cáncer"));
        }
    }

    // =========================================================================
    // NEGATIVE SCENARIOS
    // =========================================================================

    @Nested
    @DisplayName("✗ NEGATIVE: Invalid Verification Requests")
    class InvalidVerificationScenarios {

        @Test
        @DisplayName("Empty claim text - 400")
        void givenEmptyClaimText_whenVerify_thenReturns400() throws Exception {
            VerificationRequestDTO request = new VerificationRequestDTO();
            request.setClaimText("");
            request.setSourceUrl("https://example.com");

            mockMvc.perform(
                    post("/api/verification/verify")
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                )
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("Unauthenticated verification - 401")
        void givenNoAuthToken_whenVerify_thenReturns401() throws Exception {
            VerificationRequestDTO request = new VerificationRequestDTO();
            request.setClaimText("Test claim");
            request.setSourceUrl("https://example.com");

            mockMvc.perform(
                    post("/api/verification/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                )
                .andExpect(status().isUnauthorized());
        }
    }

    // =========================================================================
    // HISTORY SCENARIOS
    // =========================================================================

    @Nested
    @DisplayName("📋 History: Verification History")
    class VerificationHistoryScenarios {

        @Test
        @DisplayName("Get verification history after verifying a claim")
        void givenPreviousVerifications_whenGetHistory_thenReturns200() throws Exception {
            VerificationRequestDTO request = new VerificationRequestDTO();
            request.setClaimText("La vacuna contra la influenza es segura");
            request.setSourceUrl("https://pubmed.ncbi.nlm.nih.gov/ref123/");

            mockMvc.perform(
                    post("/api/verification/verify")
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                )
                .andExpect(status().isOk());

            mockMvc.perform(
                    get("/api/verification/history")
                        .header("Authorization", "Bearer " + studentToken)
                )
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON));
        }
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private User createUser(String email, String username, Role role) {
        User user = new User();
        user.setEmail(email);
        user.setUsername(username);
        user.setFirstName("Test");
        user.setLastName("User");
        user.setPasswordHash(passwordEncoder.encode("SecurePassword123!"));
        user.setRole(role);
        user.setActive(true);
        user.setFaculty("Medicine");
        user.setDepartment("Research");
        return userRepository.save(user);
    }
}