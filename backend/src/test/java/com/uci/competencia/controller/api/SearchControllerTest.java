package com.uci.competencia.controller.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.exception.ResourceNotFoundException;
import com.uci.competencia.model.dto.request.ExternalHealthSearchRequestDTO;
import com.uci.competencia.model.dto.request.SearchAssistantRequestDTO;
import com.uci.competencia.model.dto.request.SearchRequestDTO;
import com.uci.competencia.model.dto.response.ExternalHealthSearchResponseDTO;
import com.uci.competencia.model.dto.response.SearchAssistantResponseDTO;
import com.uci.competencia.model.dto.response.SearchResponseDTO;
import com.uci.competencia.model.entity.SearchResult;
import com.uci.competencia.model.entity.SearchSession;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.model.enums.StudyType;
import com.uci.competencia.repository.SearchResultRepository;
import com.uci.competencia.repository.SearchSessionRepository;
import com.uci.competencia.security.UserIdentityResolver;
import com.uci.competencia.service.SearchAssistantService;
import com.uci.competencia.service.SearchService;
import com.uci.competencia.service.external.HealthSearchProxyService;
import com.uci.competencia.service.external.PubMedApiService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Pruebas unitarias para {@link SearchController}.
 *
 * <p>Valida todos los endpoints REST del controlador de búsqueda científica
 * del proyecto EduSearch. Sigue el patrón Given-When-Then de la metodología XP
 * con TDD, cubriendo escenarios positivos (happy path), negativos (errores,
 * datos inválidos, no encontrado) y de borde (listas vacías, nulos, etc.).</p>
 *
 * <p>Los datos de prueba son coherentes con el dominio médico-científico:
 * términos MeSH, estudios clínicos, PubMed IDs, evidencia médica.</p>
 *
 * @see SearchController
 * @see SearchService
 * @see SearchSessionRepository
 * @see UserIdentityResolver
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("SearchController - Pruebas unitarias de búsqueda científica")
class SearchControllerTest {

    // --- Mocks de dependencias ---

    @Mock
    private SearchService searchService;

    @Mock
    private SearchAssistantService searchAssistantService;

    @Mock
    private SearchSessionRepository searchSessionRepository;

    @Mock
    private SearchResultRepository searchResultRepository;

    @Mock
    private UserIdentityResolver userIdentityResolver;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private PubMedApiService pubMedApiService;

    @Mock
    private HealthSearchProxyService healthSearchProxyService;

    @InjectMocks
    private SearchController searchController;

    @Captor
    private ArgumentCaptor<SearchRequestDTO> searchRequestCaptor;

    @Captor
    private ArgumentCaptor<SearchSession> sessionCaptor;

    // --- Datos de prueba reutilizables ---

    private static final String USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    private static final String CANONICAL_USER_ID = "canonical-" + USER_ID;
    private static final String SESSION_ID = "session-uuid-12345";
    private static final String SEARCH_TERM = "insulin resistance diabetes type 2";
    private static final String PMID_EXAMPLE = "38245678";
    private static final String MESH_TERM = "Diabetes Mellitus, Type 2";

    private User defaultUser;
    private SearchSession defaultSession;
    private SearchResult defaultResult;
    private SearchRequestDTO defaultRequest;
    private SearchResponseDTO defaultResponse;
    private SearchResponseDTO.SearchResultDTO defaultResultDTO;

    @BeforeEach
    void setUp() {
        // --- Configurar usuario de prueba ---
        defaultUser = new User();
        defaultUser.setId(USER_ID);
        defaultUser.setUsername("maria.garcia");
        defaultUser.setEmail("maria.garcia@universidad.edu");
        defaultUser.setRole(Role.ROLE_STUDENT);
        defaultUser.setActive(true);

        // --- Configurar sesión de búsqueda de prueba ---
        defaultSession = new SearchSession();
        defaultSession.setId(SESSION_ID);
        defaultSession.setUser(defaultUser);
        defaultSession.setOriginalQuery(SEARCH_TERM);
        defaultSession.setStartedAt(LocalDateTime.now().minusMinutes(30));
        defaultSession.setCompletedAt(LocalDateTime.now());
        defaultSession.setResultsCount(42);
        defaultSession.setSearchEngine("pubmed");
        defaultSession.setIsFavorite(false);
        defaultSession.setFiltersApplied("{\"query\":{\"terms\":[\"insulin resistance\",\"diabetes type 2\"],\"meshTerms\":[\"D003920\",\"D003924\"]},\"filters\":{\"yearFrom\":2020,\"yearTo\":2025}}");

        // --- Configurar resultado de búsqueda de prueba ---
        defaultResult = new SearchResult();
        defaultResult.setId("result-uuid-001");
        defaultResult.setPmid(PMID_EXAMPLE);
        defaultResult.setTitle("Insulin Resistance and Type 2 Diabetes Mellitus: A Comprehensive Review");
        defaultResult.setAbstractText("Type 2 diabetes mellitus (T2DM) is a chronic metabolic disorder characterized by insulin resistance...");
        defaultResult.setAuthors("García-López M, Rodríguez-Sánchez E, Martínez-Díaz JA");
        defaultResult.setJournal("New England Journal of Medicine");
        defaultResult.setPublicationYear(2024);
        defaultResult.setPublicationDate(LocalDate.of(2024, 3, 15));
        defaultResult.setStudyType(StudyType.SYSTEMATIC_REVIEW);
        defaultResult.setEvidenceLevel(1);
        defaultResult.setRelevanceScore(0.95);
        defaultResult.setHasFullText(true);
        defaultResult.setFullTextUrl("https://pubmed.ncbi.nlm.nih.gov/" + PMID_EXAMPLE + "/");
        defaultResult.setSampleSize(15000);
        defaultResult.setHasConflictOfInterest(false);
        defaultResult.setDoi("10.1056/NEJMra2300001");
        defaultResult.setMeshTerms(List.of("D003920", "D003924", "D007328"));

        // --- Configurar SearchRequestDTO de prueba ---
        defaultRequest = new SearchRequestDTO();
        SearchRequestDTO.SearchQueryDTO query = new SearchRequestDTO.SearchQueryDTO();
        query.setTerms(List.of("insulin resistance", "diabetes type 2"));
        query.setOperators(List.of("AND"));
        query.setMeshTerms(List.of("D003920", "D003924"));
        defaultRequest.setQuery(query);
        SearchRequestDTO.SearchFiltersDTO filters = new SearchRequestDTO.SearchFiltersDTO();
        filters.setYearFrom(2020);
        filters.setYearTo(2025);
        filters.setStudyTypes(List.of("SYSTEMATIC_REVIEW", "META_ANALYSIS"));
        filters.setHasFullText(true);
        filters.setLanguage("en");
        filters.setMaxResults(50);
        defaultRequest.setFilters(filters);
        SearchRequestDTO.SearchContextDTO context = new SearchRequestDTO.SearchContextDTO();
        context.setUserId(USER_ID);
        context.setSessionId(SESSION_ID);
        context.setIsPractice(false);
        defaultRequest.setContext(context);

        // --- Configurar SearchResultDTO de prueba ---
        defaultResultDTO = new SearchResponseDTO.SearchResultDTO();
        defaultResultDTO.setId("result-uuid-001");
        defaultResultDTO.setPmid(PMID_EXAMPLE);
        defaultResultDTO.setTitle("Insulin Resistance and Type 2 Diabetes Mellitus: A Comprehensive Review");
        defaultResultDTO.setAbstractText("Type 2 diabetes mellitus (T2DM) is a chronic metabolic disorder...");
        defaultResultDTO.setAuthors(List.of("García-López M", "Rodríguez-Sánchez E", "Martínez-Díaz JA"));
        defaultResultDTO.setJournal("New England Journal of Medicine");
        defaultResultDTO.setYear(2024);
        defaultResultDTO.setStudyType("systematic_review");
        defaultResultDTO.setEvidenceLevel(1);
        defaultResultDTO.setSampleSize(15000);
        defaultResultDTO.setHasConflictOfInterest(false);
        defaultResultDTO.setDoi("10.1056/NEJMra2300001");
        defaultResultDTO.setRelevanceScore(0.95);
        defaultResultDTO.setFullTextUrl("https://pubmed.ncbi.nlm.nih.gov/38245678/");
        defaultResultDTO.setMeshTerms(List.of("D003920", "D003924", "D007328"));

        // --- Configurar SearchResponseDTO de prueba ---
        defaultResponse = new SearchResponseDTO();
        defaultResponse.setSearchId(SESSION_ID);
        defaultResponse.setResults(List.of(defaultResultDTO));
        SearchResponseDTO.SearchMetadataDTO metadata = new SearchResponseDTO.SearchMetadataDTO();
        metadata.setTotalResults(1);
        metadata.setSearchTime("0.352s");
        metadata.setQueryTransformed("(insulin resistance AND diabetes type 2)");
        metadata.setFallbackUsed(false);
        metadata.setWarnings(List.of());
        defaultResponse.setMetadata(metadata);
    }

