package com.uci.competencia.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.request.SearchAssistantRequestDTO;
import com.uci.competencia.model.dto.request.SearchRequestDTO;
import com.uci.competencia.model.dto.response.SearchAssistantResponseDTO;
import com.uci.competencia.service.SearchAssistantService;
import com.uci.competencia.service.external.OpenAIService;
import com.uci.competencia.service.external.PubMedApiService;
import com.uci.competencia.util.MeshMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@Slf4j
@RequiredArgsConstructor
public class SearchAssistantServiceImpl implements SearchAssistantService {

    private static final Pattern TOKEN_SPLIT = Pattern.compile("\\s+");
    private static final Set<String> VALID_OPERATORS = Set.of("AND", "OR", "NOT");

    private final OpenAIService openAIService;
    private final PubMedApiService pubMedApiService;
    private final MeshMapper meshMapper;
    private final ObjectMapper objectMapper;

    @Override
    public SearchAssistantResponseDTO generateResponse(SearchAssistantRequestDTO request) {
        String message = request != null && request.getMessage() != null ? request.getMessage().trim() : "";
        SearchRequestDTO.SearchFiltersDTO baseFilters = sanitizeFilters(request != null ? request.getFilters() : null);
        List<String> selectedTerms = sanitizeTerms(request != null ? request.getSelectedTerms() : null, 8);
        List<String> recentTerms = sanitizeTerms(request != null ? request.getRecentTerms() : null, 8);
        List<String> selectedOperators = sanitizeOperators(request != null ? request.getOperators() : null, 3);

        FallbackBundle fallback = buildFallbackBundle(message, selectedTerms, recentTerms, selectedOperators, baseFilters);
        if (message.isBlank()) {
            return fallback.toResponse(false, true);
        }

        String aiOutput = openAIService.generateText(
            buildPrompt(message, selectedTerms, recentTerms, selectedOperators, baseFilters, fallback)
        );
        if (aiOutput == null || aiOutput.isBlank()) {
            return fallback.toResponse(false, true);
        }

        try {
            JsonNode parsed = parseJsonNode(aiOutput);
            if (parsed == null || !parsed.isObject()) {
                return fallback.toResponse(false, true);
            }

            String reply = parsed.path("reply").asText(fallback.reply).trim();
            List<SearchAssistantResponseDTO.SuggestedTermDTO> terms =
                mergeTerms(readSuggestedTerms(parsed.path("suggestedTerms")), fallback.suggestedTerms);
            List<String> operators = mergeOperators(
                sanitizeOperators(readStringArray(parsed.path("suggestedOperators")), 3),
                fallback.suggestedOperators
            );
            SearchRequestDTO.SearchFiltersDTO suggestedFilters =
                mergeFilters(readFilters(parsed.path("suggestedFilters")), fallback.suggestedFilters);
            SearchAssistantResponseDTO.AutoPlanDTO autoPlan = resolveAutoPlan(
                parsed.path("autoPlan"),
                terms,
                operators,
                suggestedFilters,
                fallback.autoPlan
            );
            List<String> tips = mergeTips(readStringArray(parsed.path("tips")), fallback.tips);

            return SearchAssistantResponseDTO.builder()
                .reply(reply.isBlank() ? fallback.reply : reply)
                .suggestedTerms(terms)
                .suggestedOperators(operators)
                .suggestedFilters(suggestedFilters)
                .autoPlan(autoPlan)
                .canAutoApply(autoPlan != null && autoPlan.getTerms() != null && !autoPlan.getTerms().isEmpty())
                .tips(tips)
                .usedAi(true)
                .fallbackUsed(false)
                .build();
        } catch (Exception ex) {
            log.warn("Search assistant AI parse error, using fallback", ex);
            return fallback.toResponse(false, true);
        }
    }

