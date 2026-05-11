package com.uci.competencia.verification;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.request.VerificationRequestDTO;
import com.uci.competencia.model.dto.response.VerificationResponseDTO;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.repository.UserRepository;
import com.uci.competencia.repository.VerificationResultRepository;
import com.uci.competencia.security.JwtTokenProvider;
import com.uci.competencia.service.external.OpenAIService;
import com.uci.competencia.service.external.PubMedApiService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * PRUEBA DE INTEGRACIÓN — Motor IA/BioBERT para validación semántica
 * ==================================================================
 *
 * VALIDA LA COMUNICACIÓN ENTRE SPRING BOOT Y EL MOTOR IA
 * (RAGServiceImpl + SimilarityCalculator + OpenAIService + PubMedApiService)
 *
 * OBJETIVOS:
 *   1. Validar envío de afirmaciones médicas al motor IA
 *   2. Validar recepción de scores semánticos (0.0 - 100.0)
 *   3. Validar clasificación de veracidad (VERIFIED, REFUTED, CONFLICTING)
 *   4. Validar errores del motor IA (timeout simulado)
 *   5. Validar respuestas ambiguas (evidencia mixta)
 *   6. Validar formato de respuesta JSON completo
 *
 * AFIRMACIONES MÉDICAS:
 *   ✓ "El ejercicio reduce la diabetes" → VERIFIED (score alto)
 *   ✗ "El chocolate cura el cáncer" → REFUTED (score bajo)
 *   ⚠ "La vitamina D previene resfriados" → CONFLICTING (evidencia mixta)
 *   ◌ "La tierra es plana" → SIN EVIDENCIA (score 0)
 *   🔴 Error de IA → fallback heurístico (200 OK)
 *
 * SIMULACIÓN DEL SERVICIO IA:
 *   Usa @TestConfiguration + @Primary para reemplazar los servicios
 *   reales PubMedApiService y OpenAIService por implementaciones
 *   simuladas que retornan datos controlados sin conexiones reales.
 *
 * @see com.uci.competencia.service.impl.RAGServiceImpl
 * @see com.uci.competencia.service.impl.VerificationServiceImpl
 */
@SpringBootTest
@ActiveProfiles("integration")
@Transactional
@DisplayName("VerificationRAGIntegrationTest — Motor IA/BioBERT para validación semántica")
class VerificationRAGIntegrationTest {

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

    // ──────────────────────────────────────────────────────────────
    // TEST CONFIGURATION: Reemplaza servicios reales por simulados
    // Usamos @TestConfiguration + @Primary para que Spring inyecte
    // nuestras implementaciones mock en lugar de las reales.
    //
    // Esto evita la dependencia de @MockBean (no disponible en este
    // entorno) y nos da control total sobre las respuestas simuladas.
    // ──────────────────────────────────────────────────────────────

    /**
     * Control de respuestas para los servicios simulados.
     * Se configuran en cada test antes de la petición HTTP.
     */
    static class MockResponses {
        static List<PubMedApiService.PubMedArticle> pubmedArticles = List.of();
        static String openAiResponse = null;
        static RuntimeException openAiError = null;
        static boolean openAiStructuredMode = false;
    }

    @TestConfiguration
    static class TestMockConfig {

        @Bean
        @Primary
        PubMedApiService mockPubMedApiService() {
            return new PubMedApiService() {
                @Override
                public List<PubMedApiService.PubMedArticle> searchArticles(String query, int maxResults) {
                    return MockResponses.pubmedArticles != null ? MockResponses.pubmedArticles : List.of();
                }

                @Override
                public List<PubMedApiService.MeshSuggestion> getSuggestedMeshTerms(String term, int limit) {
                    return List.of();
                }
            };
        }

