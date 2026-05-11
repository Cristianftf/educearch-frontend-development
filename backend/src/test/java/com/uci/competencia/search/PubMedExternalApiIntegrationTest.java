package com.uci.competencia.search;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.client.WireMock;
import com.github.tomakehurst.wiremock.core.WireMockConfiguration;
import com.uci.competencia.service.external.PubMedApiService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * PRUEBA DE INTEGRACIÓN — PubMed API externa con WireMock
 * =======================================================
 *
 * VALIDA EL CONSUMO DE LA API CIENTÍFICA DE PubMed (E-utilities)
 * DESDE EL SERVICIO PubMedApiServiceImpl.
 *
 * OBJETIVOS:
 *   1. Validar requests HTTP externas (esearch.fcgi + efetch.fcgi)
 *   2. Validar parseo de XML científico a DTOs (PubMedArticle record)
 *   3. Validar transformación de datos: PMID, título, autores, revista, MeSH
 *   4. Validar timeouts de la API externa
 *   5. Validar errores HTTP (404, 500)
 *   6. Validar listas vacías (PubMed sin resultados)
 *   7. Validar respuestas científicas complejas (XML real de PubMed)
 *
 * ARQUITECTURA:
 *   WireMockServer simula el endpoint real de NCBI E-utilities:
 *   - GET /esearch.fcgi → retorna JSON con lista de PMIDs
 *   - GET /efetch.fcgi → retorna XML PubMed con metadatos completos
 *
 *   PubMedApiServiceImpl real (inyectado por Spring):
 *   - Llama a esearch.fcgi para obtener IDs
 *   - Llama a efetch.fcgi para obtener detalles en XML
 *   - Parsea XML con DocumentBuilderFactory
 *   - Mapea a PubMedArticle record
 *
 * @see com.uci.competencia.service.external.PubMedApiServiceImpl
 * @see com.uci.competencia.service.external.PubMedApiService
 */
@SpringBootTest
@ActiveProfiles("integration")
@DisplayName("PubMedExternalApiIntegrationTest — Consumo de API científica PubMed")
class PubMedExternalApiIntegrationTest {

    @Autowired
    private PubMedApiService pubMedApiService;

    @Autowired
    private ObjectMapper objectMapper;

    private WireMockServer wireMockServer;
    private String pubmedBaseUrl;

    // =====================================================================
    //  TEST CONFIGURATION
    //  Inyectamos un WebClient.Builder que apunta al WireMock local
    //  para simular las llamadas reales a NCBI E-utilities.
    // =====================================================================

    @TestConfiguration
    static class TestConfig {
        @Bean
        @Primary
        WebClient.Builder testWebClientBuilder() {
            return WebClient.builder();
        }
    }

    @BeforeEach
    void setUp() {
        // Iniciar WireMock en puerto dinámico
        wireMockServer = new WireMockServer(
            WireMockConfiguration.wireMockConfig().dynamicPort()
        );
        wireMockServer.start();
        WireMock.configureFor("localhost", wireMockServer.port());
        pubmedBaseUrl = "http://localhost:" + wireMockServer.port();

        // Configurar la URL base del PubMedApiServiceImpl real
        // para que apunte a nuestro WireMock en lugar de NCBI
        ReflectionTestUtils.setField(pubMedApiService, "pubmedBaseUrl", pubmedBaseUrl);
        ReflectionTestUtils.setField(pubMedApiService, "timeoutMs", 5000L);
        ReflectionTestUtils.setField(pubMedApiService, "maxRetries", 0);
    }

    @AfterEach
    void tearDown() {
        if (wireMockServer != null) {
            wireMockServer.stop();
        }
    }

    // =====================================================================
    //  STUB HELPERS
    // =====================================================================

    /**
     * Configura stub para esearch.fcgi que retorna una lista de PMIDs en JSON.
     * Este es el primer paso del pipeline de PubMed: búsqueda de IDs.
     */
    private void stubEsearch(String queryParam, String jsonResponse, int status) {
        WireMock.stubFor(WireMock.get(urlPathEqualTo("/esearch.fcgi"))
            .withQueryParam("term", WireMock.containing(queryParam))
            .willReturn(aResponse()
                .withStatus(status)
                .withHeader("Content-Type", "application/json")
                .withBody(jsonResponse)
            ));
    }

