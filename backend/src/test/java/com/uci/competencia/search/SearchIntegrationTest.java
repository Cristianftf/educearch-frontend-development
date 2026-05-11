package com.uci.competencia.search;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.request.SearchRequestDTO;
import com.uci.competencia.model.dto.response.SearchResponseDTO;
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
 * PRUEBAS DE INTEGRACIÓN — Search (Búsqueda Científica en PubMed)
 * ===============================================================
 * 
 * Versión corregida: usa MockMvc con WebApplicationContext en lugar de
 * TestRestTemplate + @MockBean (paquetes no disponibles en este entorno).
 */
@SpringBootTest
@ActiveProfiles("integration")
@Transactional
@DisplayName("SearchIntegrationTest - Suite de integración de búsqueda científica")
class SearchIntegrationTest {

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

    private String studentToken;
    private String adminToken;

    private static final String STUDENT_EMAIL = "laura.fernandez@universidad.edu";
    private static final String ADMIN_EMAIL = "admin@edusearch.uci.cu";

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
            .webAppContextSetup(webApplicationContext)
            .build();

        userRepository.deleteAll();

        var student = new User();
        student.setUsername("laura.fernandez");
        student.setEmail(STUDENT_EMAIL);
        student.setPasswordHash(passwordEncoder.encode("Medicina2024!"));
        student.setFirstName("Laura");
        student.setLastName("Fernández Ruiz");
        student.setRole(Role.ROLE_STUDENT);
        student.setFaculty("Medicina");
        student.setActive(true);
        student.setCreatedAt(LocalDateTime.now());
        student.setUpdatedAt(LocalDateTime.now());
        userRepository.saveAndFlush(student);

        var admin = new User();
        admin.setUsername("admin");
        admin.setEmail(ADMIN_EMAIL);
        admin.setPasswordHash(passwordEncoder.encode("AdminEduSearch2024!"));
        admin.setFirstName("Admin");
        admin.setLastName("Sistema");
        admin.setRole(Role.ROLE_ADMIN);
        admin.setFaculty("Dirección");
        admin.setActive(true);
        admin.setCreatedAt(LocalDateTime.now());
        admin.setUpdatedAt(LocalDateTime.now());
        userRepository.saveAndFlush(admin);

        studentToken = jwtTokenProvider.generateTokenFromUsername(
            STUDENT_EMAIL, Role.ROLE_STUDENT.name());
        adminToken = jwtTokenProvider.generateTokenFromUsername(
            ADMIN_EMAIL, Role.ROLE_ADMIN.name());
    }

    @Nested
    @DisplayName("POST /api/search/execute")
    class ExecuteSearchTests {

        @Test
        @DisplayName("Búsqueda exitosa con términos médicos → HTTP 200")
        void givenMedicalQuery_whenExecuteSearch_thenReturns200() throws Exception {
            SearchRequestDTO req = new SearchRequestDTO();
            var query = new SearchRequestDTO.SearchQueryDTO();
            query.setTerms(List.of("efectividad", "vacuna", "COVID"));
            req.setQuery(query);

            mockMvc.perform(
                    post("/api/search/execute")
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req))
                )
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.searchId").exists())
                .andExpect(jsonPath("$.results").isArray());
        }

        @Test
        @DisplayName("Búsqueda sin query → HTTP 400")
        void givenNullQuery_whenExecuteSearch_thenReturns400() throws Exception {
            SearchRequestDTO req = new SearchRequestDTO();
            req.setQuery(null);

            mockMvc.perform(
                    post("/api/search/execute")
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req))
                )
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("Búsqueda sin token → HTTP 401")
        void givenNoToken_whenExecuteSearch_thenReturns401() throws Exception {
            SearchRequestDTO req = new SearchRequestDTO();
            var query = new SearchRequestDTO.SearchQueryDTO();
            query.setTerms(List.of("covid"));
            req.setQuery(query);

            mockMvc.perform(
                    post("/api/search/execute")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req))
                )
                .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Admin ejecutando búsqueda → HTTP 403")
        void givenAdminToken_whenExecuteSearch_thenReturns403() throws Exception {
            SearchRequestDTO req = new SearchRequestDTO();
            var query = new SearchRequestDTO.SearchQueryDTO();
            query.setTerms(List.of("vacunas"));
            req.setQuery(query);

            mockMvc.perform(
                    post("/api/search/execute")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req))
                )
                .andExpect(status().isForbidden());
        }
    }

    @Nested
    @DisplayName("GET /api/search/history")
    class SearchHistoryTests {

        @Test
        @DisplayName("Historial con búsqueda previa → HTTP 200")
        void givenPreviousSearches_whenGetHistory_thenReturns200() throws Exception {
            SearchRequestDTO req = new SearchRequestDTO();
            var query = new SearchRequestDTO.SearchQueryDTO();
            query.setTerms(List.of("hipertensión"));
            req.setQuery(query);

            mockMvc.perform(
                    post("/api/search/execute")
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req))
                )
                .andExpect(status().isOk());

            mockMvc.perform(
                    get("/api/search/history")
                        .header("Authorization", "Bearer " + studentToken)
                )
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON));
        }

        @Test
        @DisplayName("Historial sin autenticación → HTTP 401")
        void givenNoToken_whenGetHistory_thenReturns401() throws Exception {
            mockMvc.perform(get("/api/search/history"))
                .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    @DisplayName("GET /api/search/mesh/suggestions")
    class MeshSuggestionsTests {

        @Test
        @DisplayName("Sugerencias MeSH exitosas → HTTP 200")
        void givenValidTerm_whenGetMeshSuggestions_thenReturns200() throws Exception {
            mockMvc.perform(
                    get("/api/search/mesh/suggestions")
                        .header("Authorization", "Bearer " + studentToken)
                        .param("term", "health misinformation")
                )
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON));
        }

        @Test
        @DisplayName("Sugerencias MeSH sin término → HTTP 400")
        void givenNoTermParam_whenGetMeshSuggestions_thenReturns400() throws Exception {
            mockMvc.perform(
                    get("/api/search/mesh/suggestions")
                        .header("Authorization", "Bearer " + studentToken)
                )
                .andExpect(status().is4xxClientError());
        }
    }
}