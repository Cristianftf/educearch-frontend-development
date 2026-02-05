package com.uci.competencia.service.external;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class PubMedApiServiceImpl implements PubMedApiService {

    @Value("${app.pubmed.api.base-url}")
    private String pubmedBaseUrl;

    @Value("${app.pubmed.api.key}")
    private String pubmedApiKey;

    @Override
    public String searchArticles(String query, int maxResults) {
        log.info("Searching PubMed with query: {}", query);
        // Implementation for PubMed search
        return "{}";
    }

    @Override
    public String getArticleDetails(String pmid) {
        log.info("Getting article details for PMID: {}", pmid);
        // Implementation for getting article details
        return "{}";
    }

    @Override
    public String getSuggestedMeshTerms(String term) {
        log.info("Getting MeSH suggestions for term: {}", term);
        // Implementation for MeSH suggestions
        return "[]";
    }
}