    /**
     * Configura stub para efetch.fcgi que retorna XML de PubMed.
     * Este es el segundo paso: obtener detalles de los artículos.
     * PubMed devuelve XML con estructura PubmedArticleSet > PubmedArticle.
     */
    private void stubEfetch(String idsParam, String xmlResponse, int status) {
        WireMock.stubFor(WireMock.get(urlPathEqualTo("/efetch.fcgi"))
            .withQueryParam("id", WireMock.containing(idsParam))
            .willReturn(aResponse()
                .withStatus(status)
                .withHeader("Content-Type", "application/xml")
                .withBody(xmlResponse)
            ));
    }

    // =====================================================================
    //  ESCENARIO 1: Búsqueda exitosa con 2 artículos
    //  Simula una consulta completa a PubMed: esearch → IDs → efetch → XML → DTOs
    // =====================================================================

    @Nested
    @DisplayName("✓ ESCENARIO 1: Búsqueda exitosa → 2 artículos científicos")
    class SuccessfulSearchScenario {

        /**
         * OBJETIVO: Validar el pipeline completo de PubMed
         *
         * FLUJO SIMULADO:
         *   1. GET /esearch.fcgi?term=covid-19+vaccine&retmax=10&retmode=json
         *      → {"esearchresult":{"idlist":["33456789","33456790"]}}
         *   2. GET /efetch.fcgi?db=pubmed&id=33456789,33456790&retmode=xml
         *      → XML con 2 artículos (vacuna COVID, infodemia)
         *
         * VALIDACIONES:
         *   - Lista con 2 PubMedArticle
         *   - Cada artículo tiene: pmid, title, abstractText, authors, journal, meshTerms
         *   - authors es lista de strings
         *   - meshTerms contiene términos MeSH del dominio médico
         *   - publicationDate parseada correctamente desde XML
         *   - doi extraído del XML
         *   - publicationTypes mapeados desde XML
         */
        @Test
        @DisplayName("✓ Consulta exitosa → 2 PubMedArticle con todos los campos")
        void givenValidQuery_whenSearchArticles_thenReturnsParsedArticles() {
            // ARRANGE: Stub de esearch.fcgi (JSON con 2 PMIDs)
            stubEsearch("covid", """
                {"esearchresult":{"idlist":["33456789","33456790"]}}
                """, 200);

            // ARRANGE: Stub de efetch.fcgi (XML PubMed real simulado)
            stubEfetch("33456789", """
                <?xml version="1.0" encoding="UTF-8"?>
                <PubmedArticleSet>
                    <PubmedArticle>
                        <MedlineCitation>
                            <PMID>33456789</PMID>
                            <Article>
                                <ArticleTitle>Efficacy of mRNA-1273 SARS-CoV-2 vaccine in preventing COVID-19 hospitalization: a prospective cohort study</ArticleTitle>
                                <Abstract>
                                    <AbstractText>This prospective cohort study evaluated the efficacy of the mRNA-1273 vaccine in preventing COVID-19 hospitalization among 50,000 healthcare workers. The vaccine showed 94.1% efficacy in preventing severe disease requiring hospitalization at 6 months follow-up.</AbstractText>
                                </Abstract>
                                <AuthorList>
                                    <Author><LastName>Thompson</LastName><ForeName>Michael G</ForeName></Author>
                                    <Author><LastName>Rodriguez</LastName><ForeName>Laura A</ForeName></Author>
                                    <Author><LastName>Chen</LastName><ForeName>Wei</ForeName></Author>
                                </AuthorList>
                                <Journal>
                                    <Title>New England Journal of Medicine</Title>
                                    <JournalIssue>
                                        <PubDate><Year>2024</Year><Month>Mar</Month><Day>15</Day></PubDate>
                                    </JournalIssue>
                                </Journal>
                                <PublicationTypeList>
                                    <PublicationType>Journal Article</PublicationType>
                                    <PublicationType>Cohort Study</PublicationType>
                                </PublicationTypeList>
                            </Article>
                            <MeshHeadingList>
                                <MeshHeading><DescriptorName>COVID-19</DescriptorName></MeshHeading>
                                <MeshHeading><DescriptorName>SARS-CoV-2</DescriptorName></MeshHeading>
                                <MeshHeading><DescriptorName>mRNA Vaccines</DescriptorName></MeshHeading>
                                <MeshHeading><DescriptorName>Hospitalization</DescriptorName></MeshHeading>
                                <MeshHeading><DescriptorName>Humans</DescriptorName></MeshHeading>
                            </MeshHeadingList>
                        </MedlineCitation>
                        <PubmedData>
                            <ArticleIdList>
                                <ArticleId IdType="doi">10.1056/NEJMoa2401234</ArticleId>
                                <ArticleId IdType="pubmed">33456789</ArticleId>
                            </ArticleIdList>
                        </PubmedData>
                    </PubmedArticle>
                    <PubmedArticle>
                        <MedlineCitation>
                            <PMID>33456790</PMID>
                            <Article>
                                <ArticleTitle>Health misinformation about vaccines on social media: A systematic analysis of COVID-19 infodemic</ArticleTitle>
                                <Abstract>
                                    <AbstractText>Systematic analysis of 15,000 social media posts identified patterns of health misinformation about COVID-19 vaccines, including false claims about microchips, infertility, and long-term health effects. The study categorized misinformation types and their spread dynamics.</AbstractText>
                                </Abstract>
                                <AuthorList>
                                    <Author><LastName>Martinez</LastName><ForeName>Carlos R</ForeName></Author>
                                    <Author><LastName>Williams</LastName><ForeName>Sarah K</ForeName></Author>
                                </AuthorList>
                                <Journal>
                                    <Title>The Lancet Digital Health</Title>
                                    <JournalIssue>
                                        <PubDate><Year>2024</Year><Month>Jan</Month></PubDate>
                                    </JournalIssue>
                                </Journal>
                                <PublicationTypeList>
                                    <PublicationType>Journal Article</PublicationType>
                                    <PublicationType>Systematic Review</PublicationType>
                                </PublicationTypeList>
                            </Article>
                            <MeshHeadingList>
                                <MeshHeading><DescriptorName>Social Media</DescriptorName></MeshHeading>
                                <MeshHeading><DescriptorName>Health Misinformation</DescriptorName></MeshHeading>
                                <MeshHeading><DescriptorName>COVID-19 Vaccines</DescriptorName></MeshHeading>
                                <MeshHeading><DescriptorName>Humans</DescriptorName></MeshHeading>
                            </MeshHeadingList>
                        </MedlineCitation>
                        <PubmedData>
                            <ArticleIdList>
                                <ArticleId IdType="doi">10.1016/S2589-7500(24)00089-3</ArticleId>
                            </ArticleIdList>
                        </PubmedData>
                    </PubmedArticle>
                </PubmedArticleSet>
                """, 200);

            // ACT: Ejecutar búsqueda real contra WireMock
            List<PubMedApiService.PubMedArticle> articles = pubMedApiService.searchArticles("covid-19 vaccine efficacy", 10);

            // ASSERT: Validar cantidad
            assertThat(articles)
                .as("PubMed debe retornar 2 artículos simulados")
                .hasSize(2);

            // ASSERT: Validar PRIMER artículo (vacuna COVID)
            PubMedApiService.PubMedArticle article1 = articles.get(0);
            assertThat(article1.pmid()).isEqualTo("33456789");
            assertThat(article1.title()).contains("Efficacy of mRNA-1273");
            assertThat(article1.abstractText()).contains("94.1% efficacy");
            assertThat(article1.authors())
                .hasSize(3)
                .contains("Michael G Thompson", "Laura A Rodriguez", "Wei Chen");
            assertThat(article1.journal()).isEqualTo("New England Journal of Medicine");
            assertThat(article1.publicationDate()).isEqualTo("2024-03-15");
            assertThat(article1.doi()).isEqualTo("10.1056/NEJMoa2401234");
            assertThat(article1.publicationTypes())
                .contains("Journal Article", "Cohort Study");
            assertThat(article1.meshTerms())
                .contains("COVID-19", "SARS-CoV-2", "mRNA Vaccines", "Humans");

            // ASSERT: Validar SEGUNDO artículo (infodemia)
            PubMedApiService.PubMedArticle article2 = articles.get(1);
            assertThat(article2.pmid()).isEqualTo("33456790");
            assertThat(article2.title()).contains("Health misinformation about vaccines");
            assertThat(article2.authors())
                .hasSize(2)
                .contains("Carlos R Martinez", "Sarah K Williams");
            assertThat(article2.journal()).isEqualTo("The Lancet Digital Health");
            assertThat(article2.publicationDate()).isEqualTo("2024-01-01"); // Solo año y mes
            assertThat(article2.publicationTypes())
                .contains("Systematic Review");
            assertThat(article2.meshTerms())
                .contains("Social Media", "Health Misinformation", "COVID-19 Vaccines");
        }
    }

