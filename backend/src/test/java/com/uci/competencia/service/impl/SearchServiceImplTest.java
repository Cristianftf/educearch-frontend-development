package com.uci.competencia.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.request.ExternalHealthSearchRequestDTO;
import com.uci.competencia.model.dto.request.SearchRequestDTO;
import com.uci.competencia.model.dto.response.ExternalHealthSearchResponseDTO;
import com.uci.competencia.model.dto.response.SearchResponseDTO;
import com.uci.competencia.model.entity.SearchResult;
import com.uci.competencia.model.entity.SearchSession;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.model.enums.StudyType;
import com.uci.competencia.repository.SearchResultRepository;
import com.uci.competencia.repository.SearchSessionRepository;
import com.uci.competencia.security.UserIdentityResolver;
import com.uci.competencia.service.external.HealthSearchProxyService;
import com.uci.competencia.service.external.PubMedApiService;
import com.uci.competencia.util.PubMedQueryBuilder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("SearchServiceImpl - Busqueda cientifica y transformacion de articulos")
class SearchServiceImplTest {

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
    private PubMedQueryBuilder pubMedQueryBuilder;

    @Mock
    private HealthSearchProxyService healthSearchProxyService;

    @InjectMocks
    private SearchServiceImpl searchService;

    private SearchRequestDTO searchRequest;
    private User authenticatedUser;

    @BeforeEach
    void setUp() {
        searchRequest = new SearchRequestDTO();

        SearchRequestDTO.SearchQueryDTO query = new SearchRequestDTO.SearchQueryDTO();
        query.setTerms(List.of("diabetes", "vitamina D"));
        query.setOperators(List.of("AND"));
        searchRequest.setQuery(query);

        SearchRequestDTO.SearchFiltersDTO filters = new SearchRequestDTO.SearchFiltersDTO();
        filters.setMaxResults(25);
        filters.setMinSampleSize(100);
        filters.setYearFrom(2020);
        filters.setYearTo(2025);
        filters.setStudyTypes(List.of("rct", "systematic_review"));
        searchRequest.setFilters(filters);

        SearchRequestDTO.SearchContextDTO context = new SearchRequestDTO.SearchContextDTO();
        context.setSessionId("search-session-001");
        context.setIsPractice(false);
        searchRequest.setContext(context);

        authenticatedUser = new User();
        authenticatedUser.setId("user-001");
        authenticatedUser.setEmail("ana.medina@edusearch.edu");
        authenticatedUser.setUsername("ana.medina");
        authenticatedUser.setRole(Role.ROLE_STUDENT);
    }

    @Nested
    @DisplayName("executeSearch()")
    class ExecuteSearchTests {

