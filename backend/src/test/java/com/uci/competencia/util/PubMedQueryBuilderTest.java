package com.uci.competencia.util;

import com.uci.competencia.model.dto.request.SearchRequestDTO;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("PubMedQueryBuilder - Construccion de consultas MeSH")
class PubMedQueryBuilderTest {

    private final PubMedQueryBuilder builder = new PubMedQueryBuilder(new MeshMapper());

    @Test
    @DisplayName("Given_MedicalTermsAndFilters_When_BuildPubMedQuery_Then_ReturnsMeshQueryWithScientificFilters")
    void Given_MedicalTermsAndFilters_When_BuildPubMedQuery_Then_ReturnsMeshQueryWithScientificFilters() {
        SearchRequestDTO.SearchQueryDTO query = new SearchRequestDTO.SearchQueryDTO();
        query.setTerms(List.of("diabetes", "vitamina D", "hypertension"));
        query.setOperators(List.of("AND", "OR"));

        SearchRequestDTO.SearchFiltersDTO filters = new SearchRequestDTO.SearchFiltersDTO();
        filters.setYearFrom(2019);
        filters.setYearTo(2025);
        filters.setHasFullText(true);
        filters.setLanguage("eng");
        filters.setStudyTypes(List.of("systematic_review", "rct"));

        String pubmedQuery = builder.buildPubMedQuery(query, filters);

        assertEquals(
            "(Diabetes Mellitus[MeSH] AND \"vitamina D\"[tiab] OR Hypertension[MeSH]) AND 2019:2025[PDAT] AND (\"systematic review\"[Publication Type] OR \"randomized controlled trial\"[Publication Type]) AND free full text[filter] AND eng[lang]",
            pubmedQuery
        );
        assertTrue(builder.isValidQuery(pubmedQuery));
    }

    @Test
    @DisplayName("Given_UnknownMedicalTerm_When_BuildPubMedQuery_Then_UsesTitleAbstractFallback")
    void Given_UnknownMedicalTerm_When_BuildPubMedQuery_Then_UsesTitleAbstractFallback() {
        SearchRequestDTO.SearchQueryDTO query = new SearchRequestDTO.SearchQueryDTO();
        query.setTerms(List.of("colesterol oxidado", "ejercicio físico"));
        query.setOperators(List.of("AND"));

        String pubmedQuery = builder.buildPubMedQuery(query, null);

        assertEquals("(\"colesterol oxidado\"[tiab] AND \"ejercicio físico\"[tiab])", pubmedQuery);
        assertTrue(builder.isValidQuery(pubmedQuery));
    }

    @Test
    @DisplayName("Given_InvalidBooleanOperator_When_BuildPubMedQuery_Then_DefaultsToAnd")
    void Given_InvalidBooleanOperator_When_BuildPubMedQuery_Then_DefaultsToAnd() {
        SearchRequestDTO.SearchQueryDTO query = new SearchRequestDTO.SearchQueryDTO();
        query.setTerms(List.of("diabetes", "exercise"));
        query.setOperators(List.of("XOR"));

        String pubmedQuery = builder.buildPubMedQuery(query, null);

        assertEquals("(Diabetes Mellitus[MeSH] AND \"exercise\"[tiab])", pubmedQuery);
    }

    @Test
    @DisplayName("Given_QueryWithGroupings_When_BuildPubMedQuery_Then_AddsAdditionalParentheses")
    void Given_QueryWithGroupings_When_BuildPubMedQuery_Then_AddsAdditionalParentheses() {
        SearchRequestDTO.SearchQueryDTO query = new SearchRequestDTO.SearchQueryDTO();
        query.setTerms(List.of("diabetes", "hypertension"));
        query.setOperators(List.of("AND"));

        SearchRequestDTO.GroupingDTO grouping = new SearchRequestDTO.GroupingDTO();
        grouping.setOperation("OR");
        grouping.setTerms(List.of("exercise", "cholesterol"));
        query.setGroupings(List.of(grouping));

        String pubmedQuery = builder.buildPubMedQuery(query, null);

        assertEquals("((Diabetes Mellitus[MeSH] AND Hypertension[MeSH]))", pubmedQuery);
        assertTrue(builder.isValidQuery(pubmedQuery));
    }

    @Test
    @DisplayName("Given_DirtyQueryString_When_CleanQuery_Then_RemovesDangerousCharactersAndExtraSpaces")
    void Given_DirtyQueryString_When_CleanQuery_Then_RemovesDangerousCharactersAndExtraSpaces() {
        String cleaned = builder.cleanQuery("  diabetes   <script> AND  \"vitamin d\" ;  ");

        assertEquals("diabetes script AND vitamin d", cleaned);
    }

    @Test
    @DisplayName("Given_UnbalancedParentheses_When_IsValidQuery_Then_ReturnsFalse")
    void Given_UnbalancedParentheses_When_IsValidQuery_Then_ReturnsFalse() {
        assertFalse(builder.isValidQuery("(Diabetes Mellitus[MeSH] AND Hypertension[MeSH]"));
    }
}
