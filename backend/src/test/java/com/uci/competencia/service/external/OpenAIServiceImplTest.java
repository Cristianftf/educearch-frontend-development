package com.uci.competencia.service.external;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.util.SimilarityCalculator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.reactive.function.client.WebClient;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("OpenAIServiceImpl - Fachada del modelo IA para similitud semantica")
class OpenAIServiceImplTest {

    @Mock
    private WebClient.Builder webClientBuilder;

    @Mock
    private SimilarityCalculator similarityCalculator;

    @InjectMocks
    private OpenAIServiceImpl openAIService;

    @BeforeEach
    void setUp() {
        openAIService = new OpenAIServiceImpl(webClientBuilder, new ObjectMapper(), similarityCalculator);
    }

    @Test
    @DisplayName("Given_TwoMedicalClaims_When_CalculateSimilarity_Then_DelegatesAndReturnsSemanticScore")
    void Given_TwoMedicalClaims_When_CalculateSimilarity_Then_DelegatesAndReturnsSemanticScore() {
        when(similarityCalculator.combinedSimilarity(
            "El ejercicio reduce la diabetes.",
            "La actividad fisica regular reduce el riesgo de diabetes tipo 2.",
            0.7
        )).thenReturn(0.84);

        Double score = openAIService.calculateSimilarity(
            "El ejercicio reduce la diabetes.",
            "La actividad fisica regular reduce el riesgo de diabetes tipo 2."
        );

        assertEquals(0.84, score);
        verify(similarityCalculator).combinedSimilarity(
            "El ejercicio reduce la diabetes.",
            "La actividad fisica regular reduce el riesgo de diabetes tipo 2.",
            0.7
        );
    }

    @Test
    @DisplayName("Given_NullText_When_CalculateSimilarity_Then_ReturnsZero")
    void Given_NullText_When_CalculateSimilarity_Then_ReturnsZero() {
        Double score = openAIService.calculateSimilarity(null, "La vitamina D previene resfriados.");

        assertEquals(0.0, score);
        verifyNoInteractions(similarityCalculator);
    }

    @Test
    @DisplayName("Given_BlankPrompt_When_GenerateText_Then_ReturnsEmptyWithoutCallingModel")
    void Given_BlankPrompt_When_GenerateText_Then_ReturnsEmptyWithoutCallingModel() {
        String response = openAIService.generateText("   ", true);

        assertTrue(response.isEmpty());
        verifyNoInteractions(webClientBuilder, similarityCalculator);
    }
}
