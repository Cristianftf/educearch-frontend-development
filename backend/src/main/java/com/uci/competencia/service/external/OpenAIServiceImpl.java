package com.uci.competencia.service.external;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.util.SimilarityCalculator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.reactive.function.client.WebClient;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeoutException;

@Service
@Slf4j
@RequiredArgsConstructor
public class OpenAIServiceImpl implements OpenAIService {

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;
    private final SimilarityCalculator similarityCalculator;

    @Value("${app.google.ai.base-url:https://generativelanguage.googleapis.com/v1beta/openai/chat/completions}")
    private String googleAiBaseUrl;

    @Value("${app.google.ai.api.key:${GEMINI_API_KEY:${GOOGLE_AI_API_KEY:}}}")
    private String googleAiApiKey;

    @Value("${app.google.ai.model:${GOOGLE_AI_MODEL:gemini-3-flash-preview}}")
    private String googleAiModel;

    @Value("${app.google.ai.sdk-enabled:${GOOGLE_AI_SDK_ENABLED:false}}")
    private boolean sdkEnabled;

    @Value("${app.google.ai.temperature:${GOOGLE_AI_TEMPERATURE:1.0}}")
    private double googleAiTemperature;

    @Value("${app.google.ai.max-tokens:${GOOGLE_AI_MAX_TOKENS:2000}}")
    private int maxTokens;

    @Value("${app.google.ai.timeout:${GOOGLE_AI_TIMEOUT:20000}}")
    private long timeoutMs;

    @Value("${app.google.ai.max-retries:${GOOGLE_AI_MAX_RETRIES:2}}")
    private int maxRetries;

    @Value("${app.google.ai.retry-delay-ms:${GOOGLE_AI_RETRY_DELAY_MS:2000}}")
    private long retryDelayMs;

    @Override
    public String generateText(String prompt) {
        return generateText(prompt, false);
    }

    @Override
    public String generateText(String prompt, boolean jsonResponse) {
        if (!hasText(prompt)) {
            return "";
        }

        String response = callGeminiGenerateContent(
            googleAiBaseUrl,
            googleAiApiKey,
            googleAiModel,
            prompt,
            "gemini",
            jsonResponse
        );
        if (hasText(response)) {
            return response;
        }

        log.warn("Gemini response is empty after SDK and REST fallback attempts.");
        return "";
    }

    private String callGeminiGenerateContent(
        String baseUrl,
        String apiKey,
        String model,
        String prompt,
        String channel,
        boolean jsonResponse
    ) {
        String resolvedApiKey = resolveGeminiApiKey(apiKey);
        String restResponse = callGeminiGenerateContentRest(
            baseUrl,
            resolvedApiKey,
            model,
            prompt,
            channel,
            jsonResponse
        );
        if (hasText(restResponse)) {
            return restResponse;
        }

        // SDK fallback disabled: google.genai SDK not available
        return "";
    }