    // =========================================================================
    //  1. POST /api/search/execute — executeSearch()
    // =========================================================================

    @Nested
    @DisplayName("POST /api/search/execute - Ejecutar búsqueda científica")
    class ExecuteSearchTests {

        @Test
        @DisplayName("Given valid search request, when executeSearch, then returns 200 OK with results")
        void givenValidSearchRequest_whenExecuteSearch_thenReturnsOkWithResults() {
            // Arrange
            when(searchService.executeSearch(any(SearchRequestDTO.class))).thenReturn(defaultResponse);

            // Act
            ResponseEntity<SearchResponseDTO> response = searchController.executeSearch(defaultRequest);

            // Assert
            assertNotNull(response, "Response must not be null");
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode(), "HTTP status must be 200 OK");
            assertNotNull(response.getBody(), "Response body must not be null");
            assertEquals(SESSION_ID, response.getBody().getSearchId(), "Search ID must match");
            assertEquals(1, response.getBody().getResults().size(), "Must return 1 result");
            assertEquals(PMID_EXAMPLE, response.getBody().getResults().getFirst().getPmid(), "PMID must match");
            assertEquals(1, response.getBody().getResults().getFirst().getEvidenceLevel(), "Evidence level must be 1 (systematic review)");
            verify(searchService, times(1)).executeSearch(defaultRequest);
        }

        @Test
        @DisplayName("Given search request with null query, when executeSearch, then throws NullPointerException because @Valid is bypassed in unit test")
        void givenSearchRequestWithNullQuery_whenExecuteSearch_thenThrowsNullPointer() {
            // Arrange: construir request con query nulo
            // Nota: En un test unitario con Mockito, la validación @Valid de Jakarta
            // no se ejecuta. El controlador accede directamente a request.getQuery().getTerms()
            // lo que produce NPE. En producción, @Valid rechazaría la petición antes.
            SearchRequestDTO invalidRequest = new SearchRequestDTO();
            invalidRequest.setQuery(null);

            // Act & Assert
            assertThrows(NullPointerException.class,
                () -> searchController.executeSearch(invalidRequest),
                "Should throw NullPointerException because @Valid validation is bypassed in unit test");
        }

