package com.uci.competencia.search;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.request.SearchRequestDTO;
import com.uci.competencia.model.dto.response.SearchResponseDTO;
import com.uci.competencia.model.entity.SearchSession;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.repository.SearchSessionRepository;
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

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * PRUEBA DE INTEGRACIÓN — Search Completa (MockMvc manual)
 * ========================================================
 *
 * OBJETIVO: Validar búsqueda científica con persistencia y seguridad.
 * Versión corregida sin dependencia de @AutoConfigureMockMvc.
 *
 * @see com.uci.competencia.controller.SearchController
 * @see com.uci.competencia.service.SearchServiceImpl
 */
@SpringBootTest
@ActiveProfiles("integration")
@Transactional
@DisplayName("SearchComprehensiveIntegrationTest - Medical Research Search Suite")
class SearchComprehensiveIntegrationTest {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SearchSessionRepository searchSessionRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User studentUser;
    private User professorUser;
    private User adminUser;
    private String studentToken;
    private String professorToken;
    private String adminToken;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
            .webAppContextSetup(webApplicationContext)
            .build();

        searchSessionRepository.deleteAll();
        userRepository.deleteAll();

        studentUser = createUser("student@university.edu", "student_user", Role.ROLE_STUDENT, true);
        professorUser = createUser("professor@university.edu", "professor_user", Role.ROLE_PROFESSOR, true);
        adminUser = createUser("admin@university.edu", "admin_user", Role.ROLE_ADMIN, true);