    // =====================================================================
    //  ESCENARIO 2: Términos MeSH simulados
    //  Simula la API de MeSH de NLM
    // =====================================================================

    @Nested
    @DisplayName("✓ ESCENARIO 2: Sugerencias MeSH desde NLM")
    class MeshSuggestionsScenario {

        /**
         * OBJETIVO: Validar que getSuggestedMeshTerms parsea correctamente
         * la respuesta JSON de la API de MeSH de NLM.
         *
         * JSON SIMULADO: respuesta real de id.nlm.nih.gov/mesh/lookup/descriptor
         */
        @Test
        @DisplayName("✓ Búsqueda MeSH exitosa → términos con id + label")
        void givenMeshTerm_whenGetSuggestions_thenReturnsParsedTerms() {
            // ARRANGE: Stub para la API de MeSH de NLM
            WireMock.stubFor(WireMock.get(urlPathEqualTo("/lookup/descriptor"))
                .withQueryParam("label", WireMock.containing("diabetes"))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("""
                        [
                            {"label":"Diabetes Mellitus, Type 2","resource":"https://id.nlm.nih.gov/mesh/D003924"},
                            {"label":"Diabetes Mellitus, Type 1","resource":"https://id.nlm.nih.gov/mesh/D003922"},
                            {"label":"Diabetes, Gestational","resource":"https://id.nlm.nih.gov/mesh/D048909"},
                            {"label":"Diabetes Complications","resource":"https://id.nlm.nih.gov/mesh/D048909"},
                            {"label":"Diabetic Nephropathies","resource":"https://id.nlm.nih.gov/mesh/D003928"}
                        ]
                        """)
                ));