        @Test
        @DisplayName("Given_PubMedArticles_When_ExecuteSearch_Then_MapsScientificResultsAndPersistsSession")
        void Given_PubMedArticles_When_ExecuteSearch_Then_MapsScientificResultsAndPersistsSession() throws Exception {
            List<PubMedApiService.PubMedArticle> articles = List.of(
                new PubMedApiService.PubMedArticle(
                    "38123456",
                    "Vitamin D supplementation in diabetes with hypertension",
                    "Randomized controlled trial with n=240 adults with diabetes and hypertension.",
                    List.of("Ana Suarez", "Luis Perez"),
                    "Journal of Clinical Endocrinology",
                    "2024-03-14",
                    "10.1000/jce.2024.001",
                    List.of("Randomized Controlled Trial"),
                    List.of("Diabetes Mellitus", "Hypertension", "Vitamin D")
                )
            );

            SearchSession savedSession = new SearchSession();
            savedSession.setId("persisted-search-001");

            when(pubMedQueryBuilder.buildPubMedQuery(searchRequest.getQuery(), searchRequest.getFilters()))
                .thenReturn("(Diabetes Mellitus[MeSH] AND \"vitamina D\"[tiab])");
            when(pubMedApiService.searchArticles("(Diabetes Mellitus[MeSH] AND \"vitamina D\"[tiab])", 25))
                .thenReturn(articles);
            when(objectMapper.writeValueAsString(searchRequest)).thenReturn("{\"query\":\"serialized\"}");
            when(userIdentityResolver.resolveCurrentUser()).thenReturn(Optional.of(authenticatedUser));
            when(searchSessionRepository.save(any(SearchSession.class))).thenReturn(savedSession);

            SearchResponseDTO response = searchService.executeSearch(searchRequest);

            assertNotNull(response);
            assertEquals("persisted-search-001", response.getSearchId());
            assertEquals(1, response.getResults().size());
            assertEquals("38123456", response.getResults().getFirst().getPmid());
            assertEquals("rct", response.getResults().getFirst().getStudyType());
            assertEquals(2, response.getResults().getFirst().getEvidenceLevel());
            assertEquals(240, response.getResults().getFirst().getSampleSize());
            assertEquals("https://doi.org/10.1000/jce.2024.001", response.getResults().getFirst().getFullTextUrl());
            assertFalse(Boolean.TRUE.equals(response.getMetadata().getFallbackUsed()));
            assertEquals(1, response.getMetadata().getTotalResults());

            ArgumentCaptor<SearchSession> sessionCaptor = ArgumentCaptor.forClass(SearchSession.class);
            verify(searchSessionRepository).save(sessionCaptor.capture());
            assertEquals("diabetes vitamina D", sessionCaptor.getValue().getOriginalQuery());
            assertEquals("pubmed", sessionCaptor.getValue().getSearchEngine());
            assertEquals(authenticatedUser, sessionCaptor.getValue().getUser());
            verify(pubMedApiService).searchArticles("(Diabetes Mellitus[MeSH] AND \"vitamina D\"[tiab])", 25);
        }

