package com.uci.competencia.service.external;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
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

    @Value("${app.ai.provider:auto}")
    private String aiProvider;

    @Value("${app.google.ai.base-url:https://generativelanguage.googleapis.com/v1beta}")
    private String googleAiBaseUrl;

    @Value("${app.google.ai.api.key:${GEMINI_API_KEY:${GOOGLE_AI_API_KEY:}}}")
    private String googleAiApiKey;

    @Value("${app.google.ai.model:${GOOGLE_AI_MODEL:gemini-2.5-flash}}")
    private String googleAiModel;

    @Value("${app.ai.local-fallback.enabled:true}")
    private boolean localFallbackEnabled;

    @Value("${app.ai.local.base-url:http://localhost:11434/v1}")
    private String localBaseUrl;

    @Value("${app.ai.local.api.key:}")
    private String localApiKey;

    @Value("${app.ai.local.model:llama3.2:3b}")
    private String localModel;

    @Override
    public String generateText(String prompt) {
        String primary = generatePrimaryText(prompt);
        if (hasText(primary)) {
            return primary;
        }

        if (localFallbackEnabled) {
            String local = callChatCompletion(localBaseUrl, localApiKey, localModel, prompt, "local", false);
            if (hasText(local)) {
                return local;
            }
        }

        return "";
    }

    private String generatePrimaryText(String prompt) {
        String provider = normalizeProvider(aiProvider);
        return switch (provider) {
            case "gemini" -> callGeminiGenerateContent(googleAiBaseUrl, googleAiApiKey, googleAiModel, prompt, "gemini");
            case "openai-compatible" ->
                callChatCompletion(openAiBaseUrl, openAiApiKey, openAiModel, prompt, "openai-compatible", true);
            default -> callAutoPrimaryProvider(prompt);
        };
    }

    private String callAutoPrimaryProvider(String prompt) {
        boolean geminiConfigured = hasText(googleAiBaseUrl) && hasText(googleAiApiKey) && hasText(googleAiModel);
        boolean openAiConfigured = hasText(openAiBaseUrl) && hasText(openAiApiKey) && hasText(openAiModel);

        if (!geminiConfigured && !openAiConfigured) {
            log.warn("No external LLM configured. Set GOOGLE_AI_API_KEY/GEMINI_API_KEY or LLM_API_KEY/GROQ_API_KEY");
            return "";
        }

        if (geminiConfigured) {
            String gemini = callGeminiGenerateContent(googleAiBaseUrl, googleAiApiKey, googleAiModel, prompt, "gemini");
            if (hasText(gemini)) {
                return gemini;
            }
        }

        if (openAiConfigured) {
            return callChatCompletion(openAiBaseUrl, openAiApiKey, openAiModel, prompt, "openai-compatible", true);
        }

        return "";
    }

    private String callChatCompletion(
        String baseUrl,
        String apiKey,
        String model,
        String prompt,
        String channel,
        boolean requireApiKey
    ) {
        if (!hasText(baseUrl) || !hasText(model) || !hasText(prompt)) {
            return "";
        }

        if (requireApiKey && !hasText(apiKey)) {
            log.warn("{} API key not configured", channel);
            return "";
        }

        try {
            WebClient client = webClientBuilder.baseUrl(baseUrl).build();
            Map<String, Object> payload = Map.of(
                "model", model,
                "messages", List.of(
                    Map.of("role", "system", "content", "Responde de forma concisa y solo con el formato solicitado."),
                    Map.of("role", "user", "content", prompt)
                ),
                "temperature", temperature,
                "max_tokens", maxTokens
            );

            var request = client.post()
                .uri("/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .bodyValue(payload);

            if (hasText(apiKey)) {
                request = request.header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey);
            }

            String response = request
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofMillis(timeoutMs))
                .retryWhen(Retry.fixedDelay(2, Duration.ofMillis(250)))
                .block();

            if (!hasText(response)) {
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
            log.warn("Error calling {} LLM API", channel, e);
            return "";
        }
    }

    private String callGeminiGenerateContent(
        String baseUrl,
        String apiKey,
        String model,
        String prompt,
        String channel
    ) {
        String sdkResponse = callGeminiGenerateContentSdk(apiKey, model, prompt, channel);
        if (hasText(sdkResponse)) {
            return sdkResponse;
        }

        return callGeminiGenerateContentRest(baseUrl, apiKey, model, prompt, channel);
    }

    private String callGeminiGenerateContentSdk(
        String apiKey,
        String model,
        String prompt,
        String channel
    ) {
        if (!hasText(model) || !hasText(prompt)) {
            return "";
        }

        String envApiKey = System.getenv("GEMINI_API_KEY");
        if (!hasText(apiKey) && !hasText(envApiKey)) {
            log.warn("{} API key not configured. Set GEMINI_API_KEY or app.google.ai.api.key", channel);
            return "";
        }

        try (Client client = hasText(apiKey) ? Client.builder().apiKey(apiKey).build() : new Client()) {
            GenerateContentConfig config = GenerateContentConfig.builder()
                .systemInstruction(Content.fromParts(Part.fromText(
                    "Responde de forma concisa y solo con el formato solicitado."
                )))
                .temperature((float) temperature)
                .maxOutputTokens(maxTokens)
                .build();

            GenerateContentResponse response = client.models.generateContent(
                normalizeGeminiModel(model),
                prompt,
                config
            );
            if (response == null) {
                return "";
            }

            String text = response.text();
            return hasText(text) ? text.trim() : "";
        } catch (Exception e) {
            log.warn("Error calling {} LLM SDK", channel, e);
            return "";
        }
    }

    private String callGeminiGenerateContentRest(
        String baseUrl,
        String apiKey,
        String model,
        String prompt,
        String channel
    ) {
        if (!hasText(baseUrl) || !hasText(model) || !hasText(prompt)) {
            return "";
        }
        if (!hasText(apiKey)) {
            log.warn("{} REST fallback skipped: missing API key", channel);
            return "";
        }

        try {
            String normalizedModel = normalizeGeminiModel(model);
            WebClient client = webClientBuilder.baseUrl(baseUrl).build();

            Map<String, Object> payload = Map.of(
                "system_instruction",
                Map.of(
                    "parts",
                    List.of(Map.of("text", "Responde de forma concisa y solo con el formato solicitado."))
                ),
                "contents",
                List.of(
                    Map.of(
                        "role", "user",
                        "parts", List.of(Map.of("text", prompt))
                    )
                ),
                "generationConfig",
                Map.of(
                    "temperature", temperature,
                    "maxOutputTokens", maxTokens
                )
            );

            String response = client.post()
                .uri(uriBuilder -> uriBuilder.path("/models/{model}:generateContent").build(normalizedModel))
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .header("x-goog-api-key", apiKey)
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofMillis(timeoutMs))
                .retryWhen(Retry.fixedDelay(2, Duration.ofMillis(250)))
                .block();

            if (!hasText(response)) {
                return "";
            }

            JsonNode json = objectMapper.readTree(response);
            return extractGeminiText(json);
        } catch (Exception e) {
            log.warn("Error calling {} LLM API", channel, e);
            return "";
        }
    }

    private String extractGeminiText(JsonNode json) {
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

    private String normalizeProvider(String provider) {
        if (!hasText(provider)) {
            return "auto";
        }
        String normalized = provider.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "gemini", "google", "google-ai", "google-ai-studio" -> "gemini";
            case "openai", "openai-compatible", "groq" -> "openai-compatible";
            default -> "auto";
        };
    }

    private String normalizeGeminiModel(String model) {
        String normalized = model.trim();
        if (normalized.startsWith("models/")) {
            return normalized.substring("models/".length());
        }
        return normalized;
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
