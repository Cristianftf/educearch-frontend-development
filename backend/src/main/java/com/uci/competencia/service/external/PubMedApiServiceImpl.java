package com.uci.competencia.service.external;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriBuilder;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;
import reactor.util.retry.Retry;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.XMLConstants;
import java.io.StringReader;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
public class PubMedApiServiceImpl implements PubMedApiService {

    private final ObjectMapper objectMapper;
    private final WebClient.Builder webClientBuilder;

    @Value("${app.pubmed.api.base-url}")
    private String pubmedBaseUrl;

    @Value("${app.pubmed.api.key:}")
    private String pubmedApiKey;

    @Value("${app.pubmed.api.timeout:30000}")
    private long timeoutMs;

    @Value("${app.pubmed.api.max-retries:2}")
    private int maxRetries;

    @Value("${app.pubmed.api.detail-batch-size:10}")
    private int detailBatchSize;

    @Value("${app.pubmed.api.max-in-memory-size-bytes:1048576}")
    private int maxInMemorySizeBytes;

    @Value("${app.pubmed.api.tool:uci-competencia}")
    private String pubmedTool;

    @Value("${app.pubmed.api.email:}")
    private String pubmedEmail;

    @Value("${app.mesh.api.base-url:https://id.nlm.nih.gov/mesh}")
    private String meshBaseUrl;

    @Override
    public List<PubMedArticle> searchArticles(String query, int maxResults) {
        if (query == null || query.isBlank()) {
            return List.of();
        }

        int retmax = Math.max(1, Math.min(maxResults, 200));
        List<String> ids = fetchPubMedIds(query, retmax);
        if (ids.isEmpty()) {
            return List.of();
        }

        return fetchPubMedArticles(ids);
    }

