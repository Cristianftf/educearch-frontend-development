package com.uci.competencia.service.external;

public interface OpenAIService {
    String generateText(String prompt);
    Double calculateSimilarity(String text1, String text2);
}