            // Configurar URL base de MeSH para apuntar a WireMock
            ReflectionTestUtils.setField(pubMedApiService, "meshBaseUrl",
                "http://localhost:" + wireMockServer.port());

            // ACT
            List<PubMedApiService.MeshSuggestion> suggestions =
                pubMedApiService.getSuggestedMeshTerms("diabetes", 5);

            // ASSERT
            assertThat(suggestions)
                .as("Debe retornar 5 sugerencias MeSH")
                .hasSize(5);

            assertThat(suggestions.get(0).term()).isEqualTo("Diabetes Mellitus, Type 2");
            assertThat(suggestions.get(0).id()).isEqualTo("D003924");

            assertThat(suggestions.get(1).term()).isEqualTo("Diabetes Mellitus, Type 1");
            assertThat(suggestions.get(2).term()).isEqualTo("Diabetes, Gestational");
        }
    }

    // =====================================================================
    //  ESCENARIO 3: Sin resultados (lista vacía)
    //  PubMed no encuentra artículos para la consulta
    // =====================================================================

    @Nested
    @DisplayName("◌ ESCENARIO 3: Sin resultados → lista vacía")
    class EmptyResultsScenario {

        @Test
        @DisplayName("◌ esearch retorna idlist vacío → lista vacía")
        void givenQueryWithNoResults_whenSearchArticles_thenReturnsEmptyList() {
            // ARRANGE: esearch retorna 0 IDs
            stubEsearch("xyzimpossible", """
                {"esearchresult":{"idlist":[],"count":"0"}}
                """, 200);

            // ACT
            List<PubMedApiService.PubMedArticle> articles =
                pubMedApiService.searchArticles("xyzimpossiblequery", 10);

            // ASSERT
            assertThat(articles)
                .as("PubMed sin resultados debe retornar lista vacía")
                .isEmpty();
        }
    }

    // =====================================================================
    //  ESCENARIO 4: Error HTTP 404
    //  La API de PubMed devuelve 404
    // =====================================================================

    @Nested
    @DisplayName("✗ ESCENARIO 4: Error HTTP 404 de PubMed → lista vacía (con warning)")
    class Http404Scenario {

        @Test
        @DisplayName("✗ esearch devuelve 404 → lista vacía (error manejado)")
        void givenEsearchReturns404_whenSearchArticles_thenReturnsEmptyList() {
            // ARRANGE: esearch devuelve 404
            WireMock.stubFor(WireMock.get(urlPathEqualTo("/esearch.fcgi"))
                .willReturn(aResponse()
                    .withStatus(404)
                    .withBody("Not Found")
                ));

            // ACT
            List<PubMedApiService.PubMedArticle> articles =
                pubMedApiService.searchArticles("any query", 10);

            // ASSERT: El servicio maneja el error y retorna lista vacía
            assertThat(articles)
                .as("Error 404 de PubMed debe ser manejado como lista vacía")
                .isEmpty();
        }
    }

    // =====================================================================
    //  ESCENARIO 5: Error HTTP 500 de PubMed
    //  Simula una caída del servidor de NCBI
    // =====================================================================

    @Nested
    @DisplayName("🔴 ESCENARIO 5: Error 500 (PubMed caído) → lista vacía")
    class Http500Scenario {

        @Test
        @DisplayName("🔴 esearch devuelve 500 → lista vacía (fallo manejado)")
        void givenEsearchReturns500_whenSearchArticles_thenReturnsEmptyList() {
            // ARRANGE: esearch devuelve 500
            WireMock.stubFor(WireMock.get(urlPathEqualTo("/esearch.fcgi"))
                .willReturn(aResponse()
                    .withStatus(500)
                    .withBody("{\"error\":\"Internal Server Error\"}")
                ));

            // ACT
            List<PubMedApiService.PubMedArticle> articles =
                pubMedApiService.searchArticles("any query", 10);

            // ASSERT
            assertThat(articles)
                .as("Error 500 de PubMed debe ser manejado como lista vacía")
                .isEmpty();
        }
    }

    // =====================================================================
    //  ESCENARIO 6: Timeout de PubMed API
    //  WireMock retrasa la respuesta más allá del timeout configurado
    // =====================================================================

    @Nested
    @DisplayName("⏱ ESCENARIO 6: Timeout de PubMed API")
    class TimeoutScenario {

        @Test
        @DisplayName("⏱ esearch con delay > timeout → lista vacía (timeout manejado)")
        void givenEsearchTimeout_whenSearchArticles_thenReturnsEmptyList() {
            // ARRANGE: Configurar timeout bajo para este test
            ReflectionTestUtils.setField(pubMedApiService, "timeoutMs", 500L);

            // Stub con delay de 3 segundos (supera el timeout de 500ms)
            WireMock.stubFor(WireMock.get(urlPathEqualTo("/esearch.fcgi"))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\"esearchresult\":{\"idlist\":[\"12345678\"]}}")
                    .withFixedDelay(3000)
                ));

            // ACT
            List<PubMedApiService.PubMedArticle> articles =
                pubMedApiService.searchArticles("timeout test", 10);

            // ASSERT: Timeout manejado, retorna lista vacía
            assertThat(articles)
                .as("Timeout de PubMed debe ser manejado como lista vacía")
                .isEmpty();
        }
    }

    // =====================================================================
    //  ESCENARIO 7: Query vacía
    //  El servicio no debe llamar a la API externa si la query es vacía
    // =====================================================================

    @Nested
    @DisplayName("◌ ESCENARIO 7: Query vacía → lista vacía (sin llamada externa)")
    class EmptyQueryScenario {

        @Test
        @DisplayName("◌ Query null → lista vacía")
        void givenNullQuery_whenSearchArticles_thenReturnsEmptyList() {
            List<PubMedApiService.PubMedArticle> articles =
                pubMedApiService.searchArticles(null, 10);
            assertThat(articles).isEmpty();
        }

        @Test
        @DisplayName("◌ Query blank → lista vacía")
        void givenBlankQuery_whenSearchArticles_thenReturnsEmptyList() {
            List<PubMedApiService.PubMedArticle> articles =
                pubMedApiService.searchArticles("   ", 10);
            assertThat(articles).isEmpty();
        }
    }

    // =====================================================================
    //  ESCENARIO 8: XML malformado de PubMed
    //  Simula una respuesta XML inválida desde efetch
    // =====================================================================

    @Nested
    @DisplayName("⚠ ESCENARIO 8: XML malformado → lista vacía")
    class MalformedXmlScenario {

        @Test
        @DisplayName("⚠ efetch devuelve XML inválido → lista vacía")
        void givenMalformedXml_whenSearchArticles_thenReturnsEmptyList() {
            // ARRANGE: esearch OK
            stubEsearch("malformed", """
                {"esearchresult":{"idlist":["99887766"]}}
                """, 200);

            // efetch devuelve XML malformado (tags sin cerrar)
            stubEfetch("99887766", """
                <?xml version="1.0"?>
                <PubmedArticleSet>
                    <PubmedArticle>
                        <MedlineCitation>
                            <PMID>99887766</PMID>
                            <Article>
                                <ArticleTitle>Test article with malformed XML
                        </MedlineCitation>
                </PubmedArticleSet>
                """, 200);

            // ACT: El parser debe manejar el XML malformado sin lanzar excepción
            List<PubMedApiService.PubMedArticle> articles =
                pubMedApiService.searchArticles("malformed xml test", 10);

            // ASSERT: Error de parseo manejado, retorna lista vacía
            assertThat(articles)
                .as("XML malformado debe ser manejado como lista vacía")
                .isEmpty();
        }
    }

    // =====================================================================
    //  ESCENARIO 9: Artículo sin título (campo opcional)
    //  PubMed a veces tiene artículos sin título
    // =====================================================================

    @Nested
    @DisplayName("⚠ ESCENARIO 9: Artículo sin título → placeholder \"(Sin título)\"")
    class MissingTitleScenario {

        @Test
        @DisplayName("⚠ Artículo XML sin ArticleTitle → fallback a \"(Sin título)\"")
        void givenArticleWithoutTitle_whenParsed_thenReturnsPlaceholder() {
            stubEsearch("notitle", """
                {"esearchresult":{"idlist":["11111111"]}}
                """, 200);

            stubEfetch("11111111", """
                <?xml version="1.0"?>
                <PubmedArticleSet>
                    <PubmedArticle>
                        <MedlineCitation>
                            <PMID>11111111</PMID>
                            <Article>
                                <Abstract>
                                    <AbstractText>Article without title for testing purposes.</AbstractText>
                                </Abstract>
                                <AuthorList>
                                    <Author><LastName>Test</LastName><ForeName>Author</ForeName></Author>
                                </AuthorList>
                                <Journal>
                                    <Title>Test Journal</Title>
                                    <JournalIssue>
                                        <PubDate><Year>2024</Year></PubDate>
                                    </JournalIssue>
                                </Journal>
                            </Article>
                        </MedlineCitation>
                    </PubmedArticle>
                </PubmedArticleSet>
                """, 200);

            List<PubMedApiService.PubMedArticle> articles =
                pubMedApiService.searchArticles("notitle article", 10);

            assertThat(articles)
                .as("Debe retornar 1 artículo con título placeholder")
                .hasSize(1);
            assertThat(articles.get(0).title())
                .as("Artículo sin título debe mostrar placeholder")
                .isEqualTo("(Sin título)");
            assertThat(articles.get(0).pmid()).isEqualTo("11111111");
        }
    }

    // =====================================================================
    //  ESCENARIO 10: Artículo con muchos autores (más de 10)
    //  Validar que el parseo maneja listas largas
    // =====================================================================

    @Nested
    @DisplayName("⚠ ESCENARIO 10: Artículo con múltiples autores")
    class ManyAuthorsScenario {

        @Test
        @DisplayName("⚠ Artículo con 15 autores → los parsea todos")
        void givenArticleWithManyAuthors_whenParsed_thenAllAuthorsReturned() {
            stubEsearch("manyauthors", """
                {"esearchresult":{"idlist":["22222222"]}}
                """, 200);

            // Construir XML con 15 autores
            StringBuilder authorsXml = new StringBuilder();
            for (int i = 1; i <= 15; i++) {
                authorsXml.append("<Author>")
                    .append("<LastName>Author").append(i).append("</LastName>")
                    .append("<ForeName>Test").append(i).append("</ForeName>")
                    .append("</Author>\n");
            }

            stubEfetch("22222222", """
                <?xml version="1.0"?>
                <PubmedArticleSet>
                    <PubmedArticle>
                        <MedlineCitation>
                            <PMID>22222222</PMID>
                            <Article>
                                <ArticleTitle>Multi-author collaborative study on cardiovascular outcomes</ArticleTitle>
                                <Abstract>
                                    <AbstractText>Large international collaborative study with 15 authors examining cardiovascular outcomes in 100,000 patients.</AbstractText>
                                </Abstract>
                                <AuthorList>
                                    """ + authorsXml + """
                                </AuthorList>
                                <Journal>
                                    <Title>Circulation</Title>
                                    <JournalIssue>
                                        <PubDate><Year>2024</Year><Month>Jun</Month></PubDate>
                                    </JournalIssue>
                                </Journal>
                            </Article>
                        </MedlineCitation>
                    </PubmedArticle>
                </PubmedArticleSet>
                """, 200);

            List<PubMedApiService.PubMedArticle> articles =
                pubMedApiService.searchArticles("multi author study", 10);

            assertThat(articles).hasSize(1);
            assertThat(articles.get(0).authors())
                .as("Debe parsear los 15 autores")
                .hasSize(15);
            assertThat(articles.get(0).authors().get(0))
                .isEqualTo("Test1 Author1");
            assertThat(articles.get(0).authors().get(14))
                .isEqualTo("Test15 Author15");
        }
    }

    // =====================================================================
    //  ESCENARIO 11: Actor colectivo (CollectiveName) en lugar de autor
    //  Algunos artículos usan CollectiveName en lugar de LastName/ForeName
    // =====================================================================

    @Nested
    @DisplayName("⚠ ESCENARIO 11: Actor colectivo → nombre del grupo")
    class CollectiveAuthorScenario {

        @Test
        @DisplayName("⚠ Author con CollectiveName → nombre del grupo como autor")
        void givenCollectiveAuthor_whenParsed_thenGroupNameReturned() {
            stubEsearch("collective", """
                {"esearchresult":{"idlist":["33333333"]}}
                """, 200);

            stubEfetch("33333333", """
                <?xml version="1.0"?>
                <PubmedArticleSet>
                    <PubmedArticle>
                        <MedlineCitation>
                            <PMID>33333333</PMID>
                            <Article>
                                <ArticleTitle>WHO guidelines for diabetes management</ArticleTitle>
                                <Abstract>
                                    <AbstractText>Updated WHO guidelines for diabetes management in primary care settings worldwide.</AbstractText>
                                </Abstract>
                                <AuthorList>
                                    <Author>
                                        <CollectiveName>World Health Organization Guideline Development Group</CollectiveName>
                                    </Author>
                                </AuthorList>
                                <Journal>
                                    <Title>WHO Bulletin</Title>
                                    <JournalIssue>
                                        <PubDate><Year>2024</Year><Month>Apr</Month></PubDate>
                                    </JournalIssue>
                                </Journal>
                            </Article>
                        </MedlineCitation>
                    </PubmedArticle>
                </PubmedArticleSet>
                """, 200);

            List<PubMedApiService.PubMedArticle> articles =
                pubMedApiService.searchArticles("WHO diabetes guidelines", 10);

            assertThat(articles).hasSize(1);
            assertThat(articles.get(0).authors())
                .as("Autor colectivo debe ser el nombre del grupo")
                .contains("World Health Organization Guideline Development Group");
        }
    }
}