    @Override
    public List<MeshSuggestion> getSuggestedMeshTerms(String term, int limit) {
        if (term == null || term.isBlank()) {
            return List.of();
        }
        int safeLimit = Math.max(1, Math.min(limit, 20));

        try {
            WebClient client = webClientBuilder.baseUrl(meshBaseUrl).build();
            String response = client.get()
                .uri(uriBuilder -> uriBuilder
                    .path("/lookup/descriptor")
                    .queryParam("label", term)
                    .queryParam("match", "contains")
                    .queryParam("limit", safeLimit)
                    .build())
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofMillis(timeoutMs))
                .retryWhen(Retry.fixedDelay(maxRetries, Duration.ofMillis(250)))
                .block();

            if (response == null || response.isBlank()) {
                return List.of();
            }

            JsonNode root = objectMapper.readTree(response);
            List<MeshSuggestion> suggestions = new ArrayList<>();
            for (JsonNode node : root) {
                String label = node.path("label").asText(null);
                String resource = node.path("resource").asText(null);
                if (label == null || label.isBlank()) {
                    continue;
                }
                String id = resource != null ? resource.substring(resource.lastIndexOf('/') + 1) : label;
                suggestions.add(new MeshSuggestion(id, label, "MeSH descriptor"));
            }
            return suggestions;
        } catch (Exception e) {
            log.warn("Error fetching MeSH suggestions from NLM lookup", e);
            return List.of();
        }
    }

    private List<String> fetchPubMedIds(String query, int retmax) {
        try {
            WebClient client = buildPubMedClient();
            String response = client.get()
                .uri(uriBuilder -> buildEutilsUri(uriBuilder, "/esearch.fcgi", Map.of(
                    "db", "pubmed",
                    "term", query,
                    "retmode", "json",
                    "retmax", String.valueOf(retmax)
                )))
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofMillis(timeoutMs))
                .retryWhen(Retry.fixedDelay(maxRetries, Duration.ofMillis(250)))
                .block();

            if (response == null || response.isBlank()) {
                return List.of();
            }

            JsonNode root = objectMapper.readTree(response);
            JsonNode idList = root.path("esearchresult").path("idlist");
            List<String> ids = new ArrayList<>();
            if (idList.isArray()) {
                for (JsonNode node : idList) {
                    if (node != null && !node.asText().isBlank()) {
                        ids.add(node.asText());
                    }
                }
            }
            return ids;
        } catch (Exception e) {
            log.warn("Error fetching PubMed IDs", e);
            return List.of();
        }
    }

    private String fetchPubMedDetails(List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return null;
        }
        try {
            WebClient client = buildPubMedClient();
            String joined = String.join(",", ids);
            return client.get()
                .uri(uriBuilder -> buildEutilsUri(uriBuilder, "/efetch.fcgi", Map.of(
                    "db", "pubmed",
                    "id", joined,
                    "retmode", "xml"
                )))
                .accept(MediaType.APPLICATION_XML)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofMillis(timeoutMs))
                .retryWhen(Retry.fixedDelay(maxRetries, Duration.ofMillis(250)))
                .block();
        } catch (Exception e) {
            log.warn("Error fetching PubMed details", e);
            return null;
        }
    }

    private WebClient buildPubMedClient() {
        return webClientBuilder
            .baseUrl(pubmedBaseUrl)
            .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(Math.max(262144, maxInMemorySizeBytes)))
            .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
            .build();
    }

    private List<PubMedArticle> fetchPubMedArticles(List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }

        int batchSize = Math.max(1, Math.min(detailBatchSize, 25));
        List<PubMedArticle> articles = new ArrayList<>();
        for (int start = 0; start < ids.size(); start += batchSize) {
            int end = Math.min(start + batchSize, ids.size());
            List<String> batch = ids.subList(start, end);
            String xml = fetchPubMedDetails(batch);
            if (xml == null || xml.isBlank()) {
                log.warn("PubMed detail batch returned empty response for {} ids", batch.size());
                continue;
            }
            articles.addAll(parsePubMedXml(xml));
        }
        return articles;
    }

    private java.net.URI buildEutilsUri(UriBuilder builder, String path, Map<String, String> params) {
        builder.path(path);
        Map<String, String> merged = new HashMap<>(params);
        if (pubmedApiKey != null && !pubmedApiKey.isBlank()) {
            merged.put("api_key", pubmedApiKey);
        }
        if (pubmedTool != null && !pubmedTool.isBlank()) {
            merged.put("tool", pubmedTool);
        }
        if (pubmedEmail != null && !pubmedEmail.isBlank()) {
            merged.put("email", pubmedEmail);
        }
        merged.forEach(builder::queryParam);
        return builder.build();
    }

    private List<PubMedArticle> parsePubMedXml(String xml) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            // PubMed XML includes DOCTYPE. Keep parsing enabled but block external entities/DTDs for safety.
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
            factory.setExpandEntityReferences(false);
            factory.setXIncludeAware(false);
            Document doc = factory.newDocumentBuilder().parse(new InputSource(new StringReader(xml)));

            NodeList articles = doc.getElementsByTagName("PubmedArticle");
            List<PubMedArticle> results = new ArrayList<>();
            for (int i = 0; i < articles.getLength(); i++) {
                Element article = (Element) articles.item(i);
                String pmid = text(article, "PMID");
                String title = text(article, "ArticleTitle");
                String abstractText = joinTexts(article, "AbstractText");
                List<String> authors = parseAuthors(article);
                String journal = parseJournal(article);
                String publicationDate = parsePublicationDate(article);
                String doi = parseDoi(article);
                List<String> publicationTypes = parsePublicationTypes(article);
                List<String> meshTerms = parseMeshTerms(article);

                if (pmid == null || pmid.isBlank()) {
                    continue;
                }
                results.add(new PubMedArticle(
                    pmid,
                    title != null ? title : "(Sin título)",
                    abstractText != null ? abstractText : "",
                    authors,
                    journal != null ? journal : "",
                    publicationDate,
                    doi,
                    publicationTypes,
                    meshTerms
                ));
            }
            return results;
        } catch (Exception e) {
            log.warn("Error parsing PubMed XML", e);
            return List.of();
        }
    }

    private String text(Element parent, String tag) {
        NodeList nodes = parent.getElementsByTagName(tag);
        if (nodes.getLength() == 0) return null;
        Node node = nodes.item(0);
        return node != null ? node.getTextContent() : null;
    }

    private String joinTexts(Element parent, String tag) {
        NodeList nodes = parent.getElementsByTagName(tag);
        if (nodes.getLength() == 0) return null;
        List<String> chunks = new ArrayList<>();
        for (int i = 0; i < nodes.getLength(); i++) {
            Node node = nodes.item(i);
            if (node != null && node.getTextContent() != null && !node.getTextContent().isBlank()) {
                chunks.add(node.getTextContent().trim());
            }
        }
        return chunks.isEmpty() ? null : String.join(" ", chunks);
    }

    private List<String> parseAuthors(Element article) {
        NodeList authorNodes = article.getElementsByTagName("Author");
        List<String> authors = new ArrayList<>();
        for (int i = 0; i < authorNodes.getLength(); i++) {
            Element author = (Element) authorNodes.item(i);
            String collective = text(author, "CollectiveName");
            if (collective != null && !collective.isBlank()) {
                authors.add(collective.trim());
                continue;
            }
            String last = text(author, "LastName");
            String fore = text(author, "ForeName");
            String initials = text(author, "Initials");
            String name = null;
            if (last != null && fore != null) {
                name = fore + " " + last;
            } else if (last != null && initials != null) {
                name = last + " " + initials;
            }
            if (name != null && !name.isBlank()) {
                authors.add(name.trim());
            }
        }
        return authors;
    }

    private String parseJournal(Element article) {
        NodeList journals = article.getElementsByTagName("Journal");
        if (journals.getLength() == 0) return null;
        Element journal = (Element) journals.item(0);
        return text(journal, "Title");
    }

    private String parsePublicationDate(Element article) {
        NodeList journalIssueNodes = article.getElementsByTagName("JournalIssue");
        if (journalIssueNodes.getLength() == 0) return null;
        Element journalIssue = (Element) journalIssueNodes.item(0);
        NodeList pubDates = journalIssue.getElementsByTagName("PubDate");
        if (pubDates.getLength() == 0) return null;
        Element pubDate = (Element) pubDates.item(0);

        String year = text(pubDate, "Year");
        String month = text(pubDate, "Month");
        String day = text(pubDate, "Day");

        if (year == null) {
            return null;
        }

        String monthValue = monthToNumber(month);
        String dayValue = day != null ? String.format("%02d", parseIntSafe(day, 1)) : "01";
        return year + "-" + monthValue + "-" + dayValue;
    }

    private String parseDoi(Element article) {
        NodeList articleIdNodes = article.getElementsByTagName("ArticleId");
        for (int i = 0; i < articleIdNodes.getLength(); i++) {
            Element id = (Element) articleIdNodes.item(i);
            String type = id.getAttribute("IdType");
            if ("doi".equalsIgnoreCase(type)) {
                return id.getTextContent();
            }
        }
        return null;
    }

    private List<String> parsePublicationTypes(Element article) {
        NodeList typeNodes = article.getElementsByTagName("PublicationType");
        List<String> types = new ArrayList<>();
        for (int i = 0; i < typeNodes.getLength(); i++) {
            Node node = typeNodes.item(i);
            if (node != null && node.getTextContent() != null) {
                types.add(node.getTextContent().trim());
            }
        }
        return types;
    }

    private List<String> parseMeshTerms(Element article) {
        NodeList descriptorNodes = article.getElementsByTagName("DescriptorName");
        return toTextList(descriptorNodes);
    }

    private List<String> toTextList(NodeList nodes) {
        if (nodes == null) return List.of();
        List<String> values = new ArrayList<>();
        for (int i = 0; i < nodes.getLength(); i++) {
            Node node = nodes.item(i);
            if (node != null && node.getTextContent() != null && !node.getTextContent().isBlank()) {
                values.add(node.getTextContent().trim());
            }
        }
        return values;
    }

    private String monthToNumber(String month) {
        if (month == null || month.isBlank()) return "01";
        String normalized = month.trim().toLowerCase();
        Map<String, String> map = Map.ofEntries(
            Map.entry("jan", "01"), Map.entry("january", "01"),
            Map.entry("feb", "02"), Map.entry("february", "02"),
            Map.entry("mar", "03"), Map.entry("march", "03"),
            Map.entry("apr", "04"), Map.entry("april", "04"),
            Map.entry("may", "05"),
            Map.entry("jun", "06"), Map.entry("june", "06"),
            Map.entry("jul", "07"), Map.entry("july", "07"),
            Map.entry("aug", "08"), Map.entry("august", "08"),
            Map.entry("sep", "09"), Map.entry("september", "09"),
            Map.entry("oct", "10"), Map.entry("october", "10"),
            Map.entry("nov", "11"), Map.entry("november", "11"),
            Map.entry("dec", "12"), Map.entry("december", "12")
        );
        return Optional.ofNullable(map.get(normalized)).orElse("01");
    }

    private int parseIntSafe(String value, int fallback) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }
}