        studentToken = jwtTokenProvider.generateTokenFromUsername(
            studentUser.getEmail(), Role.ROLE_STUDENT.name());
        professorToken = jwtTokenProvider.generateTokenFromUsername(
            professorUser.getEmail(), Role.ROLE_PROFESSOR.name());
        adminToken = jwtTokenProvider.generateTokenFromUsername(
            adminUser.getEmail(), Role.ROLE_ADMIN.name());
    }

    // =========================================================================
    // POSITIVE SCENARIOS
    // =========================================================================
    @Nested
    @DisplayName("✓ POSITIVE: Valid Search Execution")
    class ValidSearchScenarios {

        @Test
        @DisplayName("Execute medical research search - COVID-19")
        void givenValidCovidSearchRequest_whenExecuteSearch_thenReturns200WithResults() throws Exception {
            SearchRequestDTO.SearchQueryDTO query = new SearchRequestDTO.SearchQueryDTO();
            query.setTerms(List.of("COVID-19", "SARS-CoV-2", "pandemic"));
            query.setMeshTerms(List.of("Pandemics", "Coronavirus Infections"));

            SearchRequestDTO.SearchFiltersDTO filters = new SearchRequestDTO.SearchFiltersDTO();
            filters.setYearFrom(2019);
            filters.setYearTo(2024);
            filters.setMaxResults(20);
            filters.setStudyTypes(List.of("randomized controlled trial", "meta-analysis"));
            filters.setHasFullText(true);

            SearchRequestDTO searchRequest = new SearchRequestDTO();
            searchRequest.setQuery(query);
            searchRequest.setFilters(filters);

            MvcResult result = mockMvc.perform(
                    post("/api/search/execute")
                            .header("Authorization", "Bearer " + studentToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(searchRequest))
                    )
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.searchId").exists())
                    .andExpect(jsonPath("$.results").isArray())
                    .andExpect(jsonPath("$.metadata").exists())
                    .andExpect(jsonPath("$.metadata.totalResults").isNumber())
                    .andExpect(jsonPath("$.metadata.searchTime").exists())
                    .andReturn();

            SearchResponseDTO response = objectMapper.readValue(
                    result.getResponse().getContentAsString(),
                    SearchResponseDTO.class
            );
            assertThat(response).isNotNull();
            assertThat(response.getSearchId()).isNotNull();
        }

        @Test
        @DisplayName("Search with MeSH terms")
        void givenMeshTermsSearch_whenExecute_thenResultsClassifiedCorrectly() throws Exception {
            SearchRequestDTO.SearchQueryDTO query = new SearchRequestDTO.SearchQueryDTO();
            query.setTerms(List.of("hypertension"));
            query.setMeshTerms(List.of("Hypertension", "Blood Pressure", "Cardiovascular Diseases"));

            SearchRequestDTO searchRequest = new SearchRequestDTO();
            searchRequest.setQuery(query);

            mockMvc.perform(
                    post("/api/search/execute")
                            .header("Authorization", "Bearer " + professorToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(searchRequest))
                    )
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.metadata.totalResults").isNumber());
        }

        @Test
        @DisplayName("Get MeSH suggestions")
        void givenSearchTerm_whenGetMeshSuggestions_thenReturnsSuggestions() throws Exception {
            MvcResult result = mockMvc.perform(
                    get("/api/search/mesh/suggestions")
                            .header("Authorization", "Bearer " + studentToken)
                            .param("term", "diabetes")
                    )
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$").isArray())
                    .andReturn();

            String content = result.getResponse().getContentAsString();
            List<?> suggestions = objectMapper.readValue(content, List.class);
            assertThat(suggestions).isNotEmpty();
        }

        @Test
        @DisplayName("Multiple searches create separate sessions")
        void givenMultipleSearchesBySameUser_whenExecute_thenEachSessionIsIndependent() throws Exception {
            SearchRequestDTO search1 = createSearchRequest(List.of("oncology"));
            SearchRequestDTO search2 = createSearchRequest(List.of("gastroenterology"));

            mockMvc.perform(
                    post("/api/search/execute")
                            .header("Authorization", "Bearer " + studentToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(search1))
                    )
                    .andExpect(status().isOk());

            mockMvc.perform(
                    post("/api/search/execute")
                            .header("Authorization", "Bearer " + studentToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(search2))
                    )
                    .andExpect(status().isOk());

            List<SearchSession> sessions = searchSessionRepository
                .findByUser_IdInOrderByStartedAtDesc(List.of(studentUser.getId()));
            assertThat(sessions).hasSize(2);
        }
    }

    // =========================================================================
    // NEGATIVE SCENARIOS
    // =========================================================================
    @Nested
    @DisplayName("✗ NEGATIVE: Invalid Search Requests")
    class InvalidSearchScenarios {

        @Test
        @DisplayName("Empty search terms - 400")
        void givenEmptyTerms_whenExecuteSearch_thenReturns400() throws Exception {
            SearchRequestDTO.SearchQueryDTO query = new SearchRequestDTO.SearchQueryDTO();
            query.setTerms(List.of());

            SearchRequestDTO searchRequest = new SearchRequestDTO();
            searchRequest.setQuery(query);

            mockMvc.perform(
                    post("/api/search/execute")
                            .header("Authorization", "Bearer " + studentToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(searchRequest))
                    )
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("Unauthenticated request - 401")
        void givenNoAuthToken_whenExecuteSearch_thenReturns401() throws Exception {
            SearchRequestDTO searchRequest = createSearchRequest(List.of("covid"));

            mockMvc.perform(
                    post("/api/search/execute")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(searchRequest))
                    )
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Invalid JWT token - 401")
        void givenInvalidToken_whenExecuteSearch_thenReturns401() throws Exception {
            SearchRequestDTO searchRequest = createSearchRequest(List.of("covid"));

            mockMvc.perform(
                    post("/api/search/execute")
                            .header("Authorization", "Bearer invalid.token.here")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(searchRequest))
                    )
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Inactive user cannot search")
        void givenInactiveUser_whenExecuteSearch_thenFails() throws Exception {
            studentUser.setActive(false);
            userRepository.saveAndFlush(studentUser);

            String inactiveToken = jwtTokenProvider.generateTokenFromUsername(
                studentUser.getEmail(), Role.ROLE_STUDENT.name());

            SearchRequestDTO searchRequest = createSearchRequest(List.of("disease"));

            mockMvc.perform(
                    post("/api/search/execute")
                            .header("Authorization", "Bearer " + inactiveToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(searchRequest))
                    )
                    .andExpect(status().isUnauthorized());
        }
    }

    // =========================================================================
    // SECURITY SCENARIOS
    // =========================================================================
    @Nested
    @DisplayName("🔒 SECURITY: Authentication & Authorization")
    class SecurityScenarios {

        @Test
        @DisplayName("Student can execute search")
        void givenStudentRole_whenExecuteSearch_thenSucceeds() throws Exception {
            SearchRequestDTO searchRequest = createSearchRequest(List.of("ophthalmology"));
            mockMvc.perform(
                    post("/api/search/execute")
                            .header("Authorization", "Bearer " + studentToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(searchRequest))
                    )
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("Professor can execute search")
        void givenProfessorRole_whenExecuteSearch_thenSucceeds() throws Exception {
            SearchRequestDTO searchRequest = createSearchRequest(List.of("neurology"));
            mockMvc.perform(
                    post("/api/search/execute")
                            .header("Authorization", "Bearer " + professorToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(searchRequest))
                    )
                    .andExpect(status().isOk());
        }
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private User createUser(String email, String username, Role role, boolean active) {
        User user = new User();
        user.setEmail(email);
        user.setUsername(username);
        user.setFirstName("Test");
        user.setLastName("User");
        user.setPasswordHash(passwordEncoder.encode("SecurePassword123!"));
        user.setRole(role);
        user.setActive(active);
        user.setFaculty("Medicine");
        user.setDepartment("Medical Research");
        return userRepository.save(user);
    }

    private SearchRequestDTO createSearchRequest(List<String> terms) {
        SearchRequestDTO.SearchQueryDTO query = new SearchRequestDTO.SearchQueryDTO();
        query.setTerms(terms);
        SearchRequestDTO searchRequest = new SearchRequestDTO();
        searchRequest.setQuery(query);
        return searchRequest;
    }
}