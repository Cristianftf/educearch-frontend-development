package com.uci.competencia.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

class CitationFormatterTest {

    private final CitationFormatter formatter = new CitationFormatter();

    @Test
    @DisplayName("UT-07 formats APA citation from PubMed article metadata")
    void ut07FormatsApaCitationFromPubMedArticleMetadata() {
        CitationFormatter.Article article = new CitationFormatter.Article();
        article.pmid = "12345";
        article.title = "Exercise and diabetes outcomes";
        article.authors = List.of("Jane Smith", "Robert Lee");
        article.journal = "Journal of Metabolic Health";
        article.publicationDate = "2024-01-15";
        article.volume = "18";
        article.issue = "2";
        article.pages = "101-110";
        article.doi = "10.1000/j.jmh.2024.01.001";

        String citation = formatter.formatAPA(article);

        assertTrue(citation.contains("Smith, J."));
        assertTrue(citation.contains("(2024)."));
        assertTrue(citation.contains("Exercise and diabetes outcomes."));
        assertTrue(citation.contains("Journal of Metabolic Health"));
        assertTrue(citation.contains("https://doi.org/10.1000/j.jmh.2024.01.001"));
    }
}