        @Bean
        @Primary
        OpenAIService mockOpenAIService() {
            return new OpenAIService() {
                @Override
                public String generateText(String prompt) {
                    return generateText(prompt, false);
                }

                @Override
                public String generateText(String prompt, boolean structuredOutput) {
                    if (MockResponses.openAiError != null) {
                        throw MockResponses.openAiError;
                    }
                    MockResponses.openAiStructuredMode = structuredOutput;
                    return MockResponses.openAiResponse;
                }

                @Override
                public Double calculateSimilarity(String text1, String text2) {
                    return 0.5;
                }
            };
        }
    }

    private MockMvc mockMvc;
    private String studentToken;
    private String studentId;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
            .webAppContextSetup(webApplicationContext)
            .build();

        // Limpiar responses mock entre tests
        MockResponses.pubmedArticles = List.of();
        MockResponses.openAiResponse = null;
        MockResponses.openAiError = null;
        MockResponses.openAiStructuredMode = false;

        verificationResultRepository.deleteAll();
        userRepository.deleteAll();

        User student = new User();
        student.setUsername("laura.investigadora");
        student.setEmail("laura.investigadora@universidad.edu");
        student.setPasswordHash(passwordEncoder.encode("Medicina2024!"));
        student.setFirstName("Laura");
        student.setLastName("Investigadora García");
        student.setRole(Role.ROLE_STUDENT);
        student.setFaculty("Medicina");
        student.setDepartment("Epidemiología Clínica");
        student.setActive(true);
        student.setCreatedAt(LocalDateTime.now());
        student.setUpdatedAt(LocalDateTime.now());
        student = userRepository.saveAndFlush(student);
        studentId = student.getId();

