package com.uci.competencia.service.external;

public interface PubMedApiService {
    String searchArticles(String query, int maxResults);
    String getArticleDetails(String pmid);
    String getSuggestedMeshTerms(String term);
}
