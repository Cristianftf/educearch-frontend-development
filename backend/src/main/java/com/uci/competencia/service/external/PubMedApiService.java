package com.uci.competencia.service.external;

import java.util.List;

public interface PubMedApiService {
    List<PubMedArticle> searchArticles(String query, int maxResults);
    List<MeshSuggestion> getSuggestedMeshTerms(String term, int limit);

    record PubMedArticle(
        String pmid,
        String title,
        String abstractText,
        List<String> authors,
        String journal,
        String publicationDate,
        String doi,
        List<String> publicationTypes,
        List<String> meshTerms
    ) {}

    record MeshSuggestion(
        String id,
        String term,
        String description
    ) {}
}
