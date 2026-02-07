package com.uci.competencia.service.external;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.util.SimilarityCalculator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class OpenAIServiceImpl implements OpenAIService {

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;
    private final SimilarityCalculator similarityCalculator;

    @Value("${app.openai.api.base-url}")
    private String openAiBaseUrl;

    @Value("${app.openai.api.key:}")
    private String openAiApiKey;

    @Value("${app.openai.api.model:gpt-4o-mini}")
    private String openAiModel;

    @Value("${app.openai.api.temperature:0.2}")
    private double temperature;

    @Value("${app.openai.api.max-tokens:800}")
    private int maxTokens;

    @Value("${app.openai.api.timeout:30000}")
    private long timeoutMs;

    @Override
    public String generateText(String prompt) {
        if (openAiApiKey == null || openAiApiKey.isBlank()) {
            log.warn("OpenAI API key not configured, skipping generation");
            return "";
        }
        try {
            WebClient client = webClientBuilder.baseUrl(openAiBaseUrl).build();
            Map<String, Object> payload = Map.of(
                "model", openAiModel,
                "messages", List.of(
                    Map.of("role", "system", "content", "Responde de forma concisa y solo con el formato solicitado."),
                    Map.of("role", "user", "content", prompt)
                ),
                "temperature", temperature,
                "max_tokens", maxTokens
            );

            String response = client.post()
                .uri("/chat/completions")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + openAiApiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofMillis(timeoutMs))
                .retryWhen(Retry.fixedDelay(2, Duration.ofMillis(250)))
                .block();

            if (response == null || response.isBlank()) {
                return "";
            }

            var json = objectMapper.readTree(response);
            var choices = json.path("choices");
            if (choices.isArray() && choices.size() > 0) {
                var message = choices.get(0).path("message");
                String content = message.path("content").asText("");
                return content != null ? content.trim() : "";
            }
            return "";
        } catch (Exception e) {
            log.warn("Error calling OpenAI API", e);
            return "";
        }
    }

    @Override
    public Double calculateSimilarity(String text1, String text2) {
        if (text1 == null || text2 == null) {
            return 0.0;
        }
        return similarityCalculator.combinedSimilarity(text1, text2, 0.7);
    }
}