    private FallbackBundle buildFallbackBundle(
        String message,
        List<String> selectedTerms,
        List<String> recentTerms,
        List<String> selectedOperators,
        SearchRequestDTO.SearchFiltersDTO baseFilters
    ) {
        LinkedHashSet<String> candidateTerms = new LinkedHashSet<>();
        for (String term : selectedTerms) {
            candidateTerms.add(term);
        }
        for (String term : recentTerms) {
            candidateTerms.add(term);
        }
        for (String token : extractKeywordTokens(message)) {
            String mapped = meshMapper.mapToMeshTerm(token);
            candidateTerms.add(mapped != null && !mapped.isBlank() ? mapped : token);
        }

        List<SearchAssistantResponseDTO.SuggestedTermDTO> terms = new ArrayList<>();
        for (String candidate : candidateTerms) {
            if (candidate == null || candidate.isBlank()) {
                continue;
            }
            if (terms.size() >= 4) {
                break;
            }
            terms.add(toSuggestedTerm(candidate, "Termino recomendado segun contexto de consulta"));
        }

        if (terms.size() < 4 && !message.isBlank()) {
            try {
                List<PubMedApiService.MeshSuggestion> meshSuggestions =
                    pubMedApiService.getSuggestedMeshTerms(message, 4 - terms.size());
                for (PubMedApiService.MeshSuggestion suggestion : meshSuggestions) {
                    if (terms.size() >= 4) {
                        break;
                    }
                    if (suggestion == null || suggestion.term() == null || suggestion.term().isBlank()) {
                        continue;
                    }
                    if (containsTerm(terms, suggestion.term())) {
                        continue;
                    }
                    terms.add(
                        SearchAssistantResponseDTO.SuggestedTermDTO.builder()
                            .id(suggestion.id() != null && !suggestion.id().isBlank()
                                ? suggestion.id()
                                : suggestion.term().toUpperCase(Locale.ROOT).replace(' ', '_'))
                            .term(suggestion.term())
                            .description(
                                suggestion.description() != null && !suggestion.description().isBlank()
                                    ? suggestion.description()
                                    : "Sugerencia MeSH sugerida por PubMed"
                            )
                            .build()
                    );
                }
            } catch (Exception ex) {
                log.debug("Unable to enrich assistant terms with MeSH suggestions", ex);
            }
        }

        List<String> operators = selectedOperators.isEmpty() ? List.of("AND") : selectedOperators;
        SearchRequestDTO.SearchFiltersDTO suggestedFilters = sanitizeFilters(baseFilters);
        List<String> tips = List.of(
            "Usa AND para acotar y OR para ampliar resultados.",
            "Prioriza revisiones sistematicas y metaanalisis cuando existan.",
            "Ajusta rango de anos para mantener evidencia clinica actual."
        );
        String reply = "No hay conexion activa con un modelo IA externo o local. " +
            "Configura GEMINI_API_KEY (o GOOGLE_AI_API_KEY) o GROQ_API_KEY/LLM_API_KEY y reinicia backend, " +
            "o habilita Ollama en http://localhost:11434/v1.";
        SearchAssistantResponseDTO.AutoPlanDTO autoPlan = buildAutoPlan(
            terms,
            operators,
            suggestedFilters,
            "Plan sugerido para mejorar precision y actualidad de evidencia."
        );

        return new FallbackBundle(reply, terms, operators, suggestedFilters, autoPlan, tips);
    }

    private String buildPrompt(
        String message,
        List<String> selectedTerms,
        List<String> recentTerms,
        List<String> selectedOperators,
        SearchRequestDTO.SearchFiltersDTO filters,
        FallbackBundle fallback
    ) {
        String currentTerms = selectedTerms.isEmpty() ? "[]" : selectedTerms.toString();
        String recent = recentTerms.isEmpty() ? "[]" : recentTerms.toString();
        String operators = selectedOperators.isEmpty() ? "[]" : selectedOperators.toString();
        int currentYear = LocalDate.now().getYear();

        return """
            Devuelve SOLO un JSON valido.
            Esquema exacto:
            {
              "reply": "string",
              "suggestedTerms": [{"term":"string","description":"string"}],
              "suggestedOperators": ["AND","OR","NOT"],
              "suggestedFilters": {
                "yearFrom": number,
                "yearTo": number,
                "language": "eng|spa|por",
                "hasFullText": boolean,
                "maxResults": number
              },
              "autoPlan": {
                "terms": ["string"],
                "operators": ["AND","OR","NOT"],
                "filters": {
                  "yearFrom": number,
                  "yearTo": number,
                  "language": "eng|spa|por",
                  "hasFullText": boolean,
                  "maxResults": number
                },
                "rationale": "string"
              },
              "tips": ["string"]
            }
            Reglas:
            - maximo 4 suggestedTerms
            - maximo 4 autoPlan.terms
            - maximo 3 tips
            - no markdown ni texto fuera del JSON
            - respuesta en espanol clinico claro
            - yearTo no mayor a %d
            Contexto:
            Mensaje usuario: %s
            Terminos actuales: %s
            Operadores actuales: %s
            Terminos recientes: %s
            Filtros actuales: yearFrom=%s, yearTo=%s, language=%s, hasFullText=%s, maxResults=%s
            Terminos fallback sugeridos: %s
            """.formatted(
            currentYear,
            safe(message),
            safe(currentTerms),
            safe(operators),
            safe(recent),
            String.valueOf(filters.getYearFrom()),
            String.valueOf(filters.getYearTo()),
            String.valueOf(filters.getLanguage()),
            String.valueOf(filters.getHasFullText()),
            String.valueOf(filters.getMaxResults()),
            safe(fallback.suggestedTerms.stream().map(SearchAssistantResponseDTO.SuggestedTermDTO::getTerm).toList().toString())
        );
    }

