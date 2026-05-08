package com.uci.competencia.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("MeshMapper - Procesamiento de terminos medicos")
class MeshMapperTest {

    private final MeshMapper meshMapper = new MeshMapper();

    @Test
    @DisplayName("Given_KnownMedicalTerms_When_MapToMeshTerm_Then_ReturnsExpectedMeshDescriptor")
    void Given_KnownMedicalTerms_When_MapToMeshTerm_Then_ReturnsExpectedMeshDescriptor() {
        assertEquals("Diabetes Mellitus", meshMapper.mapToMeshTerm("diabetes"));
        assertEquals("Diabetes Mellitus, Type 2", meshMapper.mapToMeshTerm("diabetes tipo 2"));
        assertEquals("Hypertension", meshMapper.mapToMeshTerm("high blood pressure"));
        assertEquals("Metformin", meshMapper.mapToMeshTerm("metformina"));
    }

    @Test
    @DisplayName("Given_UnknownTerm_When_MapToMeshTerm_Then_ReturnsNull")
    void Given_UnknownTerm_When_MapToMeshTerm_Then_ReturnsNull() {
        assertNull(meshMapper.mapToMeshTerm("vitamina d"));
        assertNull(meshMapper.mapToMeshTerm("ejercicio físico"));
    }

    @Test
    @DisplayName("Given_MeshDescriptor_When_GetSynonyms_Then_ReturnsMedicalSynonyms")
    void Given_MeshDescriptor_When_GetSynonyms_Then_ReturnsMedicalSynonyms() {
        Set<String> synonyms = meshMapper.getSynonyms("Diabetes Mellitus, Type 2");

        assertFalse(synonyms.isEmpty());
        assertTrue(synonyms.contains("type 2 diabetes"));
        assertTrue(synonyms.contains("t2dm"));
    }

    @Test
    @DisplayName("Given_PartialTerm_When_FindMatchingMeshTerms_Then_ReturnsRelevantMedicalMatches")
    void Given_PartialTerm_When_FindMatchingMeshTerms_Then_ReturnsRelevantMedicalMatches() {
        List<String> matches = meshMapper.findMatchingMeshTerms("diabetes");

        assertFalse(matches.isEmpty());
        assertTrue(matches.contains("Diabetes Mellitus"));
        assertTrue(matches.contains("Diabetes Mellitus, Type 2"));
    }

    @Test
    @DisplayName("Given_SynonymousTerms_When_CalculateSimilarity_Then_ReturnsHighSimilarity")
    void Given_SynonymousTerms_When_CalculateSimilarity_Then_ReturnsHighSimilarity() {
        double similarity = meshMapper.calculateSimilarity("high blood pressure", "hypertension");

        assertTrue(similarity >= 0.9);
    }

    @Test
    @DisplayName("Given_DifferentTerms_When_CalculateSimilarity_Then_ReturnsLowerSimilarity")
    void Given_DifferentTerms_When_CalculateSimilarity_Then_ReturnsLowerSimilarity() {
        double similarity = meshMapper.calculateSimilarity("diabetes", "cholesterol");

        assertTrue(similarity < 0.5);
    }
}