        @Test
        @DisplayName("Given_EmptyPubMedAndLocalResults_When_ExecuteSearch_Then_UsesExternalFallbackAndSetsWarning")
        void Given_EmptyPubMedAndLocalResults_When_ExecuteSearch_Then_UsesExternalFallbackAndSetsWarning() throws Exception {
            ExternalHealthSearchResponseDTO.ExternalHealthResultDTO fallbackArticle =
                new ExternalHealthSearchResponseDTO.ExternalHealthResultDTO(
                    "fallback-001",
                    "39000001",
                    "Physical exercise and LDL cholesterol reduction in diabetes",
                    "Exercise improved LDL cholesterol and glycemic control in adults.",
                    List.of("Carlos Nunez"),
                    "Preventive Cardiology",
                    2023,
                    "systematic_review",
                    1,
                    560,
                    false,
                    "10.1000/pc.2023.010",
                    "Europe PMC",
                    "https://europepmc.org/article/MED/39000001"
                );

            ExternalHealthSearchResponseDTO fallbackResponse = new ExternalHealthSearchResponseDTO(
                "europe-pmc",
                List.of(fallbackArticle),
                1,
                false,
                "2026-05-07T19:00:00Z"
            );

            SearchSession savedSession = new SearchSession();
            savedSession.setId("persisted-search-002");

            when(pubMedQueryBuilder.buildPubMedQuery(any(), any())).thenReturn("(\"diabetes\"[tiab] AND \"vitamina D\"[tiab])");
            when(pubMedApiService.searchArticles(any(String.class), eq(25))).thenReturn(List.of());
            when(searchResultRepository.findByTitleContainingIgnoreCase(any(String.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()), new PageImpl<>(List.of()));
            when(healthSearchProxyService.search(eq("diabetes vitamina D"), eq(25), any(ExternalHealthSearchRequestDTO.class)))
                .thenReturn(fallbackResponse);
            when(objectMapper.writeValueAsString(searchRequest)).thenReturn("{\"query\":\"serialized\"}");
            when(searchSessionRepository.save(any(SearchSession.class))).thenReturn(savedSession);
            when(userIdentityResolver.resolveCurrentUser()).thenReturn(Optional.empty());

            SearchResponseDTO response = searchService.executeSearch(searchRequest);

            assertNotNull(response);
            assertEquals(1, response.getResults().size());
            assertTrue(Boolean.TRUE.equals(response.getMetadata().getFallbackUsed()));
            assertEquals(1, response.getMetadata().getTotalResults());
            assertFalse(response.getMetadata().getWarnings().isEmpty());
            assertTrue(response.getMetadata().getWarnings().getFirst().contains("proveedores externos"));
            verify(healthSearchProxyService).search(eq("diabetes vitamina D"), eq(25), any(ExternalHealthSearchRequestDTO.class));
        }

        @Test
        @DisplayName("Given_LocalScientificResults_When_ExecuteSearch_Then_MapsEntityToDtoAndFiltersBySampleSize")
        void Given_LocalScientificResults_When_ExecuteSearch_Then_MapsEntityToDtoAndFiltersBySampleSize() throws Exception {
            searchRequest.getFilters().setStudyTypes(null);

            SearchResult eligibleResult = new SearchResult();
            eligibleResult.setId("local-001");
            eligibleResult.setPmid("38000111");
            eligibleResult.setTitle("Diabetes and vitamina D in hypertension control after structured physical exercise");
            eligibleResult.setAbstractText("Cohort study with n=180 adults with diabetes, vitamina D supplementation and hypertension.");
            eligibleResult.setAuthors("Laura Diaz; Pedro Torres");
            eligibleResult.setJournal("Cuban Journal of Cardiology");
            eligibleResult.setPublicationDate(LocalDate.of(2022, 9, 12));
            eligibleResult.setStudyType(StudyType.COHORT_STUDY);
            eligibleResult.setEvidenceLevel(3);
            eligibleResult.setSampleSize(180);
            eligibleResult.setHasConflictOfInterest(false);
            eligibleResult.setDoi("10.1000/cjc.2022.018");
            eligibleResult.setMeshTerms(List.of("Hypertension", "Exercise"));

            SearchResult filteredOutResult = new SearchResult();
            filteredOutResult.setId("local-002");
            filteredOutResult.setPmid("38000112");
            filteredOutResult.setTitle("Diabetes and vitamina D small pilot on cholesterol reduction");
            filteredOutResult.setAbstractText("Pilot with n=40 patients using vitamina D in diabetes.");
            filteredOutResult.setAuthors("Marta Ruiz");
            filteredOutResult.setJournal("Clinical Lipids");
            filteredOutResult.setPublicationYear(2021);
            filteredOutResult.setStudyType(StudyType.CASE_REPORT);
            filteredOutResult.setEvidenceLevel(5);
            filteredOutResult.setSampleSize(40);

            SearchSession savedSession = new SearchSession();
            savedSession.setId("persisted-search-003");

            when(pubMedQueryBuilder.buildPubMedQuery(any(), any())).thenReturn("(Hypertension[MeSH] AND \"exercise\"[tiab])");
            when(pubMedApiService.searchArticles(any(String.class), eq(25))).thenReturn(List.of());
            when(searchResultRepository.findByTitleContainingIgnoreCase(eq("diabetes"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(eligibleResult, filteredOutResult)));
            when(searchResultRepository.findByTitleContainingIgnoreCase(eq("vitamina D"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));
            when(objectMapper.writeValueAsString(searchRequest)).thenReturn("{\"query\":\"serialized\"}");
            when(searchSessionRepository.save(any(SearchSession.class))).thenReturn(savedSession);

            SearchResponseDTO response = searchService.executeSearch(searchRequest);

            assertNotNull(response);
            assertEquals(1, response.getResults().size());
            assertEquals("local-001", response.getResults().getFirst().getId());
            assertEquals(List.of("Laura Diaz", "Pedro Torres"), response.getResults().getFirst().getAuthors());
            assertEquals(2022, response.getResults().getFirst().getYear());
            assertEquals("cohort", response.getResults().getFirst().getStudyType());
            assertEquals(180, response.getResults().getFirst().getSampleSize());
            assertEquals(1, response.getMetadata().getTotalResults());
        }

        @Test
        @DisplayName("Given_PersistSessionDisabled_When_ExecuteSearch_Then_DoesNotSaveSessionAndUsesProvidedSessionId")
        void Given_PersistSessionDisabled_When_ExecuteSearch_Then_DoesNotSaveSessionAndUsesProvidedSessionId() {
            when(pubMedQueryBuilder.buildPubMedQuery(any(), any())).thenReturn("(Diabetes Mellitus[MeSH])");
            when(pubMedApiService.searchArticles(any(String.class), eq(25))).thenReturn(List.of());
            when(searchResultRepository.findByTitleContainingIgnoreCase(any(String.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()), new PageImpl<>(List.of()));
            when(healthSearchProxyService.search(eq("diabetes vitamina D"), eq(25), any(ExternalHealthSearchRequestDTO.class)))
                .thenReturn(null);

            SearchResponseDTO response = searchService.executeSearch(searchRequest, false);

            assertNotNull(response);
            assertEquals("search-session-001", response.getSearchId());
            verify(searchSessionRepository, never()).save(any(SearchSession.class));
            verifyNoInteractions(objectMapper);
        }
    }

    @Nested
    @DisplayName("mapToResultDTO()")
    class MappingTests {

        @Test
        @DisplayName("Given_PubMedArticle_When_MapToResultDTO_Then_TransformsScientificDtoCorrectly")
        void Given_PubMedArticle_When_MapToResultDTO_Then_TransformsScientificDtoCorrectly() {
            PubMedApiService.PubMedArticle article = new PubMedApiService.PubMedArticle(
                "39999111",
                "Exercise, cholesterol and diabetes prevention",
                "Systematic review of 1200 patients. sample size 1200 across trials.",
                List.of("Elena Cruz", "Marco Perez"),
                "Sports Medicine Review",
                "2022-11-03",
                "10.1000/smr.2022.1200",
                List.of("Systematic Review"),
                List.of("Exercise", "Cholesterol", "Diabetes Mellitus")
            );

            SearchResponseDTO.SearchResultDTO dto = searchService.mapToResultDTO(article);

            assertEquals("39999111", dto.getPmid());
            assertEquals("systematic_review", dto.getStudyType());
            assertEquals(1, dto.getEvidenceLevel());
            assertEquals(1200, dto.getSampleSize());
            assertEquals(2022, dto.getYear());
            assertEquals("https://doi.org/10.1000/smr.2022.1200", dto.getFullTextUrl());
            assertEquals(3, dto.getMeshTerms().size());
        }

        @Test
        @DisplayName("Given_SearchEntityWithoutAuthorsOrYear_When_MapToResultDTO_Then_ReturnsSafeDefaults")
        void Given_SearchEntityWithoutAuthorsOrYear_When_MapToResultDTO_Then_ReturnsSafeDefaults() {
            SearchResult entity = new SearchResult();
            entity.setId("entity-001");
            entity.setPmid("37777111");
            entity.setTitle("Cholesterol and hypertension");
            entity.setAbstractText("Narrative review.");
            entity.setAuthors(null);
            entity.setJournal("Medical Review");
            entity.setStudyType(StudyType.CASE_REPORT);
            entity.setEvidenceLevel(5);
            entity.setHasConflictOfInterest(null);

            SearchResponseDTO.SearchResultDTO dto = searchService.mapToResultDTO(entity);

            assertEquals("entity-001", dto.getId());
            assertTrue(dto.getAuthors().isEmpty());
            assertNotNull(dto.getYear());
            assertEquals("case_report", dto.getStudyType());
            assertFalse(dto.getHasConflictOfInterest());
            assertNull(dto.getSampleSize());
        }
    }
}