    private JsonNode parseJsonNode(String raw) throws Exception {
        String text = raw.trim();
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
            text = text.substring(start, end + 1);
        }
        return objectMapper.readTree(text);
    }

    private List<SearchAssistantResponseDTO.SuggestedTermDTO> readSuggestedTerms(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<SearchAssistantResponseDTO.SuggestedTermDTO> result = new ArrayList<>();
        for (JsonNode entry : node) {
            if (result.size() >= 4) {
                break;
            }
            String term = entry.path("term").asText("").trim();
            if (term.isBlank()) {
                continue;
            }
            String description = entry.path("description").asText("Termino sugerido para mejorar precision").trim();
            result.add(toSuggestedTerm(term, description));
        }
        return result;
    }

    private SearchRequestDTO.SearchFiltersDTO readFilters(JsonNode node) {
        if (node == null || !node.isObject()) {
            return null;
        }
        SearchRequestDTO.SearchFiltersDTO filters = new SearchRequestDTO.SearchFiltersDTO();
        if (node.hasNonNull("yearFrom")) {
            filters.setYearFrom(node.path("yearFrom").asInt());
        }
        if (node.hasNonNull("yearTo")) {
            filters.setYearTo(node.path("yearTo").asInt());
        }
        if (node.hasNonNull("language")) {
            filters.setLanguage(node.path("language").asText("").trim().toLowerCase(Locale.ROOT));
        }
        if (node.has("hasFullText")) {
            filters.setHasFullText(node.path("hasFullText").asBoolean(false));
        }
        if (node.hasNonNull("maxResults")) {
            filters.setMaxResults(node.path("maxResults").asInt());
        }
        return sanitizeFilters(filters);
    }

    private SearchAssistantResponseDTO.AutoPlanDTO readAutoPlan(JsonNode node) {
        if (node == null || !node.isObject()) {
            return null;
        }
        List<String> terms = sanitizeTerms(readStringArray(node.path("terms")), 4);
        List<String> operators = sanitizeOperators(readStringArray(node.path("operators")), 3);
        SearchRequestDTO.SearchFiltersDTO filters = readFilters(node.path("filters"));
        String rationale = node.path("rationale").asText("Plan sugerido por el asistente.").trim();
        if (terms.isEmpty()) {
            return null;
        }
        return SearchAssistantResponseDTO.AutoPlanDTO.builder()
            .terms(terms)
            .operators(operators.isEmpty() ? List.of("AND") : operators)
            .filters(filters != null ? filters : sanitizeFilters(null))
            .rationale(rationale.isBlank() ? "Plan sugerido por el asistente." : rationale)
            .build();
    }

    private SearchAssistantResponseDTO.AutoPlanDTO resolveAutoPlan(
        JsonNode aiNode,
        List<SearchAssistantResponseDTO.SuggestedTermDTO> suggestedTerms,
        List<String> suggestedOperators,
        SearchRequestDTO.SearchFiltersDTO suggestedFilters,
        SearchAssistantResponseDTO.AutoPlanDTO fallbackPlan
    ) {
        SearchAssistantResponseDTO.AutoPlanDTO aiPlan = readAutoPlan(aiNode);
        if (aiPlan == null) {
            return fallbackPlan;
        }
        List<String> terms = sanitizeTerms(aiPlan.getTerms(), 4);
        if (terms.isEmpty()) {
            terms = sanitizeTerms(
                suggestedTerms.stream().map(SearchAssistantResponseDTO.SuggestedTermDTO::getTerm).toList(),
                4
            );
        }
        List<String> operators = sanitizeOperators(aiPlan.getOperators(), 3);
        if (operators.isEmpty()) {
            operators = suggestedOperators;
        }
        SearchRequestDTO.SearchFiltersDTO filters = mergeFilters(aiPlan.getFilters(), suggestedFilters);
        String rationale = aiPlan.getRationale() != null ? aiPlan.getRationale().trim() : "";
        if (rationale.isBlank()) {
            rationale = "Plan sugerido por IA para aplicar ajustes de consulta en un solo paso.";
        }
        return SearchAssistantResponseDTO.AutoPlanDTO.builder()
            .terms(terms)
            .operators(operators.isEmpty() ? List.of("AND") : operators)
            .filters(filters)
            .rationale(rationale)
            .build();
    }

    private SearchAssistantResponseDTO.AutoPlanDTO buildAutoPlan(
        List<SearchAssistantResponseDTO.SuggestedTermDTO> suggestedTerms,
        List<String> suggestedOperators,
        SearchRequestDTO.SearchFiltersDTO suggestedFilters,
        String rationale
    ) {
        List<String> terms = sanitizeTerms(
            suggestedTerms.stream().map(SearchAssistantResponseDTO.SuggestedTermDTO::getTerm).toList(),
            4
        );
        return SearchAssistantResponseDTO.AutoPlanDTO.builder()
            .terms(terms)
            .operators(suggestedOperators == null || suggestedOperators.isEmpty() ? List.of("AND") : suggestedOperators)
            .filters(sanitizeFilters(suggestedFilters))
            .rationale(rationale)
            .build();
    }

    private List<String> readStringArray(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        for (JsonNode entry : node) {
            String value = entry.asText("").trim();
            if (!value.isBlank()) {
                values.add(value);
            }
        }
        return values;
    }

    private SearchAssistantResponseDTO.SuggestedTermDTO toSuggestedTerm(String term, String description) {
        String normalizedTerm = term.trim();
        return SearchAssistantResponseDTO.SuggestedTermDTO.builder()
            .id(normalizedTerm.toUpperCase(Locale.ROOT).replace(' ', '_'))
            .term(normalizedTerm)
            .description(description)
            .build();
    }

    private List<SearchAssistantResponseDTO.SuggestedTermDTO> mergeTerms(
        List<SearchAssistantResponseDTO.SuggestedTermDTO> primary,
        List<SearchAssistantResponseDTO.SuggestedTermDTO> fallback
    ) {
        List<SearchAssistantResponseDTO.SuggestedTermDTO> merged = new ArrayList<>();
        for (SearchAssistantResponseDTO.SuggestedTermDTO item : primary) {
            if (merged.size() >= 4) break;
            if (!containsTerm(merged, item.getTerm())) {
                merged.add(item);
            }
        }
        for (SearchAssistantResponseDTO.SuggestedTermDTO item : fallback) {
            if (merged.size() >= 4) break;
            if (!containsTerm(merged, item.getTerm())) {
                merged.add(item);
            }
        }
        return merged;
    }

    private boolean containsTerm(List<SearchAssistantResponseDTO.SuggestedTermDTO> terms, String value) {
        if (value == null) return false;
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return terms.stream()
            .anyMatch(item -> item.getTerm() != null && item.getTerm().trim().toLowerCase(Locale.ROOT).equals(normalized));
    }

    private List<String> mergeOperators(List<String> primary, List<String> fallback) {
        List<String> merged = new ArrayList<>(primary);
        for (String op : fallback) {
            if (merged.size() >= 3) break;
            if (!merged.contains(op)) {
                merged.add(op);
            }
        }
        return merged.isEmpty() ? List.of("AND") : merged;
    }

    private SearchRequestDTO.SearchFiltersDTO mergeFilters(
        SearchRequestDTO.SearchFiltersDTO primary,
        SearchRequestDTO.SearchFiltersDTO fallback
    ) {
        if (fallback == null) {
            fallback = sanitizeFilters(null);
        }
        if (primary == null) {
            return sanitizeFilters(fallback);
        }
        SearchRequestDTO.SearchFiltersDTO merged = sanitizeFilters(primary);
        if (merged.getYearFrom() == null) merged.setYearFrom(fallback.getYearFrom());
        if (merged.getYearTo() == null) merged.setYearTo(fallback.getYearTo());
        if (merged.getLanguage() == null || merged.getLanguage().isBlank()) merged.setLanguage(fallback.getLanguage());
        if (merged.getHasFullText() == null) merged.setHasFullText(fallback.getHasFullText());
        if (merged.getMaxResults() == null) merged.setMaxResults(fallback.getMaxResults());
        return sanitizeFilters(merged);
    }

    private List<String> mergeTips(List<String> primary, List<String> fallback) {
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String tip : primary) {
            if (unique.size() >= 3) break;
            if (!tip.isBlank()) unique.add(tip);
        }
        for (String tip : fallback) {
            if (unique.size() >= 3) break;
            if (!tip.isBlank()) unique.add(tip);
        }
        return unique.isEmpty() ? fallback : new ArrayList<>(unique);
    }

    private List<String> sanitizeTerms(List<String> source, int maxItems) {
        if (source == null || source.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String item : source) {
            if (item == null) continue;
            String normalized = item.trim();
            if (normalized.isBlank()) continue;
            unique.add(normalized);
            if (unique.size() >= maxItems) break;
        }
        return new ArrayList<>(unique);
    }

    private List<String> sanitizeOperators(List<String> operators, int maxItems) {
        if (operators == null || operators.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String op : operators) {
            if (op == null) continue;
            String normalized = op.trim().toUpperCase(Locale.ROOT);
            if (!VALID_OPERATORS.contains(normalized)) continue;
            unique.add(normalized);
            if (unique.size() >= maxItems) break;
        }
        return new ArrayList<>(unique);
    }

    private SearchRequestDTO.SearchFiltersDTO sanitizeFilters(SearchRequestDTO.SearchFiltersDTO filters) {
        SearchRequestDTO.SearchFiltersDTO sanitized = new SearchRequestDTO.SearchFiltersDTO();
        int currentYear = LocalDate.now().getYear();

        Integer yearFrom = filters != null ? filters.getYearFrom() : null;
        Integer yearTo = filters != null ? filters.getYearTo() : null;
        int defaultFrom = currentYear - 8;
        int safeFrom = yearFrom != null ? clamp(yearFrom, 1900, currentYear) : defaultFrom;
        int safeTo = yearTo != null ? clamp(yearTo, 1900, currentYear) : currentYear;
        if (safeFrom > safeTo) {
            int tmp = safeFrom;
            safeFrom = safeTo;
            safeTo = tmp;
        }

        String language = filters != null ? filters.getLanguage() : null;
        String safeLanguage = language == null ? "eng" : language.trim().toLowerCase(Locale.ROOT);
        if (!safeLanguage.equals("eng") && !safeLanguage.equals("spa") && !safeLanguage.equals("por")) {
            safeLanguage = "eng";
        }

        Integer maxResults = filters != null ? filters.getMaxResults() : null;
        int safeMaxResults = maxResults != null ? clamp(maxResults, 5, 100) : 30;

        Boolean fullText = filters != null ? filters.getHasFullText() : null;

        sanitized.setYearFrom(safeFrom);
        sanitized.setYearTo(safeTo);
        sanitized.setLanguage(safeLanguage);
        sanitized.setHasFullText(fullText != null ? fullText : Boolean.FALSE);
        sanitized.setMaxResults(safeMaxResults);
        sanitized.setStudyTypes(filters != null ? filters.getStudyTypes() : null);
        sanitized.setMinSampleSize(filters != null ? filters.getMinSampleSize() : null);
        return sanitized;
    }

    private List<String> extractKeywordTokens(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        String normalized = text.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9\\s]", " ");
        String[] parts = TOKEN_SPLIT.split(normalized.trim());
        LinkedHashSet<String> tokens = new LinkedHashSet<>();
        Set<String> stopwords = Set.of(
            "the", "and", "for", "with", "that", "this", "from",
            "para", "como", "donde", "sobre", "entre", "desde", "segun",
            "con", "sin", "por", "que", "los", "las", "del", "una", "uno", "quiero", "buscar"
        );
        for (String part : parts) {
            if (part.length() < 4) continue;
            if (stopwords.contains(part)) continue;
            tokens.add(part);
            if (tokens.size() >= 6) break;
        }
        return new ArrayList<>(tokens);
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private String safe(String value) {
        return value == null ? "" : value.replace("\n", " ").trim();
    }

    private record FallbackBundle(
        String reply,
        List<SearchAssistantResponseDTO.SuggestedTermDTO> suggestedTerms,
        List<String> suggestedOperators,
        SearchRequestDTO.SearchFiltersDTO suggestedFilters,
        SearchAssistantResponseDTO.AutoPlanDTO autoPlan,
        List<String> tips
    ) {
        private SearchAssistantResponseDTO toResponse(boolean usedAi, boolean fallbackUsed) {
            return SearchAssistantResponseDTO.builder()
                .reply(reply)
                .suggestedTerms(suggestedTerms)
                .suggestedOperators(suggestedOperators)
                .suggestedFilters(suggestedFilters)
                .autoPlan(autoPlan)
                .canAutoApply(autoPlan != null && autoPlan.getTerms() != null && !autoPlan.getTerms().isEmpty())
                .tips(tips)
                .usedAi(usedAi)
                .fallbackUsed(fallbackUsed)
                .build();
        }
    }
}