    private String callGeminiGenerateContentRest(
        String baseUrl,
        String apiKey,
        String model,
        String prompt,
        String channel,
        boolean jsonResponse
    ) {
        if (!hasText(baseUrl) || !hasText(model) || !hasText(prompt)) {
            return "";
        }
        if (!hasText(apiKey)) {
            log.warn("{} REST fallback skipped: missing API key", channel);
            return "";
        }

        String endpoint = resolveChatCompletionsEndpoint(baseUrl);
        String normalizedModel = normalizeGeminiModel(model);
        WebClient client = webClientBuilder.build();
        Map<String, Object> payload = buildChatCompletionsPayload(normalizedModel, prompt, jsonResponse);
        int retries = resolveRetryAttempts();

        for (int attempt = 0; attempt <= retries; attempt += 1) {
            try {
                String response = client.post()
                    .uri(endpoint)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + apiKey)
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofMillis(resolveRestTimeoutMs()))
                    .block();

                if (!hasText(response)) {
                    return "";
                }

                JsonNode json = objectMapper.readTree(response);
                return extractChatCompletionText(json);
            } catch (WebClientResponseException ex) {
                int statusCode = ex.getStatusCode().value();
                boolean retryable = isRetryableStatusCode(statusCode);
                log.warn(
                    "Error calling {} LLM API (attempt {}/{}): status={}, retryable={}, body={}",
                    channel,
                    attempt + 1,
                    retries + 1,
                    statusCode,
                    retryable,
                    ex.getResponseBodyAsString()
                );
                if (!retryable || attempt >= retries) {
                    return "";
                }
                sleepBeforeRetry();
            } catch (Exception ex) {
                boolean retryable = isRetryableThrowable(ex);
                log.warn(
                    "Error calling {} LLM API (attempt {}/{}): {}, retryable={}",
                    channel,
                    attempt + 1,
                    retries + 1,
                    ex.getMessage(),
                    retryable
                );
                if (!retryable || attempt >= retries) {
                    return "";
                }
                sleepBeforeRetry();
            }
        }

        return "";
    }

    private Map<String, Object> buildChatCompletionsPayload(String model, String prompt, boolean jsonResponse) {
        List<Map<String, Object>> messages = List.of(
            Map.of(
                "role", "system",
                "content",
                jsonResponse
                    ? "Devuelve unicamente un objeto JSON valido y compacto, sin markdown."
                    : "Responde de forma concisa y solo con el formato solicitado."
            ),
            Map.of("role", "user", "content", prompt)
        );

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("messages", messages);
        payload.put("temperature", googleAiTemperature);
        payload.put("max_tokens", maxTokens);
        if (jsonResponse) {
            payload.put("response_format", Map.of("type", "json_object"));
        }
        return payload;
    }

    private String resolveChatCompletionsEndpoint(String configuredBaseUrl) {
        String url = configuredBaseUrl.trim();
        if (url.endsWith("/chat/completions")) {
            return url;
        }
        if (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        if (url.endsWith("/openai")) {
            return url + "/chat/completions";
        }
        return url + "/openai/chat/completions";
    }

    private String extractChatCompletionText(JsonNode json) {
        JsonNode choices = json.path("choices");
        if (choices.isArray() && !choices.isEmpty()) {
            JsonNode content = choices.get(0).path("message").path("content");
            String extracted = extractTextFromContentNode(content);
            if (hasText(extracted)) {
                return extracted.trim();
            }
        }
        return extractGenerateContentText(json);
    }

    private String extractTextFromContentNode(JsonNode contentNode) {
        if (contentNode == null || contentNode.isMissingNode() || contentNode.isNull()) {
            return "";
        }
        if (contentNode.isTextual()) {
            return contentNode.asText("").trim();
        }
        if (!contentNode.isArray()) {
            return "";
        }
        List<String> textParts = new ArrayList<>();
        for (JsonNode part : contentNode) {
            if (part == null || part.isNull()) {
                continue;
            }
            if (part.isTextual()) {
                String directText = part.asText("");
                if (hasText(directText)) {
                    textParts.add(directText.trim());
                }
                continue;
            }
            String text = part.path("text").asText("");
            if (hasText(text)) {
                textParts.add(text.trim());
            }
        }
        return textParts.isEmpty() ? "" : String.join("\n", textParts).trim();
    }

    private String extractGenerateContentText(JsonNode json) {
        JsonNode candidates = json.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            return "";
        }
        JsonNode parts = candidates.get(0).path("content").path("parts");
        if (!parts.isArray() || parts.isEmpty()) {
            return "";
        }
        List<String> textParts = new ArrayList<>();
        for (JsonNode part : parts) {
            String text = part.path("text").asText("");
            if (hasText(text)) {
                textParts.add(text.trim());
            }
        }
        if (textParts.isEmpty()) {
            return "";
        }
        return String.join("\n", textParts).trim();
    }

    private String resolveGeminiApiKey(String configured) {
        if (hasText(configured)) {
            return configured.trim();
        }
        String geminiEnv = System.getenv("GEMINI_API_KEY");
        if (hasText(geminiEnv)) {
            return geminiEnv.trim();
        }
        String googleEnv = System.getenv("GOOGLE_AI_API_KEY");
        if (hasText(googleEnv)) {
            return googleEnv.trim();
        }
        return "";
    }

    private String normalizeGeminiModel(String model) {
        if (!hasText(model)) {
            return "gemini-3-flash-preview";
        }
        String normalized = model.trim();
        if (normalized.startsWith("models/")) {
            return normalized.substring("models/".length());
        }
        return normalized;
    }

    private int resolveClientTimeoutMs() {
        long clamped = Math.max(3000L, Math.min(timeoutMs, 30000L));
        return (int) clamped;
    }

    private int resolveRestTimeoutMs() {
        int clientTimeout = resolveClientTimeoutMs();
        int reduced = (clientTimeout * 3) / 4;
        return Math.max(4000, Math.min(reduced, 25000));
    }

    private int resolveRetryAttempts() {
        return Math.max(0, Math.min(maxRetries, 3));
    }

    private long resolveRetryDelayMs() {
        return Math.max(500L, Math.min(retryDelayMs, 10_000L));
    }

    private boolean isRetryableStatusCode(int code) {
        return code == 429 || code == 500 || code == 502 || code == 503 || code == 504;
    }

    private boolean isRetryableThrowable(Throwable throwable) {
        if (throwable == null) {
            return false;
        }
        if (throwable instanceof TimeoutException || throwable instanceof IOException) {
            return true;
        }
        if (throwable instanceof WebClientResponseException webClientEx) {
            int code = webClientEx.getStatusCode().value();
            return isRetryableStatusCode(code);
        }
        String message = throwable.getMessage();
        if (!hasText(message)) {
            return false;
        }
        String normalized = message.toLowerCase();
        return normalized.contains("timeout")
            || normalized.contains("timed out")
            || normalized.contains("connection reset")
            || normalized.contains("connection aborted")
            || normalized.contains("high demand")
            || normalized.contains("temporarily unavailable");
    }

    private void sleepBeforeRetry() {
        try {
            Thread.sleep(resolveRetryDelayMs());
        } catch (InterruptedException interruptedException) {
            Thread.currentThread().interrupt();
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    @Override
    public Double calculateSimilarity(String text1, String text2) {
        if (text1 == null || text2 == null) {
            return 0.0;
        }
        return similarityCalculator.combinedSimilarity(text1, text2, 0.7);
    }
}