        studentToken = jwtTokenProvider.generateTokenFromUsername(
            student.getEmail(), Role.ROLE_STUDENT.name());
    }

    // =====================================================================
    //  ESCENARIO 1: VERIFIED — "El ejercicio reduce la diabetes"
    //  Score alto, evidencia consistente, clasificación SUPPORTED
    // =====================================================================

    @Nested
    @DisplayName("✓ ESCENARIO 1: VERIFIED — \"El ejercicio reduce la diabetes\"")
    class VerifiedClaimScenario {

        @Test
        @DisplayName("✓ Claim verdadero → VERIFIED (score alto) + persistencia en BD")
        void givenExerciseReducesDiabetesClaim_whenVerify_thenReturnsVerified() throws Exception {
            // ARRANGE: PubMed con 3 artículos que APOYAN
            MockResponses.pubmedArticles = List.of(
                new PubMedApiService.PubMedArticle(
                    "30123456",
                    "Exercise reduces type 2 diabetes risk: A randomized controlled trial",
                    "A 12-month RCT with 2000 participants showed that moderate exercise reduces diabetes incidence by 34% in high-risk adults.",
                    List.of("Smith JA", "Johnson KB", "Williams RL"),
                    "New England Journal of Medicine",
                    "2024-06-15",
                    "10.1056/NEJMoa2401234",
                    List.of("Randomized Controlled Trial", "Journal Article"),
                    List.of("Exercise", "Diabetes Mellitus Type 2", "Prevention")
                ),
                new PubMedApiService.PubMedArticle(
                    "31234567",
                    "Physical activity and glycemic control: Meta-analysis of 45 studies",
                    "Meta-analysis of 45 RCTs (n=12,500) demonstrates that regular physical activity significantly improves HbA1c levels in type 2 diabetes patients.",
                    List.of("Garcia MR", "Lopez FA", "Chen Y"),
                    "The Lancet Diabetes & Endocrinology",
                    "2024-03-20",
                    "10.1016/S2213-8587(24)00089-2",
                    List.of("Meta-Analysis", "Journal Article"),
                    List.of("Exercise", "Diabetes Mellitus", "Glycemic Control")
                ),
                new PubMedApiService.PubMedArticle(
                    "32345678",
                    "Long-term exercise prevents diabetes: A 10-year cohort study",
                    "A 10-year cohort study (n=5,000) found that consistent exercise reduces diabetes development by 28% in prediabetic adults.",
                    List.of("Fernandez RA", "Martinez PL"),
                    "Diabetes Care",
                    "2023-11-01",
                    "10.2337/dc23-1234",
                    List.of("Cohort Study", "Journal Article"),
                    List.of("Exercise", "Prediabetic State", "Primary Prevention")
                )
            );

            // ARRANGE: OpenAI responde con JSON de veredicto SUPPORTED
            MockResponses.openAiResponse = """
                {
                    "verdict": "SUPPORTED",
                    "score": 85.0,
                    "confidence": 0.92,
                    "explanation": "La evidencia científica es contundente: múltiples estudios de alta calidad metodológica demuestran que el ejercicio regular reduce significativamente el riesgo de desarrollar diabetes tipo 2.",
                    "recommendations": [
                        "Realizar al menos 150 minutos de ejercicio moderado por semana",
                        "Combinar ejercicio aeróbico con entrenamiento de fuerza",
                        "Consultar con un endocrinólogo antes de iniciar un programa intensivo"
                    ]
                }
                """;

            // ARRANGE: Request con afirmación médica
            VerificationRequestDTO request = new VerificationRequestDTO();
            request.setClaimText("El ejercicio reduce la diabetes");
            request.setSourceUrl("https://pubmed.ncbi.nlm.nih.gov/?term=exercise+diabetes");

            // ACT & ASSERT
            MvcResult result = mockMvc.perform(
                    post("/api/verification/verify")
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                )
                // HTTP 200 + Content-Type JSON
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))

                // Validar estructura del response DTO completo
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.claim").value("El ejercicio reduce la diabetes"))
                .andExpect(jsonPath("$.status").value("verified"))
                .andExpect(jsonPath("$.score").isNumber())
                .andExpect(jsonPath("$.verdict").value("SUPPORTED"))
                .andExpect(jsonPath("$.confidence").isNumber())
                .andExpect(jsonPath("$.evidenceCount").isNumber())
                .andExpect(jsonPath("$.supportingEvidence").isArray())
                .andExpect(jsonPath("$.supportingEvidence[0].pmid").exists())
                .andExpect(jsonPath("$.supportingEvidence[0].stance").value("support"))
                .andExpect(jsonPath("$.contradictingEvidence").isArray())
                .andExpect(jsonPath("$.explanation").exists())
                .andExpect(jsonPath("$.recommendations").isArray())
                .andExpect(jsonPath("$.verifiedAt").exists())
                .andReturn();

            // VALIDAR DESERIALIZACIÓN JSON
            VerificationResponseDTO response = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                VerificationResponseDTO.class
            );
            assertThat(response.getStatus()).isEqualTo("verified");
            assertThat(response.getScore()).isGreaterThan(50.0);
            assertThat(response.getVerdict()).isEqualTo("SUPPORTED");
            assertThat(response.getSupportingEvidence()).isNotEmpty();
            assertThat(response.getRecommendations()).isNotEmpty();

            // VALIDAR PERSISTENCIA EN BD
            assertThat(verificationResultRepository.countByUser_Id(studentId))
                .as("El resultado de verificación debe persistirse en BD")
                .isEqualTo(1);
        }
    }

    // =====================================================================
    //  ESCENARIO 2: REFUTED (INFODEMIA) — "El chocolate cura el cáncer"
    //  Score bajo, evidencia contradictoria
    // =====================================================================

    @Nested
    @DisplayName("✗ ESCENARIO 2: REFUTED (INFODEMIA) — \"El chocolate cura el cáncer\"")
    class MisinformationClaimScenario {

        @Test
        @DisplayName("✗ Afirmación falsa → REFUTED (score bajo) + evidencia contradictoria")
        void givenChocolateCuresCancerClaim_whenVerify_thenReturnsMisinformation() throws Exception {
            // ARRANGE: PubMed con artículos que CONTRADICEN
            MockResponses.pubmedArticles = List.of(
                new PubMedApiService.PubMedArticle(
                    "41234567",
                    "No evidence that cocoa products cure cancer: Systematic review",
                    "A systematic review of 28 studies found no evidence that chocolate or cocoa products have any curative effect on cancer in humans.",
                    List.of("Thompson R", "Miller S", "Davis K"),
                    "Journal of the National Cancer Institute",
                    "2024-01-10",
                    "10.1093/jnci/djae001",
                    List.of("Systematic Review", "Journal Article"),
                    List.of("Cacao", "Neoplasms", "Complementary Therapies")
                ),
                new PubMedApiService.PubMedArticle(
                    "42345678",
                    "Dietary misinformation and cancer: Understanding pseudoscientific claims",
                    "Analysis of popular dietary misinformation about cancer, highlighting that claims about chocolate curing cancer lack any scientific basis.",
                    List.of("Wilson JM", "Brown AK"),
                    "CA: A Cancer Journal for Clinicians",
                    "2024-05-20",
                    "10.3322/caac.21834",
                    List.of("Review", "Journal Article"),
                    List.of("Health Misinformation", "Neoplasms", "Diet")
                ),
                new PubMedApiService.PubMedArticle(
                    "43456789",
                    "Cancer treatment myths: Why chocolate cannot replace chemotherapy",
                    "Editorial discussing dangerous cancer misinformation, emphasizing that chocolate consumption has no proven role in cancer treatment.",
                    List.of("Anderson PL"),
                    "The Lancet Oncology",
                    "2023-12-15",
                    "10.1016/S1470-2045(23)00567-8",
                    List.of("Editorial", "Journal Article"),
                    List.of("Health Misinformation", "Antineoplastic Agents", "Cacao")
                )
            );

            // ARRANGE: IA confirma REFUTED
            MockResponses.openAiResponse = """
                {
                    "verdict": "REFUTED",
                    "score": 12.0,
                    "confidence": 0.95,
                    "explanation": "No existe evidencia científica que respalde la afirmación. Revisiones sistemáticas confirman que esta afirmación carece de base científica.",
                    "recommendations": [
                        "No reemplazar tratamientos médicos convencionales con chocolate",
                        "Consultar con un oncólogo para tratamientos basados en evidencia",
                        "Reportar afirmaciones de curas milagrosas a las autoridades sanitarias"
                    ]
                }
                """;

            VerificationRequestDTO request = new VerificationRequestDTO();
            request.setClaimText("El chocolate cura el cáncer");
            request.setSourceUrl("https://example-fake-news.com");

            MvcResult result = mockMvc.perform(
                    post("/api/verification/verify")
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("misinformation"))
                .andExpect(jsonPath("$.verdict").value("REFUTED"))
                .andExpect(jsonPath("$.score").isNumber())
                .andExpect(jsonPath("$.contradictingEvidence").isArray())
                .andReturn();

            VerificationResponseDTO response = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                VerificationResponseDTO.class
            );
            assertThat(response.getStatus()).isEqualTo("misinformation");
            assertThat(response.getScore()).isLessThan(30.0);
            assertThat(response.getContradictingEvidence()).isNotEmpty();
        }
    }

    // =====================================================================
    //  ESCENARIO 3: CONFLICTING — "La vitamina D previene resfriados"
    //  Evidencia mixta (apoya y contradice)
    // =====================================================================

    @Nested
    @DisplayName("⚠ ESCENARIO 3: CONFLICTING — \"La vitamina D previene resfriados\"")
    class ConflictingClaimScenario {

        @Test
        @DisplayName("⚠ Evidencia mixta → CONFLICTING (score medio) + ambos lados")
        void givenVitaminDPreventsColdsClaim_whenVerify_thenReturnsConflicting() throws Exception {
            // ARRANGE: PubMed con artículos que APOYAN y CONTRADICEN
            MockResponses.pubmedArticles = List.of(
                // Artículo que APOYA
                new PubMedApiService.PubMedArticle(
                    "53456789",
                    "Vitamin D supplementation reduces respiratory infections: RCT",
                    "A double-blind RCT with 1,200 participants found that vitamin D supplementation reduced the incidence of acute respiratory infections by 22% in adults with baseline deficiency.",
                    List.of("Martinez P", "Rodriguez S", "Kim JH"),
                    "BMJ",
                    "2024-02-15",
                    "10.1136/bmj-2024-078901",
                    List.of("Randomized Controlled Trial", "Journal Article"),
                    List.of("Vitamin D", "Respiratory Tract Infections", "Dietary Supplements")
                ),
                // Artículo que CONTRADICE
                new PubMedApiService.PubMedArticle(
                    "54567890",
                    "Vitamin D for common cold prevention: No significant benefit in well-nourished adults",
                    "A large RCT (n=3,500) found no significant difference in cold incidence between vitamin D supplementation and placebo in adults with normal vitamin D levels.",
                    List.of("Johnson KL", "Brown TD", "Wilson MA"),
                    "JAMA",
                    "2024-04-10",
                    "10.1001/jama.2024.05678",
                    List.of("Randomized Controlled Trial", "Journal Article"),
                    List.of("Vitamin D", "Common Cold", "Primary Prevention")
                ),
                // Meta-análisis con conclusiones mixtas
                new PubMedApiService.PubMedArticle(
                    "55678901",
                    "Vitamin D and respiratory infections: Meta-analysis shows subgroup-dependent effects",
                    "Meta-analysis of 32 RCTs (n=45,000) shows vitamin D reduces infection risk mainly in deficient individuals (RR 0.78), with no significant effect in replete populations.",
                    List.of("Chen L", "Garcia MR", "Patel S"),
                    "The Lancet Respiratory Medicine",
                    "2024-08-01",
                    "10.1016/S2213-2600(24)00234-5",
                    List.of("Meta-Analysis", "Journal Article"),
                    List.of("Vitamin D Deficiency", "Respiratory Tract Infections")
                )
            );

            // ARRANGE: IA detecta CONFLICTING
            MockResponses.openAiResponse = """
                {
                    "verdict": "CONFLICTING",
                    "score": 55.0,
                    "confidence": 0.72,
                    "explanation": "La evidencia es mixta. La vitamina D reduce infecciones respiratorias en personas con deficiencia basal, pero no hay beneficio significativo en población general con niveles normales.",
                    "recommendations": [
                        "Medir niveles de vitamina D antes de suplementar",
                        "Solo suplementar si hay deficiencia documentada",
                        "Mantener una dieta equilibrada rica en vitamina D"
                    ]
                }
                """;

            VerificationRequestDTO request = new VerificationRequestDTO();
            request.setClaimText("La vitamina D previene resfriados");
            request.setSourceUrl("https://pubmed.ncbi.nlm.nih.gov/?term=vitamin+D+cold");

            MvcResult result = mockMvc.perform(
                    post("/api/verification/verify")
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("conflicting"))
                .andExpect(jsonPath("$.supportingEvidence").isArray())
                .andExpect(jsonPath("$.contradictingEvidence").isArray())
                .andReturn();

            VerificationResponseDTO response = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                VerificationResponseDTO.class
            );
            assertThat(response.getStatus()).isEqualTo("conflicting");
            assertThat(response.getScore()).isBetween(30.0, 70.0);
            assertThat(response.getSupportingEvidence()).isNotEmpty();
            assertThat(response.getContradictingEvidence()).isNotEmpty();
        }
    }

    // =====================================================================
    //  ESCENARIO 4: SIN EVIDENCIA — Afirmación sin respaldo científico
    //  score 0, evidenceCount 0
    // =====================================================================

    @Nested
    @DisplayName("◌ ESCENARIO 4: SIN EVIDENCIA — \"La tierra es plana\"")
    class NoEvidenceClaimScenario {

        @Test
        @DisplayName("◌ Sin evidencia → score 0 + evidenceCount 0")
        void givenClaimWithNoEvidence_whenVerify_thenReturnsNoEvidence() throws Exception {
            MockResponses.pubmedArticles = List.of();
            MockResponses.openAiResponse = null;

            VerificationRequestDTO request = new VerificationRequestDTO();
            request.setClaimText("La tierra es plana");

            MvcResult result = mockMvc.perform(
                    post("/api/verification/verify")
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.evidenceCount").value(0))
                .andReturn();

            VerificationResponseDTO response = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                VerificationResponseDTO.class
            );
            assertThat(response.getEvidenceCount()).isEqualTo(0);
        }
    }

    // =====================================================================
    //  ESCENARIO 5: ERROR DEL MOTOR IA — Timeout simulado
    //  El sistema debe usar fallback heurístico
    // =====================================================================

    @Nested
    @DisplayName("🔴 ESCENARIO 5: Error de motor IA — Timeout → Fallback heurístico")
    class AIErrorScenario {

        @Test
        @DisplayName("🔴 OpenAI timeout → 200 OK + fallback heurístico + evidencia presente")
        void givenAIServiceError_whenVerify_thenReturnsHeuristicFallback() throws Exception {
            MockResponses.pubmedArticles = List.of(
                new PubMedApiService.PubMedArticle(
                    "61234567",
                    "Paracetamol for fever in children: Clinical guidelines review",
                    "Current clinical guidelines support paracetamol use for fever management in children.",
                    List.of("Taylor RS", "Anderson KL"),
                    "Pediatrics",
                    "2024-07-01",
                    "10.1542/peds.2024-067890",
                    List.of("Practice Guideline", "Journal Article"),
                    List.of("Acetaminophen", "Fever", "Child")
                )
            );
            MockResponses.openAiError = new RuntimeException("OpenAI API timeout after 5000ms");

            VerificationRequestDTO request = new VerificationRequestDTO();
            request.setClaimText("El paracetamol es efectivo para reducir la fiebre en niños");

            MvcResult result = mockMvc.perform(
                    post("/api/verification/verify")
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").exists())
                .andExpect(jsonPath("$.score").isNumber())
                .andExpect(jsonPath("$.supportingEvidence").isArray())
                .andReturn();

            VerificationResponseDTO response = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                VerificationResponseDTO.class
            );
            assertThat(response.getStatus()).isNotBlank();
            assertThat(response.getSupportingEvidence())
                .isNotEmpty();
        }
    }

    // =====================================================================
    //  ESCENARIO 6: CLAIM INVÁLIDO — Texto vacío, sin token
    // =====================================================================

    @Nested
    @DisplayName("✗ ESCENARIO 6: Claim inválido — 400 / 401")
    class InvalidClaimScenario {

        @Test
        @DisplayName("✗ Texto vacío → 400 Bad Request")
        void givenEmptyClaimText_whenVerify_thenReturns400() throws Exception {
            VerificationRequestDTO request = new VerificationRequestDTO();
            request.setClaimText("");
            mockMvc.perform(
                    post("/api/verification/verify")
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                )
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("✗ Sin autenticación → 401 Unauthorized")
        void givenNoToken_whenVerify_thenReturns401() throws Exception {
            VerificationRequestDTO request = new VerificationRequestDTO();
            request.setClaimText("Test claim");
            mockMvc.perform(
                    post("/api/verification/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                )
                .andExpect(status().isUnauthorized());
        }
    }

    // =====================================================================
    //  ESCENARIO 7: HISTORIAL — Verificaciones previas
    // =====================================================================

    @Nested
    @DisplayName("📋 ESCENARIO 7: Historial de verificaciones")
    class VerificationHistoryScenario {

        @Test
        @DisplayName("📋 Historial después de verificar → 200 OK + JSON")
        void givenPreviousVerification_whenGetHistory_thenReturns200() throws Exception {
            MockResponses.pubmedArticles = List.of(
                new PubMedApiService.PubMedArticle(
                    "70123456",
                    "Test article",
                    "Abstract",
                    List.of("Author A"),
                    "Test Journal",
                    "2024", null, List.of(), List.of()
                )
            );
            MockResponses.openAiResponse = """
                {"verdict":"SUPPORTED","score":80.0,"confidence":0.8,"explanation":"Test","recommendations":["Test"]}
                """;

            VerificationRequestDTO request = new VerificationRequestDTO();
            request.setClaimText("La vacuna contra la influenza es segura");
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
}