package com.uci.competencia.util;

import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Utilidad para calcular similitud semántica entre textos
 * 
 * Usada para:
 * - Comparar claims contra snippets de artículos
 * - Detectar postura (stance detection)
 * - Calcular relevancia de evidencia
 */
@Component
public class SimilarityCalculator {
    
    /**
     * Calcula similitud coseno entre dos textos
     * 
     * Valores:
     * - 0.0 = No relacionados
     * - 0.5 = Parcialmente relacionados
     * - 1.0 = Idénticos
     * 
     * @param text1 Primer texto
     * @param text2 Segundo texto
     * @return Similitud (0-1)
     */
    public double cosineSimilarity(String text1, String text2) {
        if (text1 == null || text2 == null || text1.isEmpty() || text2.isEmpty()) {
            return 0.0;
        }
        
        // Crear vectores de palabras
        Map<String, Integer> vector1 = createTermVector(text1);
        Map<String, Integer> vector2 = createTermVector(text2);
        
        // Calcular producto escalar
        double dotProduct = calculateDotProduct(vector1, vector2);
        
        // Calcular magnitudes
        double magnitude1 = calculateMagnitude(vector1);
        double magnitude2 = calculateMagnitude(vector2);
        
        if (magnitude1 == 0 || magnitude2 == 0) {
            return 0.0;
        }
        
        // Similitud coseno = producto escalar / (magnitud1 * magnitud2)
        return dotProduct / (magnitude1 * magnitude2);
    }
    
    /**
     * Calcula similitud Jaccard entre dos textos
     * 
     * @param text1 Primer texto
     * @param text2 Segundo texto
     * @return Similitud (0-1)
     */
    public double jaccardSimilarity(String text1, String text2) {
        if (text1 == null || text2 == null) {
            return 0.0;
        }
        
        Set<String> set1 = new HashSet<>(tokenize(text1));
        Set<String> set2 = new HashSet<>(tokenize(text2));
        
        if (set1.isEmpty() && set2.isEmpty()) {
            return 1.0;
        }
        
        Set<String> intersection = new HashSet<>(set1);
        intersection.retainAll(set2);
        
        Set<String> union = new HashSet<>(set1);
        union.addAll(set2);
        
        return (double) intersection.size() / union.size();
    }
    
    /**
     * Calcula similitud combinada (promedio ponderado)
     * 
     * @param text1 Primer texto
     * @param text2 Segundo texto
     * @param cosineWeight Peso para similitud coseno (0-1)
     * @return Similitud combinada (0-1)
     */
    public double combinedSimilarity(String text1, String text2, double cosineWeight) {
        double cosine = cosineSimilarity(text1, text2);
        double jaccard = jaccardSimilarity(text1, text2);
        
        return (cosine * cosineWeight) + (jaccard * (1 - cosineWeight));
    }
    
    /**
     * Detecta la postura (stance) de text2 hacia text1
     * 
     * Retorna:
     * - SUPPORT (> 0.6): text2 apoya/confirma text1
     * - CONTRADICT (< 0.4): text2 contradice text1
     * - NEUTRAL (0.4-0.6): text2 es neutral
     * 
     * @param claim Afirmación a verificar
     * @param evidence Evidencia para comparar
     * @return Postura detectada
     */
    public StanceDetection detectStance(String claim, String evidence) {
        if (claim == null || evidence == null) {
            return new StanceDetection(Stance.NEUTRAL, 0.5);
        }
        
        // Análisis de similitud
        double similarity = combinedSimilarity(claim, evidence, 0.7);
        
        // Análisis de negación
        boolean claimHasNegation = containsNegation(claim);
        boolean evidenceHasNegation = containsNegation(evidence);
        
        // Análisis de entidades nombradas
        double entityOverlap = calculateEntityOverlap(claim, evidence);
        
        // Score final ajustado por negación
        double adjustedScore = similarity;
        
        if (claimHasNegation != evidenceHasNegation && entityOverlap > 0.5) {
            // Presencia diferencial de negación = contradicción
            adjustedScore = 1.0 - similarity;
        }
        
        // Determinar postura
        Stance stance;
        if (adjustedScore > 0.65) {
            stance = Stance.SUPPORT;
        } else if (adjustedScore < 0.35) {
            stance = Stance.CONTRADICT;
        } else {
            stance = Stance.NEUTRAL;
        }
        
        return new StanceDetection(stance, adjustedScore);
    }
    
