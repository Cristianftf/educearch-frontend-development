package com.uci.competencia.service.external;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("PubMedApiServiceImpl - Integracion aislada con PubMed y MeSH")
class PubMedApiServiceImplTest {

    @Mock
    private WebClient.Builder webClientBuilder;

    @Mock
    private WebClient webClient;

    @Mock
    @SuppressWarnings("rawtypes")
    private WebClient.RequestHeadersUriSpec requestHeadersUriSpec;

    @Mock
    @SuppressWarnings("rawtypes")
    private WebClient.RequestHeadersSpec requestHeadersSpec;

    @Mock
    private WebClient.ResponseSpec responseSpec;

    private PubMedApiServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new PubMedApiServiceImpl(new ObjectMapper(), webClientBuilder);
        ReflectionTestUtils.setField(service, "pubmedBaseUrl", "https://pubmed.mock");
        ReflectionTestUtils.setField(service, "meshBaseUrl", "https://mesh.mock");
        ReflectionTestUtils.setField(service, "timeoutMs", 1500L);
        ReflectionTestUtils.setField(service, "maxRetries", 0);
        ReflectionTestUtils.setField(service, "detailBatchSize", 10);
        ReflectionTestUtils.setField(service, "maxInMemorySizeBytes", 1048576);
        ReflectionTestUtils.setField(service, "pubmedTool", "edusearch-test");
        ReflectionTestUtils.setField(service, "pubmedEmail", "qa@edusearch.test");
    }

    @Nested
    @DisplayName("searchArticles()")
    class SearchArticlesTests {

        @Test
        @DisplayName("Given_ValidPubMedJsonAndXml_When_SearchArticles_Then_ReturnsScientificArticlesMapped")
        @SuppressWarnings("unchecked")
        void Given_ValidPubMedJsonAndXml_When_SearchArticles_Then_ReturnsScientificArticlesMapped() {
            String esearchPayload = """
                {
                  "esearchresult": {
                    "idlist": ["38123456", "38123457"]
                  }
                }
                """;

            String efetchPayload = """
                <PubmedArticleSet>
                  <PubmedArticle>
                    <MedlineCitation>
                      <PMID>38123456</PMID>
                      <Article>
                        <ArticleTitle>Vitamin D supplementation in adults with hypertension</ArticleTitle>
                        <Abstract>
                          <AbstractText>Vitamin D reduced systolic blood pressure in a randomized cohort.</AbstractText>
                        </Abstract>
                        <AuthorList>
                          <Author><ForeName>Ana</ForeName><LastName>Suarez</LastName></Author>
                          <Author><ForeName>Luis</ForeName><LastName>Perez</LastName></Author>
                        </AuthorList>
                        <Journal>
                          <Title>Journal of Clinical Hypertension</Title>
                          <JournalIssue>
                            <PubDate>
                              <Year>2024</Year>
                              <Month>Feb</Month>
                              <Day>07</Day>
                            </PubDate>
                          </JournalIssue>
                        </Journal>
                        <PublicationTypeList>
                          <PublicationType>Randomized Controlled Trial</PublicationType>
                        </PublicationTypeList>
                      </Article>
                      <MeshHeadingList>
                        <MeshHeading><DescriptorName>Hypertension</DescriptorName></MeshHeading>
                        <MeshHeading><DescriptorName>Vitamin D</DescriptorName></MeshHeading>
                      </MeshHeadingList>
                    </MedlineCitation>
                    <PubmedData>
                      <ArticleIdList>
                        <ArticleId IdType="doi">10.1000/jch.2024.001</ArticleId>
                      </ArticleIdList>
                    </PubmedData>
                  </PubmedArticle>
                  <PubmedArticle>
                    <MedlineCitation>
                      <PMID>38123457</PMID>
                      <Article>
                        <ArticleTitle>Physical exercise and LDL cholesterol control in diabetes</ArticleTitle>
                        <Abstract>
                          <AbstractText>Structured exercise improved LDL cholesterol and glycemic control.</AbstractText>
                        </Abstract>
                        <AuthorList>
                          <Author><CollectiveName>EduSearch Prevention Group</CollectiveName></Author>
                        </AuthorList>
                        <Journal>
                          <Title>Metabolic Research Reviews</Title>
                          <JournalIssue>
                            <PubDate>
                              <Year>2023</Year>
                              <Month>Oct</Month>
                              <Day>12</Day>
                            </PubDate>
                          </JournalIssue>
                        </Journal>
                        <PublicationTypeList>
                          <PublicationType>Systematic Review</PublicationType>
                        </PublicationTypeList>
                      </Article>
                      <MeshHeadingList>
                        <MeshHeading><DescriptorName>Exercise</DescriptorName></MeshHeading>
                        <MeshHeading><DescriptorName>Cholesterol, LDL</DescriptorName></MeshHeading>
                      </MeshHeadingList>
                    </MedlineCitation>
                    <PubmedData>
                      <ArticleIdList>
                        <ArticleId IdType="doi">10.1000/mrr.2023.002</ArticleId>
                      </ArticleIdList>
                    </PubmedData>
                  </PubmedArticle>
                </PubmedArticleSet>
                """;

            mockSuccessfulResponseChain(Mono.just(esearchPayload), Mono.just(efetchPayload));

            List<PubMedApiService.PubMedArticle> articles =
                service.searchArticles("vitamin d AND hypertension", 20);

            assertEquals(2, articles.size());
            assertEquals("38123456", articles.get(0).pmid());
            assertEquals("Vitamin D supplementation in adults with hypertension", articles.get(0).title());
            assertEquals("Journal of Clinical Hypertension", articles.get(0).journal());
            assertEquals("2024-02-07", articles.get(0).publicationDate());
            assertEquals("10.1000/jch.2024.001", articles.get(0).doi());
            assertEquals(2, articles.get(0).authors().size());
            assertTrue(articles.get(0).meshTerms().contains("Vitamin D"));
            assertEquals("EduSearch Prevention Group", articles.get(1).authors().getFirst());
            verify(webClient, times(2)).get();
        }

        @Test
        @DisplayName("Given_EmptyQuery_When_SearchArticles_Then_ReturnsEmptyWithoutCallingWebClient")
        void Given_EmptyQuery_When_SearchArticles_Then_ReturnsEmptyWithoutCallingWebClient() {
            List<PubMedApiService.PubMedArticle> articles = service.searchArticles("   ", 10);

            assertTrue(articles.isEmpty());
            verifyNoInteractions(webClientBuilder);
        }

        @Test
        @DisplayName("Given_EmptyPubMedIdList_When_SearchArticles_Then_ReturnsEmptyResults")
        @SuppressWarnings("unchecked")
        void Given_EmptyPubMedIdList_When_SearchArticles_Then_ReturnsEmptyResults() {
            String esearchPayload = """
                {"esearchresult":{"idlist":[]}}
                """;

            mockSuccessfulResponseChain(Mono.just(esearchPayload));

            List<PubMedApiService.PubMedArticle> articles = service.searchArticles("diabetes", 5);

            assertTrue(articles.isEmpty());
            verify(webClient, times(1)).get();
        }

        @Test
        @DisplayName("Given_HttpErrorFromPubMed_When_SearchArticles_Then_ReturnsEmptyResults")
        @SuppressWarnings("unchecked")
        void Given_HttpErrorFromPubMed_When_SearchArticles_Then_ReturnsEmptyResults() {
            WebClientResponseException httpException = WebClientResponseException.create(
                HttpStatus.BAD_GATEWAY.value(),
                "Bad Gateway",
                org.springframework.http.HttpHeaders.EMPTY,
                "{\"error\":\"upstream unavailable\"}".getBytes(StandardCharsets.UTF_8),
                StandardCharsets.UTF_8
            );

            mockSuccessfulResponseChain(Mono.error(httpException));

            List<PubMedApiService.PubMedArticle> articles = service.searchArticles("cholesterol", 5);

            assertTrue(articles.isEmpty());
            verify(webClient, times(1)).get();
        }

        @Test
        @DisplayName("Given_TimeoutErrorFromPubMed_When_SearchArticles_Then_ReturnsEmptyResults")
        @SuppressWarnings("unchecked")
        void Given_TimeoutErrorFromPubMed_When_SearchArticles_Then_ReturnsEmptyResults() {
            mockSuccessfulResponseChain(Mono.error(new RuntimeException("timeout while calling PubMed")));

            List<PubMedApiService.PubMedArticle> articles = service.searchArticles("exercise", 5);

            assertTrue(articles.isEmpty());
            verify(webClient, times(1)).get();
        }
    }

    @Nested
    @DisplayName("getSuggestedMeshTerms()")
    class MeshSuggestionTests {

        @Test
        @DisplayName("Given_ValidMeshJson_When_GetSuggestedMeshTerms_Then_ReturnsMedicalSuggestions")
        @SuppressWarnings("unchecked")
        void Given_ValidMeshJson_When_GetSuggestedMeshTerms_Then_ReturnsMedicalSuggestions() {
            String meshJson = """
                [
                  {
                    "resource": "https://id.nlm.nih.gov/mesh/D003920",
                    "label": "Diabetes Mellitus"
                  },
                  {
                    "resource": "https://id.nlm.nih.gov/mesh/D006973",
                    "label": "Hypertension"
                  }
                ]
                """;

            mockSuccessfulResponseChain(Mono.just(meshJson));

            List<PubMedApiService.MeshSuggestion> suggestions = service.getSuggestedMeshTerms("diabetes", 10);

            assertEquals(2, suggestions.size());
            assertEquals("D003920", suggestions.get(0).id());
            assertEquals("Diabetes Mellitus", suggestions.get(0).term());
            assertEquals("MeSH descriptor", suggestions.get(0).description());
            verify(webClient, times(1)).get();
        }

        @Test
        @DisplayName("Given_BlankTerm_When_GetSuggestedMeshTerms_Then_ReturnsEmptyList")
        void Given_BlankTerm_When_GetSuggestedMeshTerms_Then_ReturnsEmptyList() {
            List<PubMedApiService.MeshSuggestion> suggestions = service.getSuggestedMeshTerms(" ", 10);

            assertTrue(suggestions.isEmpty());
            verifyNoInteractions(webClientBuilder);
        }

        @Test
        @DisplayName("Given_HttpErrorFromMeshLookup_When_GetSuggestedMeshTerms_Then_ReturnsEmptyList")
        @SuppressWarnings("unchecked")
        void Given_HttpErrorFromMeshLookup_When_GetSuggestedMeshTerms_Then_ReturnsEmptyList() {
            mockSuccessfulResponseChain(Mono.error(new RuntimeException("mesh timeout")));

            List<PubMedApiService.MeshSuggestion> suggestions = service.getSuggestedMeshTerms("cholesterol", 10);

            assertTrue(suggestions.isEmpty());
        }
    }

    @SuppressWarnings("unchecked")
    private void mockSuccessfulResponseChain(Mono<String>... responses) {
        when(webClientBuilder.baseUrl(any(String.class))).thenReturn(webClientBuilder);
        lenient().when(webClientBuilder.codecs(any())).thenReturn(webClientBuilder);
        lenient().when(webClientBuilder.defaultHeader(any(String.class), any(String.class))).thenReturn(webClientBuilder);
        when(webClientBuilder.build()).thenReturn(webClient);
        when(webClient.get()).thenReturn(requestHeadersUriSpec);
        when(requestHeadersUriSpec.uri(any(java.util.function.Function.class))).thenReturn(requestHeadersSpec);
        when(requestHeadersSpec.accept(any(MediaType.class))).thenReturn(requestHeadersSpec);
        when(requestHeadersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(String.class)).thenReturn(responses[0], java.util.Arrays.copyOfRange(responses, 1, responses.length));
    }
}
