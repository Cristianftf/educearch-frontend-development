package com.uci.competencia.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("SimilarityCalculator - Score semantico y deteccion de veracidad")
class SimilarityCalculatorTest {

    private final SimilarityCalculator calculator = new SimilarityCalculator();

    @Test
    @DisplayName("Given_TrueMedicalClaim_When_DetectStance_Then_ReturnsHighSupportScore")
    void Given_TrueMedicalClaim_When_DetectStance_Then_ReturnsHighSupportScore() {
        SimilarityCalculator.StanceDetection detection = calculator.detectStance(
            "regular exercise reduces diabetes risk",
            "regular exercise reduces diabetes risk and improves insulin sensitivity"
        );

        assertEquals(SimilarityCalculator.Stance.SUPPORT, detection.stance);
        assertTrue(detection.score > 0.65);
    }

    @Test
    @DisplayName("Given_FalseMedicalClaim_When_DetectStance_Then_ReturnsLowSemanticScore")
    void Given_FalseMedicalClaim_When_DetectStance_Then_ReturnsLowSemanticScore() {
        SimilarityCalculator.StanceDetection detection = calculator.detectStance(
            "El chocolate cura el cáncer.",
            "No existe evidencia cientifica robusta que demuestre que el chocolate cure el cancer; los tratamientos oncologicos requieren terapias validadas."
        );

        assertTrue(
            detection.stance == SimilarityCalculator.Stance.CONTRADICT
                || detection.stance == SimilarityCalculator.Stance.NEUTRAL
        );
        assertTrue(detection.score < 0.50);
    }

    @Test
    @DisplayName("Given_AmbiguousClaim_When_DetectStance_Then_ReturnsNeutralMediumScore")
    void Given_AmbiguousClaim_When_DetectStance_Then_ReturnsNeutralMediumScore() {
        SimilarityCalculator.StanceDetection detection = calculator.detectStance(
            "vitamin d prevents colds",
            "vitamin d and colds remain under investigation in adults"
        );

        assertEquals(SimilarityCalculator.Stance.NEUTRAL, detection.stance);
        assertTrue(detection.score >= 0.35 && detection.score <= 0.65);
    }

    @Test
    @DisplayName("Given_SimilarScientificTexts_When_CombinedSimilarity_Then_ReturnsHighNumericScore")
    void Given_SimilarScientificTexts_When_CombinedSimilarity_Then_ReturnsHighNumericScore() {
        double score = calculator.combinedSimilarity(
            "exercise reduces diabetes risk and improves insulin sensitivity",
            "regular exercise improves insulin sensitivity and lowers diabetes risk",
            0.7
        );

        assertTrue(score > 0.55);
    }

    @Test
    @DisplayName("Given_UnrelatedScientificTexts_When_CombinedSimilarity_Then_ReturnsLowNumericScore")
    void Given_UnrelatedScientificTexts_When_CombinedSimilarity_Then_ReturnsLowNumericScore() {
        double score = calculator.combinedSimilarity(
            "exercise reduces diabetes risk",
            "chocolate dessert recipes with sugar and cream",
            0.7
        );

        assertTrue(score < 0.25);
    }

    @Test
    @DisplayName("Given_NullInput_When_DetectStance_Then_ReturnsNeutralFallback")
    void Given_NullInput_When_DetectStance_Then_ReturnsNeutralFallback() {
        SimilarityCalculator.StanceDetection detection = calculator.detectStance(null, null);

        assertEquals(SimilarityCalculator.Stance.NEUTRAL, detection.stance);
        assertEquals(0.5, detection.score);
    }
}