    /**
     * Crea vector de términos (bag of words)
     */
    private Map<String, Integer> createTermVector(String text) {
        Map<String, Integer> vector = new HashMap<>();
        List<String> tokens = tokenize(text);
        
        for (String token : tokens) {
            vector.put(token, vector.getOrDefault(token, 0) + 1);
        }
        
        return vector;
    }
    
    /**
     * Tokeniza texto en palabras
     */
    private List<String> tokenize(String text) {
        if (text == null) {
            return new ArrayList<>();
        }
        
        String[] words = text.toLowerCase()
            .replaceAll("[^a-z0-9\\s]", "")
            .split("\\s+");
        
        List<String> tokens = new ArrayList<>();
        for (String word : words) {
            if (!word.isEmpty() && !isStopword(word)) {
                tokens.add(word);
            }
        }
        
        return tokens;
    }
    
    /**
     * Determina si una palabra es stopword
     */
    private boolean isStopword(String word) {
        Set<String> stopwords = Set.of(
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
            "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
            "el", "la", "los", "las", "de", "y", "o", "pero", "en", "con", "por"
        );
        return stopwords.contains(word);
    }
    
    /**
     * Calcula producto escalar entre dos vectores
     */
    private double calculateDotProduct(Map<String, Integer> v1, Map<String, Integer> v2) {
        double product = 0;
        for (String term : v1.keySet()) {
            if (v2.containsKey(term)) {
                product += v1.get(term) * v2.get(term);
            }
        }
        return product;
    }
    
    /**
     * Calcula magnitud de un vector
     */
    private double calculateMagnitude(Map<String, Integer> vector) {
        double sumOfSquares = 0;
        for (int value : vector.values()) {
            sumOfSquares += value * value;
        }
        return Math.sqrt(sumOfSquares);
    }
    
    /**
     * Detecta si el texto contiene negación
     */
    private boolean containsNegation(String text) {
        if (text == null) return false;
        String lower = text.toLowerCase();
        return lower.contains("not") || lower.contains("no ") || 
               lower.contains("neither") || lower.contains("nor") ||
               lower.contains("never") || lower.contains("cannot") ||
               lower.contains("no hay") || lower.contains("no es");
    }
    
    /**
     * Calcula solapamiento de entidades nombradas
     * (Implementación simplificada)
     */
    private double calculateEntityOverlap(String text1, String text2) {
        List<String> tokens1 = tokenize(text1);
        List<String> tokens2 = tokenize(text2);
        
        if (tokens1.isEmpty() || tokens2.isEmpty()) {
            return 0;
        }
        
        long commonTokens = tokens1.stream()
            .filter(tokens2::contains)
            .count();
        
        return (double) commonTokens / Math.max(tokens1.size(), tokens2.size());
    }
    
    /**
     * Postura detectada
     */
    public static class StanceDetection {
        public Stance stance;
        public double score;
        
        public StanceDetection(Stance stance, double score) {
            this.stance = stance;
            this.score = score;
        }
    }
    
    /**
     * Tipos de postura
     */
    public enum Stance {
        SUPPORT("Apoya el claim"),
        CONTRADICT("Contradice el claim"),
        NEUTRAL("Neutral respecto al claim");
        
        private final String description;
        
        Stance(String description) {
            this.description = description;
        }
        
        public String getDescription() {
            return description;
        }
    }
}