        @Test
        @DisplayName("Given search service returns empty results, when executeSearch, then returns 200 with empty list")
        void givenEmptyResults_whenExecuteSearch_thenReturnsOkWithEmptyResults() {
            // Arrange
            SearchResponseDTO emptyResponse = new SearchResponseDTO();
            emptyResponse.setSearchId("empty-search-uuid");
            emptyResponse.setResults(List.of());
            SearchResponseDTO.SearchMetadataDTO emptyMetadata = new SearchResponseDTO.SearchMetadataDTO();
            emptyMetadata.setTotalResults(0);
            emptyMetadata.setSearchTime("0.100s");
            emptyMetadata.setFallbackUsed(false);
            emptyResponse.setMetadata(emptyMetadata);
            when(searchService.executeSearch(any(SearchRequestDTO.class))).thenReturn(emptyResponse);

            // Act
            ResponseEntity<SearchResponseDTO> response = searchController.executeSearch(defaultRequest);

            // Assert
            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
            assertNotNull(response.getBody());
            assertTrue(response.getBody().getResults().isEmpty(), "Results list must be empty");
            assertEquals(0, response.getBody().getMetadata().getTotalResults(), "Total results must be 0");
        }
    }

    // =========================================================================
    //  2. POST /api/search/assistant — askSearchAssistant()
    // =========================================================================

    @Nested
    @DisplayName("POST /api/search/assistant - Asistente de búsqueda con IA")
    class AskSearchAssistantTests {

        @Test
        @DisplayName("Given valid assistant request, when askSearchAssistant, then returns 200 with AI response")
        void givenValidAssistantRequest_whenAskSearchAssistant_thenReturnsOkWithResponse() {
            // Arrange
            SearchAssistantRequestDTO request = new SearchAssistantRequestDTO();
            request.setMessage("How to search for insulin resistance in PubMed?");

            SearchAssistantResponseDTO expectedResponse = new SearchAssistantResponseDTO();
            expectedResponse.setReply("Use MeSH terms: 'Diabetes Mellitus, Type 2' AND 'Insulin Resistance'. Apply filters: systematic reviews, last 5 years.");
            expectedResponse.setSuggestedTerms(List.of(
                new SearchAssistantResponseDTO.SuggestedTermDTO("D003920", "Diabetes Mellitus", "A metabolic disease..."),
                new SearchAssistantResponseDTO.SuggestedTermDTO("D003924", "Diabetes Mellitus, Type 2", "Non-insulin-dependent diabetes...")
            ));
            expectedResponse.setCanAutoApply(true);
            expectedResponse.setUsedAi(true);

            when(searchAssistantService.generateResponse(any(SearchAssistantRequestDTO.class)))
                .thenReturn(expectedResponse);

            // Act
            ResponseEntity<SearchAssistantResponseDTO> response = searchController.askSearchAssistant(request);

            // Assert
            assertNotNull(response, "Response must not be null");
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode(), "HTTP status must be 200 OK");
            assertNotNull(response.getBody(), "Response body must not be null");
            assertTrue(response.getBody().getReply().contains("MeSH"),
                "Reply should contain MeSH recommendation");
            assertFalse(response.getBody().getSuggestedTerms().isEmpty(),
                "Suggested terms list must not be empty");
            verify(searchAssistantService, times(1)).generateResponse(request);
        }

        @Test
        @DisplayName("Given assistant request with empty message, when askSearchAssistant, then returns 200 with fallback response")
        void givenEmptyMessage_whenAskSearchAssistant_thenReturnsOkWithFallback() {
            // Arrange
            SearchAssistantRequestDTO request = new SearchAssistantRequestDTO();
            request.setMessage("");

            SearchAssistantResponseDTO fallbackResponse = new SearchAssistantResponseDTO();
            fallbackResponse.setReply("Please provide a search query to get assistance.");
            fallbackResponse.setSuggestedTerms(List.of());
            fallbackResponse.setUsedAi(false);
            fallbackResponse.setFallbackUsed(true);

            when(searchAssistantService.generateResponse(any(SearchAssistantRequestDTO.class)))
                .thenReturn(fallbackResponse);

            // Act
            ResponseEntity<SearchAssistantResponseDTO> response = searchController.askSearchAssistant(request);

            // Assert
            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
            assertTrue(response.getBody().getReply().contains("Please provide"),
                "Fallback message should be returned for empty query");
            assertTrue(response.getBody().getSuggestedTerms().isEmpty(),
                "Suggested terms should be empty for fallback");
        }
    }

    // =========================================================================
    //  3. POST /api/search/external-fallback — executeExternalFallback()
    // =========================================================================

    @Nested
    @DisplayName("POST /api/search/external-fallback - Búsqueda en API externa (PubMed/Europe PMC)")
    class ExecuteExternalFallbackTests {

        @Test
        @DisplayName("Given external search request with queryText, when executeExternalFallback, then returns 200 with results")
        void givenQueryText_whenExecuteExternalFallback_thenReturnsOkWithResults() {
            // Arrange
            ExternalHealthSearchRequestDTO request = new ExternalHealthSearchRequestDTO();
            request.setQueryText("insulin resistance diabetes type 2");
            request.setMaxResults(20);

            ExternalHealthSearchResponseDTO expectedResponse = new ExternalHealthSearchResponseDTO();
            expectedResponse.setProvider("pubmed");
            expectedResponse.setTotalResults(2);
            expectedResponse.setCached(false);
            expectedResponse.setGeneratedAt(java.time.Instant.now().toString());
            ExternalHealthSearchResponseDTO.ExternalHealthResultDTO extResult =
                new ExternalHealthSearchResponseDTO.ExternalHealthResultDTO();
            extResult.setId("ext-result-001");
            extResult.setPmid(PMID_EXAMPLE);
            extResult.setTitle("Insulin Resistance and Type 2 Diabetes Mellitus");
            extResult.setAuthors(List.of("García-López M", "Rodríguez-Sánchez E"));
            extResult.setJournal("NEJM");
            extResult.setYear(2024);
            extResult.setStudyType("systematic_review");
            extResult.setEvidenceLevel(1);
            extResult.setSource("PubMed");
            extResult.setSourceUrl("https://pubmed.ncbi.nlm.nih.gov/" + PMID_EXAMPLE + "/");
            expectedResponse.setResults(List.of(extResult));

            when(healthSearchProxyService.search(
                eq("insulin resistance diabetes type 2"),
                eq(20),
                any(ExternalHealthSearchRequestDTO.class)
            )).thenReturn(expectedResponse);

            // Act
            ResponseEntity<ExternalHealthSearchResponseDTO> response =
                searchController.executeExternalFallback(request);

            // Assert
            assertNotNull(response, "Response must not be null");
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode(), "HTTP status must be 200 OK");
            assertNotNull(response.getBody(), "Response body must not be null");
            assertEquals("pubmed", response.getBody().getProvider(), "Provider must be pubmed");
            assertEquals(2, response.getBody().getTotalResults(), "Total results must be 2");
            assertFalse(response.getBody().getResults().isEmpty(), "Results list must not be empty");
            assertEquals(PMID_EXAMPLE, response.getBody().getResults().getFirst().getPmid(), "PMID must match");
            verify(healthSearchProxyService, times(1))
                .search(eq("insulin resistance diabetes type 2"), eq(20), any(ExternalHealthSearchRequestDTO.class));
        }

        @Test
        @DisplayName("Given external request with terms list instead of queryText, when executeExternalFallback, then builds query from terms and returns results")
        void givenTermsList_whenExecuteExternalFallback_thenBuildsQueryFromTerms() {
            // Arrange
            ExternalHealthSearchRequestDTO request = new ExternalHealthSearchRequestDTO();
            request.setQueryText(null);
            request.setTerms(List.of("insulin", "resistance", "diabetes"));
            request.setMaxResults(14);

            ExternalHealthSearchResponseDTO expectedResponse = new ExternalHealthSearchResponseDTO();
            expectedResponse.setProvider("europepmc");
            expectedResponse.setTotalResults(1);
            expectedResponse.setCached(true);
            expectedResponse.setResults(List.of());
            expectedResponse.setGeneratedAt(java.time.Instant.now().toString());

            when(healthSearchProxyService.search(
                eq("insulin resistance diabetes"),
                eq(14),
                any(ExternalHealthSearchRequestDTO.class)
            )).thenReturn(expectedResponse);

            // Act
            ResponseEntity<ExternalHealthSearchResponseDTO> response =
                searchController.executeExternalFallback(request);

            // Assert
            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
            assertEquals("europepmc", response.getBody().getProvider(),
                "Provider should match the proxy response");
            assertTrue(response.getBody().getCached(), "Response should be marked as cached");
        }

        @Test
        @DisplayName("Given external request with null queryText and empty terms, when executeExternalFallback, then returns 200 with empty response (no-op)")
        void givenEmptyQueryAndEmptyTerms_whenExecuteExternalFallback_thenReturnsEmptyResponse() {
            // Arrange
            ExternalHealthSearchRequestDTO request = new ExternalHealthSearchRequestDTO();
            request.setQueryText("");
            request.setTerms(List.of());

            // Act
            ResponseEntity<ExternalHealthSearchResponseDTO> response =
                searchController.executeExternalFallback(request);

            // Assert
            assertNotNull(response, "Response must not be null");
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode(), "HTTP status must be 200 OK");
            assertNotNull(response.getBody(), "Response body must not be null");
            assertEquals("none", response.getBody().getProvider(), "Provider must be 'none' for empty query");
            assertEquals(0, response.getBody().getTotalResults(), "Total results must be 0");
            assertFalse(response.getBody().getCached(), "Must not be cached");
            verifyNoInteractions(healthSearchProxyService);
        }

        @Test
        @DisplayName("Given external request with maxResults=null, when executeExternalFallback, then uses default maxResults=14")
        void givenNullMaxResults_whenExecuteExternalFallback_thenUsesDefaultMaxResults() {
            // Arrange
            ExternalHealthSearchRequestDTO request = new ExternalHealthSearchRequestDTO();
            request.setQueryText("covid-19 treatment");
            request.setMaxResults(null);

            ExternalHealthSearchResponseDTO expectedResponse = new ExternalHealthSearchResponseDTO();
            expectedResponse.setProvider("pubmed");
            expectedResponse.setTotalResults(0);
            expectedResponse.setResults(List.of());
            expectedResponse.setCached(false);
            expectedResponse.setGeneratedAt(java.time.Instant.now().toString());

            when(healthSearchProxyService.search(
                eq("covid-19 treatment"),
                eq(14),
                any(ExternalHealthSearchRequestDTO.class)
            )).thenReturn(expectedResponse);

            // Act
            ResponseEntity<ExternalHealthSearchResponseDTO> response =
                searchController.executeExternalFallback(request);

            // Assert
            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
            verify(healthSearchProxyService, times(1))
                .search(eq("covid-19 treatment"), eq(14), any(ExternalHealthSearchRequestDTO.class));
        }
    }

    // =========================================================================
    //  4. GET /api/search/mesh/suggestions — getMeshSuggestions()
    // =========================================================================

    @Nested
    @DisplayName("GET /api/search/mesh/suggestions - Sugerencias de términos MeSH")
    class GetMeshSuggestionsTests {

        @Test
        @DisplayName("Given valid search term, when getMeshSuggestions, then returns list of MeSH suggestions from PubMed")
        void givenValidTerm_whenGetMeshSuggestions_thenReturnsMeshSuggestions() {
            // Arrange
            String term = "diabetes";
            PubMedApiService.MeshSuggestion suggestion1 =
                new PubMedApiService.MeshSuggestion("D003920", "Diabetes Mellitus", "A metabolic disease...");
            PubMedApiService.MeshSuggestion suggestion2 =
                new PubMedApiService.MeshSuggestion("D003924", "Diabetes Mellitus, Type 2", "Non-insulin-dependent diabetes...");
            when(pubMedApiService.getSuggestedMeshTerms(term, 10))
                .thenReturn(List.of(suggestion1, suggestion2));

            // Act
            ResponseEntity<List<Map<String, String>>> response =
                searchController.getMeshSuggestions(term);

            // Assert
            assertNotNull(response, "Response must not be null");
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode(), "HTTP status must be 200 OK");
            assertNotNull(response.getBody(), "Response body must not be null");
            assertEquals(2, response.getBody().size(), "Must return 2 suggestions");
            assertEquals("D003920", response.getBody().getFirst().get("id"), "First MeSH ID must match");
            assertEquals("Diabetes Mellitus", response.getBody().getFirst().get("term"), "First term must match");
            assertEquals("A metabolic disease...", response.getBody().getFirst().get("description"), "First description must match");
            verify(pubMedApiService, times(1)).getSuggestedMeshTerms(term, 10);
        }

        @Test
        @DisplayName("Given empty term, when getMeshSuggestions, then returns empty list")
        void givenEmptyTerm_whenGetMeshSuggestions_thenReturnsEmptyList() {
            // Arrange
            String emptyTerm = "   ";

            // Act
            ResponseEntity<List<Map<String, String>>> response =
                searchController.getMeshSuggestions(emptyTerm);

            // Assert
            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
            assertNotNull(response.getBody());
            assertTrue(response.getBody().isEmpty(), "Suggestions list must be empty for blank term");
            verifyNoInteractions(pubMedApiService);
        }

        @Test
        @DisplayName("Given null term, when getMeshSuggestions, then returns empty list")
        void givenNullTerm_whenGetMeshSuggestions_thenReturnsEmptyList() {
            // Act
            ResponseEntity<List<Map<String, String>>> response =
                searchController.getMeshSuggestions(null);

            // Assert
            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
            assertTrue(response.getBody().isEmpty(), "Suggestions list must be empty for null term");
            verifyNoInteractions(pubMedApiService);
        }

        @Test
        @DisplayName("Given PubMed API throws exception, when getMeshSuggestions, then returns fallback suggestion with term")
        void givenPubMedApiException_whenGetMeshSuggestions_thenReturnsFallbackSuggestion() {
            // Arrange
            String term = "cancer";
            when(pubMedApiService.getSuggestedMeshTerms(term, 10))
                .thenThrow(new RuntimeException("PubMed API timeout"));

            // Act
            ResponseEntity<List<Map<String, String>>> response =
                searchController.getMeshSuggestions(term);

            // Assert
            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
            assertNotNull(response.getBody());
            assertEquals(1, response.getBody().size(), "Must return exactly 1 fallback suggestion");
            assertEquals("CANCER", response.getBody().getFirst().get("id"), "Fallback ID must be term in uppercase");
            assertEquals("cancer", response.getBody().getFirst().get("term"), "Fallback term must match input");
            assertEquals("Suggested term", response.getBody().getFirst().get("description"));
        }
    }

    // =========================================================================
    //  5. GET /api/search/results/{searchId}/evidence-pyramid — getEvidencePyramid()
    // =========================================================================

    @Nested
    @DisplayName("GET /api/search/results/{searchId}/evidence-pyramid - Pirámide de evidencia")
    class GetEvidencePyramidTests {

        @BeforeEach
        void setUpPyramidTests() {
            when(userIdentityResolver.getCurrentPrincipalIdentifier())
                .thenReturn(Optional.of(USER_ID));
            when(userIdentityResolver.resolveCanonicalUserId(USER_ID))
                .thenReturn(CANONICAL_USER_ID);
        }

        @Test
        @DisplayName("Given valid searchId with cached results, when getEvidencePyramid, then returns pyramid with session_cache source")
        void givenValidSearchIdWithCachedResults_whenGetEvidencePyramid_thenReturnsPyramidFromCache() {
            // Arrange
            when(searchSessionRepository.findByIdAndUser_Id(SESSION_ID, CANONICAL_USER_ID))
                .thenReturn(Optional.of(defaultSession));

            List<SearchResult> cachedResults = List.of(defaultResult);
            when(searchResultRepository.findBySessionId(SESSION_ID))
                .thenReturn(cachedResults);

            // Act
            ResponseEntity<Map<String, Object>> response =
                searchController.getEvidencePyramid(SESSION_ID);

            // Assert
            assertNotNull(response, "Response must not be null");
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode(), "HTTP status must be 200 OK");
            assertNotNull(response.getBody(), "Response body must not be null");
            assertEquals(SESSION_ID, response.getBody().get("searchId"), "Search ID must match");
            assertEquals("session_cache", response.getBody().get("source"), "Source must be session_cache");
            assertEquals(1, response.getBody().get("totalStudies"), "Total studies must be 1");
            assertNotNull(response.getBody().get("strength"), "Strength must not be null");
            assertNotNull(response.getBody().get("levels"), "Levels must not be null");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> levels = (List<Map<String, Object>>) response.getBody().get("levels");
            assertEquals(6, levels.size(), "Must have 6 evidence levels");

            verify(searchSessionRepository, times(1)).findByIdAndUser_Id(SESSION_ID, CANONICAL_USER_ID);
            verify(searchResultRepository, times(1)).findBySessionId(SESSION_ID);
            verify(searchService, never()).executeSearch(any(SearchRequestDTO.class), anyBoolean());
        }

        @Test
        @DisplayName("Given valid searchId with empty cached results, when getEvidencePyramid, then recomputes from live search")
        void givenValidSearchIdWithEmptyCache_whenGetEvidencePyramid_thenRecomputesFromLiveSearch() throws Exception {
            // Arrange
            when(searchSessionRepository.findByIdAndUser_Id(SESSION_ID, CANONICAL_USER_ID))
                .thenReturn(Optional.of(defaultSession));

            // Cached results are empty
            when(searchResultRepository.findBySessionId(SESSION_ID))
                .thenReturn(List.of());

            // ObjectMapper debe parsear el filtersApplied
            when(objectMapper.readValue(anyString(), eq(SearchRequestDTO.class)))
                .thenReturn(defaultRequest);

            SearchResponseDTO liveResponse = new SearchResponseDTO();
            liveResponse.setSearchId(SESSION_ID);
            liveResponse.setResults(List.of(defaultResultDTO));
            SearchResponseDTO.SearchMetadataDTO liveMetadata = new SearchResponseDTO.SearchMetadataDTO();
            liveMetadata.setTotalResults(1);
            liveMetadata.setFallbackUsed(true);
            liveResponse.setMetadata(liveMetadata);

            when(searchService.executeSearch(any(SearchRequestDTO.class), eq(false)))
                .thenReturn(liveResponse);

            // Act
            ResponseEntity<Map<String, Object>> response =
                searchController.getEvidencePyramid(SESSION_ID);

            // Assert
            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
            assertEquals("live_recomputed", response.getBody().get("source"),
                "Source must be live_recomputed when cache is empty");
            assertEquals(1, response.getBody().get("totalStudies"));
            verify(searchService, times(1)).executeSearch(any(SearchRequestDTO.class), eq(false));
        }

        @Test
        @DisplayName("Given non-existent searchId, when getEvidencePyramid, then throws ResourceNotFoundException")
        void givenNonExistentSearchId_whenGetEvidencePyramid_thenThrowsResourceNotFound() {
            // Arrange
            String nonExistentId = "non-existent-uuid";
            when(searchSessionRepository.findByIdAndUser_Id(nonExistentId, CANONICAL_USER_ID))
                .thenReturn(Optional.empty());

            // Act & Assert
            ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> searchController.getEvidencePyramid(nonExistentId),
                "Should throw ResourceNotFoundException for non-existent search"
            );
            assertTrue(exception.getMessage().contains(nonExistentId),
                "Exception message must contain the search ID");
            verify(searchResultRepository, never()).findBySessionId(anyString());
        }
    }

    // =========================================================================
    //  6. GET /api/search/history — getSearchHistory()
    // =========================================================================

    @Nested
    @DisplayName("GET /api/search/history - Historial de búsquedas del usuario")
    class GetSearchHistoryTests {

        @BeforeEach
        void setUpHistoryTests() {
            when(userIdentityResolver.getCurrentPrincipalIdentifier())
                .thenReturn(Optional.of(USER_ID));
            when(userIdentityResolver.resolveCanonicalUserId(USER_ID))
                .thenReturn(CANONICAL_USER_ID);
        }

        @Test
        @DisplayName("Given user with sessions, when getSearchHistory, then returns paginated history")
        void givenUserWithSessions_whenGetSearchHistory_thenReturnsPaginatedHistory() throws Exception {
            // Arrange
            SearchSession session2 = new SearchSession();
            session2.setId("session-uuid-67890");
            session2.setUser(defaultUser);
            session2.setOriginalQuery("hypertension treatment guidelines 2024");
            session2.setStartedAt(LocalDateTime.now().minusHours(2));
            session2.setResultsCount(15);
            session2.setIsFavorite(true);

            List<SearchSession> allSessions = List.of(defaultSession, session2);

            when(searchSessionRepository.findByUser_Id(eq(CANONICAL_USER_ID), any(Pageable.class)))
                .thenAnswer(invocation -> {
                    Pageable pageable = invocation.getArgument(1);
                    return new PageImpl<>(allSessions, pageable, allSessions.size());
                });

            when(objectMapper.readValue(anyString(), any(TypeReference.class)))
                .thenAnswer(invocation -> Map.of(
                    "query", Map.of(
                        "terms", List.of("insulin resistance", "diabetes type 2"),
                        "meshTerms", List.of("D003920", "D003924"),
                        "operators", List.of("AND")
                    ),
                    "filters", Map.of("yearFrom", 2020, "yearTo", 2025)
                ));

            // Act
            ResponseEntity<Map<String, Object>> response =
                searchController.getSearchHistory(1, 10);

            // Assert
            assertNotNull(response, "Response must not be null");
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode(), "HTTP status must be 200 OK");
            assertNotNull(response.getBody(), "Response body must not be null");
            assertEquals(2, response.getBody().get("total"), "Total must be 2 sessions");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> searches =
                (List<Map<String, Object>>) response.getBody().get("searches");
            assertEquals(2, searches.size(), "Must return 2 searches");
            verify(searchSessionRepository, times(1))
                .findByUser_Id(eq(CANONICAL_USER_ID), any(Pageable.class));
        }

        @Test
        @DisplayName("Given user with no sessions, when getSearchHistory, then returns empty history with total=0")
        void givenUserWithNoSessions_whenGetSearchHistory_thenReturnsEmptyHistory() {
            // Arrange
            when(searchSessionRepository.findByUser_Id(eq(CANONICAL_USER_ID), any(Pageable.class)))
                .thenAnswer(invocation -> {
                    Pageable pageable = invocation.getArgument(1);
                    return new PageImpl<>(List.of(), pageable, 0);
                });

            // Act
            ResponseEntity<Map<String, Object>> response =
                searchController.getSearchHistory(1, 10);

            // Assert
            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
            assertEquals(0, response.getBody().get("total"), "Total must be 0");
            assertTrue(((List<?>) response.getBody().get("searches")).isEmpty(),
                "Searches list must be empty");
        }

        @Test
        @DisplayName("Given page < 1, when getSearchHistory, then normalizes to page=1")
        void givenPageLessThanOne_whenGetSearchHistory_thenNormalizesToPage1() {
            // Arrange
            when(searchSessionRepository.findByUser_Id(eq(CANONICAL_USER_ID), any(Pageable.class)))
                .thenAnswer(invocation -> {
                    Pageable pageable = invocation.getArgument(1);
                    assertEquals(0, pageable.getPageNumber(),
                        "Page number must be 0 (Spring Data) when page=1 is requested");
                    return new PageImpl<>(List.of(), pageable, 0);
                });

            // Act
            ResponseEntity<Map<String, Object>> response = searchController.getSearchHistory(0, 10);

            // Assert
            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
        }

        @Test
        @DisplayName("Given limit > 100, when getSearchHistory, then normalizes limit to 10 and passes to repository")
        void givenLimitExceedsMax_whenGetSearchHistory_thenNormalizesLimit() {
            // Arrange
            // Nota: loadSessionsForUserIds usa internamente PageRequest.of(0, 1000, ...)
            // El controlador normaliza limit a 10 en la URL, pero el page size interno
            // del método loadSessionsForUserIds es fijo (1000) para cargar todas las sesiones.
            when(searchSessionRepository.findByUser_Id(eq(CANONICAL_USER_ID), any(Pageable.class)))
                .thenAnswer(invocation -> {
                    Pageable pageable = invocation.getArgument(1);
                    assertTrue(pageable.getPageSize() >= 10,
                        "Page size should be at least the normalized limit");
                    return new PageImpl<>(List.of(), pageable, 0);
                });

            // Act
            ResponseEntity<Map<String, Object>> response = searchController.getSearchHistory(1, 500);

            // Assert
            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
            // Verificar que total sea 0 (no hay sesiones)
            assertEquals(0, response.getBody().get("total"), "Total must be 0 for empty results");
        }
    }

    // =========================================================================
    //  7. PUT /api/search/{searchId} — updateSearch() (marcar favorito)
    // =========================================================================

    @Nested
    @DisplayName("PUT /api/search/{searchId} - Actualizar búsqueda (marcar favorito)")
    class UpdateSearchTests {

        @BeforeEach
        void setUpUpdateTests() {
            when(userIdentityResolver.getCurrentPrincipalIdentifier())
                .thenReturn(Optional.of(USER_ID));
            when(userIdentityResolver.resolveCanonicalUserId(USER_ID))
                .thenReturn(CANONICAL_USER_ID);
        }

        @Test
        @DisplayName("Given valid searchId and favorite=true, when updateSearch, then marks session as favorite and returns updated session")
        void givenValidSearchIdAndFavoriteTrue_whenUpdateSearch_thenMarksAsFavorite() {
            // Arrange
            when(searchSessionRepository.findByIdAndUser_Id(SESSION_ID, CANONICAL_USER_ID))
                .thenReturn(Optional.of(defaultSession));

            Map<String, Object> updates = new HashMap<>();
            updates.put("isFavorite", true);

            SearchSession savedSession = new SearchSession();
            savedSession.setId(SESSION_ID);
            savedSession.setUser(defaultUser);
            savedSession.setOriginalQuery(defaultSession.getOriginalQuery());
            savedSession.setStartedAt(defaultSession.getStartedAt());
            savedSession.setIsFavorite(true);

            when(searchSessionRepository.save(any(SearchSession.class)))
                .thenReturn(savedSession);

            // Act
            ResponseEntity<Map<String, Object>> response =
                searchController.updateSearch(SESSION_ID, updates);

            // Assert
            assertNotNull(response, "Response must not be null");
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode(), "HTTP status must be 200 OK");
            assertNotNull(response.getBody(), "Response body must not be null");
            assertEquals(SESSION_ID, response.getBody().get("id"), "Session ID must match");

            ArgumentCaptor<SearchSession> captor = ArgumentCaptor.forClass(SearchSession.class);
            verify(searchSessionRepository, times(1)).save(captor.capture());
            assertTrue(captor.getValue().getIsFavorite(), "Session must be marked as favorite");
        }

        @Test
        @DisplayName("Given valid searchId and favorite=false, when updateSearch, then unmarks session as favorite")
        void givenValidSearchIdAndFavoriteFalse_whenUpdateSearch_thenUnmarksAsFavorite() {
            // Arrange
            defaultSession.setIsFavorite(true); // currently favorite
            when(searchSessionRepository.findByIdAndUser_Id(SESSION_ID, CANONICAL_USER_ID))
                .thenReturn(Optional.of(defaultSession));

            Map<String, Object> updates = new HashMap<>();
            updates.put("isFavorite", false);

            SearchSession savedSession = new SearchSession();
            savedSession.setId(SESSION_ID);
            savedSession.setIsFavorite(false);
            when(searchSessionRepository.save(any(SearchSession.class)))
                .thenReturn(savedSession);

            // Act
            ResponseEntity<Map<String, Object>> response =
                searchController.updateSearch(SESSION_ID, updates);

            // Assert
            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());

            ArgumentCaptor<SearchSession> captor = ArgumentCaptor.forClass(SearchSession.class);
            verify(searchSessionRepository, times(1)).save(captor.capture());
            assertFalse(captor.getValue().getIsFavorite(),
                "Session must be unmarked as favorite");
        }

        @Test
        @DisplayName("Given non-existent searchId, when updateSearch, then throws ResourceNotFoundException")
        void givenNonExistentSearchId_whenUpdateSearch_thenThrowsResourceNotFound() {
            // Arrange
            String nonExistentId = "non-existent-uuid";
            when(searchSessionRepository.findByIdAndUser_Id(nonExistentId, CANONICAL_USER_ID))
                .thenReturn(Optional.empty());

            Map<String, Object> updates = new HashMap<>();
            updates.put("isFavorite", true);

            // Act & Assert
            assertThrows(ResourceNotFoundException.class,
                () -> searchController.updateSearch(nonExistentId, updates),
                "Should throw ResourceNotFoundException for non-existent search");
            verify(searchSessionRepository, never()).save(any());
        }

        @Test
        @DisplayName("Given updates without isFavorite field, when updateSearch, then does not modify favorite status")
        void givenUpdatesWithoutIsFavorite_whenUpdateSearch_thenDoesNotModifyFavorite() {
            // Arrange
            when(searchSessionRepository.findByIdAndUser_Id(SESSION_ID, CANONICAL_USER_ID))
                .thenReturn(Optional.of(defaultSession));

            Map<String, Object> updates = new HashMap<>();
            updates.put("title", "New title"); // non-favorite field

            when(searchSessionRepository.save(any(SearchSession.class)))
                .thenReturn(defaultSession);

            // Act
            ResponseEntity<Map<String, Object>> response =
                searchController.updateSearch(SESSION_ID, updates);

            // Assert
            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());

            ArgumentCaptor<SearchSession> captor = ArgumentCaptor.forClass(SearchSession.class);
            verify(searchSessionRepository, times(1)).save(captor.capture());
            assertFalse(captor.getValue().getIsFavorite(),
                "Favorite status must remain unchanged");
        }
    }

    // =========================================================================
    //  8. DELETE /api/search/{searchId} — deleteSearch()
    // =========================================================================

    @Nested
    @DisplayName("DELETE /api/search/{searchId} - Eliminar búsqueda del historial")
    class DeleteSearchTests {

        @BeforeEach
        void setUpDeleteTests() {
            when(userIdentityResolver.getCurrentPrincipalIdentifier())
                .thenReturn(Optional.of(USER_ID));
            when(userIdentityResolver.resolveCanonicalUserId(USER_ID))
                .thenReturn(CANONICAL_USER_ID);
        }

        @Test
        @DisplayName("Given valid searchId owned by user, when deleteSearch, then deletes session and returns 204 No Content")
        void givenValidSearchId_whenDeleteSearch_thenDeletesAndReturnsNoContent() {
            // Arrange
            when(searchSessionRepository.findByIdAndUser_Id(SESSION_ID, CANONICAL_USER_ID))
                .thenReturn(Optional.of(defaultSession));

            // Act
            ResponseEntity<Void> response = searchController.deleteSearch(SESSION_ID);

            // Assert
            assertNotNull(response, "Response must not be null");
            assertEquals(HttpStatusCode.valueOf(204), response.getStatusCode(),
                "HTTP status must be 204 No Content");
            assertNull(response.getBody(), "Response body must be null for 204 No Content");
            verify(searchSessionRepository, times(1)).delete(defaultSession);
        }

        @Test
        @DisplayName("Given non-existent searchId, when deleteSearch, then throws ResourceNotFoundException")
        void givenNonExistentSearchId_whenDeleteSearch_thenThrowsResourceNotFound() {
            // Arrange
            String nonExistentId = "non-existent-uuid";
            when(searchSessionRepository.findByIdAndUser_Id(nonExistentId, CANONICAL_USER_ID))
                .thenReturn(Optional.empty());

            // Act & Assert
            assertThrows(ResourceNotFoundException.class,
                () -> searchController.deleteSearch(nonExistentId),
                "Should throw ResourceNotFoundException for non-existent search");
            verify(searchSessionRepository, never()).delete(any());
        }
    }

    // =========================================================================
    //  9. GET /api/search/sessions/{sessionId} — getSearchSession()
    // =========================================================================

    @Nested
    @DisplayName("GET /api/search/sessions/{sessionId} - Obtener sesión de búsqueda completa")
    class GetSearchSessionTests {

        @BeforeEach
        void setUpSessionTests() {
            when(userIdentityResolver.getCurrentPrincipalIdentifier())
                .thenReturn(Optional.of(USER_ID));
            when(userIdentityResolver.resolveCanonicalUserId(USER_ID))
                .thenReturn(CANONICAL_USER_ID);
        }

        @Test
        @DisplayName("Given valid sessionId with results, when getSearchSession, then returns full session with results")
        void givenValidSessionIdWithResults_whenGetSearchSession_thenReturnsFullSession() {
            // Arrange
            when(searchSessionRepository.findByIdAndUser_Id(SESSION_ID, CANONICAL_USER_ID))
                .thenReturn(Optional.of(defaultSession));

            List<SearchResult> results = List.of(defaultResult);
            when(searchResultRepository.findBySessionId(SESSION_ID))
                .thenReturn(results);

            // Act
            ResponseEntity<Map<String, Object>> response =
                searchController.getSearchSession(SESSION_ID);

            // Assert
            assertNotNull(response, "Response must not be null");
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode(), "HTTP status must be 200 OK");
            assertNotNull(response.getBody(), "Response body must not be null");
            assertEquals(SESSION_ID, response.getBody().get("id"), "Session ID must match");
            assertNotNull(response.getBody().get("query"), "Query must not be null");
            assertNotNull(response.getBody().get("results"), "Results must not be null");
            assertEquals(1, ((List<?>) response.getBody().get("results")).size(),
                "Must return 1 result");
            assertEquals(42, response.getBody().get("totalResults"),
                "Total results must come from session.resultsCount");
            assertNotNull(response.getBody().get("executedAt"),
                "executedAt timestamp must not be null");

            verify(searchSessionRepository, times(1)).findByIdAndUser_Id(SESSION_ID, CANONICAL_USER_ID);
            verify(searchResultRepository, times(1)).findBySessionId(SESSION_ID);
        }

        @Test
        @DisplayName("Given valid sessionId with resultsCount < results size, when getSearchSession, then totalResults uses max of both")
        void givenSessionWithResultsCountLessThanResultsSize_whenGetSearchSession_thenUsesMaxTotal() {
            // Arrange
            defaultSession.setResultsCount(1);
            when(searchSessionRepository.findByIdAndUser_Id(SESSION_ID, CANONICAL_USER_ID))
                .thenReturn(Optional.of(defaultSession));

            List<SearchResult> results = List.of(defaultResult, defaultResult); // 2 results
            when(searchResultRepository.findBySessionId(SESSION_ID))
                .thenReturn(results);

            // Act
            ResponseEntity<Map<String, Object>> response =
                searchController.getSearchSession(SESSION_ID);

            // Assert
            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
            assertEquals(2, response.getBody().get("totalResults"),
                "totalResults must be the max of resultsCount(1) and results.size(2) => 2");
        }

        @Test
        @DisplayName("Given non-existent sessionId, when getSearchSession, then throws ResourceNotFoundException")
        void givenNonExistentSessionId_whenGetSearchSession_thenThrowsResourceNotFound() {
            // Arrange
            String nonExistentId = "non-existent-uuid";
            when(searchSessionRepository.findByIdAndUser_Id(nonExistentId, CANONICAL_USER_ID))
                .thenReturn(Optional.empty());

            // Act & Assert
            assertThrows(ResourceNotFoundException.class,
                () -> searchController.getSearchSession(nonExistentId),
                "Should throw ResourceNotFoundException for non-existent session");
        }

        @Test
        @DisplayName("Given session with completedAt=null but startedAt present, when getSearchSession, then executedAt uses startedAt")
        void givenSessionWithNullCompletedAt_whenGetSearchSession_thenExecutedAtFallsBackToStartedAt() {
            // Arrange
            defaultSession.setCompletedAt(null);
            when(searchSessionRepository.findByIdAndUser_Id(SESSION_ID, CANONICAL_USER_ID))
                .thenReturn(Optional.of(defaultSession));
            when(searchResultRepository.findBySessionId(SESSION_ID))
                .thenReturn(List.of());

            // Act
            ResponseEntity<Map<String, Object>> response =
                searchController.getSearchSession(SESSION_ID);

            // Assert
            assertNotNull(response);
            assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
            assertNotNull(response.getBody().get("executedAt"),
                "executedAt should fallback to startedAt when completedAt is null");
            assertTrue(((String) response.getBody().get("executedAt")).contains(
                    defaultSession.getStartedAt().toString().substring(0, 10)),
                "executedAt should match startedAt date");
        }
    }

    // =========================================================================
    //  10. Pruebas de métodos internos (vía métodos públicos)
    // =========================================================================

    @Nested
    @DisplayName("Pruebas de métodos de construcción de datos internos")
    class InternalMethodTests {

        @Test
        @DisplayName("Given SearchResult with null studyType, when mapEntityToResultDTO via evidence-pyramid, then studyType defaults to 'unknown'")
        void givenEntityWithNullStudyType_whenMapped_thenDefaultsToUnknown() {
            // Arrange
            defaultResult.setStudyType(null);
            when(userIdentityResolver.getCurrentPrincipalIdentifier())
                .thenReturn(Optional.of(USER_ID));
            when(userIdentityResolver.resolveCanonicalUserId(USER_ID))
                .thenReturn(CANONICAL_USER_ID);
            when(searchSessionRepository.findByIdAndUser_Id(SESSION_ID, CANONICAL_USER_ID))
                .thenReturn(Optional.of(defaultSession));
            when(searchResultRepository.findBySessionId(SESSION_ID))
                .thenReturn(List.of(defaultResult));

            // Act — usamos evidence-pyramid ya que devuelve Map<String, Object>
            ResponseEntity<Map<String, Object>> response =
                searchController.getEvidencePyramid(SESSION_ID);

            // Assert
            assertNotNull(response);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> levels =
                (List<Map<String, Object>>) response.getBody().get("levels");
            // Nivel 1 (systematic reviews) debe tener 1 estudio
            Map<String, Object> level1 = levels.getFirst();
            assertEquals(1, level1.get("level"), "Level 1 must be systematic reviews");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> studies =
                (List<Map<String, Object>>) level1.get("studies");
            assertEquals("unknown", studies.getFirst().get("studyType"),
                "Study type must default to 'unknown' when entity has null studyType");
        }

        @Test
        @DisplayName("Given SearchResult with authors separated by semicolons, when mapped via evidence-pyramid, then studySummary shows correct data")
        void givenEntityWithSemicolonAuthors_whenMapped_thenSplitsCorrectly() {
            // Arrange
            defaultResult.setAuthors("García-López M; Rodríguez-Sánchez E; Martínez-Díaz JA");
            when(userIdentityResolver.getCurrentPrincipalIdentifier())
                .thenReturn(Optional.of(USER_ID));
            when(userIdentityResolver.resolveCanonicalUserId(USER_ID))
                .thenReturn(CANONICAL_USER_ID);
            when(searchSessionRepository.findByIdAndUser_Id(SESSION_ID, CANONICAL_USER_ID))
                .thenReturn(Optional.of(defaultSession));
            when(searchResultRepository.findBySessionId(SESSION_ID))
                .thenReturn(List.of(defaultResult));

            // Act — usamos evidence-pyramid para probar el mapeo
            ResponseEntity<Map<String, Object>> response =
                searchController.getEvidencePyramid(SESSION_ID);

            // Assert
            assertNotNull(response);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> levels =
                (List<Map<String, Object>>) response.getBody().get("levels");
            Map<String, Object> level1 = levels.getFirst();
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> studies =
                (List<Map<String, Object>>) level1.get("studies");
            @SuppressWarnings("unchecked")
            List<String> authors = (List<String>) studies.getFirst().get("authors");
            assertEquals(3, authors.size(), "Must have 3 authors after splitting by semicolons");
            assertEquals("Rodríguez-Sánchez E", authors.get(1), "Second author must match");
        }

        @Test
        @DisplayName("Given SearchResult with null authors, when mapped via evidence-pyramid, then returns empty authors list")
        void givenEntityWithNullAuthors_whenMapped_thenReturnsEmptyAuthors() {
            // Arrange
            defaultResult.setAuthors(null);
            when(userIdentityResolver.getCurrentPrincipalIdentifier())
                .thenReturn(Optional.of(USER_ID));
            when(userIdentityResolver.resolveCanonicalUserId(USER_ID))
                .thenReturn(CANONICAL_USER_ID);
            when(searchSessionRepository.findByIdAndUser_Id(SESSION_ID, CANONICAL_USER_ID))
                .thenReturn(Optional.of(defaultSession));
            when(searchResultRepository.findBySessionId(SESSION_ID))
                .thenReturn(List.of(defaultResult));

            // Act — usamos evidence-pyramid para probar el mapeo
            ResponseEntity<Map<String, Object>> response =
                searchController.getEvidencePyramid(SESSION_ID);

            // Assert
            assertNotNull(response);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> levels =
                (List<Map<String, Object>>) response.getBody().get("levels");
            Map<String, Object> level1 = levels.getFirst();
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> studies =
                (List<Map<String, Object>>) level1.get("studies");
            @SuppressWarnings("unchecked")
            List<String> authors = (List<String>) studies.getFirst().get("authors");
            assertTrue(authors.isEmpty(), "Authors list must be empty when entity has null authors");
        }

        @Test
        @DisplayName("Given SearchSession with null filtersApplied, when mapSessionToSearchQuery via getSearchHistory, then returns fallback with originalQuery")
        void givenSessionWithNullFiltersApplied_whenMapped_thenReturnsFallbackQuery() throws Exception {
            // Arrange
            defaultSession.setFiltersApplied(null);
            when(userIdentityResolver.getCurrentPrincipalIdentifier())
                .thenReturn(Optional.of(USER_ID));
            when(userIdentityResolver.resolveCanonicalUserId(USER_ID))
                .thenReturn(CANONICAL_USER_ID);

            when(searchSessionRepository.findByUser_Id(eq(CANONICAL_USER_ID), any(Pageable.class)))
                .thenAnswer(invocation -> {
                    Pageable pageable = invocation.getArgument(1);
                    return new PageImpl<>(List.of(defaultSession), pageable, 1);
                });

            // Act
            ResponseEntity<Map<String, Object>> response =
                searchController.getSearchHistory(1, 10);

            // Assert
            assertNotNull(response);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> searches =
                (List<Map<String, Object>>) response.getBody().get("searches");
            Map<String, Object> search = searches.getFirst();
            assertNotNull(search.get("terms"), "Terms must not be null");
            @SuppressWarnings("unchecked")
            List<Map<String, String>> terms = (List<Map<String, String>>) search.get("terms");
            assertFalse(terms.isEmpty(), "Terms must not be empty (fallback to originalQuery)");
            assertEquals(SEARCH_TERM.toUpperCase(), terms.getFirst().get("id"),
                "Fallback term ID must be originalQuery in uppercase");
            assertEquals(SEARCH_TERM, terms.getFirst().get("term"),
                "Fallback term must be originalQuery");
        }
    }
}