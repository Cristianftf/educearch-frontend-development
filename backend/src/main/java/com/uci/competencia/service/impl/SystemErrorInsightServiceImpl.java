package com.uci.competencia.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.entity.SystemErrorInsight;
import com.uci.competencia.model.entity.SystemLog;
import com.uci.competencia.model.enums.LogLevel;
import com.uci.competencia.repository.SystemErrorInsightRepository;
import com.uci.competencia.repository.SystemLogRepository;
import com.uci.competencia.service.SystemErrorInsightService;
import com.uci.competencia.service.external.OpenAIService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SystemErrorInsightServiceImpl implements SystemErrorInsightService {

    private static final int MIN_WINDOW_MINUTES = 5;
    private static final int MAX_WINDOW_MINUTES = 24 * 60;
    private static final int MIN_LIMIT = 1;
    private static final int MAX_LIMIT = 200;
    private static final int MAX_PROMPT_ERRORS = 8;

    private final SystemLogRepository systemLogRepository;
    private final SystemErrorInsightRepository systemErrorInsightRepository;
    private final OpenAIService openAIService;
    private final ObjectMapper objectMapper;

    private volatile LocalDateTime lastAnalysisAt;
    private volatile int lastProcessedErrors;
    private volatile int lastAnalyzedInsights;

    @Override
    @Transactional
    public Map<String, Object> analyzeRecentErrors(int windowMinutes, int limit) {
        int safeWindow = clamp(windowMinutes, MIN_WINDOW_MINUTES, MAX_WINDOW_MINUTES);
        int safeLimit = clamp(limit, MIN_LIMIT, MAX_LIMIT);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime since = now.minusMinutes(safeWindow);

        Page<SystemLog> page = systemLogRepository.findByLevelAndTimestampAfterOrderByTimestampDesc(
            LogLevel.ERROR,
            since,
            PageRequest.of(0, safeLimit, Sort.by(Sort.Direction.DESC, "timestamp"))
        );

        List<SystemLog> errors = page.getContent();
        Map<String, List<SystemLog>> grouped = errors.stream()
            .collect(Collectors.groupingBy(this::fingerprintOf, LinkedHashMap::new, Collectors.toList()));

        int insightsUpdated = 0;
        int logsProcessed = errors.size();

        for (Map.Entry<String, List<SystemLog>> entry : grouped.entrySet()) {
            String fingerprint = entry.getKey();
            List<SystemLog> groupLogs = entry.getValue().stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(SystemLog::getTimestamp, Comparator.nullsLast(Comparator.naturalOrder())))
                .collect(Collectors.toList());
            if (groupLogs.isEmpty()) {
                continue;
            }

            SystemLog latest = groupLogs.get(groupLogs.size() - 1);
            Optional<SystemErrorInsight> existingOpt = systemErrorInsightRepository.findByFingerprint(fingerprint);
            SystemErrorInsight insight = existingOpt.orElseGet(SystemErrorInsight::new);
            boolean isNew = insight.getId() == null;
            LocalDateTime previousLastSeen = insight.getLastSeen();

            LocalDateTime firstSeen = groupLogs.stream()
                .map(SystemLog::getTimestamp)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(now);
            LocalDateTime lastSeen = groupLogs.stream()
                .map(SystemLog::getTimestamp)
                .filter(Objects::nonNull)
                .reduce((a, b) -> b)
                .orElse(now);

            long newOccurrences;
            if (isNew || previousLastSeen == null) {
                newOccurrences = groupLogs.size();
            } else {
                newOccurrences = groupLogs.stream()
                    .map(SystemLog::getTimestamp)
                    .filter(Objects::nonNull)
                    .filter(ts -> ts.isAfter(previousLastSeen))
                    .count();
            }

            insight.setFingerprint(fingerprint);
            insight.setEndpoint(trimToLength(latest.getEndpoint(), 255));
            insight.setHttpStatus(latest.getResponseStatus());
            insight.setSeverity(resolveSeverity(latest.getResponseStatus(), latest.getErrorMessage()));
            insight.setErrorType(extractErrorType(latest));
            insight.setErrorMessage(trimToLength(extractErrorMessage(latest), 4000));
            insight.setSampleStackTrace(trimToLength(cleanMultiline(latest.getStackTrace()), 6000));
            insight.setLastLogId(trimToLength(latest.getId(), 120));
            insight.setFirstSeen(isNew || insight.getFirstSeen() == null ? firstSeen : minDateTime(insight.getFirstSeen(), firstSeen));
            insight.setLastSeen(isNew || insight.getLastSeen() == null ? lastSeen : maxDateTime(insight.getLastSeen(), lastSeen));
            insight.setOccurrences(Math.max(1L, (insight.getOccurrences() == null ? 0L : insight.getOccurrences()) + newOccurrences));

            boolean needsAiAnalysis = shouldAnalyzeWithAi(insight, latest, isNew, newOccurrences);
            if (needsAiAnalysis) {
                AiAnalysis ai = analyzeWithAi(insight, groupLogs);
                insight.setAiDiagnosis(ai.diagnosis);
                insight.setAiRecommendations(ai.recommendations);
                insight.setAiConfidence(ai.confidence);
                insight.setSeverity(resolveInsightSeverity(insight.getSeverity(), ai.severity));
                insight.setLastAnalyzedAt(now);
                insightsUpdated++;
            }

            systemErrorInsightRepository.save(insight);
        }

        lastAnalysisAt = now;
        lastProcessedErrors = logsProcessed;
        lastAnalyzedInsights = insightsUpdated;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("windowMinutes", safeWindow);
        result.put("limit", safeLimit);
        result.put("processedErrors", logsProcessed);
        result.put("updatedInsights", insightsUpdated);
        result.put("timestamp", now.toString());
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getMonitoringOverview(int windowMinutes, int limit) {
        int safeWindow = clamp(windowMinutes, MIN_WINDOW_MINUTES, MAX_WINDOW_MINUTES);
        int safeLimit = clamp(limit, MIN_LIMIT, MAX_LIMIT);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime since = now.minusMinutes(safeWindow);

        Page<SystemErrorInsight> insightsPage = systemErrorInsightRepository.findByLastSeenAfterOrderByLastSeenDesc(
            since,
            PageRequest.of(0, safeLimit, Sort.by(Sort.Direction.DESC, "lastSeen"))
        );

        Page<SystemLog> recentErrors = systemLogRepository.findByLevelAndTimestampAfterOrderByTimestampDesc(
            LogLevel.ERROR,
            since,
            PageRequest.of(0, safeLimit, Sort.by(Sort.Direction.DESC, "timestamp"))
        );

        long totalErrors = systemLogRepository.countByTimestampBetweenAndLevel(since, now, LogLevel.ERROR);
        long warnCount = systemLogRepository.countByTimestampBetweenAndLevel(since, now, LogLevel.WARN);
        long criticalInsights = insightsPage.getContent().stream()
            .filter(item -> "critical".equalsIgnoreCase(item.getSeverity()) || "high".equalsIgnoreCase(item.getSeverity()))
            .count();

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("windowMinutes", safeWindow);
        summary.put("totalErrors", totalErrors);
        summary.put("totalWarnings", warnCount);
        summary.put("trackedInsights", insightsPage.getTotalElements());
        summary.put("criticalInsights", criticalInsights);

        List<Map<String, Object>> insights = insightsPage.getContent().stream()
            .map(this::toInsightMap)
            .collect(Collectors.toList());

        List<Map<String, Object>> recent = recentErrors.getContent().stream()
            .map(this::toRecentErrorMap)
            .collect(Collectors.toList());

        Map<String, Object> analysisStatus = new LinkedHashMap<>();
        analysisStatus.put("lastRun", lastAnalysisAt != null ? lastAnalysisAt.toString() : null);
        analysisStatus.put("lastProcessedErrors", lastProcessedErrors);
        analysisStatus.put("lastUpdatedInsights", lastAnalyzedInsights);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("generatedAt", now.toString());
        response.put("summary", summary);
        response.put("analysisStatus", analysisStatus);
        response.put("insights", insights);
        response.put("recentErrors", recent);
        return response;
    }

    private Map<String, Object> toInsightMap(SystemErrorInsight insight) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", insight.getId());
        item.put("fingerprint", insight.getFingerprint());
        item.put("endpoint", insight.getEndpoint());
        item.put("httpStatus", insight.getHttpStatus());
        item.put("severity", insight.getSeverity());
        item.put("errorType", insight.getErrorType());
        item.put("errorMessage", insight.getErrorMessage());
        item.put("occurrences", insight.getOccurrences());
        item.put("firstSeen", insight.getFirstSeen() != null ? insight.getFirstSeen().toString() : null);
        item.put("lastSeen", insight.getLastSeen() != null ? insight.getLastSeen().toString() : null);
        item.put("lastAnalyzedAt", insight.getLastAnalyzedAt() != null ? insight.getLastAnalyzedAt().toString() : null);
        item.put("aiDiagnosis", insight.getAiDiagnosis());
        item.put("aiConfidence", insight.getAiConfidence());
        item.put("recommendations", splitRecommendations(insight.getAiRecommendations()));
        return item;
    }

    private Map<String, Object> toRecentErrorMap(SystemLog logItem) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", logItem.getId());
        item.put("timestamp", logItem.getTimestamp() != null ? logItem.getTimestamp().toString() : null);
        item.put("endpoint", logItem.getEndpoint());
        item.put("httpStatus", logItem.getResponseStatus());
        item.put("responseTime", logItem.getResponseTime());
        item.put("userId", logItem.getUserId());
        item.put("errorMessage", extractErrorMessage(logItem));
        item.put("correlationId", logItem.getCorrelationId());
        return item;
    }

    private boolean shouldAnalyzeWithAi(
        SystemErrorInsight insight,
        SystemLog latest,
        boolean isNew,
        long newOccurrences
    ) {
        if (isNew) return true;
        if (!hasText(insight.getAiDiagnosis())) return true;
        if (insight.getLastAnalyzedAt() == null) return true;
        if (newOccurrences > 0 && insight.getLastSeen() != null && insight.getLastAnalyzedAt().isBefore(insight.getLastSeen())) {
            return true;
        }

        String persistedError = normalizeForComparison(insight.getErrorMessage());
        String latestError = normalizeForComparison(extractErrorMessage(latest));
        return !Objects.equals(persistedError, latestError);
    }

    private AiAnalysis analyzeWithAi(SystemErrorInsight insight, List<SystemLog> logs) {
        List<SystemLog> samples = logs.stream().limit(MAX_PROMPT_ERRORS).collect(Collectors.toList());
        String prompt = buildAiPrompt(insight, samples);
        try {
            String raw = openAIService.generateText(prompt, true);
            AiAnalysis parsed = parseAiAnalysis(raw);
            if (parsed != null) {
                return parsed;
            }
        } catch (Exception ex) {
            log.warn("AI analysis failed for fingerprint {}: {}", insight.getFingerprint(), ex.getMessage());
        }
        return buildFallbackAnalysis(insight, logs.isEmpty() ? null : logs.get(logs.size() - 1));
    }

    private String buildAiPrompt(SystemErrorInsight insight, List<SystemLog> samples) {
        StringBuilder builder = new StringBuilder();
        builder.append("Analiza errores de backend y devuelve JSON valido sin markdown.\n");
        builder.append("Formato exacto:\n");
        builder.append("{\"rootCause\":\"...\",\"severity\":\"critical|high|medium|low\",\"confidence\":0.0,");
        builder.append("\"fixes\":[\"...\"],\"quickChecks\":[\"...\"]}\n");
        builder.append("Contexto:\n");
        builder.append("- endpoint: ").append(trimToLength(insight.getEndpoint(), 255)).append("\n");
        builder.append("- status: ").append(insight.getHttpStatus()).append("\n");
        builder.append("- errorType: ").append(trimToLength(insight.getErrorType(), 120)).append("\n");
        builder.append("- mensaje: ").append(trimToLength(insight.getErrorMessage(), 700)).append("\n");
        builder.append("- stackTrace: ").append(trimToLength(insight.getSampleStackTrace(), 900)).append("\n");
        builder.append("Muestras recientes:\n");
        for (SystemLog logItem : samples) {
            builder.append("* [")
                .append(logItem.getTimestamp())
                .append("] endpoint=")
                .append(trimToLength(logItem.getEndpoint(), 180))
                .append(" status=")
                .append(logItem.getResponseStatus())
                .append(" error=")
                .append(trimToLength(extractErrorMessage(logItem), 260))
                .append("\n");
        }
        builder.append("Condiciones:\n");
        builder.append("1) Responde en espanol tecnico y accionable.\n");
        builder.append("2) Prioriza correcciones del backend Java/Spring y PostgreSQL.\n");
        builder.append("3) No incluyas texto fuera del JSON.\n");
        return builder.toString();
    }

    private AiAnalysis parseAiAnalysis(String raw) {
        if (!hasText(raw)) return null;
        String json = extractFirstJsonObject(raw);
        if (!hasText(json)) return null;

        try {
            JsonNode node = objectMapper.readTree(json);
            String diagnosis = trimToLength(node.path("rootCause").asText(""), 1800);
            String severity = normalizeSeverity(node.path("severity").asText(""));
            double confidence = node.path("confidence").asDouble(0.4d);
            confidence = Math.max(0d, Math.min(1d, confidence));

            List<String> fixes = readStringArray(node.path("fixes"));
            List<String> checks = readStringArray(node.path("quickChecks"));
            List<String> recommendations = new ArrayList<>();
            recommendations.addAll(fixes);
            recommendations.addAll(checks);
            if (recommendations.isEmpty()) {
                recommendations.add("Revisar trazas completas y reproducir el error en entorno controlado.");
                recommendations.add("Agregar validaciones y tests de regresion para el caso reportado.");
            }

            return new AiAnalysis(
                hasText(diagnosis) ? diagnosis : "Error recurrente detectado sin diagnostico concluyente del modelo.",
                joinRecommendations(recommendations),
                severity,
                confidence
            );
        } catch (Exception parseEx) {
            log.debug("Could not parse AI JSON response: {}", parseEx.getMessage());
            return null;
        }
    }

    private AiAnalysis buildFallbackAnalysis(SystemErrorInsight insight, SystemLog latest) {
        String msg = normalizeForComparison(extractErrorMessage(latest));
        String diagnosis;
        List<String> recommendations = new ArrayList<>();
        String severity = normalizeSeverity(insight.getSeverity());

        if (msg.contains("timeout") || msg.contains("timed out")) {
            diagnosis = "Timeout en integracion externa o consulta de larga duracion.";
            recommendations.add("Aumentar timeout en cliente HTTP y aplicar retry exponencial.");
            recommendations.add("Agregar cache por consulta para reducir llamadas repetidas.");
        } else if (msg.contains("psql") || msg.contains("postgres") || msg.contains("jdbc")) {
            diagnosis = "Fallo de persistencia o consulta en PostgreSQL.";
            recommendations.add("Validar tipos de columna y longitudes para evitar truncamiento.");
            recommendations.add("Revisar transacciones y evitar lectura LOB fuera de contexto transaccional.");
        } else if (msg.contains("nullpointer") || msg.contains("null pointer")) {
            diagnosis = "Referencia nula no controlada en flujo de backend.";
            recommendations.add("Agregar validaciones null-safe antes de acceder a objetos anidados.");
            recommendations.add("Cubrir el flujo con pruebas unitarias para entrada incompleta.");
        } else {
            diagnosis = "Error de backend detectado sin clasificacion especifica.";
            recommendations.add("Revisar stack trace y parametros de entrada del endpoint.");
            recommendations.add("Agregar manejo explicito de excepciones para este caso.");
        }

        recommendations.add("Correlacionar con logs por correlationId para trazar causa raiz.");

        return new AiAnalysis(
            diagnosis,
            joinRecommendations(recommendations),
            severity,
            0.35d
        );
    }

    private String fingerprintOf(SystemLog logItem) {
        String endpoint = trimToLength(logItem.getEndpoint(), 180);
        String status = logItem.getResponseStatus() != null ? String.valueOf(logItem.getResponseStatus()) : "NA";
        String errorType = extractErrorType(logItem);
        String message = trimToLength(normalizeForComparison(extractErrorMessage(logItem)), 220);
        String seed = endpoint + "|" + status + "|" + errorType + "|" + message;
        return sha256(seed);
    }

    private String extractErrorType(SystemLog logItem) {
        String message = extractErrorMessage(logItem);
        if (hasText(message)) {
            int idx = message.indexOf(':');
            String candidate = idx > 0 ? message.substring(0, idx) : message;
            candidate = trimToLength(candidate.replaceAll("[^a-zA-Z0-9_.-]", ""), 120);
            if (hasText(candidate)) return candidate;
        }
        String stack = cleanMultiline(logItem.getStackTrace());
        if (hasText(stack)) {
            String first = stack.split("\\s+")[0];
            return trimToLength(first.replaceAll("[^a-zA-Z0-9_.-]", ""), 120);
        }
        return "UnknownError";
    }

    private String extractErrorMessage(SystemLog logItem) {
        String message = cleanMultiline(logItem.getErrorMessage());
        if (hasText(message)) return message;
        String stack = cleanMultiline(logItem.getStackTrace());
        if (!hasText(stack)) return "Error sin detalle";
        return trimToLength(stack, 1000);
    }

    private String resolveSeverity(Integer httpStatus, String errorMessage) {
        if (httpStatus != null) {
            if (httpStatus >= 500) return "high";
            if (httpStatus >= 400) return "medium";
        }
        String normalized = normalizeForComparison(errorMessage);
        if (normalized.contains("critical") || normalized.contains("fatal")) return "critical";
        return "medium";
    }

    private String resolveInsightSeverity(String defaultSeverity, String aiSeverity) {
        String normalizedAi = normalizeSeverity(aiSeverity);
        if (!"medium".equals(normalizedAi) || !hasText(defaultSeverity)) {
            return normalizedAi;
        }
        return normalizeSeverity(defaultSeverity);
    }

    private String normalizeSeverity(String value) {
        String normalized = hasText(value) ? value.trim().toLowerCase(Locale.ROOT) : "";
        if ("critical".equals(normalized)) return "critical";
        if ("high".equals(normalized)) return "high";
        if ("low".equals(normalized)) return "low";
        return "medium";
    }

    private String normalizeForComparison(String value) {
        if (!hasText(value)) return "";
        return value
            .replaceAll("[\\u0000-\\u001f]+", " ")
            .replaceAll("\\s+", " ")
            .trim()
            .toLowerCase(Locale.ROOT);
    }

    private String cleanMultiline(String value) {
        if (!hasText(value)) return "";
        return value
            .replaceAll("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001f]+", " ")
            .replaceAll("\\s+", " ")
            .trim();
    }

    private String trimToLength(String value, int maxLength) {
        if (value == null) return null;
        String normalized = value.trim();
        if (normalized.length() <= maxLength) return normalized;
        return normalized.substring(0, maxLength);
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException ex) {
            return Integer.toHexString(input.hashCode());
        }
    }

    private LocalDateTime minDateTime(LocalDateTime a, LocalDateTime b) {
        return a.isBefore(b) ? a : b;
    }

    private LocalDateTime maxDateTime(LocalDateTime a, LocalDateTime b) {
        return a.isAfter(b) ? a : b;
    }

    private List<String> splitRecommendations(String value) {
        if (!hasText(value)) return List.of();
        return value.lines()
            .map(line -> line.replaceFirst("^[-*]\\s*", "").trim())
            .filter(this::hasText)
            .limit(10)
            .collect(Collectors.toList());
    }

    private String joinRecommendations(List<String> recommendations) {
        return recommendations.stream()
            .filter(this::hasText)
            .limit(10)
            .map(item -> "- " + trimToLength(item, 280))
            .collect(Collectors.joining("\n"));
    }

    private List<String> readStringArray(JsonNode node) {
        if (node == null || !node.isArray()) return List.of();
        List<String> values = new ArrayList<>();
        for (JsonNode item : node) {
            String text = trimToLength(item.asText(""), 280);
            if (hasText(text)) values.add(text);
        }
        return values;
    }

    private String extractFirstJsonObject(String raw) {
        String trimmed = raw.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            return trimmed;
        }
        int start = trimmed.indexOf('{');
        int end = trimmed.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return trimmed.substring(start, end + 1);
        }
        return trimmed;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private int clamp(int value, int min, int max) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    private record AiAnalysis(
        String diagnosis,
        String recommendations,
        String severity,
        double confidence
    ) {
    }
}
