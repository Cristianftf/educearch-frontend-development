package com.uci.competencia.service.external;

public interface OpenAIService {
    default String generateText(String prompt) {
        return generateText(prompt, false);
    }

    String generateText(String prompt, boolean jsonResponse);

    Double calculateSimilarity(String text1, String text2);
}